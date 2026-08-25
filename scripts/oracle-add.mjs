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
import { dirname, join, resolve, relative, isAbsolute } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// ORACLE_CORPUS lets a test point this at a throwaway file. It exists because a
// mutation test, by design, removes a guard and then runs the suite — and the suite
// writes rows. Without this the tracked corpus is one disabled guard away from
// gaining a fabricated row that no restore undoes, because mutate.mjs restores source,
// not data.
const CORPUS = process.env.ORACLE_CORPUS || join(ROOT, 'oracle', 'corpus.jsonl')

const argv = process.argv.slice(2)
const FLAGS = ['--arm', '--artifact', '--goal', '--acceptance', '--id', '--note', '--inspect', '--emission']
const arg = n => {
  const i = argv.indexOf(n)
  if (i === -1) return null
  const v = argv[i + 1]
  return v === undefined || FLAGS.includes(v) ? null : v
}

const arm = arg('--arm')
let artifact = arg('--artifact')
const goal = arg('--goal')
const acceptance = arg('--acceptance')
const note = arg('--note')
const inspect = arg('--inspect')
const force = argv.includes('--force')

// THE ABSENCE ARM. `could-not-open` is the third thing the probe can answer and the third
// way a run gets refused, and it had zero observations of thirty-eight — not because nobody
// added the row but because the row could not be added. Two refusals stood in front of it,
// both correct for the arms that existed: the arm list was closed, and a missing artifact
// was rejected in a message that named this very verdict.
//
// What made it unaddable is that `arm` meant three things at once — which answer the row
// expects, how it was grounded, and what evidence it carries — so a third answer needed a
// third grounding even though this one's is the cheapest in the corpus. The deliverable of
// a could-not-open row is an ABSENCE, and `test ! -e` settles an absence with no judgement
// in it at all. So the grounding is inverted rather than new: the acceptance command must
// still exit 0, and what it must establish is that the path is not there.
const ARMS = ['does-the-work', 'generator', 'could-not-open']
if (!ARMS.includes(arm)) {
  console.error('usage: node scripts/oracle-add.mjs --arm does-the-work --artifact <path> --goal "<text>" --acceptance "<shell command>" [--id <id>] [--note "<why>"] [--force]')
  console.error('')
  console.error('Only --arm does-the-work is implemented. The generator arm has no mechanical acceptance test —')
  console.error('"this document is a request to someone else" is not a shell exit code — so its rows come from the')
  console.error('execute-and-observe procedure in oracle/generator-procedure.md, not from this tool. Adding a')
  console.error('--arm generator path here that took the caller\'s word for the label would rebuild the exact')
  console.error('authored answer key this corpus exists to replace.')
  console.error('')
  console.error('--arm could-not-open takes an artifact path that must NOT exist, and an --acceptance that')
  console.error('establishes the absence (test ! -e <path>). Its ground truth is that there is nothing there.')
  process.exit(2)
}
if (!artifact || !goal || (arm === 'does-the-work' && !acceptance)) {
  console.error('usage: node scripts/oracle-add.mjs --arm does-the-work --artifact <path> --goal "<text>" --acceptance "<shell command>" [--id <id>] [--note "<why>"] [--force]')
  process.exit(2)
}

// THE GENERATOR ARM. Its ground truth cannot be a shell exit code — "this document's
// deliverable is a request addressed to someone else" is not mechanically testable —
// so it comes from EXECUTION: hand the artifact to an agent, keep what it emits, and
// have a SECOND agent classify that emission with a different question than the one
// under test. oracle/generator-procedure.md is the procedure.
//
// What this branch refuses is the shortcut: a row asserted without the emission it was
// derived from. `--emission` must name a file that exists, because the whole claim of
// this arm is that something OTHER than an opinion produced the label, and a caller who
// cannot show the emission is offering exactly the opinion this corpus replaces.
const emission = arg('--emission')
const disputed = argv.includes('--disputed')
if (arm === 'generator') {
  if (!emission) {
    console.error('add: --arm generator needs --emission <path>, the file the artifact PRODUCED when it was executed.')
    console.error('Its label comes from what it emitted, not from anyone saying so — see oracle/generator-procedure.md.')
    process.exit(2)
  }
  const eAbs = existsSync(resolve(ROOT, emission)) ? resolve(ROOT, emission) : emission
  if (!existsSync(eAbs)) {
    console.error(`add: the emission file ${emission} does not exist, so nothing shows what executing this artifact produced.`)
    process.exit(2)
  }
}

// THE PATH IS STORED REPO-RELATIVE, AND THE ROW IS REFUSED IF IT CANNOT BE.
//
// This used to store whatever shape the operator typed. Every one of the first 14
// rows was added with an absolute path, so the corpus could only be read on the
// machine that wrote it, and `oracle-record` refused all 14 anywhere else. The
// readers all carry `existsSync(resolve(ROOT, x)) ? resolve(ROOT, x) : x`, which
// looks like it handles this and does not: resolve(base, ABSOLUTE) returns the
// absolute path and ignores the base, so for the shape being stored the fallback
// could never fire. Normalising here is what makes that idiom true.
//
// Refusing an outside-the-repo path rather than storing `../../..` is deliberate.
// The corpus is committed; a row is ground truth only if every checkout can
// re-establish it, and a path that climbs out of the tree cannot promise that.
// The constraint belongs to the COMMITTED corpus, not to every corpus. A trial that
// builds a fixture in a temp sandbox and adds a row pointing at it is doing the right
// thing — that row is thrown away with the sandbox and no checkout ever re-reads it.
// staleness-trial.mjs does exactly this for all four of its cases, and refusing it
// outright broke a suite gate. So the refusal fires only when the row is going into
// the tracked file.
const abs = resolve(ROOT, artifact)
const rel = relative(ROOT, abs)
const insideRepo = !rel.startsWith('..') && !isAbsolute(rel)
const trackedCorpus = !process.env.ORACLE_CORPUS

if (insideRepo) {
  // From here on `artifact` IS the relative form: what gets written to the row, what
  // the refusal messages name, and what every reader resolves against ROOT.
  artifact = rel
} else if (trackedCorpus) {
  console.error(`add: ${artifact} is outside the repository.`)
  console.error('A row in the tracked corpus is ground truth only if any checkout can re-establish it, and a path')
  console.error('that leaves the tree cannot be re-established anywhere else. Copy the artifact under')
  console.error('oracle/fixtures/ and point the row at that.')
  console.error('')
  console.error('A throwaway corpus (ORACLE_CORPUS set) may point outside the tree: it is not committed and')
  console.error('nothing re-reads it.')
  process.exit(2)
}
// else: sandbox corpus, outside path — stored absolute, as given. It dies with the sandbox.
if (arm === 'could-not-open' && existsSync(abs)) {
  console.error(`add: ${artifact} EXISTS, and this arm's ground truth is that it does not.`)
  console.error('A could-not-open row records an absence. If the file is there, the probe can open it, and')
  console.error('whatever it answers is not this verdict. Point the row at a path that is genuinely not there.')
  process.exit(2)
}
if (arm !== 'could-not-open' && !existsSync(abs)) {
  console.error(`add: ${artifact} does not exist. A row whose artifact cannot be opened measures nothing — this is the same refusal the pairing check makes as "could-not-open".`)
  console.error('If an absent path is the POINT of the row, that is --arm could-not-open, whose ground truth is the absence.')
  process.exit(2)
}
// Skipped for the absence arm: there is nothing to stat, which is the row's whole claim.
if (arm !== 'could-not-open' && statSync(abs).isDirectory()) {
  console.error(`add: ${artifact} is a directory. The pairing check reads one file per side; a directory row would test something the probe never sees.`)
  process.exit(2)
}

// A ground truth downstream of a model is not a ground truth. This is a STRING check
// and it is therefore evadable — a model call disguised behind a local HTTP endpoint
// passes it. Stated rather than papered over: it stops the careless case, not the
// determined one, and the corpus's own note field is where a reader should look.
const MODEL_SHAPED = /\b(claude|anthropic|openai|gpt|llm|ollama|gemini)\b/i
if (arm === 'does-the-work' && MODEL_SHAPED.test(acceptance)) {
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
// Overridable ONLY so a test can reach this branch. Hardcoded at 120s, a test that
// exercised the timeout would have to wait 120s, so it never would — and this is the
// load-bearing safety property added after the fork bomb, which makes an unverified
// timeout the worst thing in this file to leave unverified. The default is unchanged.
const ACCEPTANCE_TIMEOUT_MS = Number(process.env.ORACLE_ACCEPTANCE_TIMEOUT_MS || 120_000)
const res = arm === 'generator' ? { status: 0, stdout: '' } : spawnSync(acceptance, { shell: true, cwd: ROOT, encoding: 'utf8', timeout: ACCEPTANCE_TIMEOUT_MS, killSignal: 'SIGKILL' })
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
// No hash for an absence. artifact_hash exists so oracle-record can refuse an observation
// made against different content; for this arm the content IS that there is none, and
// oracle-record re-checks that the path is still missing instead.
const artifactHash = arm === 'could-not-open' ? null : sha(readFileSync(abs))
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
  expected_role: arm === 'generator' ? 'produces-an-instruction' : arm === 'could-not-open' ? 'could-not-open' : 'does-the-work',
  // DISPUTED is recorded, not resolved. When the executing agent and the classifying
  // agent disagree about what the emission was, that disagreement IS the finding — a
  // row silently resolved toward the expected label is the answer key again.
  disputed: arm === 'generator' ? disputed : false,
  evidence: arm === 'could-not-open'
    ? { method: 'mechanical-absence', acceptance_command: acceptance, exit_code: res.status, stdout_head: null }
    : arm === 'generator'
    // THE EMISSION IS HASHED, like the artifact. It used to be a bare path, and a bare
    // path is a promise rather than evidence: deleting the file outright changed nothing
    // any tool could see. oracle-report re-checks both existence and this hash on every
    // run, so a generator row's ground truth stops being something anyone has to remember.
    ? { method: 'agentic-execution', emission: emission, emission_hash: 'sha256:' + createHash('sha256').update(readFileSync(existsSync(resolve(ROOT, emission)) ? resolve(ROOT, emission) : emission)).digest('hex'), classified_by: 'a second agent, asked about the OUTPUT rather than the artifact — see oracle/generator-procedure.md' }
    : {
        method: 'mechanical-execution',
        acceptance_command: acceptance,
        exit_code: res.status,
        stdout_head: String(res.stdout || '').trim().split('\n').slice(0, 3).join('\n') || null,
      },
  selection_note: note || null,
}
appendFileSync(CORPUS, JSON.stringify(row) + '\n')
// The generator arm runs no acceptance command, so saying one exited 0 would claim
// evidence that does not exist — the exact overstatement this corpus is built against.
// Each arm says what actually grounded it. The generator arm runs no acceptance command,
// so claiming one exited 0 would assert evidence that does not exist; the absence arm has
// no artifact to hash, because its claim is that there is no artifact.
console.log(`added ${id} (${arm}) — ${
  arm === 'generator' ? `grounded on the emission at ${emission}`
  : arm === 'could-not-open' ? `acceptance exited 0, and ${artifact} is not there — which is the row`
  : `acceptance exited 0, artifact ${artifactHash.slice(0, 23)}…`}`)
if (!note) {
  console.error('note: no --note given. Why this row is in the corpus is the part a later reader cannot reconstruct, and')
  console.error('      selection is the bias this corpus does NOT solve. Consider re-adding with --note and --force.')
}
