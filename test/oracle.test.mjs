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

function run(script, args, extraEnv) {
  // timeout, because a refusal that fails to fire can HANG rather than exit non-zero,
  // and a wedged suite reports nothing at all, which reads as "not run" not "broken".
  // The timeout is NOT containment: it kills this child, and any grandchild the child
  // spawned is reparented to init and keeps running. That is why the model-shaped
  // canary below has to be inert on its own — it names a path that does not exist, and
  // it says what it is, so anything that does execute it can recognise it rather than
  // get to work. It was once a live `claude -p "did this work?"`, and the agents that
  // spawned re-entered this repo and re-ran this suite. See ORACLE-MUTATION-INCIDENT.md.
  try { return { code: 0, out: execFileSync(process.execPath, [script, ...args], { encoding: 'utf8', cwd: ROOT, env: { ...SANDBOX_ENV, ...(extraEnv || {}) }, stdio: ['ignore', 'pipe', 'pipe'], timeout: 20_000 }) } }
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

  // AND --inspect, the third interpolated value. It is a real parameter that loop.js
  // renders into the prompt, so if it is not blanked out of the template then two rows
  // differing only in how they say to inspect the artifact land in different cohorts —
  // the same defect already fixed for the goal and the artifact path, in the one place
  // it had not been checked.
  const withA = JSON.parse(run(EXTRACT, ['--artifact', A, '--goal', 'goal one here', '--inspect', 'open it in a hex editor', '--json']).out)
  const withB = JSON.parse(run(EXTRACT, ['--artifact', A, '--goal', 'goal one here', '--inspect', 'run make -n and read the output', '--json']).out)
  ok(withA.prompt.includes('hex editor'), 'the inspect text reaches the prompt loop.js would send')
  ok(withA.prompt_hash !== withB.prompt_hash, 'two different inspect strings are different filled-in prompts')
  eq(withA.template_hash, withB.template_hash,
     'but the SAME template, so a row is not split into its own cohort by how it says to look at the artifact')

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

// AND THE REFUSAL BELOW IT, which is this tool's central honesty property and was the
// last thing here left unpinned: at a small corpus it must decline to state a rate at
// all. Removing that guard makes it print a confident-looking interval over four
// observations — the "figure that says more than it can support" this repository has
// shipped before and now checks for.
{
  const dir = mkdtempSync(join(tmpdir(), 'oracle-smalln-'))
  const results = join(dir, 'results.jsonl')
  const rows = []
  for (let i = 0; i < 4; i++) {
    rows.push(JSON.stringify({
      row: 's' + i, arm: 'does-the-work', artifact: '/x/s' + i, expected_role: 'does-the-work',
      predicted_role: 'does-the-work', correct: true, disputed: false,
      prompt_hash: 'sha256:S' + i, template_hash: 'sha256:TPL', schema_fingerprint: 'sha256:fp', observer: 't',
    }))
  }
  writeFileSync(results, rows.join('\n') + '\n')

  const env = { ...process.env, ORACLE_CORPUS: join(dir, 'corpus.jsonl'), ORACLE_RESULTS: results }
  let out = ''
  try { out = execFileSync(process.execPath, [join(ROOT, 'scripts', 'oracle-report.mjs')], { encoding: 'utf8', cwd: ROOT, env }) }
  catch (e) { out = String(e.stdout || '') + String(e.stderr || '') }

  ok(/CANNOT BE POSED/.test(out), `four distinct artifacts must not yield a rate — got:\n${out}`)
  ok(!/95% CI/.test(out), 'and no confidence interval, which would read as a measurement of accuracy')
  ok(!/falsely refused/.test(out), 'and no derived refusal figure, which is downstream of a rate that does not exist')
  ok(/Not evidence of accuracy/.test(out), 'and it says so in those words rather than leaving the reader to infer it')
  rmSync(dir, { recursive: true, force: true })
  console.log('oracle: a small corpus refuses to state a rate at all, rather than printing one that reads as measured OK')
}

// THE FORK-BOMB FIX ITSELF, which was the least-verified thing in this directory.
//
// oracle-add.mjs executes a caller-supplied string. The MODEL_SHAPED guard in front of
// it is evadable by construction and a mutation test removes it on purpose; the wall
// clock is what actually bounds the damage. It was hardcoded at 120s, which meant no
// test could reach it without waiting two minutes, which meant it never had. A safety
// property nobody has watched fire is a safety property nobody has.
{
  const r = run(ADD, ['--arm', 'does-the-work', '--artifact', join(ROOT, 'oracle', 'fixtures', 'make-hello', 'Makefile'),
                      '--goal', 'g', '--acceptance', 'sleep 60', '--id', 'should-not-exist'],
                { ORACLE_ACCEPTANCE_TIMEOUT_MS: '1500' })
  eq(r.code, 1, `a hanging acceptance command is killed and refused rather than waited on — got ${r.code}`)
  ok(/did not finish within/.test(r.out), 'and the refusal says it was a timeout, not a failure of the command')
  ok(/may still be running/.test(r.out),
     'and warns that killing the shell does not kill what the shell spawned — the timeout bounds the wait, not the blast')
  console.log('oracle: a hanging acceptance command is killed and refused, and the refusal admits what the kill does not cover OK')
}

// A ROW WHOSE ARTIFACT HAS BEEN DELETED. Its ground truth cannot be re-established, so
// an observation against it means nothing — distinct from the artifact having CHANGED,
// which is tested above.
{
  const dir = mkdtempSync(join(tmpdir(), 'oracle-gone-'))
  const gone = join(dir, 'vanished.md')
  writeFileSync(gone, 'placeholder\n')
  const corpus = join(dir, 'corpus.jsonl')
  writeFileSync(corpus, JSON.stringify({
    id: 'vanished', arm: 'does-the-work', artifact: gone, artifact_hash: 'sha256:whatever',
    goal: 'g', inspect: null, expected_role: 'does-the-work',
    evidence: { method: 'mechanical-execution', acceptance_command: 'true', exit_code: 0 },
  }) + '\n')
  rmSync(gone)

  const r = run(RECORD, ['--row', 'vanished', '--predicted', 'does-the-work',
                         '--prompt-hash', 'sha256:x', '--schema-fingerprint', 'sha256:y'],
                { ORACLE_CORPUS: corpus, ORACLE_RESULTS: join(dir, 'results.jsonl') })
  eq(r.code, 3, `an observation against a row whose artifact is gone is refused as UNGROUNDABLE — got ${r.code}`)
  ok(/no longer exists/.test(r.out), 'and says the ground truth cannot be re-established')
  rmSync(dir, { recursive: true, force: true })
  console.log('oracle: a row whose artifact was deleted cannot take an observation OK')
}

// AN ARM WHERE EVERY OBSERVATION IS DISPUTED. There is no rate to report and no clean
// observation to fall back on, and the report has to say that rather than print an
// empty arm or silently omit it.
{
  const dir = mkdtempSync(join(tmpdir(), 'oracle-alldisp-'))
  const results = join(dir, 'results.jsonl')
  writeFileSync(results, [0, 1].map(i => JSON.stringify({
    row: 'd' + i, arm: 'generator', artifact: '/x/d' + i, expected_role: 'produces-an-instruction',
    predicted_role: 'does-the-work', correct: false, disputed: true,
    prompt_hash: 'sha256:D' + i, template_hash: 'sha256:TPL', schema_fingerprint: 'sha256:fp', observer: 't',
  })).join('\n') + '\n')

  const env = { ...process.env, ORACLE_CORPUS: join(dir, 'corpus.jsonl'), ORACLE_RESULTS: results }
  let out = ''
  try { out = execFileSync(process.execPath, [join(ROOT, 'scripts', 'oracle-report.mjs')], { encoding: 'utf8', cwd: ROOT, env }) }
  catch (e) { out = String(e.stdout || '') + String(e.stderr || '') }
  ok(/ALL DISPUTED/.test(out), `an arm with nothing but disputed rows says so — got:\n${out}`)
  ok(/that is the finding/.test(out), 'and frames the disagreement as the result rather than as missing data')
  ok(!/misclassified/.test(out), 'and reports no accuracy figure at all, since every ground truth in it is contested')
  rmSync(dir, { recursive: true, force: true })
  console.log('oracle: an arm where every observation is disputed reports the disagreement instead of a rate OK')
}

// THE BRANCH THAT HAS NEVER RUN. Everything above exercises the small-n path, because
// the real corpus is small. The Wilson interval and the derived false-refusal figure
// only appear at 5+ distinct artifacts — so on the day someone adds a fifth row, that
// arithmetic executes for the first time in production, having never been seen. This
// runs it now, against a synthetic ledger.
{
  const dir = mkdtempSync(join(tmpdir(), 'oracle-bign-'))
  const results = join(dir, 'results.jsonl')
  // 10 distinct artifacts, 1 wrong. Wilson 95% on 1/10 is about [0.018, 0.404],
  // checked independently against published values, and 2p(1-p) at p=0.1 is 0.18.
  const rows = []
  for (let i = 0; i < 10; i++) {
    const correct = i !== 3
    rows.push(JSON.stringify({
      row: 'r' + i, arm: 'does-the-work', artifact: '/x/art' + i, expected_role: 'does-the-work',
      predicted_role: correct ? 'does-the-work' : 'produces-an-instruction', correct, disputed: false,
      prompt_hash: 'sha256:P' + i, template_hash: 'sha256:TPL', schema_fingerprint: 'sha256:fp', observer: 't',
    }))
  }
  writeFileSync(results, rows.join('\n') + '\n')

  const env = { ...process.env, ORACLE_CORPUS: join(dir, 'corpus.jsonl'), ORACLE_RESULTS: results }
  let out = ''
  try { out = execFileSync(process.execPath, [join(ROOT, 'scripts', 'oracle-report.mjs')], { encoding: 'utf8', cwd: ROOT, env }) }
  catch (e) { out = String(e.stdout || '') + String(e.stderr || '') }

  ok(!/CANNOT BE POSED/.test(out), `at 10 distinct artifacts the rate IS posed — got:\n${out}`)
  ok(/per-side error    1\/10/.test(out), 'the per-side count is reported')
  ok(/95% CI \[2%, 40%\]/.test(out), `with the Wilson interval, which is the number that must not be a bare point estimate — got: ${(out.match(/95% CI.*/) || [''])[0]}`)
  ok(/<- PRIMARY/.test(out), 'and per-side accuracy is marked PRIMARY, because the refusal rate is derived from it')
  // THE DERIVED FIGURE CARRIES THE INTERVAL, NOT THE POINT. At 1/10 the point estimate
  // gives 2p(1-p) = 18%, and printing that alone is the bare point estimate this tool
  // refuses everywhere else — it reads as a measurement while the interval behind it is
  // wide. Wilson on 1/10 is about [0.018, 0.404], and 2p(1-p) over that range is about
  // [3.6%, 48%]. The first REAL six-row run printed "~0%" off a point estimate of 0/6
  // while its own interval reached 39%, which is how this was found.
  const derived = (out.match(/derived per-run   (\d+)%–(\d+)%/) || [])
  ok(derived.length === 3, `the derived figure is a RANGE, not a point — got: ${(out.match(/derived per-run.*/) || [''])[0]}`)
  ok(Number(derived[1]) <= 4 && Number(derived[2]) >= 45,
     `and the range is carried from the interval (expected roughly 3%–48% at 1/10) — got ${derived[1]}%–${derived[2]}%`)
  ok(!/~\d+% of two/.test(out), 'and no tilde-point-estimate form survives anywhere')
  ok(/carried through from the interval above/.test(out), 'and it says where the range comes from')
  ok(/ASSUMING the two sides fail independently/.test(out),
     'and is labelled with the assumption it rests on, which is not measured anywhere')
  ok(/Secondary/.test(out), 'and marked secondary to the per-side number')
  rmSync(dir, { recursive: true, force: true })
  console.log('oracle: at 5+ distinct artifacts the rate is posed with a Wilson interval, and the derived refusal figure carries its assumption OK')
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
  // Code 4 and not 1: this is the assertion that was passing against the WRONG
  // refusal. Every corpus row stored an absolute path, so on any machine but the
  // authoring one this row was refused as ungroundable long before the instrument
  // check ran — and that refusal also exited 1, so `eq(r.code, 1)` held while
  // measuring nothing. The distinct code is what makes this check able to fail.
  eq(r.code, 4, `an observation made against a different prompt is refused as STALE-INSTRUMENT — got ${r.code}`)
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
    eq(r.code, 3, `an observation against a changed artifact is refused as UNGROUNDABLE — got ${r.code}`)
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

// EVERY CORPUS ROW CARRIES ITS GROUNDING — the fields, not the re-run.
//
// This block checks that each row NAMES how it was grounded. It does NOT re-run the
// acceptance command and does not check that the emission still exists, so a row whose
// deliverable has since broken passes here: replacing the unpinned hello.c that
// make-hello's command compiles makes that command exit 1 while this suite stays green.
// The header used to claim "the acceptance command still passes", which no line below
// does — the same too-loose-sentence failure drift-guard.mjs's header catalogues. #40
// carries the re-run.
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
    } else if (row.arm === 'could-not-open') {
      // The absence arm. Its grounding is the same SHAPE as does-the-work — a command that
      // exited 0 — and the opposite claim: that there is nothing at that path. So it carries
      // an acceptance command and no hash, because there is no content to hash.
      ok(row.evidence.acceptance_command, `row ${row.id} carries the command that established the absence`)
      eq(row.evidence.method, 'mechanical-absence', `row ${row.id} says how it was grounded`)
      eq(row.artifact_hash, null, `row ${row.id} has no artifact hash — its claim is that there is no artifact`)
      eq(row.expected_role, 'could-not-open', `row ${row.id} expects the verdict its absence produces`)
    } else {
      // EVERY file, not the first. An agentic execution emits a set and the label rests on
      // all of it; a row that pinned one of two left the other free to change.
      ok(Array.isArray(row.evidence.emissions) && row.evidence.emissions.length,
         `generator row ${row.id} names the emission file(s) it was derived from`)
      for (const em of row.evidence.emissions) {
        ok(em.path && em.hash, `generator row ${row.id} pins each emission by path and hash`)
      }
      eq(row.evidence.method, 'agentic-execution', `row ${row.id} says how it was grounded`)
      eq(row.expected_role, 'produces-an-instruction', `generator row ${row.id} expects the generator role`)
    }
    ok(row.expected_role, `row ${row.id} has an expected role`)
    ok(row.goal, `row ${row.id} carries its goal — role is goal-relative, so a row without one is undefined`)
    // INVERTED, and the inversion is the point. This asserted an ABSOLUTE path,
    // on the reasoning that it is "the shape loop.js receives and the prompt
    // hashes". The shape loop.js receives is right; the shape the corpus STORES
    // is not the same question. Storing absolute made all 14 rows readable on
    // exactly one machine — oracle-record refused every one of them anywhere
    // else, and because that refusal shared an exit code with the stale-instrument
    // refusal, the guard aimed at the latter passed while receiving the former.
    //
    // oracle-extract now resolves the stored path against ROOT before it reaches
    // the prompt, so the loop still sees an absolute path and the hash is
    // unchanged on the machine that recorded the observations. The row stays
    // portable; the prompt keeps its shape.
    ok(!row.artifact.startsWith('/'), `row ${row.id} stores a repo-relative path — an absolute one pins the corpus to one machine, and oracle-extract resolves it against ROOT before the prompt is built`)
    ok(existsSync(join(ROOT, row.artifact)) || row.arm === 'could-not-open', `row ${row.id} resolves from the repo root`)
  }
  console.log(`oracle: all ${rows.length} corpus row(s) carry goal, expected role and grounding evidence OK`)
}

// ── WHICH INSTRUMENT SHIPS ────────────────────────────────────────────────────────
//
// The report refuses to pool cohorts, which stops a superseded prompt from being blended
// into a current rate. It did not say which cohort was current, so the answer lived in a
// notes file — and "remembered, not enforced" is the shape that let five of seven early
// observations be quoted against a prompt that had already changed. `5741f5e` moved the
// template hash again and stranded 15 of 38 observations with nothing in the output
// saying so. These three cases pin the label, its failure, and its independence.

// THE GUARD ITSELF. If someone edits the roleOf prompt and does not re-draw, this is
// what fails. It runs against the TRACKED ledger on purpose — that is the only ledger
// anyone quotes — and reads it, never writes it.
{
  let out = '', code = 0
  try { out = execFileSync(process.execPath, [join(ROOT, 'scripts', 'oracle-report.mjs')], { encoding: 'utf8', cwd: ROOT, env: process.env, timeout: 30_000 }) }
  catch (e) { code = e.status; out = String(e.stdout || '') + String(e.stderr || '') }

  eq(code, 0, `the tracked corpus has observations under the prompt that ships — got exit ${code}.\n${out.slice(-600)}`)
  ok(/── instrument \S+ ── LIVE/.test(out), `some cohort is labelled LIVE\n${out.slice(0, 400)}`)
  ok(/instrument that ships: sha256:/.test(out), 'the report names the shipping instrument before printing any number')
  console.log('oracle: the shipping prompt has a cohort behind it, and the report labels which one OK')
}

// AND IT CAN FAIL. Observations carrying a template hash that is not the live one leave
// every number in the report describing a prompt nobody runs, which is exactly when the
// numbers are most quotable and least true.
{
  const dir = mkdtempSync(join(tmpdir(), 'oracle-stale-'))
  const results = join(dir, 'results.jsonl')
  writeFileSync(results, JSON.stringify({
    row: 'a', arm: 'does-the-work', artifact: '/x/a', expected_role: 'does-the-work',
    predicted_role: 'does-the-work', correct: true, prompt_hash: 'sha256:P',
    template_hash: 'sha256:NOT-THE-LIVE-TEMPLATE', schema_fingerprint: 'sha256:fp', observer: 't',
  }) + '\n')

  const env = { ...process.env, ORACLE_CORPUS: join(dir, 'corpus.jsonl'), ORACLE_RESULTS: results }
  let out = '', code = 0
  try { out = execFileSync(process.execPath, [join(ROOT, 'scripts', 'oracle-report.mjs')], { encoding: 'utf8', cwd: ROOT, env, timeout: 30_000 }) }
  catch (e) { code = e.status; out = String(e.stdout || '') + String(e.stderr || '') }

  ok(/NO COHORT DESCRIBES THE PROMPT THAT SHIPS/.test(out), `a ledger with no live cohort says so, loudly\n${out}`)
  ok(/── instrument \S+ ── SUPERSEDED/.test(out), 'and the cohort itself is labelled, not just summarised at the end')
  ok(!/── instrument \S+ ── LIVE/.test(out), 'nothing is labelled LIVE when nothing is')
  // THE SEAM, PINNED. The exit code fires for the tracked ledger only: a constructed one
  // is a test of the labelling, not someone about to quote the numbers, and a failing
  // exit here would make this very branch unreachable by a test. Asserted so that the
  // asymmetry stays deliberate rather than becoming a thing someone "fixes".
  eq(code, 0, 'a constructed ledger reports the staleness without failing the run')
  rmSync(dir, { recursive: true, force: true })
  console.log('oracle: a ledger with no cohort under the shipping prompt is reported as stale rather than as a rate OK')
}

// AND IT IS NOT READ OUT OF THE LEDGER. A quantity derived downstream of the decision
// under test cannot audit that decision: if the "live" hash came from the observations,
// it would agree with whatever was recorded and could never disagree. Two runs over two
// completely different ledgers must name the SAME shipping instrument, because both read
// loop.js and neither reads the data.
{
  const dir = mkdtempSync(join(tmpdir(), 'oracle-indep-'))
  const results = join(dir, 'results.jsonl')
  writeFileSync(results, JSON.stringify({
    row: 'a', arm: 'does-the-work', artifact: '/x/a', expected_role: 'does-the-work',
    predicted_role: 'does-the-work', correct: true, prompt_hash: 'sha256:P',
    template_hash: 'sha256:INVENTED', schema_fingerprint: 'sha256:fp', observer: 't',
  }) + '\n')
  const named = env => {
    let out = ''
    try { out = execFileSync(process.execPath, [join(ROOT, 'scripts', 'oracle-report.mjs')], { encoding: 'utf8', cwd: ROOT, env, timeout: 30_000 }) }
    catch (e) { out = String(e.stdout || '') + String(e.stderr || '') }
    return (out.match(/instrument that ships: (\S+)/) || [])[1]
  }
  const real = named(process.env)
  const fake = named({ ...process.env, ORACLE_CORPUS: join(dir, 'corpus.jsonl'), ORACLE_RESULTS: results })
  ok(real && real.startsWith('sha256:'), 'the shipping instrument is named at all')
  eq(fake, real, 'the shipping instrument is the same whatever the ledger says — it is read from loop.js')
  rmSync(dir, { recursive: true, force: true })
  console.log('oracle: the shipping instrument is read from loop.js and not from the observations it audits OK')
}

// AND "UNKNOWN" IS NOT "SUPERSEDED". An observation recorded before the template hash
// existed belongs to an instrument nobody wrote down. That is a different fact from an
// instrument that has been replaced, and it needs the opposite repair: the first has to
// have its prompt identified, the second has to be re-drawn. Built as a third label, so
// it is tested as one — an unexecuted branch is where this repo keeps finding its bugs.
{
  const dir = mkdtempSync(join(tmpdir(), 'oracle-unknown-'))
  const results = join(dir, 'results.jsonl')
  writeFileSync(results, JSON.stringify({
    row: 'a', arm: 'does-the-work', artifact: '/x/a', expected_role: 'does-the-work',
    predicted_role: 'does-the-work', correct: true, prompt_hash: 'sha256:P',
    schema_fingerprint: 'sha256:fp', observer: 't',   // no template_hash at all
  }) + '\n')

  const env = { ...process.env, ORACLE_CORPUS: join(dir, 'corpus.jsonl'), ORACLE_RESULTS: results }
  let out = ''
  try { out = execFileSync(process.execPath, [join(ROOT, 'scripts', 'oracle-report.mjs')], { encoding: 'utf8', cwd: ROOT, env, timeout: 30_000 }) }
  catch (e) { out = String(e.stdout || '') + String(e.stderr || '') }

  ok(/── instrument \S+ ── UNKNOWN INSTRUMENT/.test(out), `an observation with no template hash is labelled unknown, not superseded\n${out}`)
  ok(!/── instrument \S+ ── SUPERSEDED/.test(out), 'and it is not reported as a prompt that was replaced, which it is not')
  rmSync(dir, { recursive: true, force: true })
  console.log('oracle: an observation predating the template hash is labelled UNKNOWN INSTRUMENT, not SUPERSEDED OK')
}

// AN ARM THE REPORT DOES NOT SCORE IS REFUSED, NOT DROPPED.
//
// Before this, an observation carrying a third arm was counted nowhere and printed
// nowhere: the cohort header rendered with nothing under it and the run exited 0. The
// observation most likely to land there is a could-not-open one — the verdict #34 records
// as having no evidence — so the silent path and the missing evidence were the same hole.
{
  const dir = mkdtempSync(join(tmpdir(), 'oracle-arm-'))
  const results = join(dir, 'results.jsonl')
  // NOT could-not-open any more. This case used that arm when the corpus had no way to
  // express an absence, so nothing scored it; the corpus gained the arm and the example
  // stopped being one. The claim is unchanged — an arm the report cannot score must fail
  // the run rather than vanish — so the example is an arm that is not one.
  writeFileSync(results, JSON.stringify({
    row: 'x', arm: 'not-an-arm', artifact: '/no/such', expected_role: 'does-the-work',
    predicted_role: 'does-the-work', correct: true, prompt_hash: 'sha256:P',
    template_hash: 'sha256:T', schema_fingerprint: 'sha256:fp', observer: 't',
  }) + '\n')

  const env = { ...process.env, ORACLE_CORPUS: join(dir, 'corpus.jsonl'), ORACLE_RESULTS: results }
  let out = '', code = 0
  try { out = execFileSync(process.execPath, [join(ROOT, 'scripts', 'oracle-report.mjs')], { encoding: 'utf8', cwd: ROOT, env, timeout: 30_000 }) }
  catch (e) { code = e.status; out = String(e.stdout || '') + String(e.stderr || '') }

  eq(code, 1, `an unscored arm fails the run rather than vanishing — got exit ${code}\n${out}`)
  ok(/REFUSING: 1 observation\(s\) carry an arm this report does not score/.test(out), 'and it says how many')
  ok(/arm "not-an-arm"/.test(out), 'and names the arm, so the reader knows what to add')
  ok(!/per-side error/.test(out), 'and prints no rate computed without it')
  rmSync(dir, { recursive: true, force: true })
  console.log('oracle: an observation whose arm the report cannot score is refused, not silently dropped OK')
}

// GROUND TRUTH IS RE-DERIVED OR PINNED, NOT READ BACK — the five cases of #40, run as a
// suite gate.
//
// scripts/staleness-trial.mjs builds each situation rather than describing it: an
// acceptance command whose unpinned input is broken, a generator row whose emission is
// deleted, a row whose expected_role is corrected after the fact, a row marked disputed
// after its draws were taken, and an execution that emitted two files where the row pinned
// one. It works in its own sandbox and spawns no model. Running it here is what stops the
// five from regressing quietly; running it as a script is what makes a failure legible when
// it does.
{
  const r = run(join(ROOT, 'scripts', 'staleness-trial.mjs'), [])
  eq(r.code, 0, `every stale fact is caught — got exit ${r.code}\n${r.out}`)
  ok(/ENFORCED — all five facts are recomputed from their source or pinned to it/.test(r.out), 'and the trial says so in the form its own README claims')
  ok(!/BROKEN/.test(r.out), 'and none of its cases passed because the report failed to run')
  console.log('oracle: grounding, verdict and dispute are re-derived at read time, not read back from what was written OK')
}

// AN OBSERVATION AND THE RESPONSE IT NAMES HAVE TO BE THE SAME OBSERVATION.
//
// oracle-record validates the INSTRUMENT — that the prompt and schema an observation
// names are the ones on disk today. It did not validate the observation: the verdict was
// checked against an enum and the reasoning was whatever the caller passed, so an entry
// transcribed from the wrong draw or paraphrased from memory recorded as cleanly as an
// accurate one.
//
// --raw is a precaution with no incident behind it. No mis-recorded observation appears
// anywhere in this corpus's history, and it could not now be found if one existed, since
// no responses were kept before this. It is not a defence against anyone: a person can
// write the file too. It checks that what was typed matches what the response says.
{
  const dir = mkdtempSync(join(tmpdir(), 'oracle-raw-'))
  writeFileSync(join(dir, 'corpus.jsonl'), readFileSync(join(ROOT, 'oracle', 'corpus.jsonl')))
  const env = { ...process.env, ORACLE_CORPUS: join(dir, 'corpus.jsonl'), ORACLE_RESULTS: join(dir, 'results.jsonl') }
  const row = JSON.parse(readFileSync(join(ROOT, 'oracle', 'corpus.jsonl'), 'utf8').split('\n')[0])

  const ex = run(EXTRACT, ['--artifact', row.artifact, '--goal', row.goal, '--json'], env)
  eq(ex.code, 0, `extraction for the raw-check cases succeeds — ${ex.out.slice(0, 200)}`)
  const live = JSON.parse(ex.out)
  const hashes = ['--prompt-hash', live.prompt_hash, '--schema-fingerprint', live.schema_fingerprint]

  const resp = join(dir, 'resp.json')
  writeFileSync(resp, JSON.stringify({ verdict: 'does-the-work', reasoning: 'ran make; it produced the binary' }))

  const wrongReason = run(RECORD, ['--row', row.id, '--predicted', 'does-the-work',
    '--reasoning', 'I decided this myself', ...hashes, '--raw', resp], env)
  eq(wrongReason.code, 1, 'a reasoning the response does not contain is refused')
  ok(/--reasoning is not the reasoning in the response/.test(wrongReason.out), 'and says which field disagreed')

  const wrongVerdict = run(RECORD, ['--row', row.id, '--predicted', 'produces-an-instruction',
    '--reasoning', 'ran make; it produced the binary', ...hashes, '--raw', resp], env)
  eq(wrongVerdict.code, 1, 'a verdict the response does not carry is refused')

  const missing = run(RECORD, ['--row', row.id, '--predicted', 'does-the-work',
    '--reasoning', 'x', ...hashes, '--raw', join(dir, 'nope.json')], env)
  eq(missing.code, 2, 'a corroboration that is not on disk is refused rather than ignored')

  const good = run(RECORD, ['--row', row.id, '--predicted', 'does-the-work',
    '--reasoning', 'ran make; it produced the binary', ...hashes, '--raw', resp], env)
  eq(good.code, 0, `fields that agree with the response are recorded — ${good.out.slice(0, 200)}`)
  const rec = JSON.parse(readFileSync(join(dir, 'results.jsonl'), 'utf8').trim())
  ok(rec.corroboration && rec.corroboration.raw_hash.startsWith('sha256:'),
     'and the observation carries the response it came from, hashed — writing the file without linking it leaves corroboration nothing joins to the ledger')

  // OPTIONAL, DELIBERATELY. A person who ran the probe in a chat window has no file to
  // point at, and refusing them would push the same attestation through an empty gesture.
  // What the corpus gains is the distinction, which oracle-report prints.
  const attested = run(RECORD, ['--row', row.id, '--predicted', 'does-the-work',
    '--reasoning', 'transcribed by hand', ...hashes, '--observer', 'a-person'], env)
  eq(attested.code, 0, 'an observation with no raw response is still accepted')
  const both = readFileSync(join(dir, 'results.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l))
  eq(both.filter(o => o.corroboration).length, 1, 'and only the corroborated one carries corroboration')

  rmSync(dir, { recursive: true, force: true })
  console.log('oracle: an observation must agree with the response it names, and attested ones are marked as such OK')
}

// THE ROW MODEL — what the corpus can and cannot express, run as a suite gate.
//
// Two verdicts can refuse a run, and each had zero observations because the corpus could
// not hold the row: `could-not-open`, whose ground truth is an absence, and the pairing
// verdict itself, which is a property of two artifacts under one goal rather than of one
// artifact. scripts/rowmodel-trial.mjs builds both situations rather than describing them.
{
  const r = run(join(ROOT, 'scripts', 'rowmodel-trial.mjs'), [])
  eq(r.code, 0, `the corpus can express an absence and a pairing — got exit ${r.code}\n${r.out}`)
  ok(/Both expressible/.test(r.out), 'and the trial says so in its own terms')
  console.log('oracle: the corpus can express an absence row and a pairing, so both refusing verdicts can be measured OK')
}
