// A sweep verdict is mutate's exit code, and mutate's CAUGHT is "the check exited
// nonzero" — so a check red BEFORE any mutation grades every property CAUGHT and the
// sweep publishes a clean coverage report about a tree whose suite cannot pass.
//
//   node test/coverage-baseline.test.mjs
//
// THE REPRODUCIBLE, built before the fix. With one deliberately failing test present:
//
//   - the same uncovered comment edit read NOT CAUGHT on a green tree and CAUGHT on the
//     red one — the verdict flipped without the mutation or its coverage changing;
//   - `node scripts/coverage-sweep.mjs 'a reference is required'` printed
//     "CAUGHT ... 1 properties — 0 unpinned" and exited 0.
//
// coverage.yml had already named the class at its checkout step ("a suite red before
// the mutation is red after it") and guarded exactly one cause of it — a shallow clone.
// A guard placed where something once broke leaves every other cause unguarded; the
// baseline run in runSweep is the mechanism, and this file is what makes it falsifiable.
//
// EVERYTHING HERE DRIVES runSweep IN-PROCESS with a substitute check command, because
// test/coverage-cadence.test.mjs fails any test that spawns the sweep — a real
// invocation costs a suite run per property. The mutations land on a scratch file in
// the temp directory, never on the tree, so a real sweep mutating a repo file cannot
// collide with this suite running inside it.

import { runSweep } from '../scripts/coverage-sweep.mjs'
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }

const dir = mkdtempSync(join(tmpdir(), 'coverage-baseline-'))
const subject = join(dir, 'subject.txt')
const seed = 'NEEDLE-ALPHA lives here\n'
writeFileSync(subject, seed)
const prop = ['scratch: the needle is present', subject, 'NEEDLE-ALPHA', 'NEEDLE-GONE']

// The run page must get the refusal, and IN CI THIS SUITE RUNS WITH THE REAL
// GITHUB_STEP_SUMMARY SET — left alone, every runSweep call here would append a fake
// summary to the actual run page. Pointed at a scratch file for the whole suite.
const summaryFile = join(dir, 'summary.md')
const savedSummary = process.env.GITHUB_STEP_SUMMARY
process.env.GITHUB_STEP_SUMMARY = summaryFile

const drive = opts => {
  const lines = []
  const sink = m => lines.push(String(m))
  const r = runSweep({ properties: [prop], log: sink, err: sink, ...opts })
  return { r, text: lines.join('\n') }
}
const exit0 = [process.execPath, '-e', 'process.exit(0)']
const exit1 = [process.execPath, '-e', 'process.exit(1)']

try {
  console.log('coverage-baseline: a red baseline refuses the whole sweep before anything is mutated')
  {
    writeFileSync(summaryFile, '')
    const { r, text } = drive({ check: exit1 })
    ok(r.exitCode === 2, `expected exit 2, got ${r.exitCode}`)
    ok(/red on the unmutated tree/.test(text), `the refusal does not say the tree was red before any mutation. Output: ${JSON.stringify(text.slice(0, 200))}`)
    ok(!/^CAUGHT/m.test(text), 'a verdict line was printed — the sweep graded a property against a red baseline')
    ok(readFileSync(subject, 'utf8') === seed, 'the scratch subject was mutated — the refusal did not come before the mutations')
    const summary = readFileSync(summaryFile, 'utf8')
    ok(/REFUSED/.test(summary) && summary.includes(exit1.join(' ')),
       'the refusal never reached the run-page summary — an exit code with no rendered reason is the shape #46 was filed on')
  }

  console.log('coverage-baseline: a baseline that could not run is a crash, not a red tree')
  {
    const { r, text } = drive({ check: ['/nonexistent-baseline-check-e5b1'] })
    ok(r.exitCode === 2, `expected exit 2, got ${r.exitCode}`)
    ok(/could not run/.test(text), `the crash is not reported as a crash. Output: ${JSON.stringify(text.slice(0, 200))}`)
    ok(!/red on the unmutated tree/.test(text), 'a check that never ran was reported as a red tree — the two need opposite repairs')
  }

  console.log('coverage-baseline: a hanging baseline is killed and reported as a hang')
  {
    const savedTimeout = process.env.MUTATE_CHECK_TIMEOUT_MS
    process.env.MUTATE_CHECK_TIMEOUT_MS = '400'
    let out
    try { out = drive({ check: [process.execPath, '-e', 'setInterval(() => {}, 1000)'] }) }
    finally { if (savedTimeout === undefined) delete process.env.MUTATE_CHECK_TIMEOUT_MS; else process.env.MUTATE_CHECK_TIMEOUT_MS = savedTimeout }
    ok(out.r.exitCode === 2, `expected exit 2, got ${out.r.exitCode}`)
    ok(/not a verdict about the tree/.test(out.text), `a hang is not reported as a hang. Output: ${JSON.stringify(out.text.slice(0, 200))}`)
  }

  console.log('coverage-baseline: a green baseline lets the sweep grade, and an uncovered mutation still reads NOT CAUGHT')
  {
    const { r, text } = drive({ check: exit0 })
    ok(r.exitCode === 1, `expected exit 1, got ${r.exitCode}`)
    ok(/NOT CAUGHT/.test(text), 'a mutation nothing checks did not read NOT CAUGHT — the fix must not turn every verdict into a refusal')
    ok(/exited 0 on the unmutated tree/.test(text), 'the green branch does not say the baseline it established')
    ok(/still lands on whichever mutation is being graded/.test(text),
       'the residual is missing from the branch that grades — the baseline is checked once, and a mid-sweep failure still reads as CAUGHT; the branch carrying verdicts is the branch that must say so')
  }

  console.log('coverage-baseline: the same check, green before and red after the mutation, is what CAUGHT means')
  {
    const looks = [process.execPath, '-e',
      `process.exit(require('fs').readFileSync(${JSON.stringify(subject)}, 'utf8').includes('NEEDLE-ALPHA') ? 0 : 1)`]
    const { r, text } = drive({ check: looks })
    ok(r.exitCode === 0, `expected exit 0, got ${r.exitCode}`)
    ok(/^CAUGHT/m.test(text), 'a mutation the check sees did not read CAUGHT')
    ok(readFileSync(subject, 'utf8') === seed, 'mutate did not restore the scratch subject')
  }
} finally {
  if (savedSummary === undefined) delete process.env.GITHUB_STEP_SUMMARY
  else process.env.GITHUB_STEP_SUMMARY = savedSummary
  rmSync(dir, { recursive: true, force: true })
}

console.log('coverage-baseline: stating what this suite cannot establish')
console.log('          NOT MEASURED: the CLI wiring (argv -> runSweep -> process.exit) — no test respecting')
console.log('          test/coverage-cadence.test.mjs can spawn the sweep, so a defect there shows only on a')
console.log('          real invocation. NOT MEASURED: the default check command; this file never pays for a')
console.log('          suite run. Its corruption is self-evidencing at sweep runtime — always-red refuses the')
console.log('          sweep, always-green reads every property NOT CAUGHT — but that is argued, not run here.')

if (failures) {
  console.error(`\ncoverage-baseline: ${failures} failure(s) — a red baseline must refuse the sweep, not grade every property CAUGHT.`)
  process.exit(1)
}
console.log('\ncoverage-baseline: OK — the baseline gates the sweep, each refusal names its own cause, and CAUGHT means the mutation turned green red.')
