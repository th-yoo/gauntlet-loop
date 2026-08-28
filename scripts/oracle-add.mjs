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
import { namesAModel } from './model-shaped.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// ORACLE_CORPUS lets a test point this at a throwaway file. It exists because a
// mutation test, by design, removes a guard and then runs the suite — and the suite
// writes rows. Without this the tracked corpus is one disabled guard away from
// gaining a fabricated row that no restore undoes, because mutate.mjs restores source,
// not data.
const CORPUS = process.env.ORACLE_CORPUS || join(ROOT, 'oracle', 'corpus.jsonl')

const argv = process.argv.slice(2)
const FLAGS = ['--grounding', '--artifact', '--goal', '--acceptance', '--id', '--note', '--inspect', '--emission', '--classification', '--expected-role']
const arg = n => {
  const i = argv.indexOf(n)
  if (i === -1) return null
  const v = argv[i + 1]
  return v === undefined || FLAGS.includes(v) ? null : v
}

const grounding = arg('--grounding')
let artifact = arg('--artifact')
const goal = arg('--goal')
const acceptance = arg('--acceptance')
const note = arg('--note')
const inspect = arg('--inspect')
const force = argv.includes('--force')

// GROUNDING AND ANSWER ARE SEPARATE, and they used to be one flag.
//
// `--arm` meant three things at once — which answer the row expects, how it was grounded,
// and what evidence it carries. This file's own header said so, about the absence case:
// "a third answer needed a third grounding even though this one's is the cheapest in the
// corpus". The same conflation then made a whole combination unstorable: an artifact only
// an AGENT can execute whose emission turns out to be a COMPLETED ANSWER. Two of those
// exist — a handoff message to a named studio and a hiring ad, both executed into landing
// pages and both classified as completed answers by a blind second agent — and neither
// could be added, because the generator path wrote `produces-an-instruction` from the flag.
// #49.
//
// A FOURTH ARM WOULD BE ONE ENTRY PER CASE, which this project calls cheating. So the flag
// now names only HOW the row is grounded, and the expected role is READ OFF the evidence:
//
//   mechanical  an acceptance command that is RUN here and must exit 0. What that
//               establishes is that executing the artifact reaches the deliverable, so the
//               answer is does-the-work. No model is consulted and one is refused.
//   absence     the same command, establishing that there is nothing at the path
//               (`test ! -e`). The answer is could-not-open, and the grounding is inverted
//               rather than new.
//   agentic     the artifact is executed by an agent, the emission is kept, and a SECOND
//               agent classifies that emission with a different question — see
//               oracle/generator-procedure.md. The answer comes from THAT classification,
//               whichever way it went.
//
// scripts/rowmodel-trial.mjs case C is the check, and it crosses the label against the
// evidence rather than asking for a shape: two rows identical except for what the blind
// classification says, required to come back with different expected roles. No arrangement
// of flags can pass that while taking the label from a flag.
const GROUNDINGS = ['mechanical', 'agentic', 'absence']
if (!GROUNDINGS.includes(grounding)) {
  console.error('usage: node scripts/oracle-add.mjs --grounding mechanical --artifact <path> --goal "<text>" --acceptance "<shell command>" [--id <id>] [--note "<why>"] [--force]')
  console.error('')
  console.error('--grounding names HOW the row is established, never what answer it expects:')
  console.error('  mechanical  --acceptance "<command>" — run here, must exit 0. Answer: does-the-work.')
  console.error('  absence     --acceptance "test ! -e <path>" on a path that is not there. Answer: could-not-open.')
  console.error('  agentic     --emission <file> (once per file) and --classification <file>, the blind')
  console.error('              second agent\'s response. The ANSWER IS READ FROM IT — this tool does not')
  console.error('              decide it, because a label written from a flag is the authored answer key')
  console.error('              this corpus exists to replace. See oracle/generator-procedure.md.')
  process.exit(2)
}
if (!artifact || !goal || (grounding !== 'agentic' && !acceptance)) {
  console.error('usage: node scripts/oracle-add.mjs --grounding mechanical --artifact <path> --goal "<text>" --acceptance "<shell command>" [--id <id>] [--note "<why>"] [--force]')
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
//
// AN EXECUTION EMITS A SET, SO --emission IS REPEATABLE and every file it names is pinned.
// It used to take one path. That is not a smaller version of the same thing: the label
// comes from the WHOLE output, and the one real case where the output was two files — a
// commissioned teardown plus the cover memo routing it onward — had the classifier quoting
// the memo as what decided it while the row pinned the other file. Rewrite the unpinned
// half and no reader could tell.
//
// The does-the-work arm has the same shape and the opposite repair. There the evidence is a
// command whose footprint is unbounded and unrecorded, so oracle-report RE-RUNS it rather
// than pinning it. Here there is nothing to re-run — re-running means spawning an agent,
// and a ground truth produced by the judgement under test cannot audit that judgement — but
// the emission is a finite set of files sitting on disk, so the pin can cover it exactly.
// scripts/staleness-trial.mjs case E builds the two-file case.
const emissions = argv.reduce((acc, v, i) => (v === '--emission' && argv[i + 1] && !FLAGS.includes(argv[i + 1]) ? [...acc, argv[i + 1]] : acc), [])
const disputed = argv.includes('--disputed')
if (grounding === 'agentic') {
  if (!emissions.length) {
    console.error('add: --grounding agentic needs --emission <path>, the file the artifact PRODUCED when it was executed.')
    console.error('Its label comes from what it emitted, not from anyone saying so — see oracle/generator-procedure.md.')
    console.error('Pass --emission once per file if the execution produced several: the label rests on all of them,')
    console.error('so a row that pins one of three leaves two able to change with nothing noticing.')
    process.exit(2)
  }
  for (const em of emissions) {
    const eAbs = existsSync(resolve(ROOT, em)) ? resolve(ROOT, em) : em
    if (!existsSync(eAbs)) {
      console.error(`add: the emission file ${em} does not exist, so nothing shows what executing this artifact produced.`)
      process.exit(2)
    }
  }
}

// THE ANSWER IS READ OFF THE BLIND CLASSIFICATION, NOT TAKEN FROM A FLAG.
//
// oracle/generator-procedure.md puts one question to a second agent that has never seen the
// artifact — is this output a completed answer to the goal, or is it addressed to a further,
// unspecified party as something for them to act on — and step 3 says agreement between the
// two gives the row its expected role. The tool used to skip that and write the label from
// `--arm generator`, which is the authored answer key this corpus exists to replace, and it
// made the completed-answer outcome unstorable.
//
// The response file is required and its verdict is what decides, exactly as oracle-record
// requires --raw and checks the fields against it. The mapping is one fixed rule, not a
// registry: what the classifier can say is what the procedure asks, and each answer means
// one role.
const CLASSIFICATION_ROLE = {
  'completed-answer': 'does-the-work',
  'addressed-to-a-further-party': 'produces-an-instruction',
}
let classifications = null
let agenticRole = null
if (grounding === 'agentic') {
  // Repeatable, like --emission and for the same reason: the procedure can be run more than
  // once on one emission, and when two blind classifiers disagree that disagreement IS the
  // row's ground truth. Storing one of them and dropping the other would resolve a dispute
  // by discarding half of it.
  const cPaths = argv.reduce((acc, v, i) => (v === '--classification' && argv[i + 1] && !FLAGS.includes(argv[i + 1]) ? [...acc, argv[i + 1]] : acc), [])
  const cPath = cPaths[0]
  if (!cPath) {
    console.error('add: --grounding agentic needs --classification <file>, the blind second agent\'s response.')
    console.error('Its verdict is what decides this row\'s expected role. Writing the label from the flag instead is')
    console.error('the authored answer key this corpus exists to replace — see oracle/generator-procedure.md.')
    process.exit(2)
  }
  const cAbs = existsSync(resolve(ROOT, cPath)) ? resolve(ROOT, cPath) : cPath
  if (!existsSync(cAbs)) {
    console.error(`add: the classification file ${cPath} does not exist, so nothing shows how the emission was classified.`)
    process.exit(2)
  }
  classifications = []
  for (const cp of cPaths) {
    const abs2 = existsSync(resolve(ROOT, cp)) ? resolve(ROOT, cp) : cp
    if (!existsSync(abs2)) { console.error(`add: the classification file ${cp} does not exist, so nothing shows how the emission was classified.`); process.exit(2) }
    const cText = readFileSync(abs2, 'utf8')
    let body
    try { body = JSON.parse(cText.slice(cText.indexOf('{'), cText.lastIndexOf('}') + 1)) } catch {
      console.error(`add: ${cp} holds no JSON object, so there is no verdict in it to read.`)
      process.exit(2)
    }
    if (!CLASSIFICATION_ROLE[body.verdict]) {
      console.error(`add: the classification ${cp} says ${JSON.stringify(body.verdict)}, which is not one of the two answers the procedure asks for.`)
      console.error(`Expected one of: ${Object.keys(CLASSIFICATION_ROLE).map(k => JSON.stringify(k)).join(', ')}.`)
      console.error('An answer outside the question is not a classification of this emission.')
      process.exit(2)
    }
    classifications.push({ path: cp, hash: 'sha256:' + createHash('sha256').update(cText).digest('hex'), verdict: body.verdict })
  }
  const verdicts = [...new Set(classifications.map(c => c.verdict))]
  if (verdicts.length > 1 && !disputed) {
    console.error(`add: the classifications disagree (${verdicts.join(' vs ')}), so this row's ground truth is contested.`)
    console.error('Pass --disputed. The procedure is explicit that a disagreement is itself the finding and must not be')
    console.error('resolved by preferring whichever answer was expected — see oracle/generator-procedure.md.')
    process.exit(2)
  }
  agenticRole = CLASSIFICATION_ROLE[classifications[0].verdict]
}

// A CALLER MAY STATE THE LABEL ONLY ON A ROW NOTHING WILL BE SCORED AGAINST.
//
// `--expected-role` exists for one situation: a row whose ground truth is CONTESTED, where
// the label rests on a classification that is not on disk and a pinned one disagrees with
// it. `partial-handoff` is that row — its own note records an earlier blind classifier
// saying "addressed-onward", whose response was never kept, and a second one run on
// 2026-08-26 called the same emission a completed answer.
//
// It is refused without --disputed, and a disputed row is excluded from every rate the
// report computes. So an asserted label can never reach a number — which is the only reason
// accepting one here is not the authored answer key this corpus exists to replace.
const assertedRole = arg('--expected-role')
if (assertedRole && !disputed) {
  console.error('add: --expected-role is only accepted with --disputed.')
  console.error('On any other row the label is READ from the evidence — a command that exits 0, an absence, or the')
  console.error('blind classification. Asserting it is the answer key this corpus exists to replace. A disputed row')
  console.error('is excluded from every rate, so a label on one cannot reach a number.')
  process.exit(2)
}
if (assertedRole && !['does-the-work', 'produces-an-instruction', 'could-not-open'].includes(assertedRole)) {
  console.error(`add: ${JSON.stringify(assertedRole)} is not a role the schema allows.`)
  process.exit(2)
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
if (grounding === 'absence' && existsSync(abs)) {
  console.error(`add: ${artifact} EXISTS, and this row's ground truth is that it does not.`)
  console.error('A could-not-open row records an absence. If the file is there, the probe can open it, and')
  console.error('whatever it answers is not this verdict. Point the row at a path that is genuinely not there.')
  process.exit(2)
}
if (grounding !== 'absence' && !existsSync(abs)) {
  console.error(`add: ${artifact} does not exist. A row whose artifact cannot be opened measures nothing — this is the same refusal the pairing check makes as "could-not-open".`)
  console.error('If an absent path is the POINT of the row, that is --grounding absence, whose ground truth is the absence.')
  process.exit(2)
}
// Skipped for an absence: there is nothing to stat, which is the row's whole claim.
if (grounding !== 'absence' && statSync(abs).isDirectory()) {
  console.error(`add: ${artifact} is a directory. The pairing check reads one file per side; a directory row would test something the probe never sees.`)
  process.exit(2)
}

// A ground truth downstream of a model is not a ground truth. This is a STRING check
// and it is therefore evadable — a model call disguised behind a local HTTP endpoint
// passes it. Stated rather than papered over: it stops the careless case, not the
// determined one, and the corpus's own note field is where a reader should look.
if (grounding === 'mechanical' && namesAModel(acceptance)) {
  console.error(`add: the acceptance command mentions a model ("${acceptance}").`)
  console.error('A mechanical grounding has to be established WITHOUT the kind of judgement being tested — a')
  console.error('quantity derived downstream of the decision under test cannot audit that decision. Use a command')
  console.error('that settles the deliverable mechanically, or add the row through the generator procedure instead.')
  process.exit(2)
}

// RUN IT. Not "record that a command was supplied" — run it and require exit 0. A row
// whose acceptance command was never executed is an assertion, which is what this
// corpus exists to stop accepting.
// Hard wall-clock limit. A command that cannot settle cannot ground a row, and an
// unbounded spawn here is arbitrary command execution with no exit: the namesAModel
// guard above is the only thing in front of it, and a mutation test's whole purpose is
// to remove that guard and see what happens. It once did, and the canary it reached was
// a live agent that re-entered this repo. Note what the timeout does NOT do: killing the
// shell does not kill what the shell spawned, so this bounds the wait, not the blast.
// Overridable ONLY so a test can reach this branch. Hardcoded at 120s, a test that
// exercised the timeout would have to wait 120s, so it never would — and this is the
// load-bearing safety property added after the fork bomb, which makes an unverified
// timeout the worst thing in this file to leave unverified. The default is unchanged.
const ACCEPTANCE_TIMEOUT_MS = Number(process.env.ORACLE_ACCEPTANCE_TIMEOUT_MS || 120_000)
const res = grounding === 'agentic' ? { status: 0, stdout: '' } : spawnSync(acceptance, { shell: true, cwd: ROOT, encoding: 'utf8', timeout: ACCEPTANCE_TIMEOUT_MS, killSignal: 'SIGKILL' })
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
// made against different content; for an absence the content IS that there is none, and
// oracle-record re-checks that the path is still missing instead.
const artifactHash = grounding === 'absence' ? null : sha(readFileSync(abs))
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
  // HOW it was established, and separately WHAT it expects. One field used to carry both.
  grounding,
  artifact,
  artifact_hash: artifactHash,
  goal,
  inspect: inspect || null,
  // Read off the evidence in every case: from the blind classification where an agent
  // executed the artifact, and from what a command that exits 0 establishes otherwise.
  expected_role: assertedRole || (grounding === 'agentic' ? agenticRole : grounding === 'absence' ? 'could-not-open' : 'does-the-work'),
  // DISPUTED is recorded, not resolved. When the executing agent and the classifying
  // agent disagree about what the emission was, that disagreement IS the finding — a
  // row silently resolved toward the expected label is the answer key again.
  disputed: grounding === 'agentic' ? disputed : false,
  evidence: grounding === 'absence'
    ? { method: 'mechanical-absence', acceptance_command: acceptance, exit_code: res.status, stdout_head: null }
    : grounding === 'agentic'
    // THE EMISSION IS HASHED, like the artifact. It used to be a bare path, and a bare
    // path is a promise rather than evidence: deleting the file outright changed nothing
    // any tool could see. oracle-report re-checks both existence and this hash on every
    // run, so a generator row's ground truth stops being something anyone has to remember.
    ? {
        method: 'agentic-execution',
        // ALWAYS an array, including for one file. A second representation for the
        // single-file case is the drift this corpus spends its longest comments on, and
        // every reader would then have to handle both.
        emissions: emissions.map(em => ({
          path: em,
          hash: 'sha256:' + createHash('sha256').update(readFileSync(existsSync(resolve(ROOT, em)) ? resolve(ROOT, em) : em)).digest('hex'),
        })),
        // The response the expected role was READ FROM, pinned like the emissions. Without
        // it on disk the label is an assertion again, whichever flag produced it.
        classifications,
        classified_by: 'a second agent, asked about the OUTPUT rather than the artifact — see oracle/generator-procedure.md',
      }
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
console.log(`added ${id} (${grounding}, expects ${row.expected_role}) — ${
  grounding === 'agentic' ? `${emissions.length} emission file(s) and ${classifications.length} classification(s): ${classifications.map(c => c.verdict).join(', ')}${disputed ? ' — CONTESTED' : ''}`
  : grounding === 'absence' ? `acceptance exited 0, and ${artifact} is not there — which is the row`
  : `acceptance exited 0, artifact ${artifactHash.slice(0, 23)}…`}`)
if (!note) {
  console.error('note: no --note given. Why this row is in the corpus is the part a later reader cannot reconstruct, and')
  console.error('      selection is the bias this corpus does NOT solve. Consider re-adding with --note and --force.')
}
