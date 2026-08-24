// Drift guard for loop.js: the loop carries its contract in two prompt surfaces
// — the round prompts inside the script, and the standing agent definitions it
// spawns — and either can be edited without the other. This pins them together,
// checks the tool allowlists the verdict claims, and scans for the runtime APIs
// and round-cap names that would silently change what the loop is.
//
//   node test/drift-guard.mjs
//
// Exit 0 = pinned. Exit 1 = drift. No dependencies.

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKILLDIR = join(ROOT, 'skills', 'gauntlet-loop')
const loop = readFileSync(join(SKILLDIR, 'loop.js'), 'utf8')

// The three agent types loop.js spawns. Each entry quotes the claim in the run's
// `enforced` list that goes false if the tool comes back.
const ALLOWLIST = [
  { agent: 'gauntlet-ab-critic', forbidden: ['Write', 'Edit', 'Agent', 'ListAgents', 'SendMessage'], buys: 'is claimed to have "no Write or Edit — it could not use those TOOLS to alter either artifact", and to be unable to reach the builder or another critic' },
  { agent: 'gauntlet-builder', forbidden: ['Agent', 'ListAgents', 'SendMessage'], buys: 'is claimed to be an agent type "with no Agent/ListAgents/SendMessage — it could not reach or spawn a critic"' },
  { agent: 'gauntlet-goal-check', forbidden: ['Write', 'Edit', 'Agent', 'ListAgents', 'SendMessage'], buys: 'is the only party that never sees both sides — it reports whether the reference attempts the goal at all, and cannot be swayed by what the candidate is good at' },
  { agent: 'gauntlet-lead', forbidden: ['Write', 'Edit', 'Agent', 'ListAgents', 'SendMessage'], buys: 'divides the goal but cannot build, judge, or spawn either party' },
  { agent: 'gauntlet-breaker', forbidden: ['Read', 'Grep', 'Glob', 'Agent', 'ListAgents', 'SendMessage', 'WebSearch', 'WebFetch', 'Write', 'Edit'], buys: 'is claimed to be an agent type "whose whole tool allowlist is Bash and which never saw the goal, either artifact, or any verdict"' },
]

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }

console.log('drift-guard: agent allowlists still deny what the verdict claims they deny')
for (const a of ALLOWLIST) {
  let text
  try {
    text = readFileSync(join(ROOT, 'agents', `${a.agent}.md`), 'utf8')
  } catch {
    fail(`${a.agent}.md is missing — loop.js names it as an agentType`)
    continue
  }
  const m = text.match(/^tools:\s*(.+)$/m)
  if (!m) { fail(`${a.agent}.md has no tools: line — an unrestricted agent enforces nothing`); continue }
  const granted = m[1].split(',').map(t => t.trim()).filter(Boolean)
  for (const bad of a.forbidden) {
    if (granted.includes(bad)) fail(`${a.agent} was granted "${bad}" — it ${a.buys}, and that property is now only a promise`)
  }
}

// loop.js is a second Workflow script under the same runtime constraints as
// the Workflow runtime's constraints (no import/require, no filesystem, no Node
// APIs; Date.now(),
// Math.random() and argless new Date() THROW in the real runtime). Nothing
// previously guarded it. This is a static scan, not execution — the offline
// harness in test/harness.mjs runs scripts via AsyncFunction, which happily
// executes these calls, so a passing test there is not evidence they are
// runtime-safe. Comments are stripped first: loop.js legitimately DISCUSSES
// Math.random() in prose (explaining why alternation replaces it), and that
// mention must not itself trip the guard.
function stripLineComments(src) {
  return src.split('\n').map(line => {
    const idx = line.indexOf('//')
    return idx === -1 ? line : line.slice(0, idx)
  }).join('\n')
}

const RUNTIME_FORBIDDEN = ['import ', 'require(', 'Date.now', 'Math.random', 'new Date()']

console.log('drift-guard: loop.js runtime-safety scan (no import/require/Date.now/Math.random/new Date())')
const loopCode = stripLineComments(loop)
for (const forbidden of RUNTIME_FORBIDDEN) {
  if (loopCode.includes(forbidden)) fail(`loop.js contains "${forbidden}" outside a comment — this throws in the real Workflow runtime`)
}

// NO ROUND CAP. The primary source contains no round language at all — its
// stop clauses are "it should keep going", "Don't stop until…" and "/loop until
// it's utterly perfect" — and the meta-prompt forbids the parameter by name:
// "Do not prescribe the architecture, exact decomposition, or a fixed number of
// rounds." A cap is the easiest thing in this file to reintroduce, because it
// makes tests terminate and makes runs feel safe, and it would be the one
// change that quietly turns the loop back into a bounded pipeline.
//
// This scans STRIPPED source, so the comments that explain the absence do not
// trip it. It cannot catch every possible cap — someone determined could write
// `if (round > n) break` with a computed n — so it is a tripwire on the known
// names, not a proof. The behavioural proof is in test/loop.test.mjs, where an
// unbounded run must run past the old default until the harness stops it.
const CAP_NAMES = ['maxRounds', 'MAX_ROUNDS', 'HARD_CAP', 'ROUND_CAP', 'maxIterations']

console.log('drift-guard: loop.js has no round cap (the source forbids a fixed round count)')
for (const name of CAP_NAMES) {
  if (loopCode.includes(name)) {
    fail(`loop.js contains "${name}" outside a comment — the loop's terminators are a win, an operator cancel and a budget. A round cap is "the arbitrary final round" the source forbids.`)
  }
}

// ---------------------------------------------------------------------------
// loop.js carries its contract in TWO prompt surfaces: the standing agent
// definitions under agents/ (the system prompt each spawn is born with) and the
// round prompts rendered inside loop.js. Either can be edited without the other
// — a prompt duplicated across two surfaces drifts unless something pins it.
//
// Issue #16 is what the failure looks like: the source's one requirement on the
// judge — "a really harsh critic" — was present in loop.js only inside a comment
// quoting the source, while the live prompt asked for a neutral comparison. So
// the loop.js side is checked against COMMENT-STRIPPED source. A clause that
// survives only in a comment fails here, which is the point: a comment is not a
// prompt, and no agent ever reads one.
//
// Needles are per-file because the two surfaces legitimately differ in case and
// wording (a prompt shouts "BE A REALLY HARSH CRITIC"; a system prompt does not).
// ---------------------------------------------------------------------------
const LOOP_PINNED = [
  { loop: 'BE A REALLY HARSH CRITIC', agent: 'gauntlet-ab-critic', needle: 'really harsh critic',
    what: "the source's one requirement on the judge (\"That separate sub-agent should be a really harsh critic\")" },
  { loop: 'a tie is a critic declining to look closely enough', agent: 'gauntlet-ab-critic', needle: 'critic declining to look closely enough',
    what: 'the forced binary — no "they are comparable" exit' },
  { loop: 'the single largest thing', agent: 'gauntlet-ab-critic', needle: 'the single largest thing',
    what: 'ONE gap comes back, and it is the largest' },
  { loop: 'matte plastic under the same light', agent: 'gauntlet-ab-critic', needle: 'matte plastic under the same light',
    what: 'the concrete-enough-to-act-on example that defines what a gap must look like' },
  { loop: 'the next verdict uninterpretable', agent: 'gauntlet-builder', needle: 'the next verdict uninterpretable',
    what: 'the builder fixes exactly one gap, because a five-change round cannot be read' },
  { loop: 'breaker that cannot be read', agent: 'gauntlet-breaker', needle: 'breaker that cannot be read',
    what: 'the circuit breaker fails SAFE — an unreadable probe stops the run rather than continuing it' },
]

// Same rule as DISCLOSURES above, for loop.js: a residual that can be deleted
// without failing a test is not a disclosure.
const LOOP_DISCLOSURES = [
  'Nothing verifies that a harsh INSTRUCTION produced a harsh CRITIC',
  'NO RATCHET, and that is a decision rather than an omission',
  // k>1 is ours, not the source's. Both primary texts say one critic per piece.
  // If this line goes, the verdict starts implying a precedent that does not
  // exist — which is the exact class this tracker files most.
  'ADDITION, not source fidelity',
  // Deleting the panel deleted the only calibration mechanism. If this line goes,
  // the plugin stops telling anyone that nothing checks its critics.
  'NO CALIBRATION ANYWHERE',
  // The lead chooses what gets judged and nothing checks its choice. If this line
  // goes, a run stops admitting that its own decomposition is unverified.
  'THE SPLIT IS NOT CHECKED',
  // A goal fitted to the candidate cannot discriminate, and the first live run of
  // this build was decided by exactly that. Both halves of the residual are
  // pinned: the reference-side finding, and the candidate-side hole nothing checks.
  // Both goal probes read TEXT. Neither can see when the goal was written or by
  // whom, which is the failure that actually decided the first live run.
  'nothing here can see when it was written',
  'not independent judgments',
]

console.log('drift-guard: loop.js round prompts pinned to the agent definitions they spawn')
for (const pin of LOOP_PINNED) {
  let text
  try {
    text = readFileSync(join(ROOT, 'agents', `${pin.agent}.md`), 'utf8')
  } catch {
    fail(`${pin.agent}.md is missing — loop.js names it as an agentType`)
    continue
  }
  const inLoop = loopCode.includes(pin.loop)
  const inAgent = text.includes(pin.needle)
  if (inLoop && inAgent) continue
  if (!inLoop && !inAgent) fail(`${pin.what}: gone from BOTH loop.js and ${pin.agent}.md`)
  else if (!inLoop) fail(`${pin.what}: ${pin.agent}.md still says "${pin.needle}", but loop.js has no LIVE "${pin.loop}" — if it is only in a comment now, no agent reads it`)
  else fail(`${pin.what}: loop.js still renders "${pin.loop}", but ${pin.agent}.md no longer says "${pin.needle}" — the standing prompt is stale`)
}

console.log('drift-guard: required disclosures present in loop.js')
for (const needle of LOOP_DISCLOSURES) {
  if (!loop.includes(needle)) fail(`"${needle}" — not found in loop.js; a not_enforced disclosure was removed or reworded away`)
}

// ---------------------------------------------------------------------------
// CROSS-LANE CONTRACT — the first check in this file whose subject is the
// RELATION between lanes rather than any one file.
//
// Everything above pins loop.js against its own agent definitions — one lane,
// checked against itself. This check is the other kind: it asks what the
// DIRECTORY contains and holds every comparer lane it finds to the same
// contract, including lanes that do not exist yet.
//
// That distinction was learned the expensive way. When this repo had two lanes,
// the same defect — a blind comparer losing its instruction not to reason about
// provenance — was caught in one lane and invisible in the other, because only
// one of them happened to have a paired prompt-authority file. Placement, not
// importance, decided whether anything noticed. A check that lists the lanes it
// guards reproduces that hole the moment a lane is added; a check that discovers
// them does not.
//
//   a LANE            = a .js in the skill dir that spawns agents
//   a BLIND COMPARER  = a lane declaring a side-naming field whose domain is a
//                       closed two-option enum. That is the structural signature
//                       of a forced binary choice and does not depend on the
//                       naming convention any particular lane uses.
//
// Checked against COMMENT-STRIPPED source, same rule as LOOP_PINNED: a clause
// surviving only in a comment reaches no agent.
const LANE_IS_COMPARER = /(winner|ours_side|side)\s*:\s*\{[^}]*enum:\s*\[\s*'[^']+'\s*,\s*'[^']+'\s*\]/

const COMPARER_CONTRACT = [
  { test: /provenance/i, what: 'tells its comparer not to reason about provenance — without it the blind A/B is blind in name only' },
  { test: /\btie\b/i, what: 'forces the choice, with no tie available — a tie is the "seems fine" exit this comparison exists to refuse' },
]

console.log('drift-guard: every blind-comparer lane carries the shared comparer contract')
const laneFiles = readdirSync(SKILLDIR).filter(f => f.endsWith('.js')).sort()
let comparerLanes = 0
for (const f of laneFiles) {
  const src = stripLineComments(readFileSync(join(SKILLDIR, f), 'utf8'))
  if (!src.includes('await agent(')) continue          // not a lane: spawns nothing
  if (!LANE_IS_COMPARER.test(src)) continue            // a lane, but runs no forced two-sided choice
  comparerLanes++
  for (const c of COMPARER_CONTRACT) {
    if (!c.test.test(src)) {
      fail(`${f} runs a blind two-sided comparison but no longer ${c.what}. This is a CROSS-LANE property: ` +
           'every comparing lane owes it, and a lane is covered here because it was discovered in the directory, not because it was listed.')
    }
  }
}
if (comparerLanes === 0) {
  fail('no blind-comparer lane was discovered in ' + SKILLDIR + ' — either both lanes lost their forced-choice schema, or the detector needs updating. A check that matches nothing cannot fail informatively.')
}

// The line of critics is a CONCURRENCY claim: k critics judging the same
// artifact must be spawned together, not walked one at a time. Sequential
// spawning would still pass every behavioural test in loop.test.mjs — the
// verdicts and the split would be identical — while quietly turning one round
// into k round-lengths of wall clock. So the claim is tied to something
// checkable rather than trusted, in the same style as the AT-map scan below.
console.log('drift-guard: loop.js escalates the critic line through parallel(), not a sequential walk')
if (!/await parallel\(/.test(loopCode)) {
  fail('loop.js no longer calls parallel() outside a comment — a line of k critics spawned sequentially costs k times the wall clock and nothing in the behavioural tests would notice')
}

if (failures) {
  console.error(`\ndrift-guard: ${failures} failure(s) — the script and its prompt authority have diverged.`)
  process.exit(1)
}
console.log(`\ndrift-guard: OK — ${LOOP_PINNED.length} prompt clauses pinned between loop.js and its agent definitions, ${comparerLanes} comparer lane(s) holding the cross-lane contract, ${ALLOWLIST.length} allowlists still denying, ${LOOP_DISCLOSURES.length} disclosure(s) present, loop.js clean of ${RUNTIME_FORBIDDEN.length} forbidden runtime APIs and ${CAP_NAMES.length} round-cap names.`)
