// Drift guard: gauntlet.js carries the critic contract inline (Workflow scripts
// cannot read files), so the script and critic-prompt.md can silently diverge.
// This pins them together.
//
//   node test/drift-guard.mjs
//
// Exit 0 = pinned. Exit 1 = drift. No dependencies.

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKILLDIR = join(ROOT, 'skills', 'gauntlet-loop')
const critic = readFileSync(join(SKILLDIR, 'critic-prompt.md'), 'utf8')
const script = readFileSync(join(SKILLDIR, 'gauntlet.js'), 'utf8')
const skill = readFileSync(join(SKILLDIR, 'SKILL.md'), 'utf8')
const loop = readFileSync(join(SKILLDIR, 'loop.js'), 'utf8')

// Load-bearing contract elements. Each MUST appear verbatim in both
// critic-prompt.md and gauntlet.js. Drop one from either and the review
// silently becomes a different instrument.
const PINNED = [
  // the anchor rule — the thing that separates a finding from an opinion
  'THE ANCHOR RULE — hard constraint',
  'Every finding needs an anchor OUTSIDE the artifact.',
  'SOURCE  — a paper/post/doc you opened.',
  'REPO    — a file on this machine.',
  'HARNESS — a demonstrable behavior of the tool.',
  'TRACE   — a scenario walked step by step',
  'If your best anchor is "in my judgment", you do not have a finding.',

  // stance — the measured +4pp protocol retains the adversarial role
  'Truth-seeking, not consensus-seeking',
  'STAY IN YOUR LANE',

  // the required output fields — missing ones are malformed by contract
  'falsifier:',
  'anchor-says:',
  'behavior-delta:',
  'GETS-RIGHT',
  'FAILED-ATTACK',
  'SPILLOVER',

  // finding ids must be addressable across critics, or the round-2 margin
  // tally cannot key on them
  'as the <id> prefix for every finding you file, so findings can be addressed by id across critics.',

  // verifier triad
  'EXISTS',
  'SAYS',
  'SUPPORTS',
  'GROUNDED-WEAK',
  'NOT-GROUNDED',
  'ABSENCE CLAIMS',

  // round 2 is a cross-check, not a re-argument
  'CROSS-CHECK',

  // the blind A/B comparer — a forced choice with no "seems fine" exit
  'You must pick a winner. A tie is not available.',
  'Speculation about provenance is not a judgment about quality.',
]

// Gate semantics that live in SKILL.md and are implemented in gauntlet.js.
// These pin the SCRIPT to the SKILL, the other direction of drift.
const GATE_SEMANTICS = [
  { skill: 'VOID ≠ miss', script: "status: 'VOID'", what: 'VOID is a distinct outcome from MISS' },
  { skill: 'Two VOIDs → NO VERDICT', script: 'voids >= 2', what: 'two VOIDs terminate' },
  { skill: 'Missed twice → NO VERDICT', script: 'misses >= 2', what: 'two misses terminate' },
  { skill: 'Gate 2 has **no veto**', script: 'YOU HAVE NO VETO', what: 'gate 2 cannot refuse the run' },
  { skill: 'The author doesn\'t write the bar', script: 'You have NOT been told what the artifact', what: 'bar writer is blind' },
  { skill: 'lenses uncalibrated', script: 'lenses uncalibrated', what: 'verdict carries the uncalibrated count' },
  { skill: 'only a MISS burns a defect kind', script: 'spentKinds.push', what: 'a VOID re-runs the same kind, so it must not consume one' },
  { skill: 'control arm', script: "status: 'FALSE-POSITIVE'", what: 'gate 7 has a specificity arm that can discard a catch' },
  { skill: 'dropped, and fewer than two survivors halts', script: 'deadCriteria', what: 'gate 6 is enforced in code, not warned about' },
  { skill: 'blind A/B', script: "enum: ['LEFT', 'RIGHT']", what: 'the compare lane runs where a reference exemplar exists' },
  { skill: 'margin', script: 'contested', what: 'cross-check outcomes are tallied rather than read for' },
]

// The "what is actually enforced" table is only true while the allowlists hold.
// Prose cannot check itself: these assert that each agent definition still LACKS
// the tools the script claims it lacks. Add a tool back to any frontmatter and
// the property that tool was denying silently becomes a promise again.
const ALLOWLIST = [
  { agent: 'gauntlet-bar-writer', forbidden: ['Read', 'Grep', 'Glob', 'Bash'], buys: 'cannot open the artifact (gate 5)' },
  { agent: 'gauntlet-critic', forbidden: ['Agent', 'ListAgents', 'SendMessage', 'Write', 'Edit'], buys: 'cannot reach a peer critic through the agent-messaging channel, nor alter the artifact through a file-editing tool call' },
  { agent: 'gauntlet-verifier', forbidden: ['Agent', 'ListAgents', 'SendMessage', 'Write', 'Edit'], buys: 'cannot delegate its own checking' },
  { agent: 'gauntlet-seeder', forbidden: ['Agent', 'ListAgents', 'SendMessage', 'WebSearch', 'WebFetch'], buys: 'cannot look the artifact up to plant a recallable defect' },
  { agent: 'gauntlet-isolator', forbidden: ['Agent', 'SendMessage', 'WebSearch', 'WebFetch'], buys: 'cannot tell a critic which side is which' },
  { agent: 'gauntlet-reporter', forbidden: ['Read', 'Grep', 'Glob', 'Bash', 'Agent', 'WebSearch', 'WebFetch'], buys: 'can only write down what the run handed it' },
  { agent: 'gauntlet-judge', forbidden: ['Read', 'Grep', 'Glob', 'Bash', 'Agent', 'ListAgents', 'SendMessage', 'WebSearch', 'WebFetch'], buys: 'cannot form its own opinion of the artifact and grade the critic against that' },
  // loop.js makes three allowlist claims of its own in `enforced`, and until
  // now no guard checked any of them — the list above covers gauntlet.js's
  // seven agent types only. Same mechanism, extended to the second script's
  // three; the claims are quoted in the `buys` field so a reader can see which
  // sentence in the verdict goes false when an entry starts failing.
  { agent: 'gauntlet-ab-critic', forbidden: ['Write', 'Edit', 'Agent', 'ListAgents', 'SendMessage'], buys: 'is claimed to have "no Write or Edit — it could not use those TOOLS to alter either artifact", and to be unable to reach the builder or another critic' },
  { agent: 'gauntlet-builder', forbidden: ['Agent', 'ListAgents', 'SendMessage'], buys: 'is claimed to be an agent type "with no Agent/ListAgents/SendMessage — it could not reach or spawn a critic"' },
  { agent: 'gauntlet-breaker', forbidden: ['Read', 'Grep', 'Glob', 'Agent', 'ListAgents', 'SendMessage', 'WebSearch', 'WebFetch', 'Write', 'Edit'], buys: 'is claimed to be an agent type "whose whole tool allowlist is Bash and which never saw the goal, either artifact, or any verdict"' },
]

// A disclosure that can be deleted without failing a test is not a
// disclosure. Each of these MUST appear verbatim in gauntlet.js's
// `not_enforced` prose — this pins the disclosure itself, not just the
// property it discloses.
const DISCLOSURES = [
  'general shell and can write files',
]

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }

console.log('drift-guard: critic contract pinned between critic-prompt.md and gauntlet.js')
for (const needle of PINNED) {
  const inCritic = critic.includes(needle)
  const inScript = script.includes(needle)
  if (inCritic && inScript) continue
  if (!inCritic && !inScript) fail(`"${needle}" — absent from BOTH files (was it renamed?)`)
  else if (!inScript) fail(`"${needle}" — in critic-prompt.md but NOT in gauntlet.js (script is stale)`)
  else fail(`"${needle}" — in gauntlet.js but NOT in critic-prompt.md (prompt authority is stale)`)
}

console.log('drift-guard: gate semantics pinned between SKILL.md and gauntlet.js')
for (const g of GATE_SEMANTICS) {
  const inSkill = skill.includes(g.skill)
  const inScript = script.includes(g.script)
  if (inSkill && inScript) continue
  if (!inSkill) fail(`${g.what}: SKILL.md no longer says "${g.skill}"`)
  if (!inScript) fail(`${g.what}: gauntlet.js no longer implements it (looked for "${g.script}")`)
}

// Gates 0, 1 and 4 are OPERATOR judgment and must NOT be automated. A workflow
// that decides its own cost ceiling is the improvised-panel failure with extra
// steps.
console.log('drift-guard: agent allowlists still deny what the verdict claims they deny')
for (const a of ALLOWLIST) {
  let text
  try {
    text = readFileSync(join(ROOT, 'agents', `${a.agent}.md`), 'utf8')
  } catch {
    fail(`${a.agent}.md is missing — the script names it as an agentType`)
    continue
  }
  const m = text.match(/^tools:\s*(.+)$/m)
  if (!m) { fail(`${a.agent}.md has no tools: line — an unrestricted agent enforces nothing`); continue }
  const granted = m[1].split(',').map(t => t.trim()).filter(Boolean)
  for (const bad of a.forbidden) {
    if (granted.includes(bad)) fail(`${a.agent} was granted "${bad}" — it ${a.buys}, and that property is now only a promise`)
  }
}

console.log('drift-guard: required disclosures present in gauntlet.js')
for (const needle of DISCLOSURES) {
  if (!script.includes(needle)) fail(`"${needle}" — not found in gauntlet.js; a not_enforced disclosure was removed or reworded away`)
}

console.log('drift-guard: gates 0/1/4 stay out of the script')
for (const forbidden of ['cost_ceiling', 'costCeiling', 'gate0', 'gate1:', 'gate4']) {
  if (script.includes(forbidden)) fail(`gauntlet.js references "${forbidden}" — gates 0/1/4 are operator-run and must stay in prose`)
}

// loop.js is a second Workflow script under the same runtime constraints as
// gauntlet.js (no import/require, no filesystem, no Node APIs; Date.now(),
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
// — which is the same drift PINNED guards between critic-prompt.md and
// gauntlet.js, on the script that had no such guard at all.
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
// Everything above is pinned pairwise INSIDE a lane: critic-prompt.md against
// gauntlet.js, loop.js against its own agent definitions. Measured consequence
// (issue #20): plant the same defect — a blind comparer losing its instruction
// not to reason about provenance — in each lane, and placement alone decides
// whether anything catches it. The gauntlet.js arm fails this suite; the
// loop.js arm passed it, exit 0. gauntlet.js is protected only because it
// happens to have a paired prompt-authority file. A defect whose home is the
// relation between lanes had nothing to fail.
//
// So this does not add loop.js to a list — that would be one entry per
// incident, and a third lane would reproduce the hole (#3). Lanes are
// DISCOVERED from the directory, and the contract is required of whichever of
// them runs a blind two-sided comparison:
//
//   a LANE            = a .js in the skill dir that spawns agents
//   a BLIND COMPARER  = a lane declaring a side-naming field whose domain is a
//                       closed two-option enum. That is the structural
//                       signature of a forced binary choice, and it does not
//                       depend on the two side-naming conventions in use today
//                       ('A'/'B' in loop.js, 'LEFT'/'RIGHT' in gauntlet.js).
//
// Checked against COMMENT-STRIPPED source, same rule as LOOP_PINNED: a clause
// surviving only in a comment reaches no agent.
// ---------------------------------------------------------------------------
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

// The plugin loader namespaces plugin agents (checked against ListAgents —
// see the comment above `const AT` in gauntlet.js). A bare agent-type name in
// AT would fail to resolve on first use, silently turning a restricted spawn
// into a spawn that never runs. Parsed textually, same style as the rest of
// this file: no new dependencies.
console.log('drift-guard: AT map values stay namespaced "gauntlet-loop:" so a spawn cannot fail to resolve')
const atMatch = script.match(/const AT = \{([\s\S]*?)\n\}/)
if (!atMatch) {
  fail('could not find "const AT = { ... }" in gauntlet.js — the AT-prefix check needs updating')
} else {
  const atValues = [...atMatch[1].matchAll(/:\s*'([^']*)'/g)].map(m => m[1])
  if (!atValues.length) fail('found the AT map literal but no quoted values inside it — the AT-prefix check needs updating')
  for (const v of atValues) {
    if (!v.startsWith('gauntlet-loop:')) fail(`AT map value "${v}" is not prefixed "gauntlet-loop:" — this agentType will fail to resolve at runtime`)
  }
}

if (failures) {
  console.error(`\ndrift-guard: ${failures} failure(s) — the script and its prompt authority have diverged.`)
  process.exit(1)
}
console.log(`\ndrift-guard: OK — ${PINNED.length} contract elements + ${GATE_SEMANTICS.length} gate semantics + ${LOOP_PINNED.length} loop.js prompt clauses pinned, ${comparerLanes} comparer lane(s) holding the cross-lane contract, ${ALLOWLIST.length} allowlists still denying, ${DISCLOSURES.length + LOOP_DISCLOSURES.length} disclosure(s) present, gates 0/1/4 absent from script, AT map namespaced, loop.js clean of ${RUNTIME_FORBIDDEN.length} forbidden runtime APIs and ${CAP_NAMES.length} round-cap names.`)
