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

  // verifier triad
  'EXISTS',
  'SAYS',
  'SUPPORTS',
  'GROUNDED-WEAK',
  'NOT-GROUNDED',
  'ABSENCE CLAIMS',

  // round 2 is a cross-check, not a re-argument
  'CROSS-CHECK',
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

if (failures) {
  console.error(`\ndrift-guard: ${failures} failure(s) — the script and its prompt authority have diverged.`)
  process.exit(1)
}
console.log(`\ndrift-guard: OK — ${PINNED.length} contract elements + ${GATE_SEMANTICS.length} gate semantics pinned, gates 0/1/4 absent from script, loop.js clean of ${RUNTIME_FORBIDDEN.length} forbidden runtime APIs.`)
