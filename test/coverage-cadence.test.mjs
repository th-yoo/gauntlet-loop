// THE REPRODUCIBLE for #45 — coverage-sweep has no cadence.
//
//   node test/coverage-cadence.test.mjs
//
// #42's table listed six guards as hand-triggered. Five turned out to be one
// command: `run-all` discovers `drift-guard.mjs` and every `*.test.mjs`, and
// `oracle-report` and `staleness-trial` are both spawned by `test/oracle.test.mjs`.
// #43 gave that command a pre-push trigger and #44 gave it a foreign machine.
//
// `scripts/coverage-sweep.mjs` is what is left, and it is left for a reason: it
// runs a full suite per property, so it cannot go in either gate. Its own header
// says so and then names a trigger no machine can honour — "run it after touching
// tests, or when a fix stops feeling covered." That is a remembered trigger, which
// is the thing #42 is about, stated in the file that most needs one.
//
// THE COST IS MEASURED, NOT ESTIMATED. #45 said ">10 min". One property was timed
// at ~28s — the same as a whole `run-all`, because that is exactly what it does —
// and the list holds 114 of them. So the real figure is closer to 50 minutes, and
// the conclusion changes with it: this is not merely too slow for a pre-push hook,
// it is too slow for per-push CI as well. The number is recomputed below rather
// than restated, so it cannot go stale the way ">10 min" did.
//
// Root causes.
//
// RC1 — no trigger exists. The only one written down is a human intention.
//
// RC2 — it is too slow for any blocking gate, so "add it to the suite" is not the
//   fix. A gate that adds ~50 minutes to a push gets bypassed, and a bypassed gate
//   is worse than an absent one because the repo reads as covered.
//
// RC3 — being unrunnable in a gate is not a reason to have no cadence. Something
//   that cannot block can still run on a schedule, on a machine nobody is waiting
//   for, and be read afterwards. #45's option 3 — "neither, deliberately, recorded"
//   — stays a real answer, and this file is written so that choosing it means
//   deleting this file with a reason, rather than leaving the question open.

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WF_DIR = join(ROOT, '.github', 'workflows')
const SWEEP = join(ROOT, 'scripts', 'coverage-sweep.mjs')

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, msg) => { if (!cond) fail(msg) }

// THE COUNT IS READ FROM THE PROPERTIES LITERAL, quote style and all.
//
// The first version matched /^ {2}\['/ and reported 114. The sweep itself reported
// 117. Three entries open with a double quote because their own text contains an
// apostrophe — "the builder's failed-attempts note is kept" and two more — so a
// regex that assumed one quote character under-counted by exactly those three.
// Bounding the scan to the literal and matching the bracket rather than the quote
// removes the assumption instead of widening it.
const SWEEP_SRC = readFileSync(SWEEP, 'utf8')
const LITERAL_START = SWEEP_SRC.indexOf('const PROPERTIES = [')
const LITERAL_END = LITERAL_START === -1 ? -1 : SWEEP_SRC.indexOf('\n]', LITERAL_START)
const PROPERTY_COUNT = (LITERAL_START === -1 || LITERAL_END === -1)
  ? 0
  : (SWEEP_SRC.slice(LITERAL_START, LITERAL_END).match(/^ {2}\[/gm) || []).length

// THE COST IS AN OBSERVATION, NOT AN EXTRAPOLATION.
//
// This said `114 x ~28s = ~53 min`, from timing one property locally. The first
// real run took 13m35s for 117 on ubuntu-latest — off by four times, because
// per-entry cost measured one at a time carries startup that does not repeat 117
// times. Multiplying a local sample was the error; the figure below is a run that
// happened, with where it happened, and it is not used to derive anything.
//
// The conclusion is unchanged and does not depend on the precision: a 13-minute
// gate is as unusable in front of a push as a 53-minute one.
const OBSERVED = { minutes: 14, entries: 117, where: 'ubuntu-latest', run: '32900618692' }

console.log('coverage-cadence: the sweep is too slow for a blocking gate')
console.log(`          ${PROPERTY_COUNT} properties in the list; last full run ~${OBSERVED.minutes} min for ${OBSERVED.entries} on ${OBSERVED.where} (run ${OBSERVED.run})`)
ok(PROPERTY_COUNT > 0, 'no properties found in coverage-sweep.mjs — either the list is empty or this scan has gone blind, and those are different situations')
// The scan and the sweep must agree. They disagreed once — 114 here against 117
// there — silently, and the test was the one that was wrong.
//
// TWO THINGS make this fire and the message names both, because a guard that
// diagnoses only the case its author had in mind sends the reader the wrong way:
//   1. this parse went blind to entries the sweep still executes, or
//   2. the list genuinely shrank.
// The second is not a false positive. Coverage-sweep exists because a structural
// edit once removed four cases beyond the one being rewritten and the suite went
// green at a lower count — so a drop in the property count is exactly the event
// worth stopping on, and clearing it means updating OBSERVED on purpose.
ok(PROPERTY_COUNT >= OBSERVED.entries,
   `this scan counts ${PROPERTY_COUNT} properties, and run ${OBSERVED.run} executed ${OBSERVED.entries}. Either this parse is blind to entries the sweep still runs, or the list lost ${OBSERVED.entries - PROPERTY_COUNT} — the second is the silent-coverage-loss this sweep exists to catch. Establish which, then update OBSERVED deliberately.`)

// It must NOT be in run-all. This is asserted in the direction that would actually
// go wrong: someone reads #45, adds the sweep to the suite, and every push becomes
// an hour.
console.log('coverage-cadence: the sweep stays out of the blocking suite')
{
  const suiteFiles = readdirSync(join(ROOT, 'test')).filter(f => f.endsWith('.test.mjs') && f !== 'coverage-cadence.test.mjs')
  for (const f of suiteFiles) {
    const src = readFileSync(join(ROOT, 'test', f), 'utf8')
    // A mention is fine; a spawn is not. Only an actual invocation costs the time.
    if (/(spawnSync|execFileSync|exec|spawn)\s*\([^)]*coverage-sweep/.test(src)) {
      fail(`test/${f} invokes coverage-sweep — that puts ~${OBSERVED.minutes} min into every run of the suite, and a gate that slow gets bypassed`)
    }
  }
  const runAll = readFileSync(join(ROOT, 'test', 'run-all.mjs'), 'utf8')
  ok(!/coverage-sweep/.test(runAll), `test/run-all.mjs names coverage-sweep — the suite is the blocking gate and this does not belong in it`)
}

// ---------------------------------------------------------------------------
// THE CADENCE ITSELF.
//
// Unrunnable in a gate is not a reason to have no trigger. What is required is a
// schedule — something that fires without anyone deciding to, on a machine nobody
// is waiting for.
// ---------------------------------------------------------------------------

console.log('coverage-cadence: something runs the sweep on a schedule')
let wf = null
if (!existsSync(WF_DIR)) {
  fail('.github/workflows/ is absent — nothing can be scheduled')
} else {
  const found = readdirSync(WF_DIR).filter(f => /\.ya?ml$/.test(f))
    .map(f => ({ f, text: readFileSync(join(WF_DIR, f), 'utf8') }))
    .filter(x => /node\s+scripts\/coverage-sweep\.mjs/.test(x.text))
  if (!found.length) {
    fail(`no workflow runs coverage-sweep — its only trigger is the sentence in its own header telling a person to remember, which is the defect #42 named`)
  } else {
    wf = found[0]
    console.log(`          ${wf.f} runs it`)
  }
}

if (wf) {
  // Comments stripped first. Prose satisfying a check is the defect this repo has
  // now fixed four times — 65fc73f in containment, drift-guard's assertion scan,
  // ci-workflow's containment check, and ci.yml's toolchain echo.
  const text = wf.text.split('\n').map(l => l.replace(/(^|\s)#.*$/, '$1')).join('\n')

  console.log('coverage-cadence: the schedule is a real one')
  ok(/schedule:/.test(text) && /cron:/.test(text),
     `${wf.f} runs the sweep but has no cron — a workflow that fires only on dispatch is still a remembered trigger, wearing CI's clothes`)

  // The sweep must not gate a push. Separate workflow, or at least not on push.
  console.log('coverage-cadence: an unfiltered push trigger would put ~50 min in everyone\'s way')
  // A bare `push:` and a path-filtered one are indistinguishable by a line regex —
  // both leave `push:` alone on its line — and the first version of this check
  // called the filtered form a failure. What separates them is the indented block
  // underneath, so that is what gets read: an UNFILTERED push is the defect, a
  // filtered one is the design.
  {
    const lines = text.split('\n')
    const i = lines.findIndex(l => /^\s*push:\s*$/.test(l))
    if (i !== -1) {
      const indent = (lines[i].match(/^\s*/) || [''])[0].length
      const block = []
      for (let j = i + 1; j < lines.length; j++) {
        if (!lines[j].trim()) continue
        if ((lines[j].match(/^\s*/) || [''])[0].length <= indent) break
        block.push(lines[j])
      }
      ok(block.some(l => /paths(-ignore)?:/.test(l)),
         `${wf.f} triggers on every push with no paths filter, which queues ~${OBSERVED.minutes} min of runner time for commits that cannot have changed what the properties pin`)
    }
  }

  // A PUSH CAN CANCEL THE SCHEDULED RUN, AND THE SCHEDULED RUN IS A DIFFERENT MEASUREMENT.
  //
  // `cancel-in-progress` is right for a push burst: three runs were cancelled on 2026-08-26
  // while commits landed, and the last push's run completed, which is the debounce working.
  // What it also does is put SCHEDULED runs in the same group, so any commit landing on a
  // Monday morning discards that week's cron run — no red, no green, no verdict.
  //
  // Those are not the same measurement, and coverage.yml's own header says why: "A red
  // Monday on a tree nobody touched is a finding in itself: it means something outside this
  // repo moved under a property." A push-triggered sweep cannot make that observation,
  // because the tree just moved. Cancelling the cron run deletes the only run that can.
  //
  // NOT RESTED ON: who gets emailed. GitHub's notification behaviour differs by event and by
  // the owner's settings, and this file has not measured it. The argument above does not
  // need it.
  //
  // The fix is a group that varies by event, not the removal of the debounce: a push burst
  // should still collapse to its last run, and the cron run should not be collateral.
  console.log('coverage-cadence: a push cannot cancel the scheduled run')
  {
    const group = (text.match(/^\s*group:\s*(.+)$/m) || [, ''])[1]
    const cancels = /cancel-in-progress:\s*true/.test(text)
    if (cancels) {
      ok(/github\.event_name/.test(group),
         `${wf.f} cancels in-progress runs from a concurrency group that does not vary by event (${JSON.stringify(group.trim())}), so a commit landing on a Monday morning discards that week's cron run — the only run that can observe a tree nobody touched, which is what this workflow's own header says the schedule is for. Vary the group by event_name, or stop cancelling.`)
    } else {
      console.log('          the workflow does not cancel in-progress runs, so nothing can be cancelled by a push')
    }
  }

  console.log('coverage-cadence: a red sweep is reported rather than swallowed')
  ok(!/continue-on-error:\s*true/.test(text),
     `${wf.f} sets continue-on-error — a sweep whose failure is discarded reports coverage it has not got, which is worse than not running it`)
}

// ---------------------------------------------------------------------------
// THE RESIDUAL, on the branch that carries the verdict.
// ---------------------------------------------------------------------------

console.log('coverage-cadence: stating what a schedule does not buy')
console.log('          NOT MEASURED: whether anyone reads the result. A scheduled red sweep nobody opens')
console.log('          is the same coverage as no sweep, and no check here can see that. It is the reason')
console.log('          the cadence is weekly and visible rather than nightly and ignorable.')

if (failures) {
  console.error(`\ncoverage-cadence: ${failures} failure(s) — the sweep runs when someone remembers.`)
  process.exit(1)
}
console.log(`\ncoverage-cadence: OK — ${PROPERTY_COUNT} properties on a schedule, out of the blocking gate, failures reported.`)
