// HISTORICAL — the mechanism this reports on was deleted.
//
// The gate sequence (gates 0-7) that produced these records is gone: it was
// removed on branch `drop-judge-lane`, and `SKILL.md` now contains the word
// "gate" zero times. Nothing in the loop writes to this ledger any more.
//
// The script still runs, and its output still names gates, so it is easy to read
// as a report on something current. It is not. See runs/README.md for why the
// record is kept: the argument in it is about a gap the loop still has — no way
// to score what a refusal bought — and whoever closes that should read it first.

// Read runs/refusals.jsonl and report what it can support.
//
//   node scripts/refusal-tally.mjs [path]
//
// Reports gate firing rates, the false-negative count with a Wilson interval,
// the rule-of-three bound when the count is zero, and how often gate 4's
// number is being left blank. No dependencies.
//
// It is deliberately loud about small n. The point of the ledger is that it
// can say "this question cannot be posed here" cheaply, and that outcome is
// only visible if the tool refuses to dress up four observations as a rate.

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FILE = process.argv[2] || join(ROOT, 'runs', 'refusals.jsonl')

// Wilson score interval — behaves at small n and at p=0, unlike the normal
// approximation, which returns a zero-width interval when no events occur.
function wilson(k, n, z = 1.96) {
  if (n === 0) return null
  const p = k / n
  const d = 1 + (z * z) / n
  const c = p + (z * z) / (2 * n)
  const s = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))
  return [Math.max(0, (c - s) / d), Math.min(1, (c + s) / d)]
}

const pct = x => `${(x * 100).toFixed(1)}%`
const ci = b => (b ? `[${pct(b[0])}, ${pct(b[1])}]` : 'n/a')

if (!existsSync(FILE)) {
  console.error(`no ledger at ${FILE}`)
  process.exit(1)
}

const lines = readFileSync(FILE, 'utf8').split('\n').map(l => l.trim()).filter(Boolean)

const rows = []
const malformed = []
lines.forEach((l, i) => {
  try { rows.push(JSON.parse(l)) } catch { malformed.push(i + 1) }
})

console.error('(HISTORICAL: the gate sequence these records describe was deleted on branch drop-judge-lane — nothing writes this ledger now)')
console.log(`ledger: ${FILE}`)
console.log(`records: ${rows.length}${malformed.length ? `  (malformed lines: ${malformed.join(', ')})` : ''}`)

if (!rows.length) {
  console.log('\nNothing logged yet. The first number this produces — the gate firing rate —')
  console.log('can cancel the whole measurement programme, so it is worth the twenty minutes.')
  process.exit(0)
}

const n = rows.length
const gate0no = rows.filter(r => r.gate0 === 'NO')
const gate1narrow = rows.filter(r => r.gate1 === 'width-1')
const gate1unset = rows.filter(r => r.gate1 === null || r.gate1 === undefined || r.gate1 === '')
const gate1recorded = n - gate1unset.length
const noGate4 = rows.filter(r => r.gate4_number === null || r.gate4_number === undefined || r.gate4_number === '')

// --- the number that can end the programme --------------------------------
console.log('\n--- firing rates (this is the number that can cancel the programme) ---')
console.log(`  gate 0 refuses to zero : ${gate0no.length}/${n}  ${pct(gate0no.length / n)}  95% CI ${ci(wilson(gate0no.length, n))}`)
// Denominator is RECORDED gate-1 decisions only. An unset --gate1 is a
// decision the operator never made — silently folding it into "panel" (the
// old default) would count a non-decision inside this rate, which is exactly
// the gate4_number blank-ceiling failure mode this file already calls out
// below, just for the other gate.
if (gate1recorded === 0) {
  console.log('  gate 1 narrows to w-1  : n/a — no --gate1 decision has been recorded on any run')
} else {
  console.log(`  gate 1 narrows to w-1  : ${gate1narrow.length}/${gate1recorded}  ${pct(gate1narrow.length / gate1recorded)}  95% CI ${ci(wilson(gate1narrow.length, gate1recorded))}`)
}
console.log(`  gate 1 not recorded    : ${gate1unset.length}/${n}  ${pct(gate1unset.length / n)}`)

if (gate0no.length === 0) {
  console.log('\n  gate 0 has never refused. The false-negative question about gate 0 cannot')
  console.log('  be posed on this data, and no amount of further logging changes that until')
  console.log('  it fires. Say so and stop rather than waiting.')
}

// --- gate 4 hygiene, itself a finding -------------------------------------
console.log('\n--- gate 4 ---')
console.log(`  runs with no cost ceiling set: ${noGate4.length}/${n}  ${pct(noGate4.length / n)}`)
if (noGate4.length / n > 0.5) {
  console.log('  FINDING: the ceiling this entire argument is denominated in is mostly not being set.')
}

// --- the crux -------------------------------------------------------------
const scored = gate0no.filter(r => r.outcome && r.outcome.override_run)
const fn = scored.filter(r => r.outcome.verdict === 'FALSE_NEGATIVE')
const unscored = gate0no.length - scored.length

console.log('\n--- gate-0 override results ---')
console.log(`  refusals overridden : ${scored.length}/${gate0no.length}${unscored ? `  (${unscored} not yet run)` : ''}`)

if (scored.length === 0) {
  console.log('  nothing scored yet.')
} else {
  console.log(`  recorded false negatives: ${fn.length}/${scored.length}  ${pct(fn.length / scored.length)}`)
  console.log(`  95% CI ${ci(wilson(fn.length, scored.length))}`)
  if (fn.length === 0) {
    // Rule of three: with 0 events in n trials the 95% upper bound is ~3/n.
    console.log(`  rule of three: false-negative rate <= ${pct(3 / scored.length)} at 95%`)
    console.log('  reading: the gates have not yet been caught costing a finding. This is a')
    console.log('  bound, not a vindication — at small n the bound is weak and honest.')
  } else {
    console.log('\n  GATE 0 HAS BEEN CAUGHT. One qualifying finding falsifies "a few tool calls')
    console.log('  settle it" on that instance — gate 0 makes a universal claim, so one suffices.')
    for (const r of fn) {
      console.log(`    - ${r.date}  ${r.artifact}`)
      console.log(`      gate 0 said: ${r.gate0_reason}`)
      console.log(`      but a high-severity GROUNDED finding anchored outside ${JSON.stringify(r.gate0_files || [])}`)
    }
  }
}

// --- scoring integrity ----------------------------------------------------
const suspect = scored.filter(r => {
  const o = r.outcome
  const claimsFN = o.verdict === 'FALSE_NEGATIVE'
  const meets = o.high_grounded_findings > 0 && o.anchored_outside_gate0_files === true
  return claimsFN !== meets
})
if (suspect.length) {
  console.log(`\n  WARNING: ${suspect.length} record(s) whose verdict does not match their own fields.`)
  console.log('  All three conditions are required: high severity AND grounded AND anchored')
  console.log('  outside the files gate 0 named. See runs/README.md.')
}

const missingFiles = gate0no.filter(r => !Array.isArray(r.gate0_files) || !r.gate0_files.length)
if (missingFiles.length) {
  console.log(`\n  WARNING: ${missingFiles.length} gate-0 NO(s) with no gate0_files recorded.`)
  console.log('  Condition 3 cannot be checked without them, so those refusals are unscoreable.')
}
