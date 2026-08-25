// Add ONE row to the oracle corpus, and refuse to add one that cannot be grounded.
//
//   node scripts/oracle-add.mjs --arm does-the-work --artifact <path> --goal "<text>" \
//        --acceptance "<shell command>" [--id <id>] [--note "<why this row>"] [--force]
//
// The corpus exists because the pairing check acquired the authority to REFUSE a run
// on an evidence base of two observations scored against predictions its own author
// wrote. A corpus assembled the same way would repeat that, so a row is only written
// when something OTHER than an opinion settles it.
//
// For the does-the-work arm that something is a shell command. `--acceptance` is run
// by this tool, here, now: it must exit 0, which is what establishes that executing
// the artifact terminates in the goal's deliverable. No model is consulted, and one
// is refused if offered — a ground truth produced by the same kind of judgement being
// tested cannot audit that judgement.
//
// WHAT IS AND IS NOT A REGISTRY. The classification RULE is fixed and singular: does
// executing this artifact terminate in the goal's deliverable, or in a request
// addressed to a further party. It does not gain a branch when a row is added; adding
// a row costs no code here. What grows per row is EVIDENCE — each artifact needs its
// own acceptance command, because "the deliverable exists" is a different observation
// for a Makefile than for a spec. That is data, the way a test's expected output is
// data, and it is the distinction that separates an empirical corpus from the
// one-entry-per-shape list the first version of the pairing check shipped.

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, appendFileSync, mkdirSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// ORACLE_CORPUS lets a test point this at a throwaway file. It exists because a
// mutation test, by design, removes a guard and then runs the suite — and the suite
// writes rows. Without this the tracked corpus is one disabled guard away from
// gaining a fabricated row that no restore undoes, because mutate.mjs restores source,
// not data.
const CORPUS = process.env.ORACLE_CORPUS || join(ROOT, 'oracle', 'corpus.jsonl')

const argv = process.argv.slice(2)
const FLAGS = ['--arm', '--artifact', '--goal', '--acceptance', '--id', '--note', '--inspect']
const arg = n => {
  const i = argv.indexOf(n)
  if (i === -1) return null
  const v = argv[i + 1]
  return v === undefined || FLAGS.includes(v) ? null : v
}

const arm = arg('--arm')
const artifact = arg('--artifact')
const goal = arg('--goal')
const acceptance = arg('--acceptance')
const note = arg('--note')
const inspect = arg('--inspect')
const force = argv.includes('--force')

if (arm !== 'does-the-work') {
  console.error('usage: node scripts/oracle-add.mjs --arm does-the-work --artifact <path> --goal "<text>" --acceptance "<shell command>" [--id <id>] [--note "<why>"] [--force]')
  console.error('')
  console.error('Only --arm does-the-work is implemented. The generator arm has no mechanical acceptance test —')
  console.error('"this document is a request to someone else" is not a shell exit code — so its rows come from the')
  console.error('execute-and-observe procedure in oracle/generator-procedure.md, not from this tool. Adding a')
  console.error('--arm generator path here that took the caller\'s word for the label would rebuild the exact')
  console.error('authored answer key this corpus exists to replace.')
  process.exit(2)
}
if (!artifact || !goal || !acceptance) {
  console.error('usage: node scripts/oracle-add.mjs --arm does-the-work --artifact <path> --goal "<text>" --acceptance "<shell command>" [--id <id>] [--note "<why>"] [--force]')
  process.exit(2)
}

const abs = existsSync(resolve(ROOT, artifact)) ? resolve(ROOT, artifact) : artifact
if (!existsSync(abs)) {
  console.error(`add: ${artifact} does not exist. A row whose artifact cannot be opened measures nothing — this is the same refusal the pairing check makes as "could-not-open".`)
  process.exit(2)
}
if (statSync(abs).isDirectory()) {
  console.error(`add: ${artifact} is a directory. The pairing check reads one file per side; a directory row would test something the probe never sees.`)
  process.exit(2)
}

// A ground truth downstream of a model is not a ground truth. This is a STRING check
// and it is therefore evadable — a model call disguised behind a local HTTP endpoint
// passes it. Stated rather than papered over: it stops the careless case, not the
// determined one, and the corpus's own note field is where a reader should look.
const MODEL_SHAPED = /\b(claude|anthropic|openai|gpt|llm|ollama|gemini)\b/i
if (MODEL_SHAPED.test(acceptance)) {
  console.error(`add: the acceptance command mentions a model ("${acceptance}").`)
  console.error('Ground truth for this arm has to be established WITHOUT the kind of judgement being tested — a')
  console.error('quantity derived downstream of the decision under test cannot audit that decision. Use a command')
  console.error('that settles the deliverable mechanically, or add the row through the generator procedure instead.')
  process.exit(2)
}

// RUN IT. Not "record that a command was supplied" — run it and require exit 0. A row
// whose acceptance command was never executed is an assertion, which is what this
// corpus exists to stop accepting.
// Hard wall-clock limit. A command that cannot settle cannot ground a row, and an
// unbounded spawn here is arbitrary command execution with no exit: the MODEL_SHAPED
// guard above is the only thing in front of it, and a mutation test's whole purpose is
// to remove that guard and see what happens. It once did, and the canary it reached was
// a live agent that re-entered this repo. Note what the timeout does NOT do: killing the
// shell does not kill what the shell spawned, so this bounds the wait, not the blast.
const ACCEPTANCE_TIMEOUT_MS = 120_000
const res = spawnSync(acceptance, { shell: true, cwd: ROOT, encoding: 'utf8', timeout: ACCEPTANCE_TIMEOUT_MS, killSignal: 'SIGKILL' })
if (res.error?.code === 'ETIMEDOUT' || res.signal === 'SIGKILL') {
  console.error(`add: the acceptance command did not finish within ${ACCEPTANCE_TIMEOUT_MS / 1000}s and was killed.`)
  console.error(`    ${acceptance}`)
  console.error('')
  console.error('A command that cannot settle establishes nothing, so it is a refusal, not a retry. Note that any')
  console.error('process it started of its own may still be running: check before assuming the kill was complete.')
  process.exit(1)
}
if (res.error || res.status !== 0) {
  console.error(`add: the acceptance command did not succeed (exit ${res.status}${res.error ? `, ${res.error.message}` : ''}).`)
  console.error(`    ${acceptance}`)
  if (res.stderr) console.error(String(res.stderr).trim().split('\n').slice(0, 6).map(l => '    ' + l).join('\n'))
  console.error('')
  console.error('Until that command exits 0, nothing establishes that executing this artifact reaches the goal, so')
  console.error('there is no expected role to record. Fix the command or the fixture; do not record the row anyway.')
  process.exit(1)
}

const sha = s => 'sha256:' + createHash('sha256').update(s).digest('hex')
const artifactHash = sha(readFileSync(abs))
const id = arg('--id') || artifact.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()

mkdirSync(join(ROOT, 'oracle'), { recursive: true })
const existing = existsSync(CORPUS)
  ? readFileSync(CORPUS, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  : []
const clash = existing.find(r => r.id === id)
if (clash && !force) {
  if (clash.artifact_hash === artifactHash) {
    console.error(`add: row "${id}" already exists with the same artifact content. Nothing to do.`)
    process.exit(2)
  }
  console.error(`add: row "${id}" exists and its artifact has CHANGED since it was recorded.`)
  console.error(`    was ${clash.artifact_hash}`)
  console.error(`    now ${artifactHash}`)
  console.error('Observations recorded against the old content were made about a different artifact. Re-add with')
  console.error('--force only if you intend to retire those observations, or use a new --id and keep both.')
  process.exit(2)
}

const row = {
  id,
  arm,
  artifact,
  artifact_hash: artifactHash,
  goal,
  inspect: inspect || null,
  expected_role: 'does-the-work',
  evidence: {
    method: 'mechanical-execution',
    acceptance_command: acceptance,
    exit_code: res.status,
    stdout_head: String(res.stdout || '').trim().split('\n').slice(0, 3).join('\n') || null,
  },
  selection_note: note || null,
}
appendFileSync(CORPUS, JSON.stringify(row) + '\n')
console.log(`added ${id} (${arm}) — acceptance exited 0, artifact ${artifactHash.slice(0, 23)}…`)
if (!note) {
  console.error('note: no --note given. Why this row is in the corpus is the part a later reader cannot reconstruct, and')
  console.error('      selection is the bias this corpus does NOT solve. Consider re-adding with --note and --force.')
}
