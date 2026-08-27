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

import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// LEDGERS ARE DISCOVERED, NOT LISTED. The first version scanned runs/ only —
// which is the hand-enumeration issue 3 is about, committed inside the instrument
// built for issue 50. It missed oracle/results.jsonl entirely, and that file holds
// the 48 rows of the pairing-stability draws: the exact run issue 50 cites. The
// verdict shipped with it claimed that run "emitted no machine-readable data at
// all", which was false, and the claim was only false because this scan had been
// scoped by hand to the directory the author happened to be thinking about.
//
// Every tracked .jsonl is a candidate now. A ledger added tomorrow in a directory
// nobody anticipated is covered without an edit here.
function discoverLedgers() {
  const out = spawnSync('git', ['ls-files', '*.jsonl'], { cwd: ROOT, encoding: 'utf8' })
  return String(out.stdout || '').split('\n').filter(Boolean).sort()
}
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

// COHORTS, DISCOVERED FROM THE DATA. A whole-ledger scan cannot see a constant
// that holds inside a SUBSET, and issue 50's own instance is exactly that: in
// oracle/results.jsonl the field `correct` varies across all 90 rows and is
// `true` on every one of the 48 rows carrying a `pairing`. The pairing run could
// not have produced an incorrect prediction, and pooling it with the rest of the
// corpus hides that completely.
//
// A cohort is not chosen. A field that is present on SOME rows and absent on
// others marks rows that came from a distinct experiment — that is what a
// partially-present column means in an append-only ledger — so each such subset
// is analysed on its own. Picking the subsets by hand would be choosing where to
// look, which is the thing this whole check exists to refuse.
const MIN_COHORT_ROWS = 4
export function cohorts(rows) {
  const keys = [...new Set(rows.flatMap(r => Object.keys(r)))]
  const out = []
  for (const k of keys) {
    const present = rows.filter(r => r[k] !== undefined)
    if (present.length < MIN_COHORT_ROWS) continue
    if (present.length === rows.length) continue      // universal: not a cohort marker
    out.push({ marker: k, rows: present })
  }
  // Two markers selecting the same rows describe one experiment, not two.
  const seen = new Set()
  return out.filter(c => {
    const sig = c.rows.length + ":" + c.rows.map((_, i) => i).join()
    const key = c.rows.length + ":" + JSON.stringify(c.rows[0])
    if (seen.has(key)) return false
    seen.add(key); return Boolean(sig)
  })
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

const ledgers = discoverLedgers()
if (!ledgers.length) { console.error('capacity-check: no tracked .jsonl ledgers found — a scan that reaches nothing cannot report anything'); process.exit(2) }
const adjudicated = readAdjudications()
const reports = []
let unexplained = 0

for (const f of ledgers) {
  const rows = readFileSync(join(ROOT, f), 'utf8').split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
  const rep = analyseLedger(f, rows)
  rep.cohorts = rep.tooSmall ? [] : cohorts(rows).map(c => {
    const a = analyseLedger(`${f}[${c.marker}]`, c.rows)
    // THE MARKER ITSELF IS EXCLUDED. A cohort is defined by a field being present,
    // so that field being constant inside it is circular — it reports the
    // definition back as a finding. Same for a field the whole ledger already
    // reports as constant: the cohort adds nothing there.
    a.constants = a.constants.filter(k => k.key !== c.marker && !rep.constants.some(x => x.key === k.key))
    return { marker: c.marker, ...a }
  }).filter(c => c.constants.length)
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
  if (!rep.constants.length && !rep.cohorts.length) { console.log('  every recorded field took more than one value'); continue }
  if (!rep.constants.length) console.log('  every field took more than one value across the whole ledger')
  for (const c of rep.constants) {
    const a = adjudicated.get(`${f} ${c.key}`)
    const line = `  ${c.key} — one value across ${c.rows} rows: ${c.sample.join(', ')}`
    if (a) console.log(`${line}\n      adjudicated: ${a.why}`)
    else { console.log(`${line}\n      NO ADJUDICATION — any claim resting on this field varying is a claim this batch could not have contradicted`); unexplained++ }
  }
  for (const c of rep.cohorts) {
    console.log(`  cohort "${c.marker}" (${c.rows} of ${rep.rows} rows carry it) — a distinct experiment inside this ledger:`)
    for (const k of c.constants) {
      const a = adjudicated.get(`${f}[${c.marker}] ${k.key}`)
      const line = `    ${k.key} — one value across those ${k.rows} rows: ${k.sample.join(', ')}`
      if (a) console.log(`${line}\n        adjudicated: ${a.why}`)
      else { console.log(`${line}\n        NO ADJUDICATION — the cohort could not have contradicted any claim resting on this field`); unexplained++ }
    }
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
