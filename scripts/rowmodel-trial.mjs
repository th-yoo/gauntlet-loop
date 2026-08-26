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

  const a = add(env, ['--grounding', 'mechanical', '--artifact', join(dir, 'a', 'count.sh'), '--goal', GOAL,
                      '--acceptance', `sh ${join(dir, 'a', 'count.sh')} | grep -q 3`, '--id', 'pair-sh', '--note', 'row model trial'])
  const b = add(env, ['--grounding', 'mechanical', '--artifact', join(dir, 'b', 'Makefile'), '--goal', GOAL,
                      '--acceptance', `make -C ${join(dir, 'b')} count | grep -q 3`, '--id', 'pair-mk', '--note', 'row model trial'])
  const bothAdded = a.code === 0 && b.code === 0

  // BEHAVIOUR, NOT SHAPE. The first version of this case looked for a corpus row carrying
  // `arm: 'pairing'` or a `sides` field — a guess at a data layout, written before any
  // design existed. Checking the layout you happen to have built is not a test of the
  // claim. The claim is that two grounded rows sharing a goal can be declared a pairing and
  // yield the verdict loop.js derives, and that is what this asks for.
  const env2 = { ...env, ORACLE_PAIRINGS: join(dir, 'pairings.jsonl') }
  const paired = spawnSync(process.execPath, [join(ROOT, 'scripts', 'oracle-pair.mjs'),
    '--sides', 'pair-sh,pair-mk', '--id', 'trial-pair', '--note', 'row model trial'],
    { encoding: 'utf8', cwd: ROOT, env: env2, timeout: 60_000 })
  const out = String(paired.stdout || '') + String(paired.stderr || '')
  const declared = paired.status === 0
  // Both sides are does-the-work, so the rule in loop.js answers `comparable` — and a
  // refusal on this pairing would be a FALSE one, which is the rate #37 exists to produce.
  const derived = /loop\.js would answer: comparable/.test(out)

  verdict('A. express a pairing — two grounded artifacts under one goal, with the verdict loop.js derives',
    bothAdded && declared && derived,
    `both sides add and share a goal (${bothAdded ? 'yes' : 'NO'}); declaring the pairing ${declared ? 'succeeded' : 'FAILED'}; the derived verdict ${derived ? 'came back' : 'did NOT come back'}. Without it the false-refusal rate stays a derivation — 2q(1-q) under an independence assumption the report itself calls probably false — instead of an observation.`)
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

  const asThirdArm = add(env, ['--grounding', 'absence', '--artifact', absent, '--goal', 'anything at all',
                               '--acceptance', `test ! -e ${absent}`, '--id', 'cno', '--note', 'row model trial'])
  const asWorkArm = add(env, ['--grounding', 'mechanical', '--artifact', absent, '--goal', 'anything at all',
                              '--acceptance', `test ! -e ${absent}`, '--id', 'cno2', '--note', 'row model trial'])

  verdict('B. express a could-not-open row — an artifact whose ground truth is its absence',
    asThirdArm.code === 0 || asWorkArm.code === 0,
    `--arm could-not-open exits ${asThirdArm.code} (the arm list is closed), and using an existing arm exits ${asWorkArm.code} because a missing artifact is refused — in a message that names could-not-open. Existence is a PRECONDITION of a row, and this verdict is exactly the absent case.`)
  rmSync(dir, { recursive: true, force: true })
}

// ── C. A ROW WHOSE GROUNDING IS EXECUTION AND WHOSE ANSWER IS does-the-work ─────────
//
// `arm` means three things at once — which answer the row expects, how it was grounded,
// and what evidence it carries — so the grounding you have decides the answer you may
// record. Mechanical grounding can only produce `does-the-work`; agentic grounding can
// only produce `produces-an-instruction`, because oracle-add writes that label from the
// flag rather than reading it off the evidence.
//
// The combination that has no home: an artifact only an AGENT can execute, whose emission
// turns out to be a completed answer. Two of them exist — a handoff message to a named
// studio and a hiring ad, both executed into landing pages and both classified as
// completed answers by a blind second agent — and neither can be stored. #49.
//
// THE CASE CROSSES THE LABEL AGAINST THE EVIDENCE rather than asking for a shape, which is
// case A's lesson and CLAUDE.md's rule: two rows identical in every respect except what the
// blind classification says, required to come back with DIFFERENT expected roles. A tool
// that takes the label from a flag scores the same on both, whatever flag is added for it,
// so a fourth arm cannot pass this.
{
  const { dir, env } = sandbox()
  mkdirSync(join(dir, 'exec'))
  const artifact = join(dir, 'exec', 'HANDOFF.md')
  const emission = join(dir, 'exec', 'index.html')
  writeFileSync(artifact, '# Handoff\n\nYou build the page and you ship it. Copy is below and is final.\n')
  writeFileSync(emission, '<!doctype html><html><body><h1>The deliverable</h1></body></html>\n')

  // The blind classifier's own answer, as a response on disk — the two options
  // oracle/generator-procedure.md puts to it, and nothing else.
  const saidDone = join(dir, 'exec', 'classification-done.json')
  const saidHandoff = join(dir, 'exec', 'classification-handoff.json')
  writeFileSync(saidDone, JSON.stringify({ verdict: 'completed-answer', reasoning: 'the page is here and nothing is asked of anyone' }) + '\n')
  writeFileSync(saidHandoff, JSON.stringify({ verdict: 'addressed-to-a-further-party', reasoning: 'it asks the studio to build it' }) + '\n')

  const asDone = add(env, ['--grounding', 'agentic', '--artifact', artifact, '--goal', 'a landing page exists',
                           '--emission', emission, '--classification', saidDone, '--id', 'exec-done', '--note', 'row model trial'])
  const asHandoff = add(env, ['--grounding', 'agentic', '--artifact', artifact, '--goal', 'a landing page exists',
                              '--emission', emission, '--classification', saidHandoff, '--id', 'exec-handoff', '--note', 'row model trial'])

  let roles = {}
  try {
    for (const r of readFileSync(join(dir, 'corpus.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))) roles[r.id] = r.expected_role
  } catch { roles = {} }

  const both = asDone.code === 0 && asHandoff.code === 0
  const followed = roles['exec-done'] === 'does-the-work' && roles['exec-handoff'] === 'produces-an-instruction'

  verdict('C. express a row grounded by execution whose expected role follows the evidence',
    both && followed,
    `adding with a completed-answer classification exits ${asDone.code}, with a handoff classification exits ${asHandoff.code}; the two rows came back as ${JSON.stringify(roles['exec-done'] || null)} and ${JSON.stringify(roles['exec-handoff'] || null)}. Until they differ, the label is coming from the flag rather than from the blind classification, and an artifact only an agent can execute whose emission is a completed answer has nowhere to live.`)
  rmSync(dir, { recursive: true, force: true })
}

console.log('')
console.log(failures
  ? `${failures} of 3 unexpressible. Two verdicts that can refuse a run have 0 observations each, and this is what stops them being drawn.`
  : 'All three expressible — the corpus can hold a pairing, an absence, and a row whose grounding and whose answer are decided separately.')
process.exit(failures ? 1 : 0)
