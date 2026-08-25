// Apply one mutation, run the suite, report whether anything noticed, restore.
//
//   node scripts/mutate.mjs <file> <find> <replace>
//   node scripts/mutate.mjs <file> <find> <replace> -- node test/loop.test.mjs
//
// Mutation testing is how this repo decides whether a check can fail at all, and
// doing it by hand went wrong five times in one session — every time the same
// way. Three things have to be true before a result means anything, and each was
// skipped at least once:
//
//   1. THE MUTATION APPLIED. A find string that does not match changes nothing,
//      and the suite passes because the code is untouched. Reported as NOT CAUGHT,
//      it condemns a working test. (`dependencies:` for `depends_on:`; a mutation
//      target that did not exist in the file at all.)
//   2. THE MUTANT STILL PARSES. A careless replacement produces a syntax error,
//      which fails for a reason that has nothing to do with the check under test —
//      or, worse, fails in a way a narrow grep does not match.
//   3. THE VERDICT IS THE EXIT CODE. Grepping the output for "ASSERT FAILED"
//      misses syntax errors, thrown harness guards, and every other non-zero exit.
//      A suite that dies is not a suite that passed.
//
// The file is always restored, including when the check command dies.
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const argv = process.argv.slice(2)
const sep = argv.indexOf('--')
const [file, find, replace] = sep === -1 ? argv : argv.slice(0, sep)
const check = sep === -1 ? ['node', 'test/run-all.mjs'] : argv.slice(sep + 1)

if (!file || find === undefined || replace === undefined) {
  console.error('usage: node scripts/mutate.mjs <file> <find> <replace> [-- <check command>]')
  process.exit(2)
}

const original = readFileSync(file, 'utf8')

// RESTORE BEFORE EXITING, ALWAYS. `process.exit()` does not run `finally` blocks
// in Node, so the first version of this script — which restored in a `finally` and
// exited inside the `try` — left every mutation it applied sitting in the working
// tree. It corrupted the file it was testing, three times, on its first use. Every
// path out of this script goes through here.
let restored = false
function done(code) {
  if (!restored) { writeFileSync(file, original); restored = true }
  process.exit(code)
}
process.on('exit', () => { if (!restored) writeFileSync(file, original) })
// AND ON A SIGNAL, because 'exit' does not fire for one. A coverage sweep that runs
// past a harness timeout is SIGTERMed mid-mutation, and the mutation stays in the
// working tree looking like source — observed on 2026-08-25, an "&&" left as "||" in
// loop.js, caught only because the suite went red and `git diff` was read. SIGKILL
// still cannot be caught; nothing in a process can cover that, which is why the
// timeout in the check command matters more than this handler.
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
  process.on(sig, () => {
    if (!restored) { writeFileSync(file, original); restored = true }
    console.error(`mutate: ${sig} received — the mutation was restored before exiting. The check result is void.`)
    process.exit(2)
  })
}
const mutated = original.replace(find, replace)

if (mutated === original) {
  console.error(`mutate: the find string does not appear in ${file}, so nothing was changed.`)
  console.error('A suite passing against an unmutated file says nothing about the check you were testing.')
  done(2)
}

writeFileSync(file, mutated)
try {
  if (/\.(mjs|js)$/.test(file)) {
    // Parsed the way the file is ACTUALLY LOADED, which is not the same for every
    // file here and is not what `node --check` assumes:
    //
    //   * A Workflow script (skills/) runs inside an async function with injected
    //     globals, so top-level `return` is legal and `export const meta` is
    //     stripped before loading. test/harness.mjs does exactly this.
    //   * Everything else is an ES module.
    //
    // Both naive gates are wrong for the Workflow script: `node --check` on a .js
    // file in a repo with no package.json returned 0 for a mutant with a stray
    // brace, and the same content checked as .mjs rejects the UNMUTATED file
    // because of its top-level `return`. A gate that passes broken files and one
    // that fails working files are the same defect wearing different signs.
    const isWorkflowScript = file.includes('skills/') && /export const meta/.test(original)
    let syntax = { status: 0, stderr: '' }
    if (isWorkflowScript) {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
      try {
        new AsyncFunction('agent', 'parallel', 'pipeline', 'log', 'phase', 'args', 'budget',
          mutated.replace('export const meta', 'const meta'))
      } catch (e) {
        syntax = { status: 1, stderr: (e && e.message) || String(e) }
      }
    } else {
      const probe = join(tmpdir(), `mutate-syntax-${process.pid}.mjs`)
      writeFileSync(probe, mutated)
      syntax = spawnSync(process.execPath, ['--check', probe], { encoding: 'utf8' })
      try { rmSync(probe, { force: true }) } catch {}
    }
    if (syntax.status !== 0) {
      console.error(`mutate: the mutant does not parse, so the suite would fail for the wrong reason:`)
      console.error(String(syntax.stderr).split('\n').slice(0, 3).join('\n'))
      done(2)
    }
  }
  // TIMEOUT, because a hanging check is how this script corrupted the file it was
  // testing. spawnSync blocks forever, so `done()` is never reached, and the SIGKILL
  // that eventually arrives does not run the exit handler either — the mutation stays
  // in the working tree looking like source. A hang is also not a verdict: it is the
  // "did not run" class below, not NOT CAUGHT.
  const timeoutMs = Number(process.env.MUTATE_CHECK_TIMEOUT_MS || 300_000)
  // GAUNTLET_SUITE, for the same reason run-all sets it. A mutation sweep's whole purpose
  // is to remove a guard and run the check anyway, so this is the run most likely to reach
  // a spawn that the removed guard was in front of. It once did. Env is inherited, so
  // anything the check reaches — at any depth — carries the marker too.
  const r = spawnSync(check[0], check.slice(1), { encoding: 'utf8', timeout: timeoutMs, env: { ...process.env, GAUNTLET_SUITE: '1' } })
  if (r.error && r.error.code === 'ETIMEDOUT') {
    console.error(`mutate: the check command did not finish within ${timeoutMs} ms and was killed.`)
    console.error('A check that hangs has not noticed anything — and a mutation can CAUSE the hang, so this is')
    console.error('not a verdict. Set MUTATE_CHECK_TIMEOUT_MS if the suite is legitimately slower than this.')
    done(2)
  }
  // A check that never RAN is not a check that noticed. spawnSync reports status
  // null when the command could not be spawned or died on a signal, and `null !== 0`
  // is true — so a typo in the check command reported CAUGHT, in the script whose
  // whole purpose is refusing verdicts with no basis. Same class as everything it
  // was written to catch.
  if (r.error || r.status === null) {
    console.error(`mutate: the check command did not run (${(r.error && r.error.message) || 'terminated by signal'}).`)
    console.error('A check that never ran is not evidence that anything noticed the mutation.')
    done(2)
  }
  const caught = r.status !== 0
  console.log(caught ? 'CAUGHT' : 'NOT CAUGHT')
  console.log(`  mutation : ${JSON.stringify(find).slice(0, 70)} -> ${JSON.stringify(replace).slice(0, 40)}`)
  console.log(`  check    : ${check.join(' ')} exited ${r.status}`)
  if (!caught) console.log('  meaning  : nothing in the suite depends on what you just removed.')
  done(caught ? 0 : 1)
} catch (e) {
  console.error(`mutate: ${(e && e.message) || e}`)
  done(2)
}
