// The reproducible for #40 — the facts this corpus stores instead of recomputing.
//
//   node scripts/staleness-trial.mjs
//
// Five cases, each built rather than described. Every one constructs the situation in a
// sandbox, changes something the corpus depends on, and then asks whether anything
// notices. Exit 0 means all four are caught. Exit 1 means the corpus is reporting numbers
// whose grounds have moved underneath them.
//
// NO AGENTS AND NO MODEL. #40 is entirely mechanical, which is what makes it cheap to
// reproduce — unlike #27, which needed live draws. And per the fork-bomb rule this file
// must stay that way: nothing here may spawn a model, and nothing here writes to the
// tracked ledgers. Every case runs against ORACLE_CORPUS / ORACLE_RESULTS in a temp dir.
//
// WHY FIVE AND NOT TWO. #40 was filed on two symptoms — grounding executed once, verdict
// frozen at record time. The root cause is more general: a fact that can change is stored
// as a value instead of recomputed from its source, and which facts got a guard was
// decided by which ones had already burned someone. That predicts the defect in ANY
// derivable-but-stored field. Case D is what the prediction found: `disputed` is copied
// onto the observation and read back off the observation, and it decides whether an
// observation counts at all.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ADD = join(ROOT, 'scripts', 'oracle-add.mjs')
const RECORD = join(ROOT, 'scripts', 'oracle-record.mjs')
const REPORT = join(ROOT, 'scripts', 'oracle-report.mjs')
const EXTRACT = join(ROOT, 'scripts', 'oracle-extract.mjs')

let failures = 0

// A CRASH IS NOT A CATCH, and this file reported three of them as catches before the check
// existed. Two cases asked only `exit !== 0`, and a duplicated declaration in the report
// made every case exit non-zero — so a trial measuring a script that did not parse printed
// CAUGHT and returned the answer wanted. Any check whose success condition is satisfied by
// the thing being broken is measuring nothing. The refusal must be RECOGNISED, not merely
// non-zero.
function crashed(out) {
  return /\b(SyntaxError|ReferenceError|TypeError|RangeError)\b/.test(out) || /^\s+at .*\(node:internal/m.test(out)
}
function verdict(name, caught, detail, out) {
  if (out !== undefined && crashed(out)) {
    console.log(`BROKEN  ${name}`)
    console.log(`         the report did not run: ${String(out).trim().split('\n').find(l => /Error/.test(l)) || 'crashed'}`)
    failures++
    return
  }
  console.log(`${caught ? 'CAUGHT ' : 'MISSED '} ${name}`)
  if (!caught) { console.log(`         ${detail}`); failures++ }
}

function run(script, args, env) {
  try { return { code: 0, out: execFileSync(process.execPath, [script, ...args], { encoding: 'utf8', cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }) } }
  catch (e) { return { code: e.status === undefined ? -1 : e.status, out: String(e.stdout || '') + String(e.stderr || '') } }
}

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'staleness-'))
  return { dir, env: { ...process.env, ORACLE_CORPUS: join(dir, 'corpus.jsonl'), ORACLE_RESULTS: join(dir, 'results.jsonl') } }
}

// A does-the-work fixture whose acceptance command reads a file the row does NOT pin.
// The row pins `--artifact`, one path. The command's footprint is whatever it opens, and
// nothing records that set — `evidence` carries acceptance_command, exit_code and
// stdout_head, and no dependency list. So the two scopes cannot be made to agree by
// pinning; only re-running closes it.
function buildFixture(dir) {
  const f = join(dir, 'fixture')
  mkdirSync(f)
  writeFileSync(join(f, 'data.txt'), 'ok\n')
  writeFileSync(join(f, 'emit.sh'), '#!/bin/sh\ncat "$(dirname "$0")/data.txt"\n')
  return { script: join(f, 'emit.sh'), data: join(f, 'data.txt') }
}

// ── A. THE ACCEPTANCE COMMAND IS NEVER RE-RUN ───────────────────────────────────────
{
  const { dir, env } = sandbox()
  const fx = buildFixture(dir)
  const acceptance = `sh ${fx.script} | grep -qx ok`
  const add = run(ADD, ['--arm', 'does-the-work', '--artifact', fx.script, '--goal', 'the deliverable prints ok',
                        '--acceptance', acceptance, '--id', 'unpinned-dep', '--note', 'staleness trial'], env)
  if (add.code !== 0) { console.log(`SETUP FAILED (A): ${add.out.slice(0, 300)}`); failures++ }
  else {
    // Break a file the command reads and the row does not pin. The pinned artifact is
    // byte-identical throughout, so the artifact-hash guard has nothing to say.
    writeFileSync(fx.data, 'BROKEN\n')
    // Sanity: the command really does fail now. Without this the case could pass for the
    // wrong reason — a fixture that was never grounded proves nothing about re-running.
    let brokenNow = false
    try { execFileSync('sh', ['-c', acceptance], { stdio: 'ignore' }) } catch { brokenNow = true }
    if (!brokenNow) { console.log('SETUP FAILED (A): the acceptance command still passes after breaking its input'); failures++ }
    const rep = run(REPORT, [], env)
    const caught = brokenNow && rep.code === 1 && /no longer grounded/.test(rep.out) && /acceptance command exits/.test(rep.out)
    verdict('A. acceptance command re-run at read time',
      caught,
      'the row\'s command now exits non-zero and nothing says so — the report prints its numbers unchanged. evidence.exit_code is a past result, and the pinned artifact is unchanged because the file that broke is not the file that is pinned.', rep.out)
  }
  rmSync(dir, { recursive: true, force: true })
}

// ── B. THE GENERATOR ARM'S EMISSION IS A PATH WITH NO HASH ──────────────────────────
{
  const { dir, env } = sandbox()
  const f = join(dir, 'gen'); mkdirSync(f)
  const artifact = join(f, 'request.md')
  const emission = join(f, 'OUTPUT.md')
  writeFileSync(artifact, '# Please write the thing\n\nSomeone should implement this.\n')
  writeFileSync(emission, '# A prompt addressed to a further party\n')
  const add = run(ADD, ['--arm', 'generator', '--artifact', artifact, '--goal', 'the thing exists',
                        '--emission', emission, '--id', 'gen-row', '--note', 'staleness trial'], env)
  if (add.code !== 0) { console.log(`SETUP FAILED (B): ${add.out.slice(0, 300)}`); failures++ }
  else {
    rmSync(emission)   // the file that IS this row's ground truth
    const rep = run(REPORT, [], env)
    const caught = rep.code === 1 && /no longer grounded/.test(rep.out) && /emission/.test(rep.out)
    verdict('B. the emission is still there and unchanged',
      caught,
      'the emission — the only thing that grounds a generator row — was deleted and the report says nothing. evidence.emission is a path; nothing hashes it and nothing checks it exists.', rep.out)
  }
  rmSync(dir, { recursive: true, force: true })
}

// A row plus one recorded observation, for the two cases that need results.
function rowWithObservation(dir, env, { expected = 'does-the-work' } = {}) {
  const fx = buildFixture(dir)
  const add = run(ADD, ['--arm', 'does-the-work', '--artifact', fx.script, '--goal', 'the deliverable prints ok',
                        '--acceptance', `sh ${fx.script} | grep -qx ok`, '--id', 'r1', '--note', 'staleness trial'], env)
  if (add.code !== 0) return { ok: false, why: add.out }
  const ex = run(EXTRACT, ['--artifact', fx.script, '--goal', 'the deliverable prints ok', '--json'], env)
  if (ex.code !== 0) return { ok: false, why: ex.out }
  const j = JSON.parse(ex.out)
  const rec = run(RECORD, ['--row', 'r1', '--predicted', 'does-the-work', '--reasoning', 'it prints the deliverable',
                           '--prompt-hash', j.prompt_hash, '--schema-fingerprint', j.schema_fingerprint,
                           '--observer', 'staleness-trial'], env)
  if (rec.code !== 0) return { ok: false, why: rec.out }
  return { ok: true }
}

function editRow(env, mutate) {
  const p = env.ORACLE_CORPUS
  const rows = readFileSync(p, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  rows.forEach(mutate)
  writeFileSync(p, rows.map(r => JSON.stringify(r)).join('\n') + '\n')
}

// ── C. `correct` IS FROZEN AT RECORD TIME ───────────────────────────────────────────
{
  const { dir, env } = sandbox()
  const s = rowWithObservation(dir, env)
  if (!s.ok) { console.log(`SETUP FAILED (C): ${String(s.why).slice(0, 300)}`); failures++ }
  else {
    // The observation was scored CORRECT against expected_role `does-the-work`. Flip the
    // row's answer: the recorded verdict is now wrong by the corpus's own account.
    editRow(env, r => { r.expected_role = 'produces-an-instruction' })
    const rep = run(REPORT, [], env)
    const caught = rep.code === 1 && /disagree with the corpus they were scored against/.test(rep.out)
    verdict('C. `correct` re-derived from the corpus at read time',
      caught,
      'the row\'s expected_role was corrected and every recorded observation kept its old score. The report reads the corpus only for the header count; the rate comes from a value written by oracle-record.', rep.out)
  }
  rmSync(dir, { recursive: true, force: true })
}

// ── D. `disputed` IS FROZEN TOO, AND IT DECIDES WHETHER AN OBSERVATION COUNTS ───────
//
// Found by the root cause rather than by an incident: if the defect is "a derivable fact
// is stored", it is in every such field, including ones nobody looked at. This one gates
// INCLUSION — the report filters on the observation's copy (oracle-report.mjs:150-151),
// not on the row — so a row marked disputed today does not withdraw yesterday's draws.
{
  const { dir, env } = sandbox()
  const s = rowWithObservation(dir, env)
  if (!s.ok) { console.log(`SETUP FAILED (D): ${String(s.why).slice(0, 300)}`); failures++ }
  else {
    editRow(env, r => { r.disputed = true })
    const rep = run(REPORT, [], env)
    // A disputed row must not contribute to a rate. If the report still poses one over
    // that observation, the withdrawal did not take.
    const caught = rep.code === 0 && /ALL DISPUTED/.test(rep.out)
    verdict('D. `disputed` re-read from the corpus at read time',
      caught,
      'the row was marked disputed and its existing observation still counts toward the rate. The report filters on the observation\'s copy of the flag, so contested ground truth is only withdrawn from draws taken after the dispute.', rep.out)
  }
  rmSync(dir, { recursive: true, force: true })
}

// ── E. AN EXECUTION EMITS A SET, AND THE ROW PINS ONE OF IT ─────────────────────────
//
// Predicted by this file's own root cause rather than by an incident, which is how case D
// arrived too: if the defect is "a fact that can change is not tied to its source", then it
// is wherever the row's evidence is NARROWER than the evidence that actually established
// the label.
//
// Case A found that shape on the does-the-work arm — an acceptance command reads whatever
// it likes and the row pins one artifact — and the repair there was to RE-RUN the command,
// because the footprint is unbounded and a pin can never match it. The generator arm has
// the opposite property and therefore needs the opposite repair: there is nothing to
// re-run (re-running means spawning an agent, and a ground truth produced by the judgement
// under test cannot audit that judgement), the emission is a finite set of files that
// exists on disk, and so the pin CAN cover it exactly. `--emission` took one path.
//
// The instance is real: teardown-request's execution emitted teardown.md and a cover memo,
// the blind classifier quoted the memo as what decided it, and the row pinned the other
// file.
{
  const { dir, env } = sandbox()
  const f = join(dir, 'gen'); mkdirSync(f)
  const artifact = join(f, 'request.md')
  const first = join(f, 'teardown.md')
  const second = join(f, 'to-lead.md')
  writeFileSync(artifact, '# Produce the teardown and send it on\n')
  writeFileSync(first, '# The teardown itself\n')
  writeFileSync(second, '# Cover note: please forward this, the build is not ours\n')
  const add = run(ADD, ['--arm', 'generator', '--artifact', artifact, '--goal', 'the thing exists',
                        '--emission', first, '--emission', second, '--id', 'two-file-emission',
                        '--note', 'staleness trial'], env)
  if (add.code !== 0) { console.log(`SETUP FAILED (E): ${add.out.slice(0, 300)}`); failures++ }
  else {
    // Break the SECOND file — the one a row that pins only the first has nothing to say
    // about. Its content is what the classification rested on.
    writeFileSync(second, '# (emptied)\n')
    const rep = run(REPORT, [], env)
    const caught = rep.code === 1 && /no longer grounded/.test(rep.out) && /to-lead\.md/.test(rep.out)
    verdict('E. every file the execution emitted is pinned, not just the first',
      caught,
      'the execution emitted two files and the row pinned one, so rewriting the other changed nothing any reader could see. --emission takes a single path; an agentic execution produces a set, and the half that is not pinned is exactly as load-bearing as the half that is.', rep.out)
  }
  rmSync(dir, { recursive: true, force: true })
}

console.log('')
console.log(failures
  ? `NOT ENFORCED — ${failures} of 5 stale facts go unnoticed. The corpus is reporting numbers whose grounds have moved.`
  : 'ENFORCED — all five facts are recomputed from their source or pinned to it, not read back from what was written.')
process.exit(failures ? 1 : 0)
