// THE REPRODUCIBLE for #29 — the critic's defect-detection rate is n=1.
//
//   node test/detection-rate.test.mjs
//
// COMMITTED FAILING.
//
// #29 records the single observation: `wf_a4a68ddd-317`, round 1. A 22-line
// section was removed from a SKILL.md, the degraded copy was judged against the
// original, and the critic found the gap and confirmed it by running grep rather
// than by inferring. The same run then lost four rounds in a row, which is
// separate and useful evidence that the critic is not a constant function.
//
// One detection is an anecdote. It supports "the critic CAN detect a planted
// defect" and says nothing about how often, on what kind of defect, or at what
// size. A rate needs a set, and this repository has cited that missing rate as a
// blocker twice — #18's automatic revert is gated on it, because handing rollback
// authority to an evaluator whose detection rate is unmeasured is a trade nobody
// can price.
//
// WHAT THIS FILE ASSERTS. Not that the rate is high. That a rate EXISTS, is
// computed from a ledger of trials that were actually run, and is built so that
// an instrument reading the confound instead of the property scores at chance.
// A high number from a badly-shaped set is worse than no number, because a number
// gets quoted.
//
// THE CONFOUNDS, and each one is a way to score well while detecting nothing:
//
//   1. POSITION BIAS. A critic that always picks side A scores 100% on a set
//      where the undegraded artifact is always A. So the degraded side must be
//      CROSSED, and a position-only strategy then scores at chance by
//      construction rather than by hope.
//   2. DIFFERENCE-SEEKING. A critic that always says "the other one is better"
//      scores 100% on a set where one side is always degraded. So the set must
//      contain UNDEGRADED CONTROL PAIRS, where there is nothing to find and a
//      difference-seeker is exposed.
//   3. ONE DEFECT CLASS. A rate averaged over one kind of damage is a rate about
//      that kind. #29 names three — whole-section removal, a single inverted
//      constraint, a factual substitution — and they are not interchangeable: a
//      22-line hole and a flipped `must` are different detection problems.
//
// This is the repository's own rule applied to itself, from CLAUDE.md: "cross the
// claimed property against the confound it is probably measuring instead, and
// COMPUTE the key rather than assert it. Arrange the cases so an instrument
// reading the confound scores at chance."
//
// WHAT THIS FILE DOES NOT DO. It never spawns a model and never runs a trial. It
// reads a ledger. The trials are run by a separate script, deliberately — this
// repository produced a fork bomb the last time a live spawn sat anywhere the
// suite could reach it (docs/runs/2026-08-25-oracle-fork-bomb/), and
// test/containment.test.mjs fails if any file the suite runs so much as names a
// spawner. So this file names none, and finds the ledger by path.

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// DETECTION_LEDGER lets a check point this at a throwaway file, the same
// affordance oracle-add.mjs has as ORACLE_CORPUS and for the same reason: the
// only way to know whether a guard can FAIL is to hand it a set that should fail
// it, and doing that against the tracked ledger would mean writing fabricated
// rows into the evidence.
const LEDGER = process.env.DETECTION_LEDGER || join(ROOT, 'runs', 'detection.jsonl')

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }

// The floor is low on purpose. #29 prices ten trials at about twenty agents, and
// a floor set where the evidence is comfortable rather than where it is
// sufficient is a floor that will be met by stopping early. Ten degraded trials
// puts a 95% CI on a rate at roughly +/- 30 points, which is wide and is the
// honest starting width — the ledger is designed to be added to.
const MIN_DEGRADED = 10
const MIN_CONTROLS = 4
const REQUIRED_CLASSES = ['section-removal', 'inverted-constraint', 'factual-substitution']

console.log('detection-rate: a ledger of trials that were actually run exists')
if (!existsSync(LEDGER)) {
  fail(`runs/detection.jsonl does not exist — the critic's detection rate rests on the single observation in #29, and #18's automatic revert is blocked on it. A rate needs a set.`)
  console.error(`\ndetection-rate: ${failures} failure(s) — n=1 is an anecdote, not a rate.`)
  process.exit(1)
}

const rows = readFileSync(LEDGER, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l))
console.log(`          ${rows.length} trial(s) recorded`)

const degraded = rows.filter(r => r.degraded_side === 'A' || r.degraded_side === 'B')
const controls = rows.filter(r => r.degraded_side === 'none')

// READABLE, not merely present. A trial whose response could not be parsed
// carries no observation: it says nothing about whether the critic found the
// defect, and the response is on disk for a human to read. Counting those as
// data would let fifteen unreadable responses satisfy every floor below while
// measuring nothing — and counting them as MISSES, which an earlier version of
// the runner did, would push the rate down using trials that never spoke.
const readable = degraded.filter(r => r.detected === true || r.detected === false)
const unread = degraded.length - readable.length
if (unread) console.log(`          ${unread} degraded trial(s) unread — recorded, excluded from the rate, and on disk to be read`)

console.log('detection-rate: the set is large enough to carry a rate at all')
ok(readable.length >= MIN_DEGRADED,
   `only ${readable.length} degraded trial(s) carry a readable observation (of ${degraded.length} run); ${MIN_DEGRADED} is the floor. Below it the interval is wider than any conclusion drawn from it.`)

console.log('detection-rate: a position-only strategy scores at chance')
{
  const onA = readable.filter(r => r.degraded_side === 'A').length
  const onB = readable.filter(r => r.degraded_side === 'B').length
  console.log(`          degraded on A: ${onA} · degraded on B: ${onB}`)
  // Crossed, not merely present on both sides. A 9-1 split is technically both.
  const skew = readable.length ? Math.abs(onA - onB) / readable.length : 1
  ok(skew <= 0.34,
     `the READABLE degraded trials are skewed ${onA}/${onB} — a critic that always picks one side scores ${Math.round(Math.max(onA, onB) / Math.max(readable.length, 1) * 100)}% on this set while detecting nothing. Cross the sides.`)
}

console.log('detection-rate: a difference-seeking strategy is exposed')
ok(controls.length >= MIN_CONTROLS,
   `only ${controls.length} undegraded control pair(s); ${MIN_CONTROLS} is the floor. Without controls, a critic that always answers "the other one" is indistinguishable from one that detects.`)

console.log('detection-rate: the rate is not averaged over a single kind of damage')
{
  const classes = [...new Set(readable.map(r => r.defect_class))].sort()
  console.log(`          classes present: ${classes.join(', ') || '(none)'}`)
  for (const c of REQUIRED_CLASSES) {
    const n = readable.filter(r => r.defect_class === c).length
    ok(n >= 2, `defect class "${c}" has ${n} trial(s) — a class represented once contributes an anecdote to an average and hides inside it`)
  }
}

console.log('detection-rate: every trial is traceable to the response it came from')
for (const r of rows.slice(0, 200)) {
  ok(r.trial_id, 'a trial carries an id')
  ok(r.prompt_hash, `trial ${r.trial_id} carries the hash of the prompt it was judged under — a rate whose trials were judged under different prompts is a rate about no instrument`)
  ok(r.response, `trial ${r.trial_id} names the response file it was read from`)
  ok(existsSync(join(ROOT, r.response)), `trial ${r.trial_id} names a response file that is not there (${r.response}) — an observation whose source is missing is an assertion`)
}

console.log('detection-rate: one instrument, not several')
{
  // THE TEMPLATE, not the exact bytes. This asserted one distinct `prompt_hash`
  // across every trial — which no set of trials can satisfy, because the prompt
  // embeds each trial's two artifact paths. The check could not pass, and a
  // check that cannot pass is as broken as one that cannot fail; it would have
  // been "fixed" by deleting it. `prompt_template_hash` redacts the paths, so
  // what is compared is the instrument rather than its inputs — the same
  // correction ab67932 made to oracle-extract's template hash.
  const hashes = [...new Set(rows.map(r => r.prompt_template_hash))]
  ok(hashes.length === 1,
     `${hashes.length} distinct prompt TEMPLATES in the ledger — trials judged under different prompts cannot be pooled into one rate, which is the defect that invalidated five of seven early oracle observations`)
  ok(hashes[0], 'the template hash is recorded — an unrecorded one cannot show trials shared an instrument')
}

// --------------------------------------------------------------------------
// THE RATE ITSELF — computed here, never read back from a field someone wrote.
// --------------------------------------------------------------------------

console.log('detection-rate: the rate, computed from the ledger')
{
  const detected = readable.filter(r => r.detected === true).length
  const rate = readable.length ? detected / readable.length : 0
  const named = readable.filter(r => r.detected === true && r.named_defect === true).length
  // A control is a false alarm only if the critic claimed a real difference.
  // Picking a side while saying the pick carries no signal is the opposite of a
  // false alarm, and the runner records that separately for exactly this line.
  const falseAlarm = controls.filter(r => r.declared_no_difference === false).length

  console.log(`          detection:   ${detected}/${readable.length} = ${(rate * 100).toFixed(0)}%`)
  console.log(`          named it:    ${named}/${detected || 0} of the detections also named the planted defect`)
  console.log(`          false alarm: ${falseAlarm}/${controls.length} controls where the critic claimed a difference that was not planted`)
  console.log(`          (a control where it picked a side while declaring the pick meaningless is not a false alarm)`)

  // NOT a threshold on the rate. #29 says a rate near chance means the critic is
  // not discriminating and every verdict in the record is uninterpretable — that
  // is a finding to report, not a test to fail. What fails here is a set that
  // cannot carry a rate, which the checks above cover.
  ok(Number.isFinite(rate), 'the rate is computable from the ledger')
}

console.log('detection-rate: stating what this cannot establish')
console.log('          NOT MEASURED: whether these defects resemble the ones a real run meets. They are')
console.log('          planted, and a planted defect is one somebody chose. The rate is about detecting')
console.log('          THIS set, and generalises only as far as the set does.')
console.log('          NOT MEASURED: the builder arm. #25 is the same question about the other agent, and')
console.log('          it has no positive observation at all.')

if (failures) {
  console.error(`\ndetection-rate: ${failures} failure(s) — the critic's detection rate is not yet a measured quantity.`)
  process.exit(1)
}
console.log(`\ndetection-rate: OK — ${readable.length} readable degraded trials and ${controls.length} controls, sides crossed, ${REQUIRED_CLASSES.length} defect classes, one instrument.`)
