// Capture loop.js's LIVE pairing-check prompt, and hash it. No agent is spawned.
//
//   node scripts/oracle-extract.mjs --artifact <path> --goal "<text>" [--inspect "<how>"] [--json]
//
// WHY THIS EXISTS RATHER THAN A COPY OF THE PROMPT.
//
// An oracle that measures `roleOf` needs the exact question `roleOf` asks. Typing
// that question into this file would create a second copy of a contract that is
// already written down once, and this repository has watched that go wrong: five of
// the pairing check's seven recorded observations were invalidated at a stroke when
// the prompt changed, because nothing tied an observation to the wording that
// produced it. A copy here would drift the same way and would be discovered the same
// way — late, by someone noticing.
//
// So the prompt is never retyped. `test/harness.mjs` already loads loop.js as a real
// AsyncFunction and records every agent() call before dispatching it, which means the
// live prompt can be read straight out of a stubbed run. `comparability:1` is always
// the CANDIDATE's roleOf call (loop.js: `roleOf(CANDIDATE, 1)`), so that entry is the
// exact text, schema and agent type production would send today.
//
// A script under scripts/ importing from test/ is unusual, and it is deliberate:
// the alternative is the duplicate this file exists to avoid. If that import ever
// costs something real, hoist the harness's script loader into its own module — do
// not solve it by pasting the prompt back in here.
//
// The run is fully offline. The default breaker stub answers PRESENT, which is what
// carries execution as far as the pre-flight probes; every stubbed agent below that
// returns nothing, and the verdict this produces is discarded. Only the recorded
// prompt is read.

import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { runLoop } from '../test/harness.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const argv = process.argv.slice(2)
const FLAGS = ['--artifact', '--goal', '--inspect']
// A value that is itself an option is a MISSING value, not a value. Same rule as
// scripts/seed-loop-trial.mjs, and it is there because the other spelling produced a
// tool that reported success against a filename nobody supplied.
const arg = n => {
  const i = argv.indexOf(n)
  if (i === -1) return null
  const v = argv[i + 1]
  return v === undefined || FLAGS.includes(v) ? null : v
}

const artifact = arg('--artifact')
const goal = arg('--goal')
const inspect = arg('--inspect')
const asJson = argv.includes('--json')

if (!artifact || !goal) {
  console.error('usage: node scripts/oracle-extract.mjs --artifact <path> --goal "<text>" [--inspect "<how>"] [--json]')
  process.exit(2)
}

// The artifact is not opened here — loop.js never opens it either, it only renders
// the path into a prompt. But a path that does not exist cannot be an oracle row, and
// a hash taken against a missing file would pin nothing. Refuse now rather than
// record a row whose ground truth was never establishable.
if (!existsSync(resolve(ROOT, artifact)) && !existsSync(artifact)) {
  console.error(`extract: ${artifact} does not exist. A prompt naming a path that is not there measures nothing, and the hash would pin an absence.`)
  process.exit(2)
}

// A reference distinct from the candidate, because loop.js refuses a run whose two
// sides are the same file. It is never used: only the CANDIDATE side's prompt is read.
const THROWAWAY_REFERENCE = '/oracle-extract/unused-reference-side'

// BOUNDED, and it has to be. The pre-flight probes run before round 1's critic, so
// the prompt is captured almost immediately — but the default stub answers PRESENT
// forever and no round ever wins, so an unbounded run spins until the harness runaway
// guard fires at round 51 and throws away the capture with it. One round is all this
// needs: the breaker says PRESENT for round 1 (which is what lets the probes spawn at
// all) and ABSENT after, so the run stops at the round-2 boundary.
const r = await runLoop({
  args: { goal, candidate: artifact, reference: THROWAWAY_REFERENCE, token: '/oracle-extract/unused-token', ...(inspect ? { inspect } : {}) },
  breaker: round => round <= 1,
  rounds: [],
})

const hit = (r.prompts || []).find(p => p.label === 'comparability:1')
// UNTESTED BY CONSTRUCTION, and not redundant — the two are different things.
//
// Building this input means making loop.js not spawn the pairing check, which no test
// can do without editing the script under measurement. A mutation sweep therefore
// reports this branch NOT CAUGHT, and that is the honest state rather than a hole to
// paper over with a vacuous test.
//
// It still earns its place, unlike the redundant guards this repo has deleted: without
// it the next line reads `hit.prompt` and dies with a TypeError, which tells whoever
// hits it nothing about the actual cause. The failure it names — loop.js's shape
// changed and this tool is reading it wrongly — is exactly the case where someone
// would be tempted to "fix" it by pasting the prompt in here, which is the one repair
// that must not happen.
if (!hit) {
  console.error('extract: loop.js did not spawn the pairing check at all, so there is no live prompt to capture.')
  console.error('That means the pre-flight probes did not run — the shape of loop.js has changed, and this tool is')
  console.error('reading it wrongly. Do NOT work around this by retyping the prompt; fix the extraction.')
  process.exit(1)
}

// Canonical JSON: key order in a schema literal is not meaningful, and a fingerprint
// that changes when someone reorders two properties would report drift that did not
// happen — a false alarm trains people to ignore the alarm.
function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']'
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}'
  return JSON.stringify(v)
}
const sha = s => 'sha256:' + createHash('sha256').update(s).digest('hex')

const payload = {
  artifact,
  goal,
  inspect: inspect || null,
  agent_type: hit.agentType || null,
  prompt: hit.prompt,
  prompt_hash: sha(hit.prompt),
  schema_fingerprint: sha(canonical(hit.schema || null)),
}

if (asJson) {
  console.log(JSON.stringify(payload, null, 2))
} else {
  console.log(payload.prompt)
  console.error('')
  console.error(`# agent_type         ${payload.agent_type}`)
  console.error(`# prompt_hash        ${payload.prompt_hash}`)
  console.error(`# schema_fingerprint ${payload.schema_fingerprint}`)
}
