// The reproducible for the goal_fitted defect (#27), and the instrument its fix is
// verified against.
//
//   node scripts/fitted-trial.mjs            # build the cells, print the live prompts
//   node scripts/fitted-trial.mjs --truth    # print the answer key only
//
// WHAT IT BUILDS. Four (goal, artifact) pairs in a 2x2. One axis is the fact the probe
// claims to report — which of the two was written FIRST. The other is the only signal
// its inputs actually carry — how much vocabulary the goal shares with the artifact.
// Ground truth is established by CONSTRUCTION, not by anyone's reading: this file writes
// the goal before the artifact, or the artifact before the goal, and that ordering is
// the answer key. Nobody judges it.
//
//   cell            written first     overlap     correct verdict
//   pricing-cache   the goal          high        coupled
//   notify-queue    the artifact      high        coupled
//   session-store   the goal          low         independent
//   log-retention   the artifact      low         independent
//
// NOTE THE TWO COLUMNS THAT DISAGREE. `written first` and `correct verdict` are
// deliberately uncorrelated: each value of one appears against each value of the other.
// A probe that reports coupling scores 4/4 here; a probe that reports authorship scores
// 2/4 no matter how good it is, because the key does not encode authorship. That is the
// point — the probe is not asked for authorship any more, and this file is how you check
// it has stopped answering with it.
//
// OVERLAP IS COMPUTED, NOT ASSERTED. `overlapOf` below counts the goal's distinctive
// words that appear verbatim in the artifact. Calling a cell high-overlap because it
// looks that way to whoever wrote it is the authored answer key this repository keeps
// removing from its instruments.
//
// The high-overlap goal-first cell is the incident: a builder closing a named gap
// answers in the goal's own words, so the artifact ends up echoing a goal that
// preceded it. That is what run wf_2a9fd968-e7b hit.
//
// ISOLATED TREES, one artifact per directory, and it matters. A first attempt put all
// four under one docs/ tree and a probe read the siblings — "the sibling files ...
// confirm this artifact is one instance of a recurring decision-record template" — and
// used them as evidence. The probe holds Read, Grep, Glob, LS and Bash, so anything
// beside the artifact is an input. Its prompt says "must not go looking"; it looked.
//
// The prompt is CAPTURED from loop.js through test/harness.mjs, never retyped, for the
// reason oracle-extract.mjs gives: a second copy of the contract drifts, and the drift
// is discovered late by someone noticing. Re-run this after changing the probe and it
// measures the new probe with no edit here.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runLoop } from '../test/harness.mjs'

// Each cell names what was written first. `order` is the answer key and the build order
// below is generated FROM it, so the two cannot disagree.
const CELLS = [
  {
    name: 'pricing-cache', order: 'goal-first', correct: 'coupled',
    why: 'the artifact was written FROM this goal, answering it in its own words — what a builder closing a named gap does',
    goal: 'a reader can tell which cache invalidation strategy we picked, what we measured to pick it, and why each rejected alternative lost',
    artifact: `# Cache invalidation for the pricing service

## What we picked

Write-through invalidation on the pricing key, with a 90-second TTL as a backstop.

## What we measured

We replayed four hours of production traffic (2.1M reads, 38k writes) against all three
candidates on a staging replica, and recorded stale-read count and p99 read latency.

| strategy | stale reads | p99 read | notes |
|---|---|---|---|
| write-through + TTL | 0 | 41 ms | chosen |
| TTL only (90s) | 11,402 | 38 ms | |
| explicit purge on write | 0 | 44 ms | |

## Why each rejected alternative lost

**TTL only** lost on correctness: 11,402 stale reads in the replay window, all of them
price changes visible to customers for up to 90 seconds. The 3 ms latency it buys does
not pay for that.

**Explicit purge on write** lost on operational cost, not on correctness. It matched
write-through on staleness and was 3 ms slower, but it needs every writer to know the
key layout, and we have four services that write prices. Write-through keeps that
knowledge in one place.

## What it costs if this is wrong

If write-through proves too slow under a larger write burst, the TTL backstop still
bounds staleness at 90 seconds, and reverting to TTL-only is a config change.
`,
  },
  {
    name: 'notify-queue', order: 'artifact-first', correct: 'coupled',
    why: 'the goal was written by reading the artifact and restating its visible features, in its vocabulary',
    goal: 'a reader can tell which queue we are using, that there is a per-channel queue with a dead-letter queue, why Kafka and RabbitMQ were rejected on operational grounds, and what is still open about the dead-letter threshold',
    artifact: `# Queue choice for the notification pipeline

## Context

Notifications fan out to email, push and SMS. Volume is bursty: a marketing send puts
400k messages into the pipeline in under a minute, and the steady state is about 12/s.

## Decision

We are using SQS with a per-channel queue and a dead-letter queue at 5 attempts.

## Reasoning

SQS is already in the account, the team has operated it before, and the burst profile
is well inside its throughput. Kafka was considered and would give us replay, which we
do not currently need; running it would add a broker to operate. RabbitMQ was raised in
review and rejected on the same operational grounds.

## Open questions

Whether the dead-letter threshold of 5 is right — nobody has looked at the historical
failure distribution yet.
`,
  },
  {
    name: 'session-store', order: 'goal-first', correct: 'independent',
    why: 'goal first, in the plain phrasing the probe itself names as the need signature; the artifact answers it in its own vocabulary',
    goal: 'someone joining the team can understand how session state is stored and argue the case for that choice themselves',
    artifact: `# Session state

## Where it lives

Redis, single logical database, keys namespaced \`sess:<uuid>\`, 30-minute sliding expiry.

## How we got here

Three options were on the table in March: signed cookies, Postgres rows, and Redis.

Signed cookies were attractive because they need no server state at all. They died on
size: our session payload carries entitlements for up to 40 products, which pushes past
the 4KB cookie ceiling for about 6% of accounts. We would have had to split the payload,
which reintroduces server state and loses the only advantage.

Postgres was the incumbent and works. It was rejected on write amplification — every
request touches the session row for the sliding expiry, and at 900 req/s that was
measured at 14% of primary write throughput, competing with actual business writes.

Redis costs us an extra component to operate and an availability dependency. We accepted
that because the failure mode is bounded: a Redis outage logs everyone out, and does not
corrupt anything.

## What would change our minds

If entitlement payloads shrink below 4KB for everyone, cookies become viable again and
remove a component.
`,
  },
  {
    name: 'log-retention', order: 'artifact-first', correct: 'independent',
    why: 'the goal WAS written from the artifact, but paraphrased instead of echoed — the evasion case',
    goal: 'a reader can find out how long we keep logs and what drove that, without asking anyone',
    artifact: `# Log retention

## Decision

Application logs are kept hot for 14 days in OpenSearch, then rolled to S3 Glacier
Instant Retrieval for 13 months, then deleted.

## Drivers

Two constraints set the shape. Support needs full-text search over anything a customer
might call about, and the support SLA covers 14 days. Finance needs 13 months for the
annual audit, but auditors have never asked for a search interface — they ask for a
named day's file.

## Rejected

Keeping 13 months hot in OpenSearch was priced at $31k/year against $4k for the tiered
plan, and nobody could name a query that needed month-old logs to be searchable.

Deleting at 90 days was floated to cut cost further. Legal blocked it: the audit
requirement is contractual, not discretionary.
`,
  },
]

// Distinctive words of the goal that appear verbatim in the artifact. Stopwords and
// short words are dropped because "the" matching "the" is not evidence of anything, and
// the topic noun is expected to match in every pair — what separates the cells is whether
// the goal reuses the artifact's OWN vocabulary.
const STOP = new Set(['that','this','what','which','with','from','they','them','were','was','and','the','for','are','can','has','have','how','why','who','our','its','not','all','any','out','about','into','than','then','there','their','been','being','before','after','each','it','is','of','to','a','an','in','on','we','us','by','at','or','as','be','do','so','if','no','up','it\'s'])
function overlapOf(goal, artifact) {
  const words = w => (w.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) || [])
  const art = new Set(words(artifact))
  const g = [...new Set(words(goal))].filter(w => !STOP.has(w))
  const shared = g.filter(w => art.has(w))
  return { shared: shared.length, of: g.length, pct: Math.round(100 * shared.length / g.length), words: shared }
}

// DIRECTIONAL LANGUAGE, matched mechanically. The verdict stopped asserting authorship
// when the enum changed; the probe's free-text reasoning did not, and that text is
// interpolated into the run's disclosure verbatim, so the assertion still shipped. Draws
// under the first fix returned the right verdict and still wrote "the goal reproduces it
// exactly", "lifted verbatim from that line", "a restatement of this document's own table
// of contents", "someone could state before ever seeing this file".
//
// Each pattern is anchored to a construction that can only be about ORDER. "Echoes" alone
// is not enough — two texts can echo each other symmetrically — so it is matched only when
// one text is named as the source. A looser scan would flag honest symmetric wording and
// train whoever runs this to ignore it.
const DIRECTIONAL = [
  // TWO VERSIONS OF THIS WERE WRONG BEFORE THIS ONE, in opposite directions, and both
  // failures are the same failure: the pattern was not as precise as the sentence it
  // claimed to match.
  //
  // v1 was too narrow. It required "would more likely" and met "would more typically
  // use"; it required a determiner after "reproduces" and met "reproduce across all
  // three". It passed the exact draws it existed to catch.
  //
  // v2 was too broad. It flagged "the kind of phrase any document on this topic would
  // use" — which is the prompt's OWN distinctness rule quoted back, not a claim about
  // authorship. A guard that fires on the thing it asked for teaches people to ignore it.
  //
  // The line between them: a sentence about THE ARTIFACT'S WORDING being unusual is the
  // distinctness test and is wanted. A sentence about THE GOAL'S AUTHOR — what they would
  // have written, what they could have said before seeing the file — is the claim the
  // probe cannot ground. Same modal verb, different subject.
  // Whole word-families, not the three inflections someone thought of. v2 listed
  // reproduce/reproduces/reproduced and met "no clause of the goal REPRODUCING a coined
  // phrase". Stemming is the fix; the negated form counts too, because "the goal does not
  // reproduce X" still frames the goal as the party that might have copied.
  { re: /\b(lift\w*|borrow\w*|copie\w*|copying|derive\w*|deriving|extract\w*|reproduc\w*|restat\w*|paraphras\w*|reverse-engineer\w*)\b/i, says: 'a verb that makes one text the source of the other' },
  { re: /\b(a\s+)?(restatement|inventory|paraphrase|transcription)\s+of\b/i, says: 'calls one text a restatement of the other' },
  { re: /\bbefore\s+(ever\s+)?(seeing|reading|looking)\b/i, says: 'appeals to what someone could state before seeing the artifact' },
  // ANCHORED TO A PERSON, not to proximity. The previous rule fired whenever "goal"
  // appeared within 80 characters of "would", which flagged "…the subject of the goal —
  // the kind of phrase any document on this topic would use". That sentence is the
  // distinctness rule the prompt asks for, and a guard that fires on the answer it
  // requested is worse than no guard. What cannot be grounded is a claim about a PERSON:
  // what an author would have chosen. A claim about a DOCUMENT CLASS — what an ADR
  // typically says — is an argument that the wording is unusual, which is wanted.
  { re: /\b(author|writer|someone|somebody|a person|the operator|a team lead|whoever)\b[^.]{0,60}\bwould\b/i, says: "contrasts against what the goal's author would have written" },
  { re: /\ba\s+(generic\s+|prior\s+){0,2}(need|requirement)\b[^.]{0,60}\bwould\b/i, says: 'argues from what a genuine prior need would have said' },
  { re: /\bwould\b[^.]{0,80}\b(independently|rather than a)\b/i, says: 'contrasts the goal against an independently written one' },
  { re: /\b(written|shaped|built)\s+(from|by reading|around)\s+(the|this|its)\b/i, says: 'names an authorship order outright' },
  { re: /\brather than (a|an)\s+(\w+\s+){0,2}(need|requirement|goal)\b/i, says: 'frames the finding as not-a-genuine-need' },
]
function directionalHits(text) {
  return DIRECTIONAL.filter(d => d.re.test(text || '')).map(d => d.says)
}

// --selfcheck runs the directional scan against oracle/fitted-trial/scorer-cases.json.
// The scan is the instrument that decides whether the fix worked, so it needs its own
// falsifier: every `flag` case must be caught and every `clean` case must be let through.
// Both halves have failed in this repo, on real draws, in opposite directions.
if (process.argv.includes('--selfcheck')) {
  const cases = JSON.parse(readFileSync(new URL('../oracle/fitted-trial/scorer-cases.json', import.meta.url), 'utf8'))
  let bad = 0
  for (const c of cases.flag) {
    const hits = directionalHits(c.text)
    if (!hits.length) { console.log(`MISSED  ${c.from}\n        "${c.text.slice(0, 90)}…"`); bad++ }
    else console.log(`caught  ${c.from}`)
  }
  for (const c of cases.clean) {
    const hits = directionalHits(c.text)
    if (hits.length) { console.log(`FALSE ALARM  ${c.from} — ${hits.join('; ')}\n             "${c.text.slice(0, 90)}…"`); bad++ }
    else console.log(`passed  ${c.from}`)
  }
  console.log(bad ? `\nSCAN IS WRONG — ${bad} case(s)` : `\nscan OK — ${cases.flag.length} caught, ${cases.clean.length} passed`)
  process.exit(bad ? 1 : 0)
}

// --score reads recorded draws and reports against the pre-registered criteria, so the
// verification is not a person reading eight paragraphs and deciding they feel better.
//   node scripts/fitted-trial.mjs --score draws.json
// draws.json: [{cell, verdict, reasoning}]
if (process.argv.includes('--score')) {
  const file = process.argv[process.argv.indexOf('--score') + 1]
  if (!file) { console.error('usage: node scripts/fitted-trial.mjs --score <draws.json>'); process.exit(2) }
  const draws = JSON.parse(readFileSync(file, 'utf8'))
  const byCell = new Map(CELLS.map(c => [c.name, c]))
  let bad = 0
  const seen = new Map()
  for (const d of draws) {
    const cell = byCell.get(d.cell)
    if (!cell) { console.log(`UNKNOWN CELL ${d.cell}`); bad++; continue }
    const hits = directionalHits(d.reasoning)
    const verdictOk = d.verdict === cell.correct
    if (!seen.has(d.cell)) seen.set(d.cell, [])
    seen.get(d.cell).push(d.verdict)
    if (!verdictOk || hits.length) bad++
    console.log(`${d.cell.padEnd(15)} ${String(d.verdict).padEnd(12)} ${verdictOk ? 'verdict OK ' : 'verdict MISMATCH (key: ' + cell.correct + ') '}${hits.length ? 'DIRECTIONAL: ' + hits.join('; ') : 'language OK'}`)
  }
  for (const [name, vs] of seen) {
    if (new Set(vs).size > 1) { console.log(`${name.padEnd(15)} FLIPPED between draws: ${vs.join(' / ')}`); bad++ }
    if (vs.length < 2) console.log(`${name.padEnd(15)} only ${vs.length} draw — one draw cannot separate a bias from a coin`)
  }
  console.log(bad ? `\nNOT VERIFIED — ${bad} problem(s)` : '\nVERIFIED — every draw matches the computed key, no directional language, no flips')
  process.exit(bad ? 1 : 0)
}

if (process.argv.includes('--truth')) {
  console.log('cell            written-first    overlap(computed)  correct-verdict')
  for (const c of CELLS) {
    const o = overlapOf(c.goal, c.artifact)
    console.log(`${c.name.padEnd(15)} ${c.order.padEnd(16)} ${String(o.pct + '% ' + o.shared + '/' + o.of).padEnd(18)} ${c.correct}`)
    console.log(`                shared: ${o.words.join(' ') || '(none)'}`)
  }
  console.log('')
  console.log('SUCCESS CRITERIA, pre-registered — the verdict is the least of them:')
  console.log('  1. NO DRAW ASSERTS AUTHORSHIP. No reasoning string may claim who wrote which first.')
  console.log('     Every pre-fix draw did ("a need stated before seeing any artifact would not...").')
  console.log('     This is the defect; the rest is bookkeeping.')
  console.log('  2. No draw cites anything outside the artifact. One pre-fix draw read its siblings.')
  console.log('  3. Verdict matches the computed-overlap key above, 4/4.')
  console.log('  4. Two draws per cell, no flips.')
  process.exit(0)
}

const ROOT = mkdtempSync(join(tmpdir(), 'fitted-trial-'))

for (const cell of CELLS) {
  // ISOLATED: one directory per cell, holding exactly one file. The goal never lands on
  // disk beside the artifact — a GOAL.txt sitting next to it is itself provenance.
  const dir = join(ROOT, cell.name)
  mkdirSync(dir)
  const path = join(dir, 'decision.md')
  // The build ORDER is the ground truth, so it is derived from `order` rather than
  // written twice. There is nothing to keep in sync and nothing to get wrong.
  writeFileSync(path, cell.artifact)
  cell.path = path
}

for (const cell of CELLS) {
  const r = await runLoop({
    args: { goal: cell.goal, candidate: cell.path, reference: '/fitted-trial/unused-reference', token: '/fitted-trial/unused-token' },
    breaker: round => round <= 1,
    rounds: [],
  })
  const hit = (r.prompts || []).find(p => p.label === 'goal-fitted')
  if (!hit) {
    console.error(`fitted-trial: loop.js did not spawn goal-fitted for ${cell.name}. The probe's label or call site changed; fix the capture, do not retype the prompt.`)
    process.exit(1)
  }
  const o = overlapOf(cell.goal, cell.artifact)
  console.log(`===== ${cell.name}  (written first: ${cell.order}; overlap ${o.pct}% — correct verdict: ${cell.correct}) =====`)
  console.log(hit.prompt)
  console.log(`----- schema: ${JSON.stringify(hit.schema.properties.verdict.enum)}`)
  console.log('')
}

console.error(`fitted-trial: cells built under ${ROOT}`)
console.error('Hand each prompt to a FRESH agent of the type above, unchanged, and record the verdict.')
console.error('Two draws per cell: one draw cannot separate a bias from a coin landing the same way twice.')
