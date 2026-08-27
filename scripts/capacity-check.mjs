// Could this design have produced another answer? Read from the evidence, not the prose.
//
//   node scripts/capacity-check.mjs [--json]
//
// ISSUE 50. A pre-registration fixes what a result will be taken to mean before
// the result is known. That defends against reading a number the convenient way
// afterwards. It does nothing about a design that could only have produced one
// outcome, and a pre-registered reading of an uninformative design is still
// uninformative.
//
// The issue records two instances, the second produced by the process meant to
// prevent it. `docs/runs/2026-08-26-pairing-stability.md` was committed before
// its draws, fixed what counts as a flip, and recorded a prediction — all of
// which worked. It never asked whether those eight pairings COULD have flipped.
// Five of six put an unambiguous worker against an unambiguous worker; the run
// returned 0 flips over 24 draws, and the sentence a reader takes away is
// stronger than a set chosen for clarity can support.
//
// WHY THIS DOES NOT READ THE PROSE. That same document says, at line 90, "it did
// not come back against its author, AND IT COULD HAVE." A capacity claim written
// by the author of the design is the thing under suspicion; requiring the
// sentence would have passed the exact run the issue is about. So the question is
// asked of the LEDGER: across every row the design produced, did this field ever
// take a second value? A field that never varied is a field no claim can rest on
// varying, whatever the write-up says.
//
// WHAT THIS IS NOT. It measures OBSERVED capacity, after the fact. It cannot
// decide, before a run, whether a design was capable of disagreeing — that is not
// decidable from a design description, and issue 50's pre-run half stays open.
// What it does is make the post-hoc half impossible to skip.
//
// NOTHING HERE SPAWNS.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LEDGER_DIR = join(ROOT, 'runs')
const ADJ = process.env.CAPACITY_ADJUDICATIONS || join(ROOT, 'docs', 'capacity-adjudications.jsonl')
const argv = process.argv.slice(2)

// A ledger needs at least this many rows before a constant field means anything
// about the DESIGN rather than about the sample size. Below it, the ledger itself
// is the finding and reporting twelve constant fields would bury that in noise.
const MIN_ROWS_FOR_FIELD_ANALYSIS = 2

// Fields that identify a row rather than record an outcome. A unique id varies by
// construction and a constant one would be a different defect; neither is a
// capacity question, and including them turns the report into a list nobody reads.
// DISCOVERED BY SHAPE, not enumerated: a field whose values are all distinct
// across rows is an identifier, and one that is constant is a candidate.
function classify(rows, key) {
  const values = rows.map(r => JSON.stringify(r[key]))
  const distinct = new Set(values)
  return {
    key,
    distinct: distinct.size,
    rows: rows.length,
    sample: [...distinct].slice(0, 3).map(v => String(v).slice(0, 48)),
    identifier: distinct.size === rows.length && rows.length > 2,
  }
}

export function analyseLedger(name, rows) {
  if (rows.length < MIN_ROWS_FOR_FIELD_ANALYSIS) {
    return { ledger: name, rows: rows.length, tooSmall: true, constants: [] }
  }
  const keys = [...new Set(rows.flatMap(r => Object.keys(r)))]
  const fields = keys.map(k => classify(rows, k))
  return {
    ledger: name,
    rows: rows.length,
    tooSmall: false,
    constants: fields.filter(f => f.distinct === 1 && !f.identifier),
  }
}

function readAdjudications() {
  const m = new Map()
  if (!existsSync(ADJ)) return m
  for (const line of readFileSync(ADJ, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try {
      const a = JSON.parse(line)
      if (a.ledger && a.field) m.set(`${a.ledger} ${a.field}`, a)
    } catch { /* a malformed line is a missing adjudication, which is the safe reading */ }
  }
  return m
}

if (!existsSync(LEDGER_DIR)) { console.error('capacity-check: no runs/ directory'); process.exit(2) }
const ledgers = readdirSync(LEDGER_DIR).filter(f => f.endsWith('.jsonl')).sort()
const adjudicated = readAdjudications()
const reports = []
let unexplained = 0

for (const f of ledgers) {
  const rows = readFileSync(join(LEDGER_DIR, f), 'utf8').split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
  const rep = analyseLedger(f, rows)
  reports.push(rep)
  console.log(`capacity-check: ${f} — ${rep.rows} row(s)`)
  if (rep.tooSmall) {
    const key = `${f} *`
    const a = adjudicated.get(key)
    console.log(`  the LEDGER never varied: ${rep.rows} row(s) means every field is constant by sample size, not by design`)
    if (a) console.log(`  adjudicated: ${a.why}`)
    else { console.log('  NO ADJUDICATION — nothing states what this ledger therefore cannot establish'); unexplained++ }
    continue
  }
  if (!rep.constants.length) { console.log('  every recorded field took more than one value'); continue }
  for (const c of rep.constants) {
    const a = adjudicated.get(`${f} ${c.key}`)
    const line = `  ${c.key} — one value across ${c.rows} rows: ${c.sample.join(', ')}`
    if (a) console.log(`${line}\n      adjudicated: ${a.why}`)
    else { console.log(`${line}\n      NO ADJUDICATION — any claim resting on this field varying is a claim this batch could not have contradicted`); unexplained++ }
  }
}

console.log()
console.log(`capacity-check: ${reports.length} ledger(s), ${unexplained} unexplained constant(s)`)
// THE RESIDUAL, ON EVERY BRANCH, including the clean one.
console.log('capacity-check: NOT ESTABLISHED — this reads capacity that was OBSERVED, after the run.')
console.log('                Whether a design COULD have disagreed is not decidable from a design')
console.log('                description, and a capacity claim written by the design\'s author is the')
console.log('                thing under suspicion: the run issue 50 cites asserts "it could have"')
console.log('                in its own prose while its pairings were chosen for clarity.')
console.log('                A varied field also does not make a claim sound — only unfalsifiable-by-')
console.log('                construction slightly less likely.')

if (argv.includes('--json')) console.log(JSON.stringify(reports, null, 2))
if (unexplained) process.exit(1)
