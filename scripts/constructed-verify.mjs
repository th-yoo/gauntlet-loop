// DERIVE each constructed artifact's role by running it, and check the manifest agrees.
//
//   node scripts/constructed-verify.mjs [--json]
//
// ISSUE 33. The comparability probe's answer key was written by the person
// proposing the probe. Pre-registering the predictions prevents post-hoc
// rationalisation; it does not supply ground truth. Worse, of 22 corpus rows,
// **every one of the 7 `produces-an-instruction` rows is `agentic`** — the role
// was established by an agent classifying an emission, which is the same kind of
// judgement the probe is under suspicion for. There has never been a
// mechanically-grounded generator in this repository.
//
// THE ROLE IS NOT READ FROM THE MANIFEST. It is DERIVED by executing the artifact
// and observing the filesystem, then compared against what the manifest declares.
// A manifest that stored the answer and a checker that read it back would be the
// answer key this issue is about, one file along. The rule applied is the
// repository's own, unchanged:
//
//     does executing this artifact terminate in the goal's deliverable,
//     or in a request addressed to a further party?
//
//   does-the-work            run it, and the deliverable is there.
//   produces-an-instruction  run it, and the deliverable is NOT there — but a
//                            runnable artifact is, and running THAT reaches the
//                            deliverable. Two shell exit codes, no agent.
//   could-not-open           nothing is at the path.
//
// The second line is the one that did not exist before. It makes "terminates in a
// request addressed to a further party" a mechanical observation: the further
// party is whoever runs the emitted artifact, and the emission is on disk.
//
// KEPT OUT OF oracle/corpus.jsonl DELIBERATELY. These rows are constructed, not
// sampled, so pooling them with the corpus would change a composition that
// already has no sampling frame (#38) and would move every rate oracle-report
// computes. A different frame belongs in a different file.
//
// NOTHING HERE SPAWNS A MODEL. Every command is a shell exit code.

import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST = process.env.CONSTRUCTED_MANIFEST || join(ROOT, 'oracle', 'constructed.jsonl')
const PAIRINGS = process.env.CONSTRUCTED_PAIRINGS || join(ROOT, 'oracle', 'constructed-pairings.jsonl')
const argv = process.argv.slice(2)

const sh = cmd => spawnSync('sh', ['-c', cmd], { cwd: ROOT, encoding: 'utf8', timeout: 60_000 })
const ok = cmd => sh(cmd).status === 0

// REFUSE A COMMAND THAT COULD CONSULT A MODEL, the same rule oracle-add.mjs
// applies to acceptance commands: a ground truth produced by the kind of
// judgement under test cannot audit that judgement.
const MODEL_SHAPED = /\b(claude|anthropic|openai|gpt|llm|ollama|gemini)\b/i

export function deriveRole(probe, runner = { ok, sh }) {
  if (!probe) return { role: null, why: 'no probe declared' }
  for (const [k, cmd] of Object.entries(probe)) {
    if (typeof cmd === 'string' && MODEL_SHAPED.test(cmd)) {
      return { role: null, why: `probe.${k} names a model — a role settled by a model cannot audit a model` }
    }
  }
  if (probe.absent !== undefined) {
    return runner.ok(probe.absent)
      ? { role: 'could-not-open', why: 'nothing is at the path' }
      : { role: null, why: 'declared absent, but the path exists' }
  }
  if (!probe.run_artifact || !probe.deliverable_present) {
    return { role: null, why: 'a probe needs at least run_artifact and deliverable_present' }
  }
  if (probe.reset) runner.sh(probe.reset)
  if (!runner.ok(probe.run_artifact)) {
    if (probe.reset) runner.sh(probe.reset)
    return { role: null, why: 'the artifact did not run' }
  }
  if (runner.ok(probe.deliverable_present)) {
    if (probe.reset) runner.sh(probe.reset)
    return { role: 'does-the-work', why: 'running it reached the deliverable' }
  }
  // Not there yet. Did it hand the job to someone else?
  if (!probe.emitted_runnable || !probe.run_emitted) {
    if (probe.reset) runner.sh(probe.reset)
    return { role: null, why: 'the deliverable is absent and no emission was declared, so nothing distinguishes this from an artifact that simply failed' }
  }
  if (!runner.ok(probe.emitted_runnable)) {
    if (probe.reset) runner.sh(probe.reset)
    return { role: null, why: 'the deliverable is absent and no runnable artifact was emitted — that is a failure, not an instruction' }
  }
  const ranEmitted = runner.ok(probe.run_emitted)
  const reached = ranEmitted && runner.ok(probe.deliverable_present)
  if (probe.reset) runner.sh(probe.reset)
  return reached
    ? { role: 'produces-an-instruction', why: 'running it left the deliverable absent and a runnable artifact present, and running that reached the deliverable' }
    : { role: null, why: 'it emitted something runnable that does not reach the deliverable either — the chain does not terminate in the goal' }
}

// The composed pairing verdict, from two derived roles. One rule, no branch per
// pairing: this is the same composition oracle/results.jsonl already records.
export function composeVerdict(a, b) {
  if (a === 'could-not-open' || b === 'could-not-open') return 'unreadable'
  if (a === 'does-the-work' && b === 'does-the-work') return 'comparable'
  if (a === 'produces-an-instruction' && b === 'produces-an-instruction') return 'comparable'
  return 'generator'
}

if (!existsSync(MANIFEST)) { console.error(`constructed-verify: no manifest at ${MANIFEST}`); process.exit(2) }
const rows = readFileSync(MANIFEST, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
const pairings = existsSync(PAIRINGS)
  ? readFileSync(PAIRINGS, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : []

let bad = 0
const derived = new Map()
console.log(`constructed-verify: ${rows.length} constructed artifact(s)`)
for (const r of rows) {
  const d = deriveRole(r.probe)
  derived.set(r.id, d.role)
  const agree = d.role === r.expected_role
  if (!agree) bad++
  console.log(`  ${agree ? 'agrees ' : 'DISAGREES'} ${r.id.padEnd(24)} derived ${String(d.role).padEnd(24)} declared ${r.expected_role}`)
  console.log(`            ${d.why}`)
}

console.log()
console.log(`constructed-verify: ${pairings.length} constructed pairing(s)`)
for (const p of pairings) {
  const [x, y] = p.sides.map(s => derived.get(s))
  const v = (x && y) ? composeVerdict(x, y) : null
  if (!v) { bad++; console.log(`  UNDERIVABLE ${p.id} — a side's role could not be derived`); continue }
  console.log(`  ${p.id.padEnd(30)} ${x} + ${y}  =>  ${v}`)
}

console.log()
const mechGen = rows.filter(r => r.expected_role === 'produces-an-instruction' && r.grounding === 'mechanical').length
console.log(`constructed-verify: ${bad} disagreement(s); ${mechGen} mechanically-grounded generator row(s)`)
// THE RESIDUAL, ON EVERY BRANCH.
console.log('constructed-verify: NOT ESTABLISHED — that these artifacts resemble what the probe meets.')
console.log('                    They are constructed to make one relationship definitional, which is')
console.log('                    exactly what makes them ground truth and exactly what makes them')
console.log('                    unrepresentative. They bound whether the probe can be RIGHT on a case')
console.log('                    with a knowable answer; they say nothing about the corpus it is used on.')
console.log('                    NOT ESTABLISHED: anything about the probe. Nothing here runs it.')

if (argv.includes('--json')) console.log(JSON.stringify([...derived], null, 2))
if (bad) process.exit(1)
