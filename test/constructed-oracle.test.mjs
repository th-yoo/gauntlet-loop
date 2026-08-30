// THE REPRODUCIBLE for issue 33: ground truth nobody authored.
//
//   node test/constructed-oracle.test.mjs
//
// The comparability probe's answer key was written by the person proposing the
// probe. Pre-registering the predictions stops post-hoc rationalisation; it does
// not supply ground truth. And of 22 corpus rows, every one of the 7
// `produces-an-instruction` rows is `agentic` — the role was settled by an agent
// classifying an emission, which is the kind of judgement the probe is under
// suspicion for. There has never been a mechanically-grounded generator here.
//
// A constructed pairing is one whose relationship follows from what the artifacts
// ARE. The role is DERIVED by running them, never read from the manifest — a
// manifest that stored the answer and a checker that read it back would be the
// answer key this issue is about, one file along.
//
// WHAT THIS FILE MOSTLY DOES is try to make the deriver answer wrongly. A deriver
// that agrees with every manifest it is handed is a check that cannot fail, and
// four of the cases below exist only to see it refuse.
//
// NOTHING HERE SPAWNS A MODEL.

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync, chmodSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { deriveRole, composeVerdict } from '../scripts/constructed-verify.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }
const eq = (got, want, m) => ok(got === want, `${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)

const TMP = join(tmpdir(), `constructed-oracle-${process.pid}`)
rmSync(TMP, { recursive: true, force: true })
mkdirSync(TMP, { recursive: true })
const write = (rel, body, exec = false) => {
  const p = join(TMP, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, body)
  if (exec) chmodSync(p, 0o755)
  return p
}

console.log('constructed-oracle: the real set derives, and every role agrees with its manifest')
{
  const r = spawnSync(process.execPath, ['scripts/constructed-verify.mjs'],
    { cwd: ROOT, encoding: 'utf8', timeout: 300_000 })
  const out = String(r.stdout || '') + String(r.stderr || '')
  ok(r.status === 0, `constructed-verify failed:\n${out.split('\n').slice(-8).join('\n')}`)
  const m = out.match(/(\d+) disagreement\(s\); (\d+) mechanically-grounded generator row\(s\)/)
  ok(m, 'it produced its summary line')
  if (m) {
    eq(Number(m[1]), 0, 'no artifact disagreed with its manifest')
    // THE POINT OF THE WHOLE ISSUE. Zero of these existed before.
    ok(Number(m[2]) >= 1,
       'there is no mechanically-grounded produces-an-instruction row — every generator verdict still rests on an agent classifying an emission, which is exactly what issue 33 says cannot audit the probe')
    console.log(`          ${m[1]} disagreements, ${m[2]} mechanically-grounded generator row(s)`)
  }
  for (const v of ['generator', 'comparable', 'unreadable']) {
    ok(new RegExp(`=>  ${v}`).test(out),
       `no constructed pairing composes to "${v}" — a set that cannot produce a verdict cannot be ground truth for it`)
  }
}

console.log('constructed-oracle: a scaffold that emits nothing is a FAILURE, not an instruction')
{
  // The distinction the whole mechanical grounding rests on. Without it, any
  // artifact that simply does not work would be classed as a generator.
  write('broken/nothing.sh', '#!/bin/sh\nexit 0\n', true)
  const d = deriveRole({
    reset: `rm -f ${TMP}/broken/greet ${TMP}/broken/build.sh`,
    run_artifact: `sh ${TMP}/broken/nothing.sh`,
    deliverable_present: `test -e ${TMP}/broken/greet`,
    emitted_runnable: `test -x ${TMP}/broken/build.sh`,
    run_emitted: `sh ${TMP}/broken/build.sh`,
  })
  eq(d.role, null, 'an artifact that reaches nothing and emits nothing must not be called a generator')
  ok(/failure, not an instruction/.test(d.why), `and it must say why — got "${d.why}"`)
}

console.log('constructed-oracle: a probe with no emission declared is INCOMPLETE, not a failed artifact')
{
  // The two read the same to a deriver that skips the declaration check, and
  // they are different problems: one is an artifact that does not work, the
  // other is a probe whose author forgot half of it. Telling the second author
  // their artifact failed sends them to debug the wrong thing — and without this
  // case the declaration guard can be deleted with every other test still green.
  write('undeclared/quiet.sh', '#!/bin/sh\nexit 0\n', true)
  const d = deriveRole({
    run_artifact: `sh ${TMP}/undeclared/quiet.sh`,
    deliverable_present: `test -e ${TMP}/undeclared/greet`,
  })
  eq(d.role, null, 'an incomplete probe settles nothing')
  ok(/no emission was declared/.test(d.why),
     `the deriver must say the PROBE is incomplete, not that the artifact failed — got "${d.why}"`)
}

console.log('constructed-oracle: an emission that does not reach the deliverable is not an instruction either')
{
  write('halfway/scaffold.sh', `#!/bin/sh\nprintf '#!/bin/sh\\nexit 0\\n' > ${TMP}/halfway/build.sh\nchmod +x ${TMP}/halfway/build.sh\n`, true)
  const d = deriveRole({
    reset: `rm -f ${TMP}/halfway/greet ${TMP}/halfway/build.sh`,
    run_artifact: `sh ${TMP}/halfway/scaffold.sh`,
    deliverable_present: `test -e ${TMP}/halfway/greet`,
    emitted_runnable: `test -x ${TMP}/halfway/build.sh`,
    run_emitted: `sh ${TMP}/halfway/build.sh`,
  })
  eq(d.role, null, 'a chain that never terminates in the deliverable is not a request addressed to a further party')
  ok(/does not reach the deliverable either/.test(d.why), `and it must say so — got "${d.why}"`)
}

console.log('constructed-oracle: a role settled by a model is refused')
{
  // The same rule oracle-add.mjs applies to acceptance commands. A ground truth
  // produced by the kind of judgement under test cannot audit that judgement, and
  // this set exists precisely because the agentic rows could not.
  const d = deriveRole({
    run_artifact: 'claude -p "is this a generator?"',
    deliverable_present: 'test -e /nonexistent',
  })
  eq(d.role, null, 'a probe naming a model must be refused rather than run')
  ok(/cannot audit a model/.test(d.why), `and it must say why — got "${d.why}"`)
}

console.log('constructed-oracle: a declared-absent artifact that exists is refused')
{
  write('present/here.sh', '#!/bin/sh\n', true)
  eq(deriveRole({ absent: `test ! -e ${TMP}/present/here.sh` }).role, null,
     'declaring a path absent does not make it absent — the filesystem decides')
  eq(deriveRole({ absent: `test ! -e ${TMP}/present/missing.sh` }).role, 'could-not-open',
     'and a genuinely missing path derives could-not-open')
}

console.log('constructed-oracle: the deriver DISAGREES when the manifest is wrong')
{
  // WITHOUT THIS the first section is satisfied by a deriver that echoes whatever
  // it is told. The real scaffold is re-derived against a manifest claiming it
  // does the work; the answer must not follow the claim.
  const manifest = join(TMP, 'wrong.jsonl')
  const rows = readFileSync(join(ROOT, 'oracle', 'constructed.jsonl'), 'utf8')
    .split('\n').filter(Boolean).map(l => JSON.parse(l))
  const scaffold = rows.find(r => r.id === 'constructed-scaffold')
  ok(scaffold, 'the scaffold row is in the manifest')
  writeFileSync(manifest, JSON.stringify({ ...scaffold, expected_role: 'does-the-work' }) + '\n')
  const r = spawnSync(process.execPath, ['scripts/constructed-verify.mjs'],
    { cwd: ROOT, encoding: 'utf8', timeout: 300_000,
      env: { ...process.env, CONSTRUCTED_MANIFEST: manifest, CONSTRUCTED_PAIRINGS: join(TMP, 'none.jsonl') } })
  const out = String(r.stdout || '') + String(r.stderr || '')
  ok(r.status !== 0, 'a manifest claiming the scaffold does the work was accepted — then the role is read, not derived')
  ok(/DISAGREES/.test(out), 'and the disagreement was not reported')
  console.log('          a mislabelled manifest is rejected, so the role is derived rather than echoed')
}

console.log('constructed-oracle: the composition rule is one rule, applied both ways')
{
  eq(composeVerdict('does-the-work', 'does-the-work'), 'comparable', 'two workers are comparable')
  eq(composeVerdict('produces-an-instruction', 'does-the-work'), 'generator', 'a generator against a worker')
  eq(composeVerdict('does-the-work', 'produces-an-instruction'), 'generator', 'and the same the other way round — order must not decide it')
  eq(composeVerdict('produces-an-instruction', 'produces-an-instruction'), 'comparable', 'two generators are comparable to each other')
  eq(composeVerdict('could-not-open', 'does-the-work'), 'unreadable', 'an absent side makes the pairing unreadable')
}

console.log('constructed-oracle: a deliverable that was ALREADY there settles nothing')
{
  // THE REPRODUCIBLE. Built before the fix, and it came back does-the-work:
  //
  //   REPRO ROLE: does-the-work
  //   REPRO WHY : running it reached the deliverable
  //
  // about a script whose entire body is `exit 0`. Nothing checked that the
  // deliverable was absent before the artifact ran, so the PASS condition was
  // satisfied by the thing being broken — the failure mode this repository's own
  // rules name, sitting inside the instrument built to supply ground truth.
  //
  // Note there is no `reset` here ON PURPOSE. A probe whose reset does not clear
  // the deliverable is indistinguishable from one that declares none, and both
  // must be refused for the same reason.
  writeFileSync(join(TMP, 'prepresent-greet'), 'greetings\n')
  write('prepresent/donothing.sh', '#!/bin/sh\nexit 0\n', true)
  const d = deriveRole({
    run_artifact: `sh ${TMP}/prepresent/donothing.sh`,
    deliverable_present: `test -e ${TMP}/prepresent-greet && grep -qx greetings ${TMP}/prepresent-greet`,
  })
  eq(d.role, null, 'an artifact that did nothing was credited with a deliverable it found')
  ok(/already present before the artifact ran/.test(d.why), `and it must say why — got "${d.why}"`)
}

console.log('constructed-oracle: the set now exercises MORE THAN ONE GOAL, and both derive')
{
  // This is issue 33's remainder, and it was recorded as a bound rather than
  // discovered later: docs/capacity-adjudications.jsonl carried a row saying the
  // four original artifacts sat under one goal whose deliverable was a FILE, and
  // that until a second goal existed no claim could treat these roles as evidence
  // that the rule generalises across goals. That row is now deleted, because the
  // constant it excused no longer holds — which is the check doing its job.
  const rows = readFileSync(join(ROOT, 'oracle', 'constructed.jsonl'), 'utf8')
    .split('\n').filter(Boolean).map(l => JSON.parse(l))
  const goals = new Set(rows.map(r => r.goal))
  ok(goals.size >= 2,
     `every constructed row still sits under one goal (${[...goals].join(' | ')}) — the roles cannot be evidence that the derivation survives a change of goal`)

  // A second goal that only ever produces workers would leave the branch the
  // grounding actually rests on untested under it. The generator branch is the
  // one that did not exist before this set, so it is the one that has to appear
  // under each goal for the goal to be worth anything.
  for (const g of goals) {
    const gen = rows.filter(r => r.goal === g && r.expected_role === 'produces-an-instruction')
    ok(gen.length >= 1,
       `goal "${g}" has no produces-an-instruction row — it exercises only the branch that was already grounded, so it adds a goal without adding evidence`)
  }

  // And the deliverable of at least one goal must not be readable off the
  // filesystem, which is the specific thing the adjudication said was unshown.
  const nonFile = rows.filter(r => r.probe?.deliverable_present && !/test -e/.test(r.probe.deliverable_present))
  ok(nonFile.length >= 1,
     'every deliverable_present is still a `test -e` — the set has more goals but they are all file deliverables, so the bound the adjudication named is untouched')
  console.log(`          ${goals.size} goal(s), each with a generator row; ${nonFile.length} row(s) whose deliverable is not read off the filesystem`)
}

console.log('constructed-oracle: a pairing whose sides sit under DIFFERENT goals is refused')
{
  // Both roles answer "does executing this terminate in THE GOAL'S deliverable".
  // Two sides answering about different goals compose a verdict about nothing,
  // and composeVerdict would return one as confidently as any other.
  //
  // THIS CHECK COULD NOT HAVE FAILED BEFORE TODAY. Every row carried the same
  // goal, so no pairing could cross one. The second goal is what makes it capable
  // of firing, which is the only reason it is worth writing — and it is driven
  // through the real script rather than reimplemented here, because a test that
  // recomputes the rule it audits agrees with it, defect and all.
  const crossed = join(TMP, 'crossed-pairings.jsonl')
  writeFileSync(crossed, JSON.stringify({
    id: 'crossed-goal-pair',
    sides: ['constructed-direct', 'constructed-commit-direct'],
    selection_note: 'A file deliverable against a commit deliverable. Both sides are workers, so the composition would say comparable — about no goal at all.',
  }) + '\n')
  const r = spawnSync(process.execPath, ['scripts/constructed-verify.mjs'],
    { cwd: ROOT, encoding: 'utf8', timeout: 300_000,
      env: { ...process.env, CONSTRUCTED_PAIRINGS: crossed } })
  const out = String(r.stdout || '') + String(r.stderr || '')
  ok(r.status !== 0, 'a pairing crossing two goals was accepted, and composed to a verdict about nothing')
  ok(/CROSS-GOAL/.test(out), `and the refusal was not reported — got:\n${out.split('\n').slice(-6).join('\n')}`)
  ok(!/=>  comparable/.test(out.split('constructed pairing(s)')[1] || ''),
     'it still composed a verdict for the crossed pairing')
  console.log('          crossing two goals is refused, and the check can fail only now that goals vary')
}

console.log('constructed-oracle: a TRANSIENT deliverable is out of scope, and the deriver does not pretend otherwise')
{
  // The bound this second goal turned up, recorded rather than guarded.
  //
  // If a goal's deliverable exists only while a program runs, deliverable_present
  // has to re-run a program to observe it — so the check is bound to whichever
  // program it names. Run the scaffold and the deliverable is absent; run the
  // emission and the check re-runs the SCAFFOLD, so it is absent still. The
  // generator branch is unreachable under such a goal.
  //
  // NO GUARD IS ADDED. A self-referential deliverable and a genuinely broken chain
  // produce identical observations here, so nothing mechanical can separate them
  // — adding a detector for this one shape would be a rule fitted to the case that
  // produced it. What is asserted is that it does not MISLABEL: it must refuse.
  write('transient/scaffold.sh',
        `#!/bin/sh\nprintf '#!/bin/sh\\nprintf %s\\n' "'greetings\\n'" > ${TMP}/transient/emit.sh\nchmod +x ${TMP}/transient/emit.sh\n`, true)
  const d = deriveRole({
    reset: `rm -f ${TMP}/transient/emit.sh`,
    run_artifact: `sh ${TMP}/transient/scaffold.sh`,
    deliverable_present: `sh ${TMP}/transient/scaffold.sh | grep -qx greetings`,
    emitted_runnable: `test -x ${TMP}/transient/emit.sh`,
    run_emitted: `sh ${TMP}/transient/emit.sh`,
  })
  eq(d.role, null, 'a goal whose deliverable is defined in terms of the artifact must not be given a role')
  ok(d.why && d.why.length > 0, 'and it must say something')
  console.log(`          refused, and the reason it gives is about the chain: "${d.why}"`)
  console.log('          THAT REASON IS THE BOUND — the deriver cannot tell a self-referential')
  console.log('          deliverable from a broken chain, so goals of this shape are a precondition')
  console.log('          on the set, not a defect in the rule.')
}

rmSync(TMP, { recursive: true, force: true })

// ---------------------------------------------------------------------------
// THE LEDGER LAYER KNOWS THE CONSTRUCTED FRAME — issue 33's closing step. The first
// live draw against this set classified all 20 spawns correctly and RECORDED 2:
// oracle-record pins an artifact by a hash the constructed rows never stored, and
// oracle-report grounds a mechanical row by an acceptance command these rows do not
// have. Two things are asserted here, both recomputed rather than read back.
// ---------------------------------------------------------------------------
import { createHash } from 'node:crypto'
console.log('constructed-oracle: every constructed row pins its artifact by the hash on disk now')
{
  const rows = readFileSync(join(ROOT, 'oracle', 'constructed.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  for (const r of rows) {
    if (r.expected_role === 'could-not-open') { ok(!r.artifact_hash, `${r.id}: an absence row carries no hash`); continue }
    const now = 'sha256:' + createHash('sha256').update(readFileSync(join(ROOT, r.artifact))).digest('hex')
    ok(r.artifact_hash === now, `${r.id}: artifact_hash must equal the file on disk (${r.artifact}) — oracle-record refuses an observation otherwise. Regenerate the hash when the artifact changes.`)
  }
}
console.log('constructed-oracle: oracle-report grounds a constructed row by re-deriving its role, and refuses one whose derivation moved')
{
  const dir = join(TMP, 'report-grounding')
  mkdirSync(dir, { recursive: true })
  const empty = join(dir, 'results.jsonl'); writeFileSync(empty, '')
  const env = (manifest) => ({ ...process.env, GAUNTLET_SUITE: '1', ORACLE_CORPUS: manifest, ORACLE_PAIRINGS: join(ROOT, 'oracle', 'constructed-pairings.jsonl'), ORACLE_RESULTS: empty })
  const real = spawnSync(process.execPath, ['scripts/oracle-report.mjs'], { cwd: ROOT, encoding: 'utf8', timeout: 120_000, env: env(join(ROOT, 'oracle', 'constructed.jsonl')) })
  const out = String(real.stdout || '') + String(real.stderr || '')
  ok(!/REFUSING/.test(out) && /NO OBSERVATIONS YET/.test(out), `the real constructed set is grounded (no REFUSING) and an empty ledger reads as no observations — got:\n${out.slice(0, 600)}`)
  // A manifest that declares the wrong role for a row it can derive: the report must refuse it.
  const rows = readFileSync(join(ROOT, 'oracle', 'constructed.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  const lied = rows.map(r => r.id === 'constructed-scaffold' ? { ...r, expected_role: 'does-the-work' } : r)
  const bad = join(dir, 'lying.jsonl'); writeFileSync(bad, lied.map(r => JSON.stringify(r)).join('\n') + '\n')
  const r2 = spawnSync(process.execPath, ['scripts/oracle-report.mjs'], { cwd: ROOT, encoding: 'utf8', timeout: 120_000, env: env(bad) })
  const out2 = String(r2.stdout || '') + String(r2.stderr || '')
  ok(r2.status !== 0 && /REFUSING/.test(out2) && /constructed-scaffold/.test(out2) && /derives "produces-an-instruction"/.test(out2),
     `a constructed row declaring a role its probe does not derive is refused by name — got exit ${r2.status}:\n${out2.slice(0, 600)}`)
}

console.log('constructed-oracle: stating what this cannot establish')
console.log('          NOT ESTABLISHED: that these artifacts resemble what the probe meets. They are')
console.log('          built to make one relationship definitional, which is what makes them ground')
console.log('          truth and what makes them unrepresentative. They bound whether the probe can be')
console.log('          RIGHT where the answer is knowable; they say nothing about the corpus it is used on.')
console.log('          NOT SUPPORTED: goals whose deliverable is transient. The generator branch is')
console.log('          unreachable under them and no mechanical check can distinguish that from a')
console.log('          broken chain, so it is a precondition on goals rather than a defect.')
console.log('          NOT ESTABLISHED: anything about the probe. Nothing here runs it — that needs live')
console.log('          agents and is the next step, not this one.')
console.log('          NOT POOLED with oracle/corpus.jsonl: these are constructed, not sampled, and')
console.log('          mixing frames would move every rate oracle-report computes over a corpus that')
console.log('          already has no sampling frame (#38).')

if (failures) {
  console.error(`\nconstructed-oracle: ${failures} failure(s) — a set whose answers were authored is not ground truth.`)
  process.exit(1)
}
console.log('\nconstructed-oracle: OK — roles derived by execution, disagreement demonstrated, all three verdicts constructible.')
