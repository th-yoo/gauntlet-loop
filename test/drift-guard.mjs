// Drift guard: gauntlet.js carries the critic contract inline (Workflow scripts
// cannot read files), so the script and critic-prompt.md can silently diverge.
// This pins them together.
//
//   node test/drift-guard.mjs
//
// Exit 0 = pinned. Exit 1 = drift. No dependencies.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKILLDIR = join(ROOT, 'skills', 'gauntlet-loop')
const critic = readFileSync(join(SKILLDIR, 'critic-prompt.md'), 'utf8')
const script = readFileSync(join(SKILLDIR, 'gauntlet.js'), 'utf8')
const skill = readFileSync(join(SKILLDIR, 'SKILL.md'), 'utf8')

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
console.log(`\ndrift-guard: OK — ${PINNED.length} contract elements + ${GATE_SEMANTICS.length} gate semantics pinned, ${ALLOWLIST.length} allowlists still denying, ${DISCLOSURES.length} disclosure(s) present, gates 0/1/4 absent from script, AT map namespaced.`)
