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
// The absence arm. Declared, never inferred — see the refusal below.
const absent = process.argv.includes('--absent')
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
// EXISTENCE, EXCEPT WHERE THE ABSENCE IS THE MEASUREMENT.
//
// "A prompt naming a path that is not there measures nothing, and the hash would pin an
// absence" is right for the two arms that execute an artifact, and exactly backwards for
// the third. `could-not-open` is a verdict the probe can return and a way a run gets
// refused, and the only artifact that produces it is one that is not there — so for that
// row, pinning an absence IS the measurement.
//
// --absent is required rather than inferred. Inferring it would turn every typo'd path
// into a could-not-open measurement, which is how a corpus fills up with rows nobody
// meant. The caller states the intent; this refuses to guess it.
const present = existsSync(resolve(ROOT, artifact)) || existsSync(artifact)
if (!present && !absent) {
  console.error(`extract: ${artifact} does not exist. A prompt naming a path that is not there measures nothing, and the hash would pin an absence.`)
  console.error('If the absence IS what this row measures — the could-not-open verdict — pass --absent to say so.')
  process.exit(2)
}
if (present && absent) {
  console.error(`extract: --absent was given but ${artifact} is there. The probe can open it, so whatever it answers is not could-not-open.`)
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
// THE CANDIDATE PATH IS RESOLVED TO ABSOLUTE BEFORE IT REACHES THE PROMPT.
//
// loop.js is handed an absolute path by its operator, so that is the shape the
// prompt must carry and the shape the hash must pin. The corpus, meanwhile, has
// to store the path RELATIVE or it cannot be read on any machine but the one that
// wrote it. Resolving here is what lets both be true at once: the row stays
// portable, and the prompt is byte-identical to the one a real run produces.
//
// resolve() is idempotent on an absolute input, so a caller passing the loop's own
// absolute path is unaffected.
//
// RESIDUAL, and it is not closed by this: the resolved path is machine-specific,
// so prompt_hash is too. An observation recorded on one machine cannot be
// validated on another — not because of this change, which reproduces the old
// hash exactly on the machine that recorded them, but because a filesystem path
// is in the hashed prompt at all. That is a separate defect and it is disclosed
// rather than silently absorbed here.
const candidatePath = resolve(ROOT, artifact)

const r = await runLoop({
  args: { goal, candidate: candidatePath, reference: THROWAWAY_REFERENCE, token: '/oracle-extract/unused-token', ...(inspect ? { inspect } : {}) },
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

// THE INSTRUMENT IS THE TEMPLATE, NOT THE FILLED-IN PROMPT.
//
// The artifact path and the goal are interpolated INTO the prompt, so every row
// necessarily produces a different prompt_hash. Grouping cohorts by that hash put
// every single row in a cohort of its own — reported by the tool's own first run on a
// four-row corpus, as four cohorts of one.
//
// So two hashes are recorded and they answer different questions. `prompt_hash` is the
// exact text this observation was made against, and is what oracle-record.mjs matches
// to refuse a stale observation. `template_hash` is that text with this row's own
// goal, artifact and inspect blanked out — the part that is the same for every row —
// and is what oracle-report.mjs groups by. A prompt wording change moves the template
// hash for every row at once, which is the event that must split a cohort.
//
// BLANK THE PATH THAT WAS INTERPOLATED, NOT THE ONE THE CALLER TYPED. This used to split
// on `artifact`, the raw --artifact argument. The prompt carries `candidatePath`, the
// resolved one, so for a repo-relative row the caller's spelling matched only the TAIL of
// what is in the text and the blanking left `/wherever/the/repo/is/{{ARTIFACT}}` behind.
// The template hash then depended on where the checkout lived and on how the path was
// spelled: oracle-instrument probes with absolute paths and got one hash, every corpus row
// got another, and oracle-report — which labels a cohort by comparing the two — called
// every observation recorded since the corpus went repo-relative SUPERSEDED, about the
// prompt that ships. Nothing moved a number, which is what made it quiet.
//
// This is RC1 of #42 one layer down: normalising the STORED path left every fact DERIVED
// from a path unfixed, and one of them decides which instrument an observation belongs to.
// test/corpus-portability.test.mjs spells one artifact both ways and requires one hash.
const template = hit.prompt
  .split(goal).join('{{GOAL}}')
  .split(candidatePath).join('{{ARTIFACT}}')
  .split(inspect || '\u0000never').join('{{INSPECT}}')

const payload = {
  artifact,
  goal,
  inspect: inspect || null,
  agent_type: hit.agentType || null,
  prompt: hit.prompt,
  prompt_hash: sha(hit.prompt),
  template_hash: sha(template),
  schema_fingerprint: sha(canonical(hit.schema || null)),
}

if (asJson) {
  console.log(JSON.stringify(payload, null, 2))
} else {
  console.log(payload.prompt)
  console.error('')
  console.error(`# agent_type         ${payload.agent_type}`)
  console.error(`# prompt_hash        ${payload.prompt_hash}`)
  console.error(`# template_hash      ${payload.template_hash}`)
  console.error(`# schema_fingerprint ${payload.schema_fingerprint}`)
}
