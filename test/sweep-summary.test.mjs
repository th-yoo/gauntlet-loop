// The sweep's list is one list, and its findings reach a reader.
//
//   node test/sweep-summary.test.mjs
//
// TWO ROOT CAUSES OF #46, and they share a fix.
//
// RC4 — THE COUNT THAT WOULD CATCH DRIFT IS COMPARED AGAINST A HAND-COPIED CONSTANT.
// `test/coverage-cadence.test.mjs` re-parses the PROPERTIES literal out of the sweep's
// SOURCE with a regex, then compares its count against `OBSERVED.entries`, a number
// transcribed from one past run's log and updated by hand. That is two more parsers than
// there is list: the regex went blind once already (114 against 117, three entries opening
// with a double quote), and `test/sweep-needles.test.mjs` added a third parser today. A
// list that is imported cannot be misparsed, and a count that is read cannot be stale.
//
// RC1 — THE VERDICT CHANNEL AND THE FINDING CHANNEL ARE DIFFERENT. The harness watches the
// sweep's exit code; its findings are in stdout, which nothing points at. The instance #46
// was filed on is a run that concluded `success` while its log carried two defects. A
// finding that does not change the exit status is invisible by construction, and the cheap
// half of the repair is to put the summary where the run page shows it.
//
// WHAT THIS FILE CANNOT ESTABLISH: whether anyone reads the run page. That is #46's actual
// claim and no check can carry it.

import { execFileSync } from 'node:child_process'
import { readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SWEEP = join(ROOT, 'scripts', 'coverage-sweep.mjs')

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }

// IMPORTING THE SWEEP MUST NOT RUN IT, and the check is bounded rather than trusting.
// Today importing it starts ~50 minutes of mutation, so this asks in a child process with a
// short timeout: a sweep that runs on import cannot be imported by anything, which is why
// three files ended up re-parsing its source instead.
console.log('sweep-summary: the property list can be imported without running the sweep')
{
  let out = null, timedOut = false
  try {
    out = execFileSync(process.execPath, ['-e',
      `import(${JSON.stringify(SWEEP)}).then(m => console.log(Array.isArray(m.PROPERTIES) ? m.PROPERTIES.length : 'NO EXPORT'))`],
      { encoding: 'utf8', cwd: ROOT, timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch (e) {
    timedOut = e.killed || e.signal === 'SIGTERM' || /ETIMEDOUT/.test(String(e.code))
    out = String(e.stdout || '').trim()
  }
  if (timedOut) {
    fail('importing scripts/coverage-sweep.mjs starts the sweep — so nothing can read its list except by re-parsing its source, which is how one parser went blind and two more were written')
  } else if (out === 'NO EXPORT' || out === '') {
    fail(`scripts/coverage-sweep.mjs does not export PROPERTIES (got ${JSON.stringify(out)}), so every reader of the list is a second parser of the same text`)
  } else if (!Number.isInteger(Number(out)) || Number(out) < 50) {
    fail(`the imported list has ${out} entries, which is fewer than this repo has had for a long time — a reader that imports an empty list audits nothing and reports success`)
  } else {
    console.log(`          ${out} properties, imported`)
  }
}

// AND THE FINDINGS GO SOMEWHERE A READER SEES. Tested by CALLING the renderer rather than
// by scanning for the environment variable's name: a source scan passes on a mention, and
// this repo has fixed that same false pass three times.
//
// IN A CHILD, BOUNDED, for the same reason as the case above — and this file learned it the
// hard way: the first version awaited the import in-process, which started the sweep and
// hung the suite. A test for "importing must not run it" must not import it either.
console.log('sweep-summary: a finding is rendered for the run page, not only for the log')
{
  const probe = `
    import(${JSON.stringify(SWEEP)}).then(m => {
      if (typeof m.renderSummary !== 'function') { console.log('NO RENDER'); return }
      const withFindings = m.renderSummary({ total: 117, missed: 1, refused: 2, findings: [
        { verdict: 'NOT CAUGHT', name: 'a disputed row is excluded from any rate' },
        { verdict: 'COULD NOT RUN', name: 'the cohort key blanks the artifact path out' },
      ] })
      const clean = m.renderSummary({ total: 117, missed: 0, refused: 0, findings: [] })
      console.log(JSON.stringify({ withFindings: String(withFindings), clean: String(clean) }))
    })`
  let out = '', timedOut = false
  try {
    out = execFileSync(process.execPath, ['-e', probe],
      { encoding: 'utf8', cwd: ROOT, timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch (e) {
    timedOut = e.killed || e.signal === 'SIGTERM'
    out = String(e.stdout || '').trim()
  }

  if (timedOut) {
    fail('importing the sweep to call its renderer started the sweep instead')
  } else if (out === 'NO RENDER' || !out) {
    fail('scripts/coverage-sweep.mjs exports no renderSummary(), so its findings exist only in stdout — which is the channel #46 says nothing points at')
  } else {
    let r
    try { r = JSON.parse(out) } catch { r = null }
    if (!r) fail(`the renderer probe printed something unreadable: ${JSON.stringify(out.slice(0, 120))}`)
    else {
      const t = r.withFindings
      if (!/NOT CAUGHT/.test(t) || !/a disputed row is excluded from any rate/.test(t)) {
        fail('the rendered summary does not name the unpinned property, so a reader of the run page learns a number and not which property lost its cover')
      }
      if (!/COULD NOT RUN/.test(t) || !/the cohort key blanks the artifact path out/.test(t)) {
        fail('the rendered summary does not name the property that could not be tested')
      }
      if (!/117/.test(t)) fail('the rendered summary does not carry the count it swept')
      // A GREEN RUN CARRYING NOTHING MUST STILL SAY WHAT IT SWEPT. The instance #46 was
      // filed on is a run that concluded success while its log held two findings; a summary
      // that appeared only on failure would have been absent for exactly that run.
      if (!/117/.test(r.clean)) {
        fail('a clean sweep renders no summary, so a green run says nothing about what it covered — which is the run #46 was filed on')
      }
      if (!failures) console.log('          findings and the swept count are both named')
    }
  }
}

console.log('sweep-summary: stating what this suite cannot establish')
console.log('          NOT MEASURED: whether anyone reads the run page. That is #46\'s actual claim —')
console.log('          a rendered summary nobody opens is the same coverage as a log nobody opens — and')
console.log('          no check in this repo can see it.')

if (failures) {
  console.error(`\nsweep-summary: ${failures} failure(s) — the sweep's list is re-parsed rather than read, or its findings stop at stdout.`)
  process.exit(1)
}
console.log('\nsweep-summary: OK — one list, imported; findings rendered for a reader.')
