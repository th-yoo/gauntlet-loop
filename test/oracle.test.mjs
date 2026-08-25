// The oracle harness's refusals. Each one exists because a corpus that accepts a row
// it cannot ground produces a number nobody should trust — which is worse than no
// number, because a number gets quoted.
//
//   node test/oracle.test.mjs

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const EXTRACT = join(ROOT, 'scripts', 'oracle-extract.mjs')
const ADD = join(ROOT, 'scripts', 'oracle-add.mjs')
const RECORD = join(ROOT, 'scripts', 'oracle-record.mjs')

function ok(cond, msg) { if (!cond) throw new Error(`ASSERT FAILED: ${msg}`) }
function eq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`ASSERT FAILED: ${msg}\n  expected: ${JSON.stringify(b)}\n  actual:   ${JSON.stringify(a)}`)
}
// Returns the failure with its exit CODE and message. "Exited non-zero" cannot tell a
// deliberate refusal from a crash, and this repo has shipped that confusion before.
// EVERY invocation writes to THROWAWAY ledgers, never the tracked ones.
//
// A mutation test removes a guard by design and then runs this suite — and this suite
// adds rows. Disabling the failing-acceptance guard made a real run append a fabricated
// row (`should-not-exist`, acceptance `false`, exit 1) into the tracked corpus, where it
// survived mutate.mjs's restore and was staged for commit as data. mutate.mjs restores
// the SOURCE it mutated; it cannot know what the suite wrote while the mutation was live.
const SANDBOX = mkdtempSync(join(tmpdir(), 'oracle-test-'))
const SANDBOX_ENV = { ...process.env, ORACLE_CORPUS: join(SANDBOX, 'corpus.jsonl'), ORACLE_RESULTS: join(SANDBOX, 'results.jsonl') }
// The staleness and artifact-pin cases need a real row to aim at, so the sandbox corpus
// starts as a copy of the tracked one — read, never written.
writeFileSync(join(SANDBOX, 'corpus.jsonl'), readFileSync(join(ROOT, 'oracle', 'corpus.jsonl')))

function run(script, args) {
  // timeout, because a refusal that fails to fire can HANG rather than exit non-zero,
  // and a wedged suite reports nothing at all, which reads as "not run" not "broken".
  // The timeout is NOT containment: it kills this child, and any grandchild the child
  // spawned is reparented to init and keeps running. That is why the model-shaped
  // canary below has to be inert on its own — it names a path that does not exist, and
  // it says what it is, so anything that does execute it can recognise it rather than
  // get to work. It was once a live `claude -p "did this work?"`, and the agents that
  // spawned re-entered this repo and re-ran this suite. See ORACLE-MUTATION-INCIDENT.md.
  try { return { code: 0, out: execFileSync(process.execPath, [script, ...args], { encoding: 'utf8', cwd: ROOT, env: SANDBOX_ENV, stdio: ['ignore', 'pipe', 'pipe'], timeout: 20_000 }) } }
  catch (e) { return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') } }
}

// THE KEYSTONE. The oracle must never carry its own copy of loop.js's prompt — a
// second copy of a contract drifts, and that drift is what invalidated five of seven
// earlier observations. This asserts the prompt is captured from the live script.
{
  const r = run(EXTRACT, ['--artifact', join(ROOT, 'oracle', 'fixtures', 'make-hello', 'Makefile'),
                          '--goal', 'a working hello executable exists and prints hello', '--json'])
  eq(r.code, 0, `extraction succeeds — got ${r.code}: ${r.out.slice(0, 300)}`)
  const j = JSON.parse(r.out)
  eq(j.agent_type, 'gauntlet-loop:gauntlet-goal-check', 'the captured call carries the agent type loop.js actually uses')
  for (const role of ['does-the-work', 'produces-an-instruction', 'could-not-open']) {
    ok(j.prompt.includes(role), `the captured prompt carries the "${role}" option verbatim from loop.js`)
  }
  ok(j.prompt.includes('a working hello executable exists'), 'and the goal it was given')
  ok(j.prompt_hash.startsWith('sha256:') && j.schema_fingerprint.startsWith('sha256:'), 'both hashes are recorded')

  // The live source must contain the captured text. If someone pastes the prompt into
  // the oracle instead of extracting it, this stays green while the real prompt drifts
  // away — so the check is that loop.js ITSELF still contains what was captured.
  const loop = readFileSync(join(ROOT, 'skills', 'gauntlet-loop', 'loop.js'), 'utf8')
  ok(loop.includes('produces-an-instruction  — it would write or emit something for a DIFFERENT party'),
     'the captured wording is loop.js\'s own — the oracle reads the instrument, it does not restate it')
  console.log('oracle: the live prompt is captured from loop.js rather than retyped OK')
}

// THE COHORT IS THE TEMPLATE, NOT THE FILLED-IN PROMPT.
//
// The goal and artifact path are interpolated INTO the prompt, so two rows can never
// share a prompt_hash. Grouping cohorts by it put every row in a cohort of its own —
// the report tool said so on its own first four-row run. The template hash blanks this
// row's own goal and artifact out, so it is stable ACROSS rows and moves only when the
// wording itself changes, which is the event that must actually split a cohort.
{
  const A = join(ROOT, 'oracle', 'fixtures', 'make-hello', 'Makefile')
  const B = join(ROOT, 'oracle', 'fixtures', 'py-slug', 'slugify.py')
  const one = JSON.parse(run(EXTRACT, ['--artifact', A, '--goal', 'goal one here', '--json']).out)
  const two = JSON.parse(run(EXTRACT, ['--artifact', B, '--goal', 'a completely different goal', '--json']).out)

  ok(one.prompt_hash !== two.prompt_hash,
     'two different rows produce different filled-in prompts — this is why prompt_hash cannot be the cohort key')
  eq(one.template_hash, two.template_hash,
     'but the same template, so they belong to ONE cohort and a rate can be computed across them')
  ok(one.template_hash.startsWith('sha256:'), 'the template hash is recorded')

  // And the template must still be sensitive to the thing it exists to detect.
  const loop = readFileSync(join(ROOT, 'skills', 'gauntlet-loop', 'loop.js'), 'utf8')
  ok(loop.includes('Being short, incomplete, badly written, or bad at the goal does not change the answer'),
     'the wording the template hashes is loop.js\'s own, so a change there moves every row\'s cohort at once')
  console.log('oracle: the cohort key is the prompt TEMPLATE, stable across rows and sensitive to wording OK')
}

// AND THE REPORT MUST GROUP BY IT. Two observations sharing a template but not a
// prompt are ONE cohort; two with different templates are TWO, because a wording change
// is exactly the event that must not be averaged away.
{
  const dir = mkdtempSync(join(tmpdir(), 'oracle-report-'))
  const results = join(dir, 'results.jsonl')
  const mk = (row, template, prompt, correct) => JSON.stringify({
    row, arm: 'does-the-work', artifact: '/x/' + row, expected_role: 'does-the-work',
    predicted_role: correct ? 'does-the-work' : 'produces-an-instruction', correct,
    prompt_hash: prompt, template_hash: template, schema_fingerprint: 'sha256:fp', observer: 't',
  })
  writeFileSync(results, [
    mk('a', 'sha256:TPL1', 'sha256:P1', true),
    mk('b', 'sha256:TPL1', 'sha256:P2', true),
    mk('c', 'sha256:TPL2', 'sha256:P3', false),
  ].join('\n') + '\n')

  const env = { ...process.env, ORACLE_CORPUS: join(dir, 'corpus.jsonl'), ORACLE_RESULTS: results }
  let out = ''
  try { out = execFileSync(process.execPath, [join(ROOT, 'scripts', 'oracle-report.mjs')], { encoding: 'utf8', cwd: ROOT, env }) }
  catch (e) { out = String(e.stdout || '') + String(e.stderr || '') }

  const cohorts = (out.match(/── instrument/g) || []).length
  eq(cohorts, 2, `three observations across two templates report as TWO cohorts, not three and not one — got ${cohorts}\n${out}`)
  ok(/observations      2/.test(out), 'the two sharing a template are counted together despite differing prompt hashes')
  ok(/misclassified     1/.test(out), 'and the different-template observation is kept separate rather than diluting the other cohort')
  rmSync(dir, { recursive: true, force: true })
  console.log('oracle: the report groups observations by template, so a wording change splits a cohort instead of averaging into it OK')
}

// A DISPUTED ROW IS EXCLUDED FROM THE RATE, AND SAID OUT LOUD.
//
// Disputed means the two independent classifiers disagreed about what the artifact
// emitted, so its expected role is contested. Scoring an observation against it costs a
// choice of side, and that choice is the authored answer key the corpus exists to
// replace. Averaging it in would also make a disagreement — which is a finding —
// disappear into a percentage.
{
  const dir = mkdtempSync(join(tmpdir(), 'oracle-disputed-'))
  const results = join(dir, 'results.jsonl')
  const mk = (row, correct, disputed) => JSON.stringify({
    row, arm: 'generator', artifact: '/x/' + row, expected_role: 'produces-an-instruction',
    predicted_role: correct ? 'produces-an-instruction' : 'does-the-work', correct, disputed,
    prompt_hash: 'sha256:P' + row, template_hash: 'sha256:TPL', schema_fingerprint: 'sha256:fp', observer: 't',
  })
  // Two clean and correct; one DISPUTED and scored wrong. If the disputed row counted,
  // the arm would report 3 observations and 1 misclassified.
  writeFileSync(results, [mk('a', true, false), mk('b', true, false), mk('c', false, true)].join('\n') + '\n')

  const env = { ...process.env, ORACLE_CORPUS: join(dir, 'corpus.jsonl'), ORACLE_RESULTS: results }
  let out = ''
  try { out = execFileSync(process.execPath, [join(ROOT, 'scripts', 'oracle-report.mjs')], { encoding: 'utf8', cwd: ROOT, env }) }
  catch (e) { out = String(e.stdout || '') + String(e.stderr || '') }

  ok(/observations      2/.test(out), `the disputed observation is not counted in the arm's total — got:\n${out}`)
  ok(/misclassified     0/.test(out), 'and its wrong answer does not become a misclassification, because its ground truth is contested')
  ok(/DISPUTED          1/.test(out), 'but it is reported, not dropped silently')
  ok(/contested ground truth is a finding/.test(out), 'and the report says why it is held apart')
  rmSync(dir, { recursive: true, force: true })
  console.log('oracle: a disputed observation is excluded from the rate and surfaced rather than averaged in OK')
}

// A path that does not exist cannot be an oracle row: the hash would pin an absence.
{
  const r = run(EXTRACT, ['--artifact', '/oracle/definitely/not/here.md', '--goal', 'g', '--json'])
  eq(r.code, 2, `a missing artifact is refused with the bad-input code — got ${r.code}`)
  ok(/does not exist/.test(r.out), 'and says so rather than hashing nothing')
  console.log('oracle: extraction refuses an artifact that is not there OK')
}

// GROUND TRUTH MUST NOT BE DOWNSTREAM OF THE JUDGEMENT UNDER TEST.
{
  const r = run(ADD, ['--arm', 'does-the-work', '--artifact', join(ROOT, 'oracle', 'fixtures', 'make-hello', 'Makefile'),
                      '--goal', 'g', '--acceptance', '/nonexistent/claude-ORACLE-CANARY-DO-NOT-EXECUTE', '--id', 'should-not-exist'])
  eq(r.code, 2, `an acceptance command that consults a model is refused — got ${r.code}`)
  ok(/cannot audit that decision/.test(r.out), 'on the ground that it cannot audit the decision under test')
  console.log('oracle: a model-backed acceptance command is refused OK')
}

// AN ACCEPTANCE COMMAND THAT DOES NOT PASS IS NOT GROUND TRUTH.
{
  const r = run(ADD, ['--arm', 'does-the-work', '--artifact', join(ROOT, 'oracle', 'fixtures', 'make-hello', 'Makefile'),
                      '--goal', 'g', '--acceptance', 'false', '--id', 'should-not-exist'])
  eq(r.code, 1, `a failing acceptance command is refused — got ${r.code}`)
  ok(/did not succeed/.test(r.out) && /do not record the row anyway/.test(r.out),
     'and the tool says why rather than recording an ungrounded row')
  console.log('oracle: a row whose acceptance command fails is refused OK')
}

// THE GENERATOR ARM CANNOT BE ADDED BY ASSERTION.
//
// It has no mechanical acceptance test — "this document's deliverable is a request
// addressed to someone else" is not a shell exit code — so its label comes from
// EXECUTION: hand the artifact to an agent, keep what it emits, have a second agent
// classify that emission. The refusal here is the shortcut: a row offered without the
// emission it was derived from is exactly the opinion this corpus exists to replace.
{
  const r = run(ADD, ['--arm', 'generator', '--artifact', join(ROOT, 'oracle', 'fixtures', 'make-hello', 'Makefile'),
                      '--goal', 'g', '--id', 'should-not-exist'])
  eq(r.code, 2, `a generator row with no emission is refused — got ${r.code}`)
  ok(/needs --emission/.test(r.out), 'naming what is missing')
  ok(/not from anyone saying so/.test(r.out), 'and why an assertion is not enough')

  // And an emission path that does not exist is not an emission.
  const r2 = run(ADD, ['--arm', 'generator', '--artifact', join(ROOT, 'oracle', 'fixtures', 'make-hello', 'Makefile'),
                       '--goal', 'g', '--emission', '/oracle/no/such/output.md', '--id', 'should-not-exist'])
  eq(r2.code, 2, 'an emission file that is not there is refused')
  ok(/does not exist/.test(r2.out), 'because nothing then shows what executing the artifact produced')
  console.log('oracle: a generator row without the emission it was derived from is refused OK')
}

// THE STALENESS REFUSAL — the whole reason observations carry hashes.
{
  const r = run(RECORD, ['--row', 'make-hello', '--predicted', 'does-the-work',
                         '--prompt-hash', 'sha256:0000', '--schema-fingerprint', 'sha256:0000'])
  eq(r.code, 1, `an observation made against a different prompt is refused — got ${r.code}`)
  ok(/DIFFERENT instrument/.test(r.out), 'and names the mismatch')
  ok(/five of seven/.test(r.out), 'citing the event that made this check necessary')
  console.log('oracle: an observation from a stale instrument is refused OK')
}

// A ROLE OUTSIDE THE SCHEMA IS NOT AN OBSERVATION OF THIS INSTRUMENT.
{
  const r = run(RECORD, ['--row', 'make-hello', '--predicted', 'probably-fine',
                         '--prompt-hash', 'sha256:0000', '--schema-fingerprint', 'sha256:0000'])
  eq(r.code, 2, 'a role the schema does not allow is refused as bad input')
  ok(/not one of the three roles/.test(r.out), 'naming the three the schema does allow')
  console.log('oracle: a role outside the schema is refused OK')
}

// THE ARTIFACT PIN. A row whose file changed describes a different artifact, and
// observations about the old content are not evidence about the new one.
{
  const M = join(ROOT, 'oracle', 'fixtures', 'make-hello', 'Makefile')
  const original = readFileSync(M)
  try {
    writeFileSync(M, original + '\n# changed for one assertion\n')
    const r = run(RECORD, ['--row', 'make-hello', '--predicted', 'does-the-work',
                           '--prompt-hash', 'sha256:0000', '--schema-fingerprint', 'sha256:0000'])
    eq(r.code, 1, 'an observation against a changed artifact is refused')
    ok(/has changed since row/.test(r.out), 'and says the ground truth no longer applies')
  } finally {
    // Restored by BYTES, not by re-typing the file. Editing a fixture by hand to put it
    // back is how this repo damaged one earlier today and only caught it on a hash.
    writeFileSync(M, original)
  }
  const after = readFileSync(M)
  ok(Buffer.compare(after, original) === 0, 'and the fixture is byte-identical afterwards')
  console.log('oracle: an observation against a changed artifact is refused, and the fixture survives the test OK')
}

// THE CORPUS ROW ON DISK IS STILL GROUNDED — the acceptance command still passes.
{
  const rows = readFileSync(join(ROOT, 'oracle', 'corpus.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  ok(rows.length >= 1, 'the corpus has at least one row')
  for (const row of rows) {
    // Each arm is grounded differently, and each must carry ITS OWN grounding: the
    // does-the-work arm by a command that was run, the generator arm by the emission
    // that executing the artifact produced. A row carrying neither is an assertion.
    ok(row.evidence, `row ${row.id} carries evidence at all`)
    if (row.arm === 'does-the-work') {
      ok(row.evidence.acceptance_command, `row ${row.id} carries the command that grounded it`)
      eq(row.evidence.method, 'mechanical-execution', `row ${row.id} says how it was grounded`)
    } else {
      ok(row.evidence.emission, `generator row ${row.id} names the emission it was derived from`)
      eq(row.evidence.method, 'agentic-execution', `row ${row.id} says how it was grounded`)
      eq(row.expected_role, 'produces-an-instruction', `generator row ${row.id} expects the generator role`)
    }
    ok(row.expected_role, `row ${row.id} has an expected role`)
    ok(row.goal, `row ${row.id} carries its goal — role is goal-relative, so a row without one is undefined`)
    ok(row.artifact.startsWith('/'), `row ${row.id} uses an absolute path, the shape loop.js receives and the prompt hashes`)
  }
  console.log(`oracle: all ${rows.length} corpus row(s) carry goal, expected role and grounding evidence OK`)
}
