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
  minority: disagreed ? 1 : 0, disagreed,
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
