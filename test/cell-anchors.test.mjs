// The cell anchors' truths are re-derived by execution, and the deriver can FAIL.
//
//   node test/cell-anchors.test.mjs
//
// Issue 73's third-cell validation died because its guard expectations leaned on the
// previous instrument's readings. The battery under oracle/fixtures/cell-anchors is the
// repair: emissions whose cell is a shell-decidable fact under one partition —
// completed = predicate passes at rest; addressed = fails at rest, passes after the
// CONTAINED step; honest-incompletion = fails at rest with nothing runnable contained.
// This suite drives the real deriver over the real battery AND over constructed
// mislabels, because a verifier that has never disagreed with a label is a mirror.

import { deriveCell } from '../scripts/cell-anchors.mjs'
import { writeFileSync, mkdtempSync, mkdirSync, rmSync, chmodSync, cpSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

let failures = 0
const ok = (cond, m) => { if (cond) console.log(`  ok    ${m}`); else { console.error(`  FAIL  ${m}`); failures++ } }

console.log('cell-anchors: the committed battery derives to its own labels, through the CLI')
{
  // AGAINST A THROWAWAY COPY, and this line has a receipt. A mutation of
  // cell-anchors.mjs once made the contained step run in the fixture instead of the
  // work copy; the sweep restored the SOURCE, not the data, and the tracked
  // addressed-doc anchor was left carrying the guide its own handoff writes — deriving
  // completed-answer at rest on a clean checkout. The same reason ORACLE_CORPUS exists:
  // a check that can write must be pointed at a copy whenever a mutant might be the
  // thing running it.
  const battery = mkdtempSync(join(tmpdir(), 'cell-anchors-battery-'))
  cpSync(join(ROOT, 'oracle', 'fixtures', 'cell-anchors'), battery, { recursive: true })
  const r = spawnSync(process.execPath, ['scripts/cell-anchors.mjs'], { encoding: 'utf8', cwd: ROOT, env: { ...process.env, CELL_ANCHORS: battery } })
  rmSync(battery, { recursive: true, force: true })
  ok(r.status === 0, `the verifier exits 0 on the battery (got ${r.status}): ${(r.stdout + r.stderr).split('\n').find(l => /FAIL/.test(l)) || ''}`)
  ok((r.stdout.match(/AGREES/g) || []).length >= 5, 'at least five anchors derive to their declared cells — one per decidable condition, both clothings of each')
  ok(/shell-decidable BY CONSTRUCTION/.test(r.stdout) && /decides nothing by/.test(r.stdout),
     'and the residual prints on the passing branch: these anchors mechanize the cells, not the reading of mixed-mode prose')
}

const scratch = mkdtempSync(join(tmpdir(), 'cell-anchors-test-'))
const mk = (name, files, truth) => {
  const d = join(scratch, name); mkdirSync(d)
  for (const [f, body] of Object.entries(files)) { writeFileSync(join(d, f), body); if (f.endsWith('.sh')) chmodSync(join(d, f), 0o755) }
  writeFileSync(join(d, 'TRUTH.json'), JSON.stringify(truth))
  return d
}

try {
  console.log('cell-anchors: a mislabelled anchor is disagreed with, not echoed')
  {
    // Declared completed, actually honest incompletion: the derivation must come from
    // running the predicate, so this returns honest-incompletion against the label.
    const d = mk('mislabelled', { 'note.txt': 'nothing here\n' },
      { cell: 'completed-answer', goal: 'g', predicate: 'test -e report.txt' })
    const r = deriveCell(d)
    ok(r.derived === 'honest-incompletion',
       `the derived cell comes from execution, not from TRUTH.json (got ${r.derived}) — deriving from the declaration would be the stored answer key`)
  }

  console.log('cell-anchors: a handoff that does not reach the deliverable is BROKEN, not addressed')
  {
    const d = mk('dead-handoff', { 'BRIEF.md': 'run go.sh\n', 'go.sh': '#!/bin/sh\nexit 0\n' },
      { cell: 'addressed-to-a-further-party', goal: 'g', predicate: 'test -e report.txt', step: 'sh go.sh' })
    const r = deriveCell(d)
    ok(r.derived === 'BROKEN' && /does not reach the deliverable/.test(r.why),
       'a contained step that runs clean but produces nothing anchors nothing, and the verdict says which half failed')
  }

  console.log('cell-anchors: a contained step that itself fails is BROKEN too')
  {
    const d = mk('crashing-handoff', { 'go.sh': '#!/bin/sh\nexit 3\n' },
      { cell: 'addressed-to-a-further-party', goal: 'g', predicate: 'test -e report.txt', step: 'sh go.sh' })
    const r = deriveCell(d)
    ok(r.derived === 'BROKEN' && /step failed/.test(r.why), 'a crash is a crash, not an addressed verdict')
  }

  console.log('cell-anchors: claiming to hand off nothing while containing something runnable is a contradiction')
  {
    const d = mk('secret-handoff', { 'note.txt': 'nothing to run\n', 'lurker.sh': '#!/bin/sh\ntouch report.txt\n' },
      { cell: 'honest-incompletion', goal: 'g', predicate: 'test -e report.txt' })
    const r = deriveCell(d)
    ok(r.derived === 'BROKEN' && /must contain nothing runnable/.test(r.why),
       'the no-handoff claim is checked against the emission\'s contents, not assumed from the missing step declaration')
  }

  console.log('cell-anchors: a truth naming a model is refused before any shell runs it')
  {
    const d = mk('model-truth', { 'note.txt': 'x\n' },
      { cell: 'completed-answer', goal: 'g', predicate: 'deepseek -p "is this complete?"' })
    const r = deriveCell(d)
    ok(r.derived === 'BROKEN' && /names a model/.test(r.why),
       'a predicate that consults a model is the authored answer key this battery replaces, and it is refused rather than spawned. The name here is one with no binary on this machine, so even a mutant that removes the barrier spawns nothing live')
  }

  console.log('cell-anchors: the derivation never touches the fixture')
  {
    const d = mk('side-effect', { 'BRIEF.md': 'run go.sh\n', 'go.sh': '#!/bin/sh\nhere="$(cd "$(dirname "$0")" && pwd)"\ntouch "$here/report.txt"\n' },
      { cell: 'addressed-to-a-further-party', goal: 'g', predicate: 'test -e report.txt', step: 'sh go.sh' })
    const r = deriveCell(d)
    const leaked = spawnSync('test', ['-e', join(d, 'report.txt')]).status === 0
    ok(r.derived === 'addressed-to-a-further-party' && !leaked,
       'the step ran in a copy: the anchor directory holds no report.txt afterwards, so the tracked battery cannot drift by being verified')
  }
} finally {
  rmSync(scratch, { recursive: true, force: true })
}

console.log('cell-anchors: stating what this suite cannot establish')
console.log('          NOT MEASURED: whether any classifier reads these emissions correctly — the battery')
console.log('          is what a future question is validated AGAINST, not a validation of one. NOT')
console.log('          DECIDABLE HERE: mixed-mode emissions (salvage notes wrapped around routing sheets);')
console.log('          the partition covers the decidable core and says so on its own passing branch.')

if (failures) {
  console.error(`\ncell-anchors: ${failures} failure(s) — an anchor whose truth cannot be re-derived, or a deriver that echoes labels, anchors nothing.`)
  process.exit(1)
}
console.log('\ncell-anchors: OK — five anchors re-derive by execution, and every way the deriver can disagree has a case.')
