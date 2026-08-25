// Declare that two corpus rows form a PAIRING — the thing loop.js actually refuses on.
//
//   node scripts/oracle-pair.mjs --sides <rowA>,<rowB> [--id <id>] --note "<why>"
//
// WHY A PAIRING IS NOT A ROW. loop.js asks one factual question about each artifact ALONE
// and derives the verdict in code; a refusal fires when exactly one side is an
// instruction-writer. So the thing that refuses a run is a property of a PAIR under ONE
// goal, and the corpus stored one artifact per row with its own goal. Every observation it
// holds — 25 of them — is of the per-side classifier. None is of the verdict.
//
// It does not need a new kind of row, which was worth checking before building one: two
// rows can already share a goal today, and both are already grounded. What was missing is
// somewhere to say they form a pair, and something to derive what loop.js would answer.
//
// NOTHING DERIVED IS STORED. The pairing's expected verdict is computed from the two rows'
// expected roles every time it is read, by running loop.js — see oracle-derive.mjs. Storing
// it would be the defect #40 was filed for: a fact that can change, written down once. If a
// row's expected_role is later corrected, this follows; there is nothing to re-sync.

import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { verdictFor } from './oracle-derive.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CORPUS = process.env.ORACLE_CORPUS || join(ROOT, 'oracle', 'corpus.jsonl')
const PAIRINGS = process.env.ORACLE_PAIRINGS || join(ROOT, 'oracle', 'pairings.jsonl')

const argv = process.argv.slice(2)
const FLAGS = ['--sides', '--id', '--note']
const arg = n => { const i = argv.indexOf(n); const v = argv[i + 1]; return i === -1 || v === undefined || FLAGS.includes(v) ? null : v }
const sidesArg = arg('--sides')
const note = arg('--note')

if (!sidesArg || !sidesArg.includes(',')) {
  console.error('usage: node scripts/oracle-pair.mjs --sides <rowA>,<rowB> [--id <id>] --note "<why this pairing>"')
  console.error('Both must be existing corpus rows, they must share a goal, and they must be different artifacts.')
  process.exit(2)
}
const [a, b] = sidesArg.split(',').map(s => s.trim())

if (!existsSync(CORPUS)) { console.error(`pair: no corpus at ${CORPUS}`); process.exit(2) }
const rows = readFileSync(CORPUS, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
const byId = new Map(rows.map(r => [r.id, r]))

for (const id of [a, b]) {
  if (!byId.has(id)) {
    console.error(`pair: no corpus row "${id}". Known: ${rows.map(r => r.id).join(', ')}`)
    process.exit(2)
  }
}
const rowA = byId.get(a), rowB = byId.get(b)

// ONE GOAL, and this is the whole reason a pairing could not be assembled from what was
// already there. Role is goal-relative: the same artifact is does-the-work for one goal and
// an instruction-writer for another. Two rows with different goals are two measurements of
// two questions, and composing them would be arithmetic on unrelated numbers.
if (rowA.goal !== rowB.goal) {
  console.error(`pair: "${a}" and "${b}" do not share a goal, so they are not a pairing.`)
  console.error(`  ${a}: ${rowA.goal}`)
  console.error(`  ${b}: ${rowB.goal}`)
  console.error('Role is goal-relative — the same artifact answers differently under a different goal — so a')
  console.error('pairing is two artifacts under ONE goal. Add a row for one of these against the other\'s goal.')
  process.exit(2)
}
// loop.js refuses a run whose two sides are the same file, so a pairing that is one cannot
// be an oracle for it.
if (rowA.artifact === rowB.artifact) {
  console.error(`pair: both sides are ${rowA.artifact}. loop.js refuses a candidate compared against itself, so this pairing could never occur.`)
  process.exit(2)
}

const expected = await verdictFor(rowA.expected_role, rowB.expected_role)
const id = arg('--id') || `${a}--${b}`

mkdirSync(join(ROOT, 'oracle'), { recursive: true })
if (existsSync(PAIRINGS)) {
  const clash = readFileSync(PAIRINGS, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).find(p => p.id === id)
  if (clash) { console.error(`pair: pairing "${id}" already exists.`); process.exit(2) }
}
appendFileSync(PAIRINGS, JSON.stringify({ id, sides: [a, b], selection_note: note || null }) + '\n')

console.log(`paired ${id}: ${a} (${rowA.expected_role}) + ${b} (${rowB.expected_role})`)
console.log(`  under one goal: ${rowA.goal}`)
console.log(`  loop.js would answer: ${expected}  — derived by running it, and not stored`)
if (expected === 'comparable') {
  console.log('  This is the FALSE-REFUSAL cell: a refusal here would be wrong, and its rate is what decides')
  console.log('  whether an automatic refusal is safe to keep.')
}
if (!note) {
  console.error('note: no --note given. Why a pairing is in the corpus is what a later reader cannot reconstruct.')
}
