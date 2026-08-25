// What the corpus row model cannot express, built rather than argued.
//
//   node scripts/rowmodel-trial.mjs
//
// Two verdicts can REFUSE A RUN and neither has a single observation behind it:
// `could-not-open` (0 of 38) and the pairing verdict itself (0 of 38). Both are blocked
// before any draw can be taken, and for different reasons — which is the point of building
// them separately rather than describing them together.
//
// Exit 0 means the corpus can express both. Exit 1 means it cannot, and names which.
//
// No agents, no model, no writes outside a temp sandbox.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ADD = join(ROOT, 'scripts', 'oracle-add.mjs')
const REPORT = join(ROOT, 'scripts', 'oracle-report.mjs')

let failures = 0
function verdict(name, can, detail) {
  console.log(`${can ? 'CAN    ' : 'CANNOT '} ${name}`)
  if (!can) { console.log(`         ${detail}`); failures++ }
}
function run(script, args, env) {
  try { return { code: 0, out: spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', cwd: ROOT, env, timeout: 60_000 }).stdout || '' } }
  catch (e) { return { code: e.status ?? -1, out: String(e.stdout || '') + String(e.stderr || '') } }
}
function add(env, args) {
  const r = spawnSync(process.execPath, [ADD, ...args], { encoding: 'utf8', cwd: ROOT, env, timeout: 60_000 })
  return { code: r.status, out: String(r.stdout || '') + String(r.stderr || '') }
}
function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'rowmodel-'))
  return { dir, env: { ...process.env, ORACLE_CORPUS: join(dir, 'corpus.jsonl'), ORACLE_RESULTS: join(dir, 'results.jsonl') } }
}

// ── A. A PAIRING: two artifacts, ONE shared goal, and a verdict composed from both ──
//
// This is what decides whether an automatic refusal is safe to keep. loop.js refuses when
// exactly one side is an instruction-writer, so the only route to a FALSE refusal is a
// does-the-work artifact read as a writer — and that is a property of a PAIR under one
// goal. The corpus stores one artifact per row with its own goal, so no set of existing
// rows composes into one.
//
// Note what this case does NOT test: whether two rows may share a goal. They may, today,
// with no change — that was checked first, and it is why this case is about composition
// rather than about the row.
{
  const { dir, env } = sandbox()
  mkdirSync(join(dir, 'a')); mkdirSync(join(dir, 'b'))
  writeFileSync(join(dir, 'data.txt'), 'x\ny\nz\n')
  writeFileSync(join(dir, 'a', 'count.sh'), `#!/bin/sh\nwc -l < "${join(dir, 'data.txt')}"\n`)
  writeFileSync(join(dir, 'b', 'Makefile'), `count:\n\t@wc -l < ${join(dir, 'data.txt')}\n`)
  const GOAL = 'a reader can get the number of lines in data.txt by running one command'

  const a = add(env, ['--arm', 'does-the-work', '--artifact', join(dir, 'a', 'count.sh'), '--goal', GOAL,
                      '--acceptance', `sh ${join(dir, 'a', 'count.sh')} | grep -q 3`, '--id', 'pair-sh', '--note', 'row model trial'])
  const b = add(env, ['--arm', 'does-the-work', '--artifact', join(dir, 'b', 'Makefile'), '--goal', GOAL,
                      '--acceptance', `make -C ${join(dir, 'b')} count | grep -q 3`, '--id', 'pair-mk', '--note', 'row model trial'])
  const bothAdded = a.code === 0 && b.code === 0

  // Both sides are grounded and share a goal. Is there anywhere to say they form a pair,
  // and does anything derive the verdict loop.js would reach for them?
  const rows = bothAdded ? readFileSync(env.ORACLE_CORPUS, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : []
  const pairingExpressed = rows.some(r => r.arm === 'pairing' || r.sides || r.pair_with)
  const rep = run(REPORT, [], env)
  const pairingScored = /pairing|two-sided|comparable/i.test(rep.out) && !/would be falsely refused/i.test(rep.out)

  verdict('A. express a pairing — two grounded artifacts under one goal, with the verdict loop.js derives',
    bothAdded && pairingExpressed && pairingScored,
    `both sides add and share a goal (${bothAdded ? 'yes' : 'NO'}), but no row says they form a pair and nothing composes their verdict. The false-refusal rate stays a derivation — 2q(1-q) under an independence assumption the report itself calls probably false — instead of an observation.`)
  rmSync(dir, { recursive: true, force: true })
}

// ── B. A could-not-open ROW ─────────────────────────────────────────────────────────
//
// The third thing the probe can answer, and the third way a run gets refused. Its ground
// truth is the cheapest in the corpus — the path is not there, which `test ! -e` settles
// with no judgement at all — and it is the one arm that cannot be added.
{
  const { dir, env } = sandbox()
  const absent = join(dir, 'no', 'such', 'artifact.md')

  const asThirdArm = add(env, ['--arm', 'could-not-open', '--artifact', absent, '--goal', 'anything at all',
                               '--acceptance', `test ! -e ${absent}`, '--id', 'cno', '--note', 'row model trial'])
  const asWorkArm = add(env, ['--arm', 'does-the-work', '--artifact', absent, '--goal', 'anything at all',
                              '--acceptance', `test ! -e ${absent}`, '--id', 'cno2', '--note', 'row model trial'])

  verdict('B. express a could-not-open row — an artifact whose ground truth is its absence',
    asThirdArm.code === 0 || asWorkArm.code === 0,
    `--arm could-not-open exits ${asThirdArm.code} (the arm list is closed), and using an existing arm exits ${asWorkArm.code} because a missing artifact is refused — in a message that names could-not-open. Existence is a PRECONDITION of a row, and this verdict is exactly the absent case.`)
  rmSync(dir, { recursive: true, force: true })
}

console.log('')
console.log(failures
  ? `${failures} of 2 unexpressible. Two verdicts that can refuse a run have 0 observations each, and this is what stops them being drawn.`
  : 'Both expressible — the corpus can hold a pairing and an absence, so both refusing verdicts can be measured.')
process.exit(failures ? 1 : 0)
