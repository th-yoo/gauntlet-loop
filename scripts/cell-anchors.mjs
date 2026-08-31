// Derive each cell anchor's cell BY EXECUTION, and fail on disagreement with its label.
//
//   node scripts/cell-anchors.mjs
//
// Issue 73's third-cell validation failed because two of its guard expectations were
// anchored on the previous instrument's own readings — an instrument validated only by
// agreeing (or disagreeing) with its predecessor is not validated. These anchors are the
// repair: emissions whose cell is a SHELL-DECIDABLE fact, so a future classifier question
// can be validated against ground truth no judgement produced.
//
// THE PARTITION, one rule rather than one case per anchor. Every anchor declares a
// deliverable predicate P (a shell command over the emission) and optionally a contained
// step (a command the emission itself tells its reader to run). The cell is derived:
//
//   completed-answer            P passes at rest
//   addressed-to-a-further-party  P fails at rest, and running the CONTAINED step makes P pass
//   honest-incompletion         P fails at rest, and nothing contained reaches P
//
// "Nothing contained" is checked, not assumed: an anchor with no declared step must also
// CONTAIN no executable — a *.sh sitting in an emission that claims to hand off nothing
// is a contradiction this verifier reports rather than trusts away.
//
// NOTHING HERE MUTATES A FIXTURE. Each emission is copied to a temp directory and the
// predicate and step run there; the tracked anchors stay byte-identical across runs. The
// declared cell in TRUTH.json is the expectation under test, never the source of the
// answer — deriving the cell FROM the declaration would be the stored answer key this
// repo calls a check that cannot be wrong.
//
// WHAT THIS DOES NOT ESTABLISH, on every run: these anchors mechanize the CELLS, not the
// reading of prose. Real emissions mix modes — a salvage-notes-plus-routing-sheet has no
// shell-decidable cell, and the third-cell run split readers on exactly that shape. A
// classifier validated on these anchors is validated on the decidable core only.

import { readdirSync, readFileSync, cpSync, rmSync, mkdtempSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { namesAModel } from './model-shaped.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ANCHORS = process.env.CELL_ANCHORS || join(ROOT, 'oracle', 'fixtures', 'cell-anchors')

// THE BARRIER, because this is a spawn of whatever TRUTH.json hands it. A predicate or
// step naming a model runner is refused BEFORE the shell sees it — the same rule
// oracle-add applies to acceptance commands, for the same reason: an anchor whose truth
// is produced by a model judgement is the authored answer key this battery exists to
// replace, and a spawned runner inside a suite run is the fork-bomb shape containment
// exists to forbid.
const sh = (cmd, cwd) => {
  if (namesAModel(cmd)) return { status: null, modelRefused: true }
  return spawnSync('sh', ['-c', cmd], { cwd, encoding: 'utf8', timeout: 30_000 })
}

export function deriveCell(dir) {
  // A COPY, so the step's writes never touch the fixture. The derivation reads only
  // what the emission contains — the TRUTH.json is stripped from the copy so no
  // predicate can cheat by reading its own declaration.
  const work = mkdtempSync(join(tmpdir(), 'cell-anchor-'))
  try {
    cpSync(dir, work, { recursive: true })
    try { rmSync(join(work, 'TRUTH.json')) } catch {}
    const truth = JSON.parse(readFileSync(join(dir, 'TRUTH.json'), 'utf8'))
    const atRest = sh(truth.predicate, work)
    if (atRest.modelRefused) return { derived: 'BROKEN', why: 'the predicate names a model — a truth produced by a judgement cannot anchor the judgement, and it is refused before any shell runs it' }
    if (atRest.status === 0) return { derived: 'completed-answer', why: 'the deliverable predicate passes on the emission at rest' }
    if (truth.step) {
      const stepped = sh(truth.step, work)
      if (stepped.modelRefused) return { derived: 'BROKEN', why: 'the contained step names a model — refused before any shell runs it, for the same reason as a model-named predicate' }
      if (stepped.status !== 0) return { derived: 'BROKEN', why: `the declared contained step failed (exit ${stepped.status}) — an anchor whose handoff does not work anchors nothing` }
      const after = sh(truth.predicate, work)
      if (after.status === 0) return { derived: 'addressed-to-a-further-party', why: 'the predicate fails at rest and passes after the contained step — the deliverable is expected from whoever runs it' }
      return { derived: 'BROKEN', why: 'the contained step ran but the predicate still fails — the handoff does not reach the deliverable' }
    }
    const executables = readdirSync(work).filter(f => f.endsWith('.sh'))
    if (executables.length) return { derived: 'BROKEN', why: `no step is declared but the emission contains ${executables.join(', ')} — an emission that claims to hand off nothing must contain nothing runnable` }
    return { derived: 'honest-incompletion', why: 'the predicate fails at rest and the emission contains nothing runnable that could reach it' }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

const INVOKED = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (INVOKED) {
  let failures = 0
  const dirs = readdirSync(ANCHORS).filter(d => { try { return statSync(join(ANCHORS, d)).isDirectory() } catch { return false } }).sort()
  if (dirs.length < 5) { console.error(`cell-anchors: only ${dirs.length} anchor(s) found under ${ANCHORS} — the battery holds one per decidable condition plus both clothings of each, and fewer means it has been thinned`); failures++ }
  for (const d of dirs) {
    const declared = JSON.parse(readFileSync(join(ANCHORS, d, 'TRUTH.json'), 'utf8')).cell
    const r = deriveCell(join(ANCHORS, d))
    const ok = r.derived === declared
    if (!ok) failures++
    console.log(`${ok ? 'AGREES ' : 'FAIL   '} ${d.padEnd(20)} declared ${declared.padEnd(28)} derived ${r.derived}`)
    if (!ok) console.log(`         ${r.why}`)
  }
  console.log('')
  console.log('cell-anchors: the cells here are shell-decidable BY CONSTRUCTION. Real emissions mix')
  console.log('              modes — a salvage-note wrapped around a routing sheet decides nothing by')
  console.log('              shell — so a classifier validated on these is validated on the decidable')
  console.log('              core only, and the mixed shapes stay exactly as hard as they were.')
  process.exit(failures ? 1 : 0)
}
