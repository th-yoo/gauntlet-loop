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

import { readFileSync, writeFileSync, existsSync, mkdtempSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
// Pure text-in, number-out. The size cut lives beside the parse rather than here
// so it has one copy and can be driven with constructed input — a rule this
// ledger has already paid for three times over.
import { defectMagnitude, sizeCut, magnitudeSpread, achievableMagnitudes, magnitudeReach } from '../scripts/detection-parse.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// DETECTION_LEDGER lets a check point this at a throwaway file, the same
// affordance oracle-add.mjs has as ORACLE_CORPUS and for the same reason: the
// only way to know whether a guard can FAIL is to hand it a set that should fail
// it, and doing that against the tracked ledger would mean writing fabricated
// rows into the evidence.
const LEDGER = process.env.DETECTION_LEDGER || join(ROOT, 'runs', 'detection.jsonl')
// The sealed notes carry the bytes the size cut below is computed from, and they
// take the same override for the same reason: a constructed set is the only way
// to know whether the size checks can fail.
const SEALED = process.env.DETECTION_SEALED || join(ROOT, 'runs', 'detection-sealed')

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }

// ---------------------------------------------------------------------------
// WHAT SIZES THE INSTRUMENT CAN PLANT AT ALL, computed before any branch so that
// every branch can state it.
//
// The first version of this residual was a SENTENCE — "section removals are
// four-figure magnitudes and every other trial is a single-digit one, with
// nothing in between" — printed unconditionally. It was a fact about the fifteen
// trials on disk, stored beside the artifact it was derivable from, and it was
// ALREADY WRONG: inverted constraints reach 11 bytes and the smallest section a
// transform can remove from these documents is 390, not four figures. Storing it
// is the defect issue 54 is about, committed inside the fix for issue 29.
//
// So it is run instead. Every transform is applied at every eligible site of the
// real documents these trials were drawn from — read from the sealed notes,
// because naming the drawer is what test/containment.test.mjs forbids.
const REACH = (() => {
  if (!existsSync(SEALED)) return null
  const sources = new Set()
  for (const f of readdirSync(SEALED).filter(f => f.endsWith('.json'))) {
    try { const n = JSON.parse(readFileSync(join(SEALED, f), 'utf8')); if (n.source) sources.add(n.source) } catch { /* a note this cannot read contributes no source */ }
  }
  const per = []
  for (const src of sources) {
    const abs = join(ROOT, src)
    if (existsSync(abs)) per.push(achievableMagnitudes(readFileSync(abs, 'utf8')))
  }
  return per.length ? { ...magnitudeReach(per), docs: per.length, named: sources.size } : null
})()

// The residual, in the terms the run itself produced. `emit` is console.log on a
// branch that carries a verdict and console.error on one that is exiting hot —
// the words are the same either way, because a limitation printed only where a
// number is being asserted is printed exactly where it is least needed.
function statSeparability(emit) {
  if (!REACH) {
    emit(`          NOT MEASURED: what defect SIZES this instrument can plant. The sealed notes are not`)
    emit(`          readable from here, so whether size can be told apart from defect class is unknown`)
    emit(`          rather than ruled out — and the per-class rates say nothing about size on their own.`)
    return
  }
  emit(`          SIZES THIS INSTRUMENT CAN PLANT, over the ${REACH.docs} source document(s) the trials were drawn from:`)
  for (const r of REACH.ranges) emit(`            ${r.cls.padEnd(21)} ${r.min}–${r.max} bytes (${r.distinct} distinct)`)
  const gaps = []
  for (let i = 1; i < REACH.ranges.length; i++) {
    if (REACH.ranges[i].min > REACH.ranges[i - 1].max) gaps.push([REACH.ranges[i - 1].max, REACH.ranges[i].min, REACH.ranges[i - 1].cls, REACH.ranges[i].cls])
  }
  for (const [lo, hi, a, b] of gaps) {
    emit(`          NOT SEPARABLE by any draw from these transforms: nothing can be planted between ${lo} and`)
    emit(`          ${hi} bytes, so ${a} and ${b} can never reach the same size. Across that gap, "large`)
    emit(`          defects are easy" and "${b} is easy" predict the same table.`)
  }
  if (REACH.overlaps.length) {
    for (const [a, b] of REACH.overlaps) emit(`          SEPARABLE: ${a} and ${b} reach overlapping sizes, so a size effect between those two is not a class effect.`)
  } else {
    emit(`          NO two classes reach overlapping sizes, so on this instrument every size contrast is also a class contrast.`)
  }
}

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
  // The residual goes on this branch too, in the terms the transforms themselves
  // produce rather than in a sentence about a ledger that does not exist.
  statSeparability(m => console.error(m))
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

// --------------------------------------------------------------------------
// THE SIZE CUT — the third of #29's three questions, and the one nothing asked.
//
// #29: "A high rate on large removals and a low one on small edits would tell us
// what size of defect this instrument can see, which is the number an operator
// actually needs." The set was built for the other two — sides crossed, controls
// present, three classes — and the verdict reported the per-CLASS table in the
// size question's place, with neither document recording that size was left out.
// A residual that is not printed is a residual nobody is told about.
//
// Magnitude is DERIVED from each sealed note's own bytes, at the span where the
// two texts diverge. It is not a stored field and must not become one: this is
// the same ledger whose stored `degraded_side` disagreed with the prompt for
// twenty trials.
// --------------------------------------------------------------------------
console.log('detection-rate: the rate, cut by how big the planted defect is')
{
  const trials = []
  let noNote = 0
  for (const r of readable) {
    const p = join(SEALED, `${r.opaque}.json`)
    if (!existsSync(p)) { noNote++; continue }
    const note = JSON.parse(readFileSync(p, 'utf8'))
    const mag = defectMagnitude(note)
    if (!Number.isFinite(mag)) { noNote++; continue }
    trials.push({ mag, detected: r.detected === true, cls: r.defect_class })
  }
  ok(noNote === 0,
     `${noNote} readable degraded trial(s) have no derivable defect size — a size cut computed over the rest is a cut over a subset nobody is shown, which is how the denominator moved the first time`)

  const spread = magnitudeSpread(trials)
  for (const s of spread) console.log(`          ${s.cls.padEnd(21)} ${s.distinct} distinct size(s), ${s.min}–${s.max} bytes`)
  // WITHOUT within-class size variation there is no size contrast anywhere that
  // is not also a class contrast, and the question cannot be asked of the set at
  // all. Same argument as the per-class floor above, one level down.
  // Guarded on there being trials at all: with none, the failure above is the
  // one to read, and "every size contrast in this set is also a class contrast"
  // is a claim about an empty set — a message describing a situation the run is
  // not in is how a reader gets sent to the wrong place.
  ok(trials.length === 0 || spread.some(s => s.distinct >= 2),
     `no defect class carries more than one distinct size — every size contrast in this set is also a class contrast, so "what size can it see" cannot be asked of it. Draw trials that vary size WITHIN a class.`)

  const all = sizeCut(trials)
  const noRemoval = sizeCut(trials.filter(t => t.cls !== 'section-removal'))
  const show = (label, c) => {
    if (c.maxMissMag === null) {
      console.log(`          ${label}: n=${c.n}, ${c.misses} miss(es) — nothing to separate, so no size reading`)
      return
    }
    console.log(`          ${label}: every miss is ${c.maxMissMag} byte(s) or smaller · ` +
      `at or below ${c.maxMissMag}B ${c.below.detected}/${c.below.n} · above ${c.above.detected}/${c.above.n} · p=${c.p.toFixed(3)} (post-hoc)`)
  }
  show('all classes    ', all)
  // The confound, dropped rather than argued about: every section-removal is a
  // four-figure magnitude and every other trial a single-digit one, so on the
  // full set "large" and "removal-shaped" are the same column.
  show('removals dropped', noRemoval)
  console.log('          the threshold is read off the misses, so p is post-hoc and this separation is')
  console.log('          suggestive, not established. It is reported because the alternative is a')
  console.log('          per-class table being read as a size finding it cannot support.')
}

console.log('detection-rate: stating what this cannot establish')
console.log('          NOT MEASURED: whether these defects resemble the ones a real run meets. They are')
console.log('          planted, and a planted defect is one somebody chose. The rate is about detecting')
console.log('          THIS set, and generalises only as far as the set does.')
statSeparability(m => console.log(m))
console.log('          NOT MEASURED: the builder arm. #25 is the same question about the other agent, and')
console.log('          it has no positive observation at all.')

// --------------------------------------------------------------------------
// CAN THE SIZE CHECKS FAIL? Each one is driven with a set constructed to break
// it, and must come back naming what is wrong rather than merely exiting hot.
//
// This repository has shipped a trial that reported CAUGHT against a script that
// did not parse, because the question asked was `exit !== 0`. So each case reads
// the refusal's own words, and a crash is a crash.
//
// The cases run this file again with the sealed notes or the ledger pointed
// elsewhere; the recursion stops because the battery is skipped whenever either
// override is set. Nothing here spawns a model — the child is this same file.
// --------------------------------------------------------------------------
if (!process.env.DETECTION_LEDGER && !process.env.DETECTION_SEALED && existsSync(SEALED)) {
  console.log('detection-rate: the size checks can fail — one constructed set per branch')
  const SELF = fileURLToPath(import.meta.url)
  const run = env => {
    const r = spawnSync(process.execPath, [SELF], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env }, timeout: 120_000 })
    return { status: r.status, out: String(r.stdout || '') + String(r.stderr || '') }
  }
  const notes = readdirSync(SEALED).filter(f => f.endsWith('.json'))
  const fixture = (name, edit) => {
    const dir = mkdtempSync(join(tmpdir(), `detection-rate-${name}-`))
    for (const f of notes) {
      const note = JSON.parse(readFileSync(join(SEALED, f), 'utf8'))
      writeFileSync(join(dir, f), JSON.stringify(edit(note) ?? note))
    }
    return dir
  }

  // ONE SIZE PER CLASS. Every degraded note gets a two-byte substitution, so the
  // magnitudes are derivable and identical — which isolates this branch from the
  // one below, where they are not derivable at all.
  {
    const dir = fixture('flat', n => n.degraded_side === 'none' ? n : ({ ...n, removed: 'a 1 b', inserted: 'a 8 b' }))
    const r = run({ DETECTION_SEALED: dir })
    ok(r.status !== 0, 'a set where every defect is the same size passed — then the size cut is reported over a column that cannot vary, which is the shape of issue 50')
    ok(/no defect class carries more than one distinct size/.test(r.out),
       `the flat set was rejected for some other reason than the one under test: ${JSON.stringify(r.out.split('\n').filter(l => /FAIL/.test(l)).slice(0, 2))}`)
  }

  // A SIZE THAT CANNOT BE DERIVED. Identical bytes on both sides yield no span,
  // so the trial has no magnitude and the cut would silently run over the rest.
  {
    const dir = fixture('nomag', n => n.degraded_side === 'none' ? n : ({ ...n, removed: 'identical', inserted: 'identical' }))
    const r = run({ DETECTION_SEALED: dir })
    ok(r.status !== 0, 'trials with no derivable defect size passed — the size cut would then be computed over a subset nobody is shown')
    ok(/no derivable defect size/.test(r.out),
       `the underivable set was rejected for some other reason than the one under test: ${JSON.stringify(r.out.split('\n').filter(l => /FAIL/.test(l)).slice(0, 2))}`)
  }

  // AND THE BRANCH WITH NOTHING TO SEPARATE. A set the critic got right every
  // time carries no size reading at all, and must say so rather than divide by a
  // missing threshold.
  {
    const dir = mkdtempSync(join(tmpdir(), 'detection-rate-perfect-'))
    const led = join(dir, 'detection.jsonl')
    writeFileSync(led, rows.map(r => JSON.stringify(r.degraded_side === 'none' ? r : { ...r, detected: true })).join('\n') + '\n')
    const r = run({ DETECTION_LEDGER: led })
    ok(r.status === 0, `a ledger with no misses failed: ${JSON.stringify(r.out.split('\n').filter(l => /FAIL/.test(l)).slice(0, 2))}`)
    ok(/nothing to separate, so no size reading/.test(r.out),
       'a set with no misses reported a size threshold anyway — with nothing missed there is no largest missed size to read one off')
  }
  // AND THE BRANCH WITH NO NOTES AT ALL. The residual has two paths — one that
  // reports the sizes the transforms reach, one that says it could not find out
  // — and a path with no case is decoration. This is also the branch where the
  // sentence that used to be hard-coded here would still have been printed,
  // truthfully or not, with nothing on disk to check it against.
  {
    const empty = mkdtempSync(join(tmpdir(), 'detection-rate-nonotes-'))
    const r = run({ DETECTION_SEALED: empty })
    ok(/NOT MEASURED: what defect SIZES this instrument can plant/.test(r.out),
       'with no sealed notes the run still made a claim about what sizes it can plant, or made none at all — it must say the question is unmeasured rather than pass over it')
    ok(!/NOT SEPARABLE by any draw/.test(r.out),
       'a separability verdict was printed with no notes to compute it from — that is the stored sentence coming back')
  }
  console.log('          4 constructed set(s): one size per class, no derivable size, no misses, no notes')
}


if (failures) {
  console.error(`\ndetection-rate: ${failures} failure(s) — the critic's detection rate is not yet a measured quantity.`)
  process.exit(1)
}
console.log(`\ndetection-rate: OK — ${readable.length} readable degraded trials and ${controls.length} controls, sides crossed, ${REQUIRED_CLASSES.length} defect classes, one instrument.`)
