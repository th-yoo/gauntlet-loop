// Every decision record carries what would make it wrong — issue 8's one non-negotiable.
//
//   node test/decisions.test.mjs
//
// Issue 8 asked for an output shape that presents options with their trade-offs and,
// for each, "what result would make it the wrong choice", because an option with no
// stated way to be wrong is advocacy wearing a table's clothes. Decision 0004 records
// that this shape is a document convention here rather than a run output: a decision
// the evidence does not settle is written under docs/decisions/ by the person deciding.
// This is the check that keeps the convention from decaying into advocacy — a record
// without a question, a decision, or a reopen section fails the suite, by name.
//
// DISCOVERED, not listed: every .md under docs/decisions/ is read. A fifth record is
// checked the moment it exists. What this cannot check is whether the reopen section
// names a measurement that could actually happen; that is the reader's, and the record
// itself says so.
//
// NOTHING HERE SPAWNS.

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = join(ROOT, 'docs', 'decisions')
let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }

// The three fields a record cannot lack. Each is matched as a HEADING, not as a word
// in prose, so a record that merely mentions reopening in passing does not pass.
const REQUIRED = [
  ['a question', /^## The question\b/m],
  ['a decision', /^## (The decision|What decided it)\b/m],
  ['what would reopen it', /^## What would reopen\b/m],
]

const files = readdirSync(DIR).filter(f => f.endsWith('.md')).sort()
console.log(`decisions: ${files.length} record(s) under docs/decisions/`)
ok(files.length > 0, 'at least one decision record exists — a convention with no instance is not one')
for (const f of files) {
  const text = readFileSync(join(DIR, f), 'utf8')
  ok(/^\*\*Status:\*\* decided, \d{4}-\d{2}-\d{2}\./m.test(text), `${f}: states its status and date`)
  ok(/\*\*Decided by:\*\*/.test(text), `${f}: says who decided`)
  for (const [what, re] of REQUIRED) {
    ok(re.test(text), `${f}: has no section for ${what} — a decision without ${what} is advocacy`)
  }
  // The alternatives. A record that weighs nothing against its choice decided nothing.
  ok(/^Declined, with reasons:|^## What was weighed against\b/m.test(text), `${f}: names the alternatives it declined, with reasons`)
  console.log(`          ${f}: question, decision, alternatives, reopen — present`)
}

console.log('decisions: stating what this cannot establish')
console.log('          NOT CHECKED: that a reopen section names a measurement that could happen, or that')
console.log('          the alternatives listed are the real ones. Headings prove the shape was filled;')
console.log('          whether it was filled honestly is the reader\'s, and each record says so itself.')

if (failures) { console.error(`\ndecisions: ${failures} failure(s) — a record without its falsifier is advocacy.`); process.exit(1) }
console.log('\ndecisions: OK — every record carries a question, a decision, its alternatives, and what would reopen it.')
