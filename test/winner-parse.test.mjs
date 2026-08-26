// THE REPRODUCIBLE for #53: parseWinner drops responses that answer the prompt,
// and reads an answer out of prose that does not.
//
//   node test/winner-parse.test.mjs
//
// COMMITTED FAILING.
//
// Three of fifteen degraded trials are recorded `picked: null` and excluded from
// the detection rate. All three state their answer on the first line of the
// response, in the form the prompt asked for:
//
//   **1. WINNER — A**
//   **1. WINNER — B**
//   **1. WINNER — A** (`b/subject.md`, 63 lines)
//
// The parser requires a `#` heading. Nothing in the prompt asks for one — it asks
// for a numbered list, `1. WINNER — A or B` — so the parser demands a form the
// instrument never specified and drops the responses that comply most literally.
//
// A 20% drop rate set by markdown decoration is a selection step nobody chose,
// applied after the fact, on a criterion uncorrelated with anything being
// measured, and it silently narrows every interval computed from the ledger.
//
// WHAT THE FIX MAY NOT BE: a wider catalogue of markdown shapes. Adding
// `**N. LABEL**` because three responses used it is one pattern per incident and
// says nothing about the shape nobody has emitted yet. The rule here is derived
// from the PROMPT: the prompt states a numbered template whose item labels are
// ALL-CAPS words, so a section line is a line that carries one of THOSE labels,
// after markdown decoration and an optional item number are stripped. Change the
// prompt's labels and the parse follows; invent a new bold style and it still
// works; write the word in lowercase prose and it is not a section line.
//
// AND WHAT THE ANSWER IS WITHIN THE SECTION: the template reads `1. WINNER — A
// or B`, so the answer is the value that follows the label. The FIRST answer
// token in the section is taken, which is what "follows the label" means when the
// critic keeps writing afterwards. That is not cosmetic — one response reads
// `**1. WINNER — A** ... Narrow win. Neither meets goal.` and a parser scanning
// for `neither` anywhere in the block answers `neither` to a response that said A.
//
// NOTHING HERE SPAWNS. Pure text in, verdict out, plus the stubbed harness to
// obtain the prompt whose template the rule is derived from.

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseWinner, templateLabels, DEPLOYED_LABELS } from '../scripts/detection-parse.mjs'
import { runLoop } from './harness.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }
const eq = (got, want, m) => ok(got === want, `${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)

// --------------------------------------------------------------------------
// THE LABELS COME FROM THE PROMPT, and that is checked against the prompt rather
// than trusted. A default list is a pin; a pin covers what someone thought to
// enumerate. This one is crossed against the deployed template on every run, so
// the day the prompt renames an item the parse is not quietly reading a label
// that no longer exists.
// --------------------------------------------------------------------------
console.log('winner-parse: the item labels are the ones the deployed prompt states')
{
  const r = await runLoop({
    args: { goal: 'g', candidate: '/x/a/subject.md', reference: '/x/b/subject.md', token: '/winner-parse/unused' },
    rounds: [{ candidateWins: true, gap: 'g', margin: 'clear' }],
  }).catch(e => { fail(`the stubbed loop threw: ${e.message}`); return null })
  const ab = r && r.prompts.find(p => /:ab$/.test(p.label))
  const labels = ab ? templateLabels(ab.prompt) : null
  console.log(`          from the prompt: ${labels ? labels.join(', ') : '(none read)'}`)
  ok(labels && labels.length >= 2, 'the deployed prompt states a numbered template this can read')
  ok(labels && labels[0] === 'WINNER', `the first item of the deployed template is WINNER, not ${labels && labels[0]}`)
  ok(labels && JSON.stringify(labels) === JSON.stringify(DEPLOYED_LABELS),
     `the labels read from the deployed prompt (${labels && labels.join(', ')}) differ from the defaults the parse falls back to (${DEPLOYED_LABELS.join(', ')}) — the fallback is stale, and a parse reading a label the prompt no longer uses drops every response`)
}

// --------------------------------------------------------------------------
// THE SHAPES. Each is a claim about the RULE, not a catalogue entry: strip
// decoration, strip an item number, require the label in the template's own case
// at the start of what remains.
// --------------------------------------------------------------------------
console.log('winner-parse: a section line is one carrying a template label, however it is decorated')
{
  eq(parseWinner('**1. WINNER — B**'), 'B', 'a bolded numbered item')
  eq(parseWinner('**1. WINNER — A** (`b/subject.md`, 63 lines). Narrow win.'), 'A', 'a bolded item with the file named after it')
  eq(parseWinner('## 1. WINNER\n\n**A** — but by declared coin-flip, not by merit'), 'A',
     'the answer on the line after the heading — the false negative the parse header already records')
  eq(parseWinner('1. WINNER — A'), 'A', 'the bare numbered form the prompt literally asks for')
  eq(parseWinner('#### WINNER: B'), 'B', 'a heading with no item number')
  eq(parseWinner('**WINNER**\n\nB'), 'B', 'a bolded label with the answer beneath it')
}

console.log('winner-parse: prose is not a section line')
{
  // THE FALSE POSITIVE THE PARSE HEADER RECORDS. It matched `winner` followed
  // anywhere on the line by a standalone A, and read a control that had
  // correctly called the files identical as a pick for A.
  eq(parseWinner('There is no honest winner. Not tie-from-laziness — tie from measurement. `cmp` returns 0 and A is B.'), null,
     'the word "winner" inside a sentence is not the template item')
  eq(parseWinner('I considered which artifact is the winner and could not say. A and B are the same file.'), null,
     'lowercase prose mentioning both letters')
  eq(parseWinner('Compare two artifacts and pick the better one.'), null, 'a response that never answers item 1')
  eq(parseWinner(''), null, 'an empty response')
}

console.log('winner-parse: the answer is the value that FOLLOWS the label')
{
  // A response that picks A and then says neither artifact is good is a pick for
  // A. Scanning the whole block for `neither` inverts it.
  eq(parseWinner('**1. WINNER — A**. Narrow win. Neither meets the goal.'), 'A',
     'a pick followed by a remark that neither artifact is good enough')
  eq(parseWinner('## 1. WINNER\n\nNone. Not a tie from shallow looking — a literal identity.'), 'neither',
     'a refusal to pick, stated as "None"')
  eq(parseWinner('## 1. WINNER\n\nNeither — the files are byte-identical.'), 'neither', 'a refusal stated as "Neither"')
  eq(parseWinner('## 1. WINNER\n\n**A** — by coin-flip convention only, not earned. Reporting a fabricated distinction would be worse than reporting the tie.'), 'A',
     'a pick with a disclaimer that mentions a tie is a PICK; the disclaimer is declared_no_difference’s job, and merging them is how a control set stops controlling')
}

console.log('winner-parse: a label is a word, not a prefix')
{
  // BUILT BECAUSE A MUTATION SURVIVED. Deleting the word-boundary requirement
  // in sectionLabelAt left every other case in this file passing — the property
  // was asserted in code and never given an input that needs it, which is this
  // repository's own rule about checks that cannot fail, one level in: the
  // check existed, and nothing established that it did anything. Both cases
  // below have a real consequence — an answer is lost, not a label misread.
  eq(parseWinner('## 1. WINNER\n\nThe two differ.\nGAPS between them are large, and B closes more of them.'), 'B',
     'a line beginning GAPS does not end the WINNER item — without the boundary the answer beneath it is discarded')
  eq(parseWinner('WINNERLESS comparison follows.\n\n## 1. WINNER\n\nB'), 'B',
     'a line beginning WINNERLESS does not start the WINNER item — without the boundary the real answer is never reached')
}

console.log('winner-parse: the section ends where the next item begins')
{
  eq(parseWinner('## 1. WINNER\n\nThe files differ.\n\n## 2. WHY\n\nB is longer.'), null,
     'an item 1 that never names a side does not borrow the answer from item 2')
  eq(parseWinner('## 1. WINNER\n\nB\n\n## 2. WHY\n\nA has more sections.'), 'B',
     'and item 2 cannot overturn an answer item 1 gave')
}

// --------------------------------------------------------------------------
// THE RESPONSES ON DISK, and the drop rate they produce. Reported on every run,
// because a parser that reads 20 of 20 by guessing is worse than one that reads
// 15 and says so, and only the drop rate tells them apart.
// --------------------------------------------------------------------------
console.log('winner-parse: the responses on disk, and what fraction go unread')
{
  const RAW = join(ROOT, 'runs', 'detection-raw')
  const LEDGER = join(ROOT, 'runs', 'detection.jsonl')
  if (!existsSync(RAW) || !existsSync(LEDGER)) {
    console.log('          no responses on disk — nothing to measure a drop rate on')
  } else {
    const rows = readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
    let read = 0, dropped = []
    for (const r of rows) {
      const p = join(RAW, `${r.opaque}.txt`)
      if (!existsSync(p)) continue
      const got = parseWinner(readFileSync(p, 'utf8'))
      if (got === null) dropped.push(r.trial_id); else read++
    }
    const total = read + dropped.length
    console.log(`          read ${read}/${total}; dropped ${dropped.length}${dropped.length ? ' — ' + dropped.join(', ') : ''}`)
    ok(dropped.length === 0,
       `${dropped.length} of ${total} responses on disk state no answer this parse can read (${dropped.join(', ')}). Each one excluded from the rate is a trial that was paid for and not counted; read them or record why they are genuinely unanswerable.`)
    // THE THREE #53 NAMES, asserted individually so a regression cannot hide
    // inside an aggregate that happens to stay at zero.
    for (const [opaque, want, why] of [
      ['75cb6afd3a41', 'A', 't02 answers "**1. WINNER — A**" on its first line'],
      ['06debd894040', 'B', 't14 answers "**1. WINNER — B**" on its first line'],
      ['e050810d2d04', 'A', 't13 answers "**1. WINNER — A** (`b/subject.md`, 63 lines)"'],
      ['e05703f6fdcb', 'neither', 'c02 answers "None. Not a tie from shallow looking — a literal identity."'],
      ['99801a576879', 'A', 'c05 answers "**A** — by coin-flip convention only", which is a pick with a disclaimer, not a refusal'],
    ]) {
      const p = join(RAW, `${opaque}.txt`)
      if (!existsSync(p)) { fail(`${opaque}.txt is not on disk — the case #53 rests on is missing`); continue }
      eq(parseWinner(readFileSync(p, 'utf8')), want, why)
    }
  }
}

console.log('winner-parse: stating what this cannot establish')
console.log('          NOT MEASURED: whether a response this parse reads was read CORRECTLY. Five are')
console.log('          checked against a human reading above; the rest rest on the rule. A parser can')
console.log('          only be wrong in two directions and this file constrains both, on a small set.')

if (failures) {
  console.error(`\nwinner-parse: ${failures} failure(s) — a parser that drops answers sets the denominator by accident.`)
  process.exit(1)
}
console.log('\nwinner-parse: OK — labels derived from the prompt, sections read however decorated, prose refused, drop rate reported.')
