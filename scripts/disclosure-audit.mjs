// Which pinned disclosures are EXERCISED, and which are only present?
//
//   node scripts/disclosure-audit.mjs [--json]
//
// ISSUE 54. loop.js's not_enforced list said "the source gets width by
// decomposing the goal, WHICH THIS LOOP DOES NOT DO". The loop decomposes. That
// sentence was pinned in test/drift-facts.mjs, drift-guard failed if it vanished,
// and scripts/guard-sweep.mjs broke it and confirmed drift-guard went red AND
// named it. All of that machinery faithfully protected a false statement, because
// a disclosure is pinned for PRESENCE and nothing checks it is TRUE.
//
// That is worse than an unpinned false claim: a reader who sees a disclosure
// covered by a guard reasonably concludes someone checked it.
//
// THE FIX IS A PARTITION, NOT AN ASSERTION PER SENTENCE. Nineteen truth-checks
// would be one entry per disclosure — the 1:1 growth this project calls cheating,
// and it would go stale the moment a twentieth was written. Instead every pinned
// disclosure must be one of two things, and which one is DISCOVERED:
//
//   EXERCISED    a behavioural test names it in live code. The test drives the
//                loop and the disclosure's text appears in the test's source with
//                comments stripped — so a mention in prose does not count, which
//                is the same stripper drift-guard uses and for the same reason.
//   ADJUDICATED  recorded as unexercisable, with the reason. Some claims cannot
//                be run: "nothing verifies that a harsh INSTRUCTION produced a
//                harsh CRITIC" has no behavioural form, and saying so is half the
//                answer rather than a gap in it.
//
// Anything that is neither is a sentence nobody has checked and nobody has
// admitted cannot be checked. That count can only go down, and a new disclosure
// has to declare which kind it is.
//
// WHAT "EXERCISED" IS WORTH, stated because this check is one level down from the
// defect it exists for: it is a FLOOR, not a proof. A behavioural test naming a
// disclosure in live code is evidence someone connected the two; it is not
// evidence the assertion checks the claim. The honest reading is "a human wired
// this sentence to a run", and the remedy for the rest is reading the test.
//
// NOTHING HERE SPAWNS.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { LOOP_DISCLOSURES } from '../test/drift-facts.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ADJ = process.env.DISCLOSURE_ADJUDICATIONS || join(ROOT, 'docs', 'disclosure-adjudications.jsonl')
const argv = process.argv.slice(2)

// The same stripper drift-guard carries, for the same reason: a clause that
// survives only inside a comment is not code, and a disclosure discussed in a
// header is not a disclosure that was tested.
function stripLineComments(src) {
  return src.split('\n').map(line => {
    const i = line.indexOf('//')
    return i === -1 ? line : line.slice(0, i)
  }).join('\n')
}

const norm = s => String(s).replace(/\s+/g, ' ').trim()
// Long enough to be distinctive, short enough that a test can quote it inside an
// assertion message without reproducing a paragraph.
const KEY_LEN = 40
export const disclosureKey = d => norm(d).slice(0, KEY_LEN)

// THE PIN ITSELF IS NOT EVIDENCE. drift-facts holds the sentences and drift-guard
// checks they are present; counting either as "exercised" would make every
// disclosure exercised by definition, which is the defect this file exists for.
const NOT_EVIDENCE = new Set(['drift-facts.mjs', 'drift-guard.mjs'])

export function auditDisclosures(disclosures, tests) {
  return disclosures.map(d => {
    const key = disclosureKey(d)
    const by = tests.filter(t => t.behavioural && t.live.includes(key)).map(t => t.name)
    const mentionedOnly = tests.filter(t => !by.includes(t.name) && t.raw.includes(key)).map(t => t.name)
    return { disclosure: d, key, exercised_by: by, mentioned_only_by: mentionedOnly }
  })
}

const testFiles = readdirSync(join(ROOT, 'test'))
  .filter(f => f.endsWith('.mjs') && !NOT_EVIDENCE.has(f))
  .map(f => {
    const raw = readFileSync(join(ROOT, 'test', f), 'utf8')
    const live = norm(stripLineComments(raw))
    // A test that never drives the loop cannot exercise a claim about the loop.
    return { name: `test/${f}`, raw: norm(raw), live, behavioural: /from '\.\/harness\.mjs'/.test(raw) }
  })

const adjudicated = new Map()
if (existsSync(ADJ)) {
  for (const line of readFileSync(ADJ, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try { const a = JSON.parse(line); if (a.key) adjudicated.set(a.key, a) } catch { /* malformed is missing */ }
  }
}

const rows = auditDisclosures(LOOP_DISCLOSURES, testFiles)
let unaccounted = 0
console.log(`disclosure-audit: ${LOOP_DISCLOSURES.length} pinned disclosure(s), ${testFiles.filter(t => t.behavioural).length} behavioural test file(s)`)
for (const r of rows) {
  const a = adjudicated.get(r.key)
  if (r.exercised_by.length) {
    console.log(`  EXERCISED    ${r.key}…  by ${r.exercised_by.join(', ')}`)
  } else if (a) {
    console.log(`  ADJUDICATED  ${r.key}…  ${a.verdict}`)
  } else {
    unaccounted++
    const extra = r.mentioned_only_by.length
      ? `  (mentioned in ${r.mentioned_only_by.join(', ')}, but only in comments or by a test that never drives the loop)`
      : ''
    console.log(`  UNCHECKED    ${r.key}…${extra}`)
  }
}

console.log()
const ex = rows.filter(r => r.exercised_by.length).length
console.log(`disclosure-audit: ${ex} exercised, ${rows.length - ex - unaccounted} adjudicated, ${unaccounted} neither`)
// THE RESIDUAL, ON EVERY BRANCH.
console.log('disclosure-audit: NOT ESTABLISHED — that an EXERCISED disclosure is true. This checks that a')
console.log('                  behavioural test names it in live code, which is evidence a human wired the')
console.log('                  sentence to a run; it is not evidence the assertion checks the claim. It is a')
console.log('                  floor. The defect that produced this file was a false sentence that every')
console.log('                  automated check around it was satisfied by, and this check is one level down')
console.log('                  from that — it can be satisfied by a test that quotes without asserting.')

if (argv.includes('--json')) console.log(JSON.stringify(rows, null, 2))
if (unaccounted) process.exit(1)
