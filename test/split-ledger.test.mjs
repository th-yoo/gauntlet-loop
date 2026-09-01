// THE REPORT'S CLAIMS, checked against the numbers it is reporting.
//
//   node test/split-ledger.test.mjs
//
// scripts/split-ledger.mjs had no test at all, and the line that decides how a
// reader interprets a position breakdown was UNCONDITIONAL:
//
//   between-side gap 0% — disagreement this large is position, not judge variance
//
// Printed on a rehearsal ingest whose gap was exactly zero. A sentence emitted
// whatever the number says cannot be wrong and therefore cannot be informative —
// and here it asserted the opposite of what 0% means, inside the instrument built
// to settle how many critics a round needs.
//
// THE REPLACEMENT IS COMPUTED, NOT THRESHOLDED. A cut-off picked by hand ("call it
// position above 20%") is a parameter fitted to the case that motivated it. What
// decides instead is whether the two sides' Wilson intervals OVERLAP, using the
// same wilson() the rest of this instrument already uses: overlapping intervals
// mean the data does not separate position from judge variance, and that answer
// can come back either way as trials accumulate.
//
// NOTHING HERE SPAWNS.

import { spawnSync } from 'node:child_process'
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }

const TMP = mkdtempSync(join(tmpdir(), 'split-ledger-'))
const trial = (i, winsA, judgA, winsB, judgB, disagreed) => ({
  run: 'r', kind: 'within-round', rounds: [i], piece: null, judges: judgA + judgB,
  for_candidate: winsA + winsB, against_candidate: (judgA - winsA) + (judgB - winsB), disagreed,
  judgements_by_side: { A: judgA, B: judgB },
  candidate_wins_by_side: { A: winsA, B: winsB },
})
function report(trials) {
  const p = join(TMP, `led-${Math.random().toString(36).slice(2)}.jsonl`)
  writeFileSync(p, trials.map(t => JSON.stringify(t)).join('\n') + (trials.length ? '\n' : ''))
  const r = spawnSync(process.execPath, ['scripts/split-ledger.mjs', '--report'],
    { cwd: ROOT, encoding: 'utf8', timeout: 60_000, env: { ...process.env, SPLIT_LEDGER: p } })
  return String(r.stdout || '') + String(r.stderr || '')
}

console.log('split-ledger: a ZERO gap is not reported as evidence of a position effect')
{
  // The exact rehearsal that exposed it: both sides 100%, gap 0.
  const out = report([trial(1, 1, 1, 1, 1, false), trial(2, 1, 1, 1, 1, false)])
  ok(/between-side gap 0%/.test(out), `the gap itself must still be reported — got:\n${out}`)
  ok(!/disagreement this large is position/.test(out),
     `a 0% gap was described as "disagreement this large is position, not judge variance" — the sentence is printed whatever the number says, so it cannot be wrong and cannot inform:\n${out}`)
  ok(/does not separate|cannot separate|overlap/i.test(out),
     `with two judgements a side, the report must say the data does not separate position from judge variance — got:\n${out}`)
}

console.log('split-ledger: a gap the data DOES separate is reported as separated')
{
  // Side A always picks the candidate, side B never does, over enough judgements
  // that the two Wilson intervals cannot overlap. If this case reads the same as
  // the one above, the new sentence is as uninformative as the one it replaced.
  const trials = []
  for (let i = 0; i < 12; i++) trials.push(trial(i, 1, 1, 0, 1, true))
  const out = report(trials)
  ok(/between-side gap 100%/.test(out), `the gap must be reported — got:\n${out}`)
  ok(!/does not separate|cannot separate/i.test(out),
     `a fully separated 100% gap was reported as inseparable — then the verdict never changes and the check is decoration:\n${out}`)
  ok(/position/i.test(out), `and a separated gap must name position as what it points at — got:\n${out}`)
}

console.log('split-ledger: an empty ledger still refuses to read as a low rate')
{
  const out = report([])
  ok(/UNMEASURED/.test(out), 'the empty branch lost its residual')
  ok(/never a low disagreement rate/.test(out), 'and the sentence that stops it being read as evidence')
}

console.log('split-ledger: the mixed-population caveat is printed WHERE THE NUMBER IS, not only where nothing is claimed')
{
  // Decision 0007 changed which rounds arm, and arming is what makes an arm-confirm panel.
  // Panels from before and after it come from different populations and this report pools
  // them. That caveat first shipped as a COMMENT in split-extract.mjs — which is to say it
  // shipped nowhere, since a comment is not printed and the operator reading the number
  // never sees it. The repo's own rule is that the branch carrying the verdict is the
  // branch that must state the residual, so this asserts it on a branch that states d.
  const out = report([
    { run: 'r1', piece: null, kind: 'arm-confirm', judges: 2, for_candidate: 2, against_candidate: 0, sides: ['A', 'B'] },
    { run: 'r2', piece: null, kind: 'arm-confirm', judges: 2, for_candidate: 1, against_candidate: 1, sides: ['A', 'B'] },
  ])
  ok(/\d/.test(out), 'sanity: this branch does state a number, or the caveat is not being asked for where it matters')
  ok(/MIXED POPULATION/.test(out),
     `the report states d without disclosing that it pools panels from two different exit bars — got:\n${out}`)
  ok(/0007/.test(out) && /narrow/.test(out),
     'and the disclosure names the decision and the condition, so a reader can tell which panels are affected')
  ok(/biased/i.test(out), 'and says which way the bias runs, since a caveat with no direction is not actionable')
}

console.log('split-ledger: issue 21\'s falsifiers are read off the ENDS of the interval, in both directions')
{
  // FALSIFIER 1 — unanimity. Forty panels of two, every pair concordant: d = 0 with an
  // interval whose high end is small enough that even it needs one critic. The
  // report must say the line buys nothing and the composition is unjustified.
  const unanimous = []
  for (let i = 0; i < 40; i++) unanimous.push(trial(i, 1, 1, 1, 1, false))
  const a = report(unanimous)
  ok(/FALSIFIER 1 MET/.test(a) && /line buys nothing/.test(a), `forty unanimous panels must read as falsifier 1 — got:\n${a}`)
  ok(!/falsifies the composition/.test(a), 'and the old high-end sentence is gone')

  // THE OTHER DIRECTION — two panels, both split. The interval is wide because
  // the panels are few, and a wide interval decides nothing. This is the exact
  // ledger the Tetris run produced, and the old line printed "falsifies the
  // composition" on it.
  const two = [trial(1, 1, 1, 0, 1, true), trial(2, 0, 1, 1, 1, true)]
  const b = report(two)
  ok(/neither falsifier decided/.test(b), `two split panels must decide neither falsifier — got:\n${b}`)
  ok(!/FALSIFIER 1 MET/.test(b) && !/falsifies the composition/.test(b), 'and must not claim either')
  ok(/cheapest line this data allows is \d+/.test(b) && /operator's cost to judge/.test(b), 'the low end is reported as a cost the operator judges, not thresholded here')

  // THE CASE THAT SEPARATES THE ENDS. Six unanimous panels: d = 0, so the LOW end
  // needs one critic — but six panels leave the high end wide enough to need more.
  // A verdict read off the low end calls this unanimity; the right reading is
  // "neither, and at the low end one already clears the bar". The first version of
  // this test lacked it, and the sweep reported the end-swap NOT CAUGHT.
  const six = []
  for (let i = 0; i < 6; i++) six.push(trial(i, 1, 1, 1, 1, false))
  const c = report(six)
  const endsC = c.match(/(\d+) at the low end of the interval, \d+ at the point estimate, (\d+) at the high end/)
  ok(endsC && Number(endsC[1]) === 1 && Number(endsC[2]) > 1, `six unanimous panels must have low end 1 and high end above 1 for this case to separate the ends — got ${endsC && endsC.slice(1).join('/')}`)
  ok(/neither falsifier decided/.test(c) && /a single critic already clears the bar/.test(c), `six unanimous panels read as "neither", with the low end noted — got:\n${c}`)
  ok(!/FALSIFIER 1 MET/.test(c), 'and NOT as falsifier 1 — that needs the HIGH end at one')

  // AND THE KEY IS COMPUTED: the verdict must follow N_at_high, which the test reads
  // back from the same report rather than restating impliedN.
  const ends = b.match(/(\d+) at the low end of the interval, \d+ at the point estimate, (\d+) at the high end/)
  ok(ends && Number(ends[2]) > 1, `the wide case's high end must need more than one critic for "neither" to be the right reading — got ${ends && ends[2]}`)
  const endsA = a.match(/(\d+) at the low end of the interval, \d+ at the point estimate, (\d+) at the high end/)
  ok(endsA && Number(endsA[2]) === 1, `the unanimous case's high end must be 1 for falsifier 1 — got ${endsA && endsA[2]}`)
}

rmSync(TMP, { recursive: true, force: true })

console.log('split-ledger: stating what this cannot establish')
console.log('          NOT ESTABLISHED: that an overlap verdict is the RIGHT test for position bias.')
console.log('          Overlapping Wilson intervals mean this set of trials does not separate the two')
console.log('          explanations; they are not evidence the sides are equal, and non-overlap is not')
console.log('          proof the cause is position rather than anything else that tracks side.')

if (failures) {
  console.error(`\nsplit-ledger: ${failures} failure(s) — a report that states a conclusion its own number contradicts.`)
  process.exit(1)
}
console.log('\nsplit-ledger: OK — the position claim follows the numbers, and both directions are exercised.')
