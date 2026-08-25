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

// Append one decision to runs/refusals.jsonl. Friction is what kills ledgers,
// so this exists purely to make the honest thing the easy thing.
//
//   node scripts/refusal-log.mjs \
//     --artifact path/or/description \
//     --lines 191 \
//     --gate0 NO --gate0-reason "reading stop-hook.sh and the setup script settles it" \
//     --gate0-files hooks/stop-hook.sh,scripts/setup.sh \
//     --gate1 width-1 --gate1-reason "one agent would miss X because one agent Y" \
//     --gate4 250000
//
// Scoring an override afterwards:
//
//   node scripts/refusal-log.mjs --score <line-number> \
//     --high-grounded 1 --outside true
//
// The verdict is COMPUTED from the three conditions, never passed in — see
// runs/README.md. No dependencies.

import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FILE = join(ROOT, 'runs', 'refusals.jsonl')

const argv = process.argv.slice(2)
if (!argv.length || argv.includes('-h') || argv.includes('--help')) {
  // Wide enough to cover the historical notice AND the usage block beneath it.
  // The notice was added above and pushed the actual instructions out of a
  // 20-line window, so `--help` printed the warning and nothing else.
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 31).join('\n'))
  process.exit(0)
}

function arg(name, dflt = null) {
  const i = argv.indexOf(`--${name}`)
  return i === -1 || i === argv.length - 1 ? dflt : argv[i + 1]
}

const fail = m => { console.error(`error: ${m}`); process.exit(1) }
if (!existsSync(FILE)) writeFileSync(FILE, '')

// ---- scoring an existing record -----------------------------------------
if (arg('score')) {
  const lineNo = parseInt(arg('score'), 10)
  const lines = readFileSync(FILE, 'utf8').split('\n')
  const idx = lines.findIndex((l, i) => l.trim() && i + 1 === lineNo)
  if (idx === -1) fail(`no record at line ${lineNo}`)

  const rec = JSON.parse(lines[idx])
  const high = parseInt(arg('high-grounded', '0'), 10)
  const outsideRaw = arg('outside', 'false')
  const outside = outsideRaw === 'true'
  if (!['true', 'false'].includes(outsideRaw)) fail('--outside must be true or false')

  // All three conditions, or it does not count. Computed here so the verdict
  // cannot drift from the evidence recorded beside it.
  const verdict = high > 0 && outside ? 'FALSE_NEGATIVE' : 'GATE0_HELD'

  rec.outcome = {
    override_run: true,
    high_grounded_findings: high,
    anchored_outside_gate0_files: outside,
    verdict,
  }
  lines[idx] = JSON.stringify(rec)
  writeFileSync(FILE, lines.join('\n'))

  console.log(`line ${lineNo} scored: ${verdict}`)
  if (verdict === 'FALSE_NEGATIVE') {
    console.log('\nGate 0 has been caught on this instance. It claimed a few tool calls would')
    console.log('settle it; a high-severity grounded finding landed outside the files it named.')
    console.log('That is a universal claim falsified by one counterexample — it is enough.')
  } else if (high > 0 && !outside) {
    console.log('\nNote: findings were produced, but inside the files gate 0 named. That is')
    console.log('gate 0 being right, not the critic being weak — the refusal held.')
  }
  process.exit(0)
}

// ---- appending a new decision -------------------------------------------
const artifact = arg('artifact') || fail('--artifact is required')
const gate0 = arg('gate0') || fail('--gate0 NO|GO is required')
if (!['NO', 'GO'].includes(gate0)) fail('--gate0 must be NO or GO')
// Nullable, like gate4_number: an unset --gate1 is an operator decision that
// was never made, not a silent "panel". Recording it as 'panel' would count a
// decision that never happened in one of the two firing rates the ledger
// exists to produce (see refusal-tally.mjs).
const gate1raw = arg('gate1')
if (gate1raw !== null && !['width-1', 'panel'].includes(gate1raw)) fail('--gate1 must be width-1 or panel')
const gate1 = gate1raw

const gate4raw = arg('gate4')
const gate0files = (arg('gate0-files') || '').split(',').map(s => s.trim()).filter(Boolean)

if (gate0 === 'NO' && !gate0files.length) {
  console.error('warning: gate 0 refused but --gate0-files is empty.')
  console.error('  Condition 3 of the scoring rule cannot be checked without the files gate 0')
  console.error('  claimed would settle it, so this refusal will be unscoreable. Logging anyway.')
}

const rec = {
  date: arg('date') || new Date().toISOString().slice(0, 10),
  artifact,
  artifact_lines: arg('lines') ? parseInt(arg('lines'), 10) : null,
  gate0,
  gate0_reason: arg('gate0-reason', ''),
  gate0_files: gate0files,
  gate1,
  gate1_reason: arg('gate1-reason', ''),
  gate4_number: gate4raw ? parseInt(gate4raw, 10) : null,
  outcome: null,
}

appendFileSync(FILE, JSON.stringify(rec) + '\n')
const lineNo = readFileSync(FILE, 'utf8').split('\n').filter(l => l.trim()).length
console.log(`logged line ${lineNo}: gate0=${gate0} gate1=${gate1 === null ? '(not recorded)' : gate1}`)

if (rec.gate1 === null) {
  console.log('note: no --gate1 recorded. The tally reports this rate separately from "panel" —')
  console.log('  an unrecorded decision is not the same as a recorded panel decision.')
}
if (rec.gate4_number === null) {
  console.log('note: no cost ceiling recorded. The tally reports this rate separately —')
  console.log('  a ceiling that is never set is the weakest part of the gate sequence.')
}
if (gate0 === 'NO') {
  console.log('\nSTANDING RULE: run the width-1 lane anyway (bar writer, one critic, verifier,')
  console.log('~150k). Then score it:')
  console.log(`  node scripts/refusal-log.mjs --score ${lineNo} --high-grounded <n> --outside <true|false>`)
}
