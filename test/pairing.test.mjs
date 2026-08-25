// THE REPRODUCIBLE for #37 — the corpus cannot express the verdict that refuses runs.
//
//   node test/pairing.test.mjs
//
// WHAT IS MISSING. Every observation in oracle/results.jsonl is of `roleOf`: one
// artifact, one role. The thing that can refuse a run is the PAIRING verdict, composed
// from two roles under one goal (loop.js: `writers.length === 1`). A pairing can be
// DECLARED today — oracle/pairings.jsonl, scripts/oracle-pair.mjs — and its expected
// verdict derived by running loop.js. Nothing can OBSERVE one: an observation names one
// row, so two sides of one draw cannot be joined, and the report can only count how many
// pairings exist. The false-refusal rate — the number #33 says decides whether an
// automatic refusal is safe to keep — is therefore printed as 2q(1-q) carried through the
// per-side interval, under an independence assumption the report itself calls probably
// false.
//
// So this file is the exit test of #37, built before the machinery: a pairing OBSERVATION
// is two per-side observations joined by a draw id, and the report composes them by
// RUNNING loop.js and reports a measured rate. Every case below fails until that exists.
//
// NO AGENTS AND NO MODEL, and the containment rule makes that structural rather than
// polite: test/containment.test.mjs forbids any file under test/ from so much as naming
// the model-spawner, because a mutation sweep runs these files. So the runner's own thin
// part — draw both sides in one invocation — is NOT tested here, and cannot be. What is
// tested is everything that decides anything: the join, its refusals, the composition,
// the rate, and what the report says when it cannot pose one.
//
// CASE G IS THE ISSUE'S EXIT TEST. The rest are the failures that would make a printed
// rate wrong rather than absent, and each one is BUILT rather than described.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ADD = join(ROOT, 'scripts', 'oracle-add.mjs')
const PAIR = join(ROOT, 'scripts', 'oracle-pair.mjs')
const RECORD = join(ROOT, 'scripts', 'oracle-record.mjs')
const REPORT = join(ROOT, 'scripts', 'oracle-report.mjs')
const EXTRACT = join(ROOT, 'scripts', 'oracle-extract.mjs')

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, msg) => { if (!cond) fail(msg) }

// A CASE THAT FAILED MUST NOT ALSO PRINT ITS OK LINE. The first run of this file printed
// both, one line apart, for every case — the assertions were right and the transcript said
// the opposite. `mark` reports the OK only when the case added no failures, so a reader
// scanning the output sees what a reader of the exit code sees.
let caseStart = 0
const start = () => { caseStart = failures }
const mark = msg => { if (failures === caseStart) console.log(`pairing: ${msg} OK`) }

// A CRASH IS NOT A FAILURE OF THE THING UNDER TEST, and it must not read as one. The
// staleness trial reported three crashes as catches because its cases asked only
// `exit !== 0`; a report that does not parse satisfies every "it refused" assertion ever
// written. Same rule here, in the direction that matters for a report: a case that
// expects a refusal must see the refusal's own words, and a case that expects numbers
// must see the report actually run.
const crashed = out => /\b(SyntaxError|ReferenceError|TypeError|RangeError)\b/.test(out) || /^\s+at .*\(node:internal/m.test(out)

function run(script, args, env) {
  try { return { code: 0, out: execFileSync(process.execPath, [script, ...args], { encoding: 'utf8', cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 }) } }
  catch (e) { return { code: e.status === undefined ? -1 : e.status, out: String(e.stdout || '') + String(e.stderr || '') } }
}

function sandbox(tag) {
  const dir = mkdtempSync(join(tmpdir(), `pairing-${tag}-`))
  return {
    dir,
    env: {
      ...process.env,
      ORACLE_CORPUS: join(dir, 'corpus.jsonl'),
      ORACLE_RESULTS: join(dir, 'results.jsonl'),
      ORACLE_PAIRINGS: join(dir, 'pairings.jsonl'),
    },
  }
}

// A does-the-work artifact grounded the way the corpus grounds one: a command that is RUN
// and must exit 0. Two of these under ONE goal are a pairing whose true verdict is
// `comparable` — the false-refusal cell.
function addWorker(dir, env, { id, goal }) {
  const f = join(dir, id)
  mkdirSync(f, { recursive: true })
  const script = join(f, 'deliver.sh')
  writeFileSync(script, `#!/bin/sh\necho ${id}\n`)
  const add = run(ADD, ['--arm', 'does-the-work', '--artifact', script, '--goal', goal,
    '--acceptance', `sh ${script} | grep -qx ${id}`, '--id', id, '--note', 'pairing exit test'], env)
  if (add.code !== 0) throw new Error(`setup: could not add row ${id}: ${add.out.slice(0, 400)}`)
  return script
}

// An instruction-writer row, grounded the way the corpus grounds one: not by anyone
// saying so, but by the file the artifact PRODUCED when it was executed.
function addWriter(dir, env, { id, goal }) {
  const f = join(dir, id)
  mkdirSync(f, { recursive: true })
  const artifact = join(f, 'request.md')
  const emission = join(f, 'OUTPUT.md')
  writeFileSync(artifact, `# Please write the thing\n\nSomeone should do this and send it back.\n`)
  writeFileSync(emission, `# A request addressed to a further party\n`)
  const add = run(ADD, ['--arm', 'generator', '--artifact', artifact, '--goal', goal,
    '--emission', emission, '--id', id, '--note', 'pairing exit test'], env)
  if (add.code !== 0) throw new Error(`setup: could not add writer row ${id}: ${add.out.slice(0, 400)}`)
  return artifact
}

function declarePair(env, { id, sides }) {
  const p = run(PAIR, ['--sides', sides.join(','), '--id', id, '--note', 'pairing exit test'], env)
  if (p.code !== 0) throw new Error(`setup: could not declare pairing ${id}: ${p.out.slice(0, 400)}`)
  return p.out
}

// The live instrument for a row, read out of loop.js the way oracle-record will re-read it.
function liveFor(env, artifact, goal) {
  const ex = run(EXTRACT, ['--artifact', artifact, '--goal', goal, '--json'], env)
  if (ex.code !== 0) throw new Error(`setup: extraction failed: ${ex.out.slice(0, 400)}`)
  return JSON.parse(ex.out)
}

// ONE SIDE of one pairing draw. `--pairing` names which pairing, `--pairing-draw` is what
// joins this side to the other one drawn beside it; without the second, two sides cannot
// be told from two unrelated observations that happen to share a pairing.
function recordSide(env, { row, artifact, goal, predicted, pairing, draw, extra = [] }) {
  const live = liveFor(env, artifact, goal)
  return run(RECORD, ['--row', row, '--predicted', predicted, '--reasoning', 'pairing exit test',
    '--prompt-hash', live.prompt_hash, '--schema-fingerprint', live.schema_fingerprint,
    '--observer', 'pairing-test',
    ...(pairing ? ['--pairing', pairing] : []), ...(draw ? ['--pairing-draw', draw] : []), ...extra], env)
}

const GOAL = 'the deliverable prints its own name'

// ── A. A SIDE THAT IS NOT A SIDE ────────────────────────────────────────────────────
//
// The join is only worth anything if it is checked. An observation tagged with a pairing
// it is not part of composes a verdict out of an artifact the pairing never contained,
// and nothing downstream can tell — both rows are grounded, both are does-the-work, and
// the arithmetic works perfectly on the wrong pair.
{
  start()
  const { dir, env } = sandbox('a')
  try {
    const a = addWorker(dir, env, { id: 'side-a', goal: GOAL })
    addWorker(dir, env, { id: 'side-b', goal: GOAL })
    const c = addWorker(dir, env, { id: 'outsider', goal: GOAL })
    declarePair(env, { id: 'p1', sides: ['side-a', 'side-b'] })
    void a
    const r = recordSide(env, { row: 'outsider', artifact: c, goal: GOAL, predicted: 'does-the-work', pairing: 'p1', draw: 'd1' })
    ok(r.code !== 0 && !crashed(r.out), `recording "outsider" as a side of p1 was accepted (exit ${r.code}) — a pairing observation must name a row the pairing actually has`)
    ok(/not a side of/.test(r.out), `the refusal does not say the row is not a side of that pairing: ${r.out.split('\n')[0]}`)
      mark('a row that is not a side of the pairing is refused')
  } catch (e) { fail(String(e.message)) }
  rmSync(dir, { recursive: true, force: true })
}

// ── B. A SIDE WITH NOTHING TO JOIN IT TO ────────────────────────────────────────────
//
// Both directions. `--pairing` with no draw id produces observations that cannot be
// paired with anything; `--pairing-draw` with no pairing produces a join key pointing at
// nothing. Either one leaves a ledger that looks like it holds pairing evidence.
{
  start()
  const { dir, env } = sandbox('b')
  try {
    const a = addWorker(dir, env, { id: 'side-a', goal: GOAL })
    addWorker(dir, env, { id: 'side-b', goal: GOAL })
    declarePair(env, { id: 'p1', sides: ['side-a', 'side-b'] })

    const noDraw = recordSide(env, { row: 'side-a', artifact: a, goal: GOAL, predicted: 'does-the-work', pairing: 'p1' })
    ok(noDraw.code !== 0 && !crashed(noDraw.out), `--pairing with no --pairing-draw was accepted (exit ${noDraw.code}) — a side that cannot be joined to its partner is not an observation of a pairing`)
    ok(/--pairing-draw/.test(noDraw.out), `the refusal does not name --pairing-draw: ${noDraw.out.split('\n')[0]}`)

    const noPairing = recordSide(env, { row: 'side-a', artifact: a, goal: GOAL, predicted: 'does-the-work', draw: 'd1' })
    ok(noPairing.code !== 0 && !crashed(noPairing.out), `--pairing-draw with no --pairing was accepted (exit ${noPairing.code}) — a join key pointing at no pairing joins nothing`)
      mark('a side with no draw id, and a draw id with no pairing, are both refused')
  } catch (e) { fail(String(e.message)) }
  rmSync(dir, { recursive: true, force: true })
}

// ── C. THE SAME SIDE TWICE IN ONE DRAW ──────────────────────────────────────────────
//
// A draw is two sides. Three records under one draw id compose nothing, and the failure
// is silent at read time — the report can only drop the draw. Refusing at write time is
// the difference between a message naming the fix and a number quietly resting on fewer
// draws than it claims.
{
  start()
  const { dir, env } = sandbox('c')
  try {
    const a = addWorker(dir, env, { id: 'side-a', goal: GOAL })
    addWorker(dir, env, { id: 'side-b', goal: GOAL })
    declarePair(env, { id: 'p1', sides: ['side-a', 'side-b'] })
    const first = recordSide(env, { row: 'side-a', artifact: a, goal: GOAL, predicted: 'does-the-work', pairing: 'p1', draw: 'd1' })
    ok(first.code === 0, `the first side could not be recorded at all: ${first.out.slice(0, 300)}`)
    const again = recordSide(env, { row: 'side-a', artifact: a, goal: GOAL, predicted: 'produces-an-instruction', pairing: 'p1', draw: 'd1' })
    ok(again.code !== 0 && !crashed(again.out), `the same side was recorded twice under one draw id (exit ${again.code}) — that draw has three sides and composes nothing`)
      mark('the same side twice in one draw is refused')
  } catch (e) { fail(String(e.message)) }
  rmSync(dir, { recursive: true, force: true })
}

// ── D. THE FALSE REFUSAL, BUILT ─────────────────────────────────────────────────────
//
// The input that should break it, per CLAUDE.md: reading the report finds nothing. Two
// grounded does-the-work artifacts under one goal — loop.js answers `comparable`, so a
// refusal here is FALSE by construction — and one side drawn as `produces-an-instruction`.
// That is exactly one writer, which is loop.js's refusal condition. If the report prints
// zero false refusals against this ledger, its number is not measuring the thing.
{
  start()
  const { dir, env } = sandbox('d')
  try {
    const a = addWorker(dir, env, { id: 'side-a', goal: GOAL })
    const b = addWorker(dir, env, { id: 'side-b', goal: GOAL })
    declarePair(env, { id: 'p1', sides: ['side-a', 'side-b'] })
    recordSide(env, { row: 'side-a', artifact: a, goal: GOAL, predicted: 'does-the-work', pairing: 'p1', draw: 'd1' })
    recordSide(env, { row: 'side-b', artifact: b, goal: GOAL, predicted: 'produces-an-instruction', pairing: 'p1', draw: 'd1' })

    const rep = run(REPORT, [], env)
    ok(!crashed(rep.out), `the report did not run: ${String(rep.out).split('\n').find(l => /Error/.test(l)) || 'crashed'}`)
    ok(/draw d1: does-the-work \+ produces-an-instruction -> generator/.test(rep.out),
       'the report does not show this draw composing to `generator` from its two observed roles — matching only the absence of a number would pass against a report that composes nothing')
    ok(/FALSE REFUSAL/.test(rep.out), 'a comparable pairing observed as `generator` is not reported as a FALSE REFUSAL — the composed verdict is either not computed or not scored against the derived one')

    // AND IT IS COMPOSED, NOT STORED. Nothing in the ledger may carry the verdict: it is
    // derived from the two roles by running loop.js, every read. A stored copy is #40.
    const recs = readFileSync(env.ORACLE_RESULTS, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
    for (const rec of recs) {
      const stored = Object.keys(rec).filter(k => /verdict|refus/i.test(k))
      ok(!stored.length, `an observation stores ${stored.join(', ')} — the pairing verdict is derivable from the two roles and must be recomputed by running loop.js, not written down`)
    }
      mark('a worker misread as a writer on a comparable pairing is counted as a FALSE REFUSAL')
  } catch (e) { fail(String(e.message)) }
  rmSync(dir, { recursive: true, force: true })
}

// ── E. TWO WRITERS ARE COMPARABLE ───────────────────────────────────────────────────
//
// The branch a retyped rule gets wrong, and the reason the composition must come from
// RUNNING loop.js. "Any instruction-writer refuses" is the obvious paraphrase and it is
// false: loop.js refuses on `writers.length === 1`, so two writers are at the same level
// as each other and the run proceeds. A report that scored this as a refusal would invent
// false refusals out of correct behaviour.
{
  start()
  const { dir, env } = sandbox('e')
  try {
    const a = addWorker(dir, env, { id: 'side-a', goal: GOAL })
    const b = addWorker(dir, env, { id: 'side-b', goal: GOAL })
    declarePair(env, { id: 'p1', sides: ['side-a', 'side-b'] })
    recordSide(env, { row: 'side-a', artifact: a, goal: GOAL, predicted: 'produces-an-instruction', pairing: 'p1', draw: 'd1' })
    recordSide(env, { row: 'side-b', artifact: b, goal: GOAL, predicted: 'produces-an-instruction', pairing: 'p1', draw: 'd1' })

    const rep = run(REPORT, [], env)
    ok(!crashed(rep.out), `the report did not run: ${String(rep.out).split('\n').find(l => /Error/.test(l)) || 'crashed'}`)
    // THE PASS CONDITION MUST NOT BE SATISFIED BY THE THING BEING BROKEN. "no FALSE
    // REFUSAL appears" is true of a report that composes nothing at all — it passed
    // against exactly that before this line existed. The draw's own composed verdict is
    // what this case is about, so that is what it asserts.
    ok(/draw d1: produces-an-instruction \+ produces-an-instruction -> comparable/.test(rep.out),
       'the report does not show two writers composing to `comparable` — that is loop.js\'s answer, and a rule retyped as "any writer refuses" would get it wrong')
    ok(!/FALSE REFUSAL/.test(rep.out), 'two sides both read as instruction-writers were scored as a refusal — loop.js refuses on exactly ONE writer, so this composes to `comparable` and no run is refused')
      mark('two writers compose to comparable, which is not a refusal')
  } catch (e) { fail(String(e.message)) }
  rmSync(dir, { recursive: true, force: true })
}

// ── F. A HALF DRAW IS NOT AN OBSERVATION ────────────────────────────────────────────
//
// This one happens for real: the runner records nothing for a probe that died, so one
// side can legitimately be missing. It must be named and excluded, not scored — a draw
// with one side has no second role to compose with, and treating the missing side as
// anything at all is inventing an answer.
{
  start()
  const { dir, env } = sandbox('f')
  try {
    const a = addWorker(dir, env, { id: 'side-a', goal: GOAL })
    addWorker(dir, env, { id: 'side-b', goal: GOAL })
    declarePair(env, { id: 'p1', sides: ['side-a', 'side-b'] })
    recordSide(env, { row: 'side-a', artifact: a, goal: GOAL, predicted: 'does-the-work', pairing: 'p1', draw: 'd1' })

    const rep = run(REPORT, [], env)
    ok(!crashed(rep.out), `the report did not run: ${String(rep.out).split('\n').find(l => /Error/.test(l)) || 'crashed'}`)
    ok(/1 of 2 sides recorded/.test(rep.out) && /could not be scored/.test(rep.out), 'a draw with one side recorded is not reported as unscorable — an observation counted nowhere and printed nowhere is the silent drop this report refuses everywhere else')
    ok(!/FALSE REFUSAL/.test(rep.out), 'a half draw was scored as a refusal')
      mark('a draw with one side is named and excluded rather than scored')
  } catch (e) { fail(String(e.message)) }
  rmSync(dir, { recursive: true, force: true })
}

// ── G. THE EXIT TEST OF #37 ─────────────────────────────────────────────────────────
//
// "oracle-report.mjs prints a pairing-arm rate with an interval, computed from direct
// pairing observations rather than from 2q(1-q)."
//
// Two halves, because a tool that prints a rate at any n is not the tool this repo wants:
// below its own threshold it must refuse to pose one, and the refusal must say what it is
// short of. The threshold is the one the per-side arm already uses — five distinct — so
// the pairing arm does not get a lower bar for being newer.
{
  start()
  const { dir, env } = sandbox('g')
  try {
    // Under the threshold first: two pairings, both observed, no rate.
    for (let i = 1; i <= 2; i++) {
      const goal = `${GOAL} (${i})`
      const a = addWorker(dir, env, { id: `p${i}-a`, goal })
      const b = addWorker(dir, env, { id: `p${i}-b`, goal })
      declarePair(env, { id: `p${i}`, sides: [`p${i}-a`, `p${i}-b`] })
      recordSide(env, { row: `p${i}-a`, artifact: a, goal, predicted: 'does-the-work', pairing: `p${i}`, draw: `p${i}-d1` })
      recordSide(env, { row: `p${i}-b`, artifact: b, goal, predicted: 'does-the-work', pairing: `p${i}`, draw: `p${i}-d1` })
    }
    const thin = run(REPORT, [], env)
    ok(!crashed(thin.out), `the report did not run: ${String(thin.out).split('\n').find(l => /Error/.test(l)) || 'crashed'}`)
    ok(/distinct pairing\(s\) supports no rate/.test(thin.out),
       'at two distinct pairings the report poses a rate anyway — the pairing arm must refuse below the same threshold the per-side arm uses, and say what it is short of')

    // Then over it: five distinct pairings, one of them falsely refused.
    for (let i = 3; i <= 5; i++) {
      const goal = `${GOAL} (${i})`
      const a = addWorker(dir, env, { id: `p${i}-a`, goal })
      const b = addWorker(dir, env, { id: `p${i}-b`, goal })
      declarePair(env, { id: `p${i}`, sides: [`p${i}-a`, `p${i}-b`] })
      recordSide(env, { row: `p${i}-a`, artifact: a, goal, predicted: 'does-the-work', pairing: `p${i}`, draw: `p${i}-d1` })
      recordSide(env, {
        row: `p${i}-b`, artifact: b, goal, pairing: `p${i}`, draw: `p${i}-d1`,
        // One pairing of the five is refused, so the measured rate is neither 0/5 nor 5/5
        // — a rate that can only come out at an endpoint is not a measurement.
        predicted: i === 5 ? 'produces-an-instruction' : 'does-the-work',
      })
    }
    const rep = run(REPORT, [], env)
    ok(!crashed(rep.out), `the report did not run: ${String(rep.out).split('\n').find(l => /Error/.test(l)) || 'crashed'}`)
    // MATCHED AS PRECISELY AS THE CLAIM. `MEASURED` alone matches the per-side arm's own
    // "answer stability NOT MEASURED", and `95% CI [` matches the per-side interval that
    // is printed here too — both passed against a report with no pairing rate in it at
    // all. The needle has to be the sentence this case is about.
    ok(/falsely refused\s+1\/5, 95% CI \[/.test(rep.out),
       'the measured false-refusal rate is not printed as 1/5 with an interval — that number, from drawn pairings rather than from 2q(1-q), is #37\'s exit test')
    ok(/MEASURED by drawing the pairing/.test(rep.out),
       'the rate is not marked as measured rather than derived, so a reader cannot tell it from the 2q(1-q) figure above it')
      mark('below the threshold no rate is posed; at five distinct pairings a measured rate with an interval is printed')
  } catch (e) { fail(String(e.message)) }
  rmSync(dir, { recursive: true, force: true })
}

// ── I. THE CELL WHERE A REFUSAL IS CORRECT GETS THE SAME THRESHOLD ──────────────────
//
// Found by the rule rather than by an incident, again: the false-refusal cell refuses to
// pose a rate below five distinct pairings, and the cell beside it printed a bare `1/1`.
// A reader takes that for 100%, which is the bare point estimate this report exists to
// refuse — and it is the same defect in the same output, one branch over, because the
// threshold was written where the number was being watched.
//
// A MISSED REFUSAL is different and must print at any n: a run that proceeded on a pairing
// the corpus says is not comparable is an event, not a rate.
{
  start()
  const { dir, env } = sandbox('i')
  try {
    const w = addWriter(dir, env, { id: 'writer', goal: GOAL })
    const b = addWorker(dir, env, { id: 'worker', goal: GOAL })
    declarePair(env, { id: 'gen-pair', sides: ['writer', 'worker'] })
    recordSide(env, { row: 'writer', artifact: w, goal: GOAL, predicted: 'produces-an-instruction', pairing: 'gen-pair', draw: 'd1' })
    recordSide(env, { row: 'worker', artifact: b, goal: GOAL, predicted: 'does-the-work', pairing: 'gen-pair', draw: 'd1' })

    const rep = run(REPORT, [], env)
    ok(!crashed(rep.out), `the report did not run: ${String(rep.out).split('\n').find(l => /Error/.test(l)) || 'crashed'}`)
    ok(/fired correctly\s+1 of 1 draw\(s\) — NO RATE/.test(rep.out),
       'the refusal-fires cell prints a bare fraction at one draw — the false-refusal cell beside it refuses to pose a rate below five distinct pairings, and a reader reads 1/1 as 100% either way')
    mark('the refusal-fires cell refuses a rate below the same threshold')
  } catch (e) { fail(String(e.message)) }
  rmSync(dir, { recursive: true, force: true })
}

// ── H. A DRAW WHOSE PAIRING IS GONE ─────────────────────────────────────────────────
//
// Found by the rule rather than by an incident, which is the test #40 taught: if the
// defect is "counted nowhere and printed nowhere", it is wherever a reader iterates one
// ledger and scores another. The pairing block iterates DECLARED pairings, so a draw whose
// pairing was removed afterwards vanishes — the rate quietly rests on fewer draws than the
// ledger holds, and every number still prints.
//
// The recorder refuses this at the door, so the only way in is removal after the fact,
// which is the corpus moving underneath a number.
{
  start()
  const { dir, env } = sandbox('h')
  try {
    const a = addWorker(dir, env, { id: 'side-a', goal: GOAL })
    const b = addWorker(dir, env, { id: 'side-b', goal: GOAL })
    declarePair(env, { id: 'p1', sides: ['side-a', 'side-b'] })
    recordSide(env, { row: 'side-a', artifact: a, goal: GOAL, predicted: 'does-the-work', pairing: 'p1', draw: 'd1' })
    recordSide(env, { row: 'side-b', artifact: b, goal: GOAL, predicted: 'does-the-work', pairing: 'p1', draw: 'd1' })
    writeFileSync(env.ORACLE_PAIRINGS, '')   // the pairing withdrawn, its draws left behind

    const rep = run(REPORT, [], env)
    ok(!crashed(rep.out), `the report did not run: ${String(rep.out).split('\n').find(l => /Error/.test(l)) || 'crashed'}`)
    ok(rep.code !== 0 && /name a pairing that is not declared/.test(rep.out),
       'two observations tagged with a pairing the ledger no longer declares are neither scored nor mentioned — the same silent drop this report refuses for an arm it does not score')
    mark('a draw whose pairing was withdrawn is refused rather than dropped')
  } catch (e) { fail(String(e.message)) }
  rmSync(dir, { recursive: true, force: true })
}

// ---------------------------------------------------------------------------
// THE RESIDUAL, on the branch that carries the verdict.
// ---------------------------------------------------------------------------
console.log('pairing: stating what this suite cannot establish')
console.log('          NOT TESTED: that the two sides of a draw were drawn in ONE invocation. The')
console.log('          runner cannot be named here — containment forbids it — and no check anywhere')
console.log('          could tell a joined pair of separately-drawn sides from a paired draw. The')
console.log('          draw id records the claim; it does not establish it, exactly as --raw records')
console.log('          which response an observation came from without proving who produced it.')
console.log('          NOT TESTED: whether a real agent ever misreads a real worker as a writer. Every')
console.log('          role above is supplied by this file. This suite tests the instrument that would')
console.log('          count such a case, not the rate — only live draws produce that.')

if (failures) {
  console.error(`\npairing: ${failures} failure(s) — the verdict that refuses runs still cannot be observed.`)
  process.exit(1)
}
console.log('\npairing: OK — a pairing draw can be recorded, joined, composed by running loop.js, and refused when it is malformed.')
