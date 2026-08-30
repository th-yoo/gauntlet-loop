// THE REPRODUCIBLE for S5 of the #28 suspect list — the refusal's authority is
// unconditioned.
//
//   node test/refusal-conditioned.test.mjs
//
// IT FAILS TODAY, ON PURPOSE, and it is committed failing.
//
// WHAT #28 ACTUALLY ASKS FOR. The comparability probe is the only component in
// this plugin that can stop a run. #28's remedy, in its own words, is that if the
// probe's verdicts turn out to be noise, "the refusal must be downgraded to a
// warning until it is stable". That remedy has nowhere to attach:
//
//     $ grep -c 'oracle\|corpus\|results.jsonl' skills/gauntlet-loop/loop.js
//     0
//
// Whatever the corpus measures, it measures somewhere the instrument cannot hear.
// If tomorrow's false-refusal rate were 40%, loop.js would refuse exactly as it
// does now, and the operator's only recourse would be to edit the loop.
//
// WHY A GREP IS NOT ENOUGH, and why this file exists at all. That grep is what S5
// rested on until now, and this project's own rule says reading the source finds
// nothing — a fact established by inspection is not thereby a cause. The counter
// -factual S5 asserts is behavioural: THE OPERATOR CANNOT MAKE A REFUSED RUN
// PROCEED. So it is asserted the way behaviour has to be, by running the loop and
// watching what it does, through the same stubbed harness every other loop test
// uses.
//
// THE PROPERTY, in two halves, because a switch alone would be worse than nothing:
//
//   1. An operator-supplied input can downgrade the refusal to a warning, and a
//      run given it PROCEEDS rather than stopping.
//   2. A run that proceeded over a refusal SAYS SO in its record. A comparison the
//      probe called meaningless, handed back with a clean verdict, is the false
//      all-clear this repository keeps finding in other instruments. The downgrade
//      has to cost the record something, or it launders the refusal.
//
// ON THE INTERFACE NAME. `args.on_refusal` is a PROPOSAL, held in one constant
// below so it can be renamed in one place. The assertions are about behaviour, not
// about the spelling: a fix that calls it something else changes this line and
// nothing under it. What the test refuses to accept is the shape where the switch
// exists and the record stays silent.
//
// WHAT THIS TEST CANNOT DO, stated here because the branch that carries it is the
// one that passes once the fix lands: making the refusal ANSWERABLE is not making
// it CORRECT. Nothing here measures whether refusing was right — that is the
// corpus's job, and the corpus is not wired to this decision either way. A
// downgrade switch lets an operator overrule an instrument they have reason to
// distrust; it supplies no reason.

import { runLoop } from './harness.mjs'

const CANDIDATE = '/tmp/x/mybuild.html'
const REFERENCE = '/tmp/x/theoriginal.html'
const TOKEN = '/tmp/x/run.token'
const GOAL = 'a goal worth looping over'
const base = { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN }

const WORKER = { role: 'does-the-work', what_it_is: 'a runbook', reasoning: 'it names the commands' }
const WRITER = { role: 'produces-an-instruction', what_it_is: 'a meta-prompt', reasoning: 'its output is a prompt' }

// The proposed operator input. One constant, so a fix may rename it freely.
const DOWNGRADE = { on_refusal: 'warn' }

let failures = 0
const ok = (cond, m) => { if (cond) console.log(`  ok    ${m}`); else { console.error(`  FAIL  ${m}`); failures++ } }

// A REFUSED RUN, ESTABLISHED FIRST. If this stopped being a refusal the two
// assertions below would pass vacuously — the run would proceed because nothing
// objected, not because anything was downgraded. That is the failure mode this
// repository calls a PASS condition satisfied by the thing being broken, so the
// refusal is confirmed before anything is asked of it.
console.log('refusal-conditioned: the pairing under test really is refused today')
let refusedMessage = null
try {
  await runLoop({ args: base, breaker: rd => rd <= 2, rounds: [], roles: [WRITER, WORKER] })
} catch (e) { refusedMessage = e.message }
ok(refusedMessage !== null, 'one instruction-writer against one worker stops the run')
ok(refusedMessage !== null && /GENERATOR/.test(refusedMessage),
   'and it stops for the reason under test — the pairing is a category error, not some other refusal')

console.log('refusal-conditioned: an operator can downgrade the refusal to a warning')
let downgraded = null
let downgradeError = null
try {
  downgraded = await runLoop({ args: { ...base, ...DOWNGRADE }, breaker: rd => rd <= 2, rounds: [], roles: [WRITER, WORKER] })
} catch (e) { downgradeError = e.message }

ok(downgradeError === null,
   `a run given ${JSON.stringify(DOWNGRADE)} proceeds instead of stopping. Today it does not: the loop reads no such input, so the refusal is unconditional and #28's own remedy — "downgrade the refusal to a warning until it is stable" — has nowhere to attach. Got: ${downgradeError ? downgradeError.slice(0, 120) : '(no error)'}`)

console.log('refusal-conditioned: a run that proceeded over a refusal says so in its record')
const rec = downgraded && downgraded.result
ok(rec !== null && rec !== undefined,
   'the downgraded run produced a record at all')
if (rec) {
  const verdict = rec.comparability && rec.comparability.verdict
  ok(verdict && verdict !== 'comparable',
     `the record keeps what the probe actually said (${JSON.stringify(verdict)}) — a downgrade that rewrites the verdict to "comparable" destroys the evidence it is overruling`)
  const text = JSON.stringify(rec)
  ok(/proceeded_over_refusal|refusal_downgraded|on_refusal/.test(text),
     'and the record names the downgrade, so a reader of this run cannot mistake it for a comparison nothing objected to. A switch that leaves the record clean launders the refusal, which is worse than having no switch')
}

// ---------------------------------------------------------------------------
// THE CASES WHERE THE REMEDY MUST NOT APPLY.
//
// Everything above tests that the downgrade WORKS. What decides whether it is
// safe is where it must not reach, and each case below is derived from something
// in the artifact rather than from a list that felt incomplete:
//
//   - the two REFUSED branches sit adjacent in loop.js (:1150, :1159), so a fix
//     that wraps "the refusal" wraps both;
//   - loop.js already holds the rule that a passed argument is refused rather
//     than ignored, for round caps, with the reason spelled out;
//   - other throws share the same path;
//   - the `comparable` branch is the one a flag could pollute.
//
// FOUR OF THESE PASS TODAY, AND THREE OF THOSE PASS VACUOUSLY — the input is
// ignored, so nothing can be wrongly downgraded yet. They are here as the
// baseline the fix must not break, and saying which is which is the point: a
// green line whose green comes from the feature not existing measures nothing
// until it does.
// ---------------------------------------------------------------------------

console.log('refusal-conditioned: an unopenable artifact is NOT downgradable  [holds today, vacuously]')
{
  const SHUT = { role: 'could-not-open', what_it_is: 'nothing — no such path', reasoning: 'open failed' }
  let msg = null
  try {
    await runLoop({ args: { ...base, ...DOWNGRADE }, breaker: rd => rd <= 2, rounds: [], roles: [SHUT, WORKER] })
  } catch (e) { msg = e.message }
  ok(msg !== null,
     'a file that could not be opened still stops the run with the downgrade on. An operator can overrule a JUDGEMENT about what an artifact is; they cannot overrule a file that is not there, and a downgraded run here would be a blind A/B against a path that does not exist')
  ok(msg !== null && /could not be opened/.test(msg) && !/GENERATOR/.test(msg),
     'and it stops for the unreadable reason, not the category one — the two REFUSED branches are adjacent in the source and a fix that wraps both would pass the first assertion while breaking this')
}

console.log('refusal-conditioned: an unrecognised value is refused, not ignored  [fails until the fix]')
{
  let msg = null
  try {
    await runLoop({ args: { ...base, on_refusal: 'banana' }, breaker: rd => rd <= 2, rounds: [], roles: [WORKER, WORKER] })
  } catch (e) { msg = e.message }
  ok(msg !== null,
     'a run given an unrecognised on_refusal value stops rather than proceeding. loop.js already states this rule about round caps — "A cap passed in is REFUSED, not ignored ... Silently dropping the argument leaves them believing the run is bounded" — and an operator who typed a value they believe disarms a refusal is in exactly that position. Two workers are used here so the ONLY thing that could object is the argument itself')
}

console.log('refusal-conditioned: the downgrade does not disable unrelated refusals  [holds today]')
{
  let msg = null
  try {
    await runLoop({ args: { ...base, reference: CANDIDATE, ...DOWNGRADE }, breaker: rd => rd <= 2, rounds: [], roles: [WORKER, WORKER] })
  } catch (e) { msg = e.message }
  ok(msg !== null && /same file/.test(msg),
     'a candidate compared against itself still stops with the downgrade on — otherwise "downgrade the comparability refusal" has quietly become a kill switch over every guard in the file')
}

console.log('refusal-conditioned: a clean run does not claim a downgrade that never happened  [holds today, vacuously]')
{
  const clean = await runLoop({ args: { ...base, ...DOWNGRADE }, breaker: rd => rd <= 2, rounds: [], roles: [WORKER, WORKER] })
  const verdict = clean.result && clean.result.comparability && clean.result.comparability.verdict
  ok(verdict === 'comparable', `two workers are comparable even with the downgrade on (got ${JSON.stringify(verdict)}) — the switch is not an instruction to refuse`)
  const text = JSON.stringify(clean.result)
  ok(!/proceeded_over_refusal|refusal_downgraded/.test(text),
     'and nothing in the record says a refusal was overruled, because none was. A flag that appears on runs where nothing objected is noise, and a reader who learns to ignore it loses the only thing the record half of this property buys')
}

console.log('refusal-conditioned: a probe that died is unaffected by the downgrade  [holds today, vacuously]')
{
  const died = await runLoop({ args: { ...base, ...DOWNGRADE }, breaker: rd => rd <= 2, rounds: [], roles: 'throw' })
  ok(died.result && died.result.comparability === null,
     'a probe that threw leaves no verdict, with or without the downgrade — there is no refusal to downgrade, and inventing one from a dead probe would be the switch manufacturing evidence')
}

// ---------------------------------------------------------------------------
// THE OTHER HALF OF S5 — the authority is conditioned on the CORPUS, not only on
// the operator. loop.js carries a copy of the corpus's false-refusal cell
// (REFUSAL_EVIDENCE) because a Workflow script cannot read oracle/; the default of
// on_refusal is DERIVED from it. Two things have to be true for that to be more
// than a constant with a story: the copy must equal what the corpus says today,
// recomputed by the same code that tallies it; and the branches only a different
// corpus reaches must be driven, by handing the script a different copy.
// ---------------------------------------------------------------------------
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LOOP_SRC = readFileSync(join(ROOT, 'skills', 'gauntlet-loop', 'loop.js'), 'utf8')
const EVIDENCE_LINE = /^const REFUSAL_EVIDENCE = (\{.*\})$/m

console.log('refusal-conditioned: the copy of the false-refusal cell in loop.js is what the corpus says today')
{
  const m = LOOP_SRC.match(EVIDENCE_LINE)
  ok(m !== null, 'loop.js carries REFUSAL_EVIDENCE as one JSON literal on one line')
  const stored = m ? JSON.parse(m[1]) : null
  const r = spawnSync(process.execPath, ['scripts/oracle-report.mjs'], { cwd: ROOT, encoding: 'utf8', timeout: 120_000, env: { ...process.env, GAUNTLET_SUITE: '1' } })
  const line = (String(r.stdout || '').match(/^REFUSAL_EVIDENCE_JSON (\{.*\})$/m) || [])[1]
  ok(line !== undefined, 'oracle-report emits the cell as REFUSAL_EVIDENCE_JSON — without it nothing can recompute the copy')
  const live = line ? JSON.parse(line) : null
  ok(stored && live && JSON.stringify(stored) === JSON.stringify(live),
     `the copy in loop.js must equal the corpus's tally — stored ${JSON.stringify(stored)}, corpus ${JSON.stringify(live)}. Regenerate: node scripts/oracle-report.mjs | grep REFUSAL_EVIDENCE_JSON`)
  console.log(`          corpus: ${line}`)
}

console.log('refusal-conditioned: with the corpus as it stands, the refusal holds and says what it rests on')
{
  const clean = await runLoop({ args: base, breaker: rd => rd <= 1, rounds: [], roles: [WORKER, WORKER] })
  const ra = clean.result.refusal_authority
  ok(ra && ra.holds === true && ra.default === 'refuse' && ra.set_by === 'evidence', `a clean run records that the refusal's authority holds by evidence — got ${JSON.stringify(ra && { holds: ra.holds, default: ra.default, set_by: ra.set_by })}`)
  ok(ra && /no counterexample on file/.test(ra.why) && /not evidence of accuracy/.test(ra.why), 'and says the authority is absence of a counterexample, not accuracy')
  ok((clean.result.not_enforced || []).some(l => /AUTHORITY IS CONDITIONED ON THE CORPUS/.test(l)), 'the disclosure states the conditioning on every run')
  ok(refusedMessage !== null && /THE AUTHORITY TO STOP YOU RESTS ON/.test(refusedMessage), 'and the refusal itself states what its authority rests on')
}

console.log('refusal-conditioned: a corpus with a counterexample withdraws the authority — the run proceeds by EVIDENCE, and the record says so')
{
  const withEvidence = e => src => src.replace(EVIDENCE_LINE, `const REFUSAL_EVIDENCE = ${JSON.stringify(e)}`)
  const cases = [
    ['a false refusal on file', { pairings: 6, draws: 18, falsely_refused: 1, redrawn: 6, flipped: 0, ci: [0.005, 0.445] }, /falsely refused pairing/],
    ['a flipped verdict on file', { pairings: 6, draws: 18, falsely_refused: 0, redrawn: 6, flipped: 1, ci: [0, 0.39] }, /flipped between draws/],
    ['too few pairings to pose a rate', { pairings: 4, draws: 8, falsely_refused: 0, redrawn: 4, flipped: 0, ci: [0, 0.49] }, /fewer than the five/],
  ]
  for (const [name, evidence, why] of cases) {
    let err = null, r = null
    try { r = await runLoop({ args: base, breaker: rd => rd <= 2, rounds: [], roles: [WRITER, WORKER], source: withEvidence(evidence) }) }
    catch (e) { err = e.message }
    ok(err === null, `${name}: the same pairing that is refused today proceeds — got: ${err ? err.slice(0, 140) : '(proceeded)'}`)
    const ra = r && r.result.refusal_authority
    const por = r && r.result.proceeded_over_refusal
    ok(ra && ra.holds === false && ra.default === 'warn' && ra.set_by === 'evidence', `${name}: the record says the authority does not hold and the default came from evidence — got ${JSON.stringify(ra && { holds: ra.holds, default: ra.default, set_by: ra.set_by })}`)
    ok(ra && why.test(ra.why), `${name}: and names the counterexample — got: ${ra && ra.why}`)
    ok(por && por.downgraded_by === 'evidence' && por.verdict === 'generator', `${name}: proceeded_over_refusal keeps the probe's verdict and says the evidence downgraded it — got ${JSON.stringify(por)}`)
  }
  // The operator's explicit 'refuse' still refuses under a bad corpus — and the
  // refusal says the operator overrode the evidence.
  let msg = null
  try { await runLoop({ args: { ...base, on_refusal: 'refuse' }, breaker: rd => rd <= 2, rounds: [], roles: [WRITER, WORKER], source: withEvidence(cases[0][1]) }) }
  catch (e) { msg = e.message }
  ok(msg !== null && /GENERATOR/.test(msg) && /You set args.on_refusal to "refuse" explicitly/.test(msg), `an explicit 'refuse' still stops the run under a withdrawn authority, and says the operator chose it — got: ${msg && msg.slice(0, 160)}`)
  // And the transform is honest about itself: an unchanged source is refused by the harness.
  let hookErr = null
  try { await runLoop({ args: base, rounds: [], roles: [WORKER, WORKER], breaker: rd => rd <= 1, source: src => src.replace(/no such constant anywhere/, 'x') }) }
  catch (e) { hookErr = e.message }
  ok(hookErr !== null && /matched nothing/.test(hookErr), 'a source transform that changes nothing is an error, not a silent pass')
}

console.log('refusal-conditioned: stating what this file does NOT establish')
console.log('          NOT MEASURED: whether refusing was RIGHT. The corpus now reaches the decision —')
console.log('          the default of on_refusal is derived from its false-refusal cell, recomputed above —')
console.log('          but the corpus itself was labelled by a person (#38), so a probe that agrees with')
console.log('          its labeller passes. Ground truth nobody authored is #33, and it is not here.')
console.log('          NOT MEASURED: the copy is recomputed when the SUITE runs, not when the loop runs. A')
console.log('          corpus that moved after the last push is not what an installed loop reads.')
console.log('          ALSO NOT MEASURED YET: three of the five must-not-apply cases pass VACUOUSLY')
console.log('          today — the input is ignored, so nothing can be wrongly downgraded. They begin')
console.log('          measuring only once the switch exists, and are here so the fix is judged against')
console.log('          a baseline that is in git rather than one written after it.')

if (failures) {
  console.error(`\nrefusal-conditioned: ${failures} failure(s) — the only component that can stop a run cannot be answered.`)
  process.exit(1)
}
console.log('\nrefusal-conditioned: OK — the refusal can be downgraded, and a downgraded run admits it.')
