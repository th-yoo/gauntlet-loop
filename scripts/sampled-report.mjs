// Account for the sampled corpus against its frame: population, draws, attrition,
// grounding — and refuse a row that cannot show where it was drawn from.
//
//   node scripts/sampled-report.mjs
//
// Issue 73. This prints the DENOMINATOR side of the sampled cohort: what the population
// is, how many members a seed named, what happened to every one of them. It does NOT
// state instrument rates — those come from oracle-report run with
//   ORACLE_CORPUS=oracle/sampled.jsonl ORACLE_RESULTS=oracle/sampled-results.jsonl
// whose own disclosures then apply. Splitting the two keeps this file from becoming a
// second implementation of the rate arithmetic it would then agree with, defect and all.
//
// THE JOIN IS THE GUARD. A row in the sampled corpus must name an artifact some FETCHED
// ledger row produced. A sampled row with no draw provenance is the authored corpus
// wearing a frame — issue 73's second falsifier — and it FAILS this report rather than
// being counted. The join key is the fixture path, stored once in the ledger; frame
// membership is derived through it, never restated on the corpus row.

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FRAME = process.env.ORACLE_FRAME || join(ROOT, 'oracle', 'frame.json')
const LEDGER = process.env.ORACLE_DRAWS || join(ROOT, 'oracle', 'sampled-draws.jsonl')
const SAMPLED = process.env.ORACLE_SAMPLED || join(ROOT, 'oracle', 'sampled.jsonl')

const jsonl = p => !existsSync(p) ? [] : readFileSync(p, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l) } catch { return { unparseable: l.slice(0, 80) } } })

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }

const draws = jsonl(LEDGER)
const rows = jsonl(SAMPLED)

if (!existsSync(FRAME)) {
  if (draws.length || rows.length) {
    console.error('sampled-report: REFUSED — draws or rows exist but the frame does not. Their denominator')
    console.error(`is gone: every count below would be a numerator with nothing under it. Expected ${FRAME};`)
    console.error('scripts/frame-snapshot.mjs writes it, and replacing a frame retires the ledgers that cite the old one.')
    process.exit(2)
  }
  console.log('sampled-report: no frame, no draws, no rows — the sampled cohort does not exist yet.')
  console.log('               Nothing here weakens the authored corpus\'s own disclosure: its selection')
  console.log('               still has no frame, and oracle-report still says so.')
  process.exit(0)
}
const frame = JSON.parse(readFileSync(FRAME, 'utf8'))

console.log(`sampled-report: frame ${frame.frame_id}`)
console.log(`  population        ${frame.n} members — ${frame.query}`)
console.log(`  authored          ${frame.authored}`)

for (const d of draws.filter(x => x.unparseable)) fail(`unreadable ledger line: ${d.unparseable} — a row that cannot be read is a member that cannot be accounted for`)

const bySeed = new Map()
for (const d of draws.filter(x => !x.unparseable)) {
  if (d.frame_id !== frame.frame_id) { fail(`ledger row for ${d.full_name} cites frame ${JSON.stringify(d.frame_id)}, not the committed ${frame.frame_id} — its denominator is not this population`); continue }
  if (!bySeed.has(d.seed)) bySeed.set(d.seed, [])
  bySeed.get(d.seed).push(d)
}
const fixtureOwner = new Map()
for (const d of draws) if (d.status === 'fetched' && d.fixture) fixtureOwner.set(d.fixture, d)

for (const [seed, ds] of bySeed) {
  const fetched = ds.filter(d => d.status === 'fetched')
  const attr = ds.filter(d => d.status === 'attrition')
  console.log(`  seed ${JSON.stringify(seed)}   drawn ${ds.length}, fetched ${fetched.length}, attrition ${attr.length}`)
  for (const a of attr) console.log(`      attrition       ${a.full_name}: ${a.why}`)
  const other = ds.length - fetched.length - attr.length
  if (other > 0) fail(`${other} ledger row(s) under seed ${JSON.stringify(seed)} are neither fetched nor attrition — a third status is a branch nothing here accounts for`)
}

// Grounding, joined through the fixture path. Every grounded row must be a drawn member;
// every fetched member is either grounded or still waiting, and both are counted.
const grounded = []
for (const r of rows) {
  if (r.unparseable !== undefined) { fail(`unreadable sampled row: ${r.unparseable}`); continue }
  const owner = fixtureOwner.get(r.artifact)
  if (!owner) { fail(`sampled row ${JSON.stringify(r.id)} names ${r.artifact}, which no fetched ledger row produced — a sampled row with no draw provenance is the authored corpus wearing a frame`); continue }
  grounded.push({ r, owner })
}
const groundedFixtures = new Set(grounded.map(g => g.r.artifact))
const waiting = [...fixtureOwner.values()].filter(d => !groundedFixtures.has(d.fixture))
console.log(`  grounded          ${grounded.length} row(s)${grounded.length ? ' — ' + grounded.map(g => `${g.owner.full_name} (${g.r.expected_role}${g.r.disputed ? ', DISPUTED' : ''})`).join('; ') : ''}`)
console.log(`  awaiting ground   ${waiting.length}${waiting.length ? ' — ' + waiting.map(d => d.full_name).join(', ') : ''}`)

// On every branch, because a reader arrives at whichever branch printed. The scope of
// the claim is the frame, and the frame is authored; deleting these lines must go red.
console.log('')
console.log('  WHAT A SAMPLED NUMBER MEANS HERE')
console.log('  - The denominator is the committed frame: authored query, authored order, authored N.')
console.log('    Random within an authored frame — never representative of the pairings operators bring.')
console.log('  - Attrition is part of the estimate: a rate over grounded rows silently conditions on')
console.log('    "groundable", and the reasons above are the only record of what that excluded.')
console.log('  - Rates come from oracle-report with the sampled env, and its disclosures apply on top;')
console.log('    the authored corpus\'s selection-bias paragraph is untouched by anything here.')

if (failures) {
  console.error(`\nsampled-report: ${failures} failure(s) — a cohort that cannot show its draws is not a sampled cohort.`)
  process.exit(1)
}
console.log('\nsampled-report: OK — every row joins a draw, every draw joins the frame, and the frame admits what it is.')
