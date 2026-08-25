// THE REPRODUCIBLE for #43 — a red commit can still reach origin.
//
//   node test/push-gate.test.mjs
//
// #42 recorded the failure: `d0450ca` was green, a header edit made `containment`
// fail, and the `&&` chain pushed anyway because the failure was in an earlier line
// of the same command's output. The author DID run the suite. What was missing was
// anything that conditioned the push on its EXIT CODE rather than on someone reading
// scrollback, so this file tests the gate's exit status and never its wording.
//
// Three root causes.
//
// RC1 — nothing runs on push. `.git/hooks` holds only samples and `core.hooksPath`
//   is unset, so every guard in the repo fires when a person types the command.
//
// RC2 — the failure was not a forgotten run. It was a run whose result did not bind
//   anything. A gate that prints a warning and exits 0 reproduces it exactly.
//
// RC3 — a hook in `.git/hooks/` is untracked. It cannot be reviewed, cannot be
//   cloned, and is absent on the next machine — the same works-here-only class as
//   the corpus defect fixed in `ebb630a`. So the hook must live in a tracked
//   directory, and `core.hooksPath` is what activates it.
//
// BOTH DIRECTIONS ARE TESTED. A gate proven only to refuse is indistinguishable from
// a gate that refuses everything, which would be discovered the first time it blocked
// a good push and then disabled. Red must refuse AND green must pass.
//
// The gate is exercised against a STUB suite in a throwaway repo, not against this
// repo's real suite. That keeps the test fast, keeps it from running the whole suite
// recursively inside a suite run, and — the point — lets the red case be genuinely
// red without breaking anything here.

import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync, chmodSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const HOOK_DIR = join(ROOT, '.githooks')
const HOOK = join(HOOK_DIR, 'pre-push')

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }

// ---------------------------------------------------------------------------
// RC3 — the hook is tracked, so it survives a clone and can be reviewed.
// ---------------------------------------------------------------------------

console.log('push-gate: the hook is a tracked file, not a local-only one')
if (!existsSync(HOOK)) {
  fail(`no hook at .githooks/pre-push — a hook written into .git/hooks instead is untracked, unreviewable, and absent on the next clone, which is the works-here-only class ebb630a came from`)
} else {
  // Executable bit, because git runs it directly rather than through a shell.
  const mode = statSync(HOOK).mode
  if (!(mode & 0o111)) fail('.githooks/pre-push is not executable — git will not run it')

  const tracked = spawnSync('git', ['ls-files', '--error-unmatch', '.githooks/pre-push'], { cwd: ROOT, encoding: 'utf8' })
  if (tracked.status !== 0) fail('.githooks/pre-push exists but is not tracked by git — an untracked gate is one `git clean` from gone and never reaches a second machine')
}

// ---------------------------------------------------------------------------
// RC1/RC2 — the gate binds the push to the suite's EXIT CODE, both ways.
//
// A throwaway git repo with a stub `test/run-all.mjs` whose exit code this test
// chooses. The real hook runs there, so what is measured is the hook's own logic.
// ---------------------------------------------------------------------------

function gateExitsWith(suiteExitCode) {
  const dir = mkdtempSync(join(tmpdir(), 'push-gate-'))
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir })
    mkdirSync(join(dir, 'test'), { recursive: true })
    // The stub prints on both streams, because the failure this gate exists to catch
    // was one whose output was READ and missed. Output must not be what decides.
    writeFileSync(join(dir, 'test', 'run-all.mjs'),
      `console.log('stub suite: some passing line')\n` +
      `console.error('stub suite: a failure buried in earlier output')\n` +
      `process.exit(${suiteExitCode})\n`)
    const r = spawnSync(HOOK, [], {
      cwd: dir,
      encoding: 'utf8',
      input: '',                       // git feeds refs on stdin; none here
      env: { ...process.env, PATH: process.env.PATH },
    })
    return { code: r.status, out: String(r.stdout || '') + String(r.stderr || '') }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

if (existsSync(HOOK)) {
  console.log('push-gate: a red suite refuses the push')
  const red = gateExitsWith(1)
  console.log(`          suite exit 1 -> gate exit ${red.code}`)
  if (red.code === 0) {
    fail('the gate allowed a push while the suite exited 1 — this is d0450ca exactly: the suite ran, the result bound nothing')
  }

  console.log('push-gate: a green suite allows the push')
  const green = gateExitsWith(0)
  console.log(`          suite exit 0 -> gate exit ${green.code}`)
  if (green.code !== 0) {
    fail(`the gate refused a push while the suite exited 0 (gate exit ${green.code}) — a gate that blocks good pushes gets disabled, and a disabled gate is the state this issue is about`)
  }
}

// ---------------------------------------------------------------------------
// THE RESIDUAL, stated on the branch that carries the verdict.
//
// A tracked hook file is not an ACTIVE hook. git runs `.git/hooks/` unless
// core.hooksPath says otherwise, and core.hooksPath is local config that no
// committed file can set. So this suite can prove the gate is correct and cannot
// prove it is switched on — here or anywhere else.
// ---------------------------------------------------------------------------

console.log('push-gate: reporting whether the gate is ACTIVE on this machine')
{
  const hp = spawnSync('git', ['config', '--get', 'core.hooksPath'], { cwd: ROOT, encoding: 'utf8' })
  const path = String(hp.stdout || '').trim()
  if (path === '.githooks') {
    console.log('          core.hooksPath = .githooks — active here')
  } else {
    console.log(`          NOT ACTIVE here: core.hooksPath is ${path ? `"${path}"` : 'unset'}, so git runs .git/hooks/ and this gate does not fire.`)
    console.log('          Activate with:  git config core.hooksPath .githooks')
    console.log('          This is NOT asserted. core.hooksPath is local config; no committed file can set it, so a')
    console.log('          check that failed here would fail on every fresh clone and would be turned off rather than fixed.')
  }
}

if (failures) {
  console.error(`\npush-gate: ${failures} failure(s) — nothing binds a push to the suite's exit code.`)
  process.exit(1)
}
console.log('\npush-gate: OK — the gate refuses red, allows green, and is tracked.')
