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

rmSync(TMP, { recursive: true, force: true })

console.log('constructed-oracle: stating what this cannot establish')
console.log('          NOT ESTABLISHED: that these artifacts resemble what the probe meets. They are')
console.log('          built to make one relationship definitional, which is what makes them ground')
console.log('          truth and what makes them unrepresentative. They bound whether the probe can be')
console.log('          RIGHT where the answer is knowable; they say nothing about the corpus it is used on.')
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
