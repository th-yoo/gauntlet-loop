// Break each fact drift-guard checks, and require drift-guard to notice.
//
//   node scripts/guard-sweep.mjs [--only <LIST>] [--json]
//
// ISSUE 3. The guard's file surface is discovered — a new agent definition, a new
// comparer lane, a new script are all found by reading the directory. Its FACTS
// are not: five hand-written lists, forty entries, and nothing measures what they
// miss or whether any given entry still fires. An entry that has quietly stopped
// biting looks exactly like one that never needed to, and everything stays green.
//
// This does to drift-guard what coverage-sweep already does to the test suite:
// break the thing the check is supposed to catch, and require the check to fail.
// An entry that survives its own mutation is decoration.
//
// TWO CONDITIONS, NOT ONE, and the second is the point. Asking only for a
// non-zero exit is a check whose PASS is satisfied by the subject being broken in
// ANY way — a mutation that made drift-guard crash, or that tripped a different
// entry, would score CAUGHT. This repository has already shipped that mistake: a
// trial asking only `exit !== 0` reported CAUGHT against a script that did not
// parse. So a mutation counts as caught only when drift-guard fails AND its
// output names THAT entry.
//
// NOTHING IS MUTATED IN THE WORKING TREE. Every mutation is applied to a copy of
// the tracked files under the system temp directory, and drift-guard is run from
// inside that copy so its own ROOT resolves there. The copy is taken from
// `git ls-files` rather than from a list of files this script thinks the guard
// reads — a pin covers what someone thought to enumerate, and the guard's read
// set is exactly the thing under test.
//
// NO MODEL IS SPAWNED. The only subprocess is `node` running drift-guard, which
// is why this can live where the suite can reach it.

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { RUNTIME_FORBIDDEN, CAP_NAMES, LOOP_PINNED, LOOP_DISCLOSURES, COMPARER_CONTRACT } from '../test/drift-facts.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const val = (f, d) => { const i = argv.indexOf(f); return i === -1 ? d : argv[i + 1] }
const ONLY = val('--only', null)
const WORK = join(tmpdir(), 'gauntlet-guard-sweep')

const LOOP = 'skills/gauntlet-loop/loop.js'

// --------------------------------------------------------------------------
// THE MUTATIONS. Each names the entry it targets, the file it damages, how, and
// the string drift-guard must produce. The expectation is derived from the entry
// itself — never a hand-copied message — so an entry added to a list tomorrow
// gets a mutation without an edit here.
// --------------------------------------------------------------------------
function mutations() {
  const out = []
  for (const forbidden of RUNTIME_FORBIDDEN) {
    out.push({
      list: 'RUNTIME_FORBIDDEN', entry: forbidden, file: LOOP,
      // Appended as LIVE code. The guard strips comments first, so a mutation
      // hidden in a comment would prove nothing about the live scan.
      apply: src => src + `\nconst __guardSweep = ${JSON.stringify(forbidden)}\nvoid ${forbidden === 'require(' ? 'require(0)' : forbidden === 'import ' ? '0; import x from "y"' : forbidden}\n`,
      expect: forbidden,
    })
  }
  for (const name of CAP_NAMES) {
    out.push({
      list: 'CAP_NAMES', entry: name, file: LOOP,
      apply: src => src + `\nconst ${name} = 5\nvoid ${name}\n`,
      expect: name,
    })
  }
  for (const pin of LOOP_PINNED) {
    out.push({
      list: 'LOOP_PINNED', entry: pin.loop, file: LOOP,
      // Removed from loop.js only. The agent definition still carries its
      // needle, so the guard must report the ONE-SIDED case rather than the
      // both-gone case — which is the branch a drifting edit actually produces.
      apply: src => src.split(pin.loop).join('[[GUARD-SWEEP-REMOVED]]'),
      expect: pin.what,
    })
  }
  for (const needle of LOOP_DISCLOSURES) {
    out.push({
      list: 'LOOP_DISCLOSURES', entry: needle, file: LOOP,
      apply: src => src.split(needle).join('[[GUARD-SWEEP-REMOVED]]'),
      expect: needle,
    })
  }
  for (const c of COMPARER_CONTRACT) {
    out.push({
      list: 'COMPARER_CONTRACT', entry: String(c.test), file: null, lanes: true,
      apply: src => src.replace(new RegExp(c.test.source, c.test.flags.includes('g') ? c.test.flags : c.test.flags + 'g'), 'GUARDSWEEPREMOVED'),
      expect: c.what,
    })
  }
  return ONLY ? out.filter(m => m.list === ONLY) : out
}

// --------------------------------------------------------------------------
function stageWorkingCopy() {
  if (existsSync(WORK)) rmSync(WORK, { recursive: true, force: true })
  mkdirSync(WORK, { recursive: true })
  // TRACKED **AND** UNTRACKED-BUT-PRESENT. `git ls-files` alone lists only what is
  // in the index, so a file added this session is absent from the copy and the
  // baseline dies with a missing-module error — which is exactly what happened the
  // first time this ran, and is the baseline control doing its job. The subject is
  // the WORKING TREE, so the copy must be the working tree.
  const ls = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
  const files = String(ls.stdout || '').split('\n').filter(Boolean)
  if (!files.length) { console.error('guard-sweep: git ls-files returned nothing — cannot stage a working copy'); process.exit(2) }
  for (const f of files) {
    const src = join(ROOT, f), dst = join(WORK, f)
    if (!existsSync(src)) continue
    mkdirSync(dirname(dst), { recursive: true })
    cpSync(src, dst)
  }
  return files.length
}

function runGuard() {
  const r = spawnSync(process.execPath, ['test/drift-guard.mjs'], { cwd: WORK, encoding: 'utf8', timeout: 60_000 })
  const out = String(r.stdout || '') + String(r.stderr || '')
  // ATTRIBUTED TO FAILURE LINES ONLY. Searching the whole output credits a
  // mutation whose token happens to appear in unrelated prose — drift-guard
  // prints its checks as it runs, and its closing summary names every list. That
  // is a PASS condition satisfied by something other than the thing under test,
  // which is the defect this repository names most often.
  const failures = out.split('\n').filter(l => /^\s*FAIL\b/.test(l.replace(/^\s+/, ''))).join('\n')
  // A CRASH IS NOT A VERDICT. drift-guard dying — a syntax error, a missing
  // module — produces a non-zero exit and no FAIL lines at all, and every
  // comparison below would read that as "the guard did not name it". In the
  // redundancy pass that inverts the answer: a malformed entry removal makes the
  // facts module unparseable, the guard crashes, and the entry is reported
  // load-bearing precisely when the measurement failed to happen.
  const crashed = r.status !== 0 && !failures.trim()
  return { status: r.status, out, failures, crashed }
}

const laneFiles = () => {
  const dir = join(WORK, 'skills', 'gauntlet-loop')
  const ls = spawnSync('ls', [dir], { encoding: 'utf8' })
  return String(ls.stdout || '').split('\n').filter(f => f.endsWith('.js')).map(f => join('skills', 'gauntlet-loop', f))
}

// Delete one entry from the facts module, textually, so the same mutation can be
// re-run with the entry absent. Returns null when the entry cannot be located,
// which is reported as unmeasured rather than guessed at.
// Delete ONE entry from the facts module so the same mutation can be re-run with
// the entry absent. Returns null when the entry cannot be located, which is
// reported as unmeasured rather than guessed at.
//
// IT SPLICES THE ELEMENT, NOT THE LINE. The first version deleted the whole line
// containing the literal — which is correct for the disclosure lists, one entry
// per line, and catastrophic for CAP_NAMES and RUNTIME_FORBIDDEN, which are
// single-line arrays. Removing that line deleted the entire export, drift-guard
// died on the missing import, and every entry came back "redundancy unmeasured".
// The list shape is not something to assume; the element boundary is.
function removeEntry(src, m) {
  const objectList = m.list === 'LOOP_PINNED' || m.list === 'COMPARER_CONTRACT'
  if (objectList) {
    const needle = m.list === 'LOOP_PINNED' ? m.entry : m.entry
    const i = src.indexOf(needle)
    if (i === -1) return null
    const start = src.lastIndexOf('{', i)
    const end = src.indexOf('},', i)
    if (start === -1 || end === -1) return null
    return src.slice(0, start) + src.slice(end + 2)
  }
  const lit = src.includes(JSON.stringify(m.entry))
    ? JSON.stringify(m.entry)
    : "'" + m.entry.replace(/'/g, "\\'") + "'"
  const i = src.indexOf(lit)
  if (i === -1) return null
  let from = i, to = i + lit.length
  // Take one adjacent separator with it, so the array stays well formed whether
  // the entry is first, last, or in the middle.
  const after = src.slice(to)
  const sep = after.match(/^\s*,\s*/)
  if (sep) to += sep[0].length
  else {
    const before = src.slice(0, from)
    const psep = before.match(/,\s*$/)
    if (psep) from -= psep[0].length
  }
  return src.slice(0, from) + src.slice(to)
}
// Ask node whether the text is a valid module, rather than guessing from its
// punctuation. Written to a scratch file inside the working copy so nothing in
// the real tree is touched.
function parsesAsModule(text) {
  const probe = join(WORK, '.guard-sweep-parse-probe.mjs')
  writeFileSync(probe, text)
  const r = spawnSync(process.execPath, ['--check', probe], { encoding: 'utf8', timeout: 20_000 })
  rmSync(probe, { force: true })
  return r.status === 0
}

const staged = stageWorkingCopy()
console.log(`guard-sweep: staged ${staged} tracked file(s) under ${WORK}`)

// THE BASELINE MUST BE GREEN, or every mutation "fails" for a reason that has
// nothing to do with the mutation. A sweep whose control is already red measures
// the control.
const base = runGuard()
if (base.status !== 0) {
  console.error('guard-sweep: REFUSING — drift-guard is already failing on an unmutated copy, so nothing below would mean anything:')
  console.error(base.out.split('\n').filter(l => /FAIL|Error/.test(l)).slice(0, 3).join('\n'))
  process.exit(2)
}
console.log('guard-sweep: baseline green on the unmutated copy')

const results = []
for (const m of mutations()) {
  const targets = m.lanes ? laneFiles() : [m.file]
  const originals = new Map()
  let changed = false
  for (const t of targets) {
    const p = join(WORK, t)
    if (!existsSync(p)) continue
    const src = readFileSync(p, 'utf8')
    originals.set(p, src)
    const next = m.apply(src)
    if (next !== src) changed = true
    writeFileSync(p, next)
  }
  // A MUTATION THAT CHANGED NOTHING IS NOT A PASS. If the string this entry
  // pins is not in the subject at all, the entry is already dead and the sweep
  // must say so rather than reporting a clean run.
  let verdict
  let loadBearing = null
  if (!changed) {
    verdict = 'INERT'
  } else {
    const r = runGuard()
    if (r.status === 0) verdict = 'SURVIVED'
    else if (r.failures.includes(m.expect)) verdict = 'CAUGHT'
    else verdict = 'RED-BUT-UNNAMED'

    // IS THIS ENTRY THE THING THAT CAUGHT IT? A caught mutation says the guard
    // noticed; it does not say this list entry is why. Some properties are pinned
    // twice — inserting `Date.now` trips a second check that names it regardless
    // of whether the entry is in the list at all.
    //
    // So the entry is DELETED from drift-facts.mjs and the same mutation re-run.
    // Still caught means something else covers it and the entry is redundant;
    // caught only with the entry present means the entry is load-bearing. That is
    // the distinction issue 3 asks for — which of these lists actually bite —
    // and the first version of this sweep could not make it.
    if (verdict === 'CAUGHT') {
      const factsPath = join(WORK, 'test', 'drift-facts.mjs')
      const factsSrc = readFileSync(factsPath, 'utf8')
      const without = removeEntry(factsSrc, m)
      // The removal must leave a module that still parses, or what runs next is
      // not "the guard without this entry" but "the guard with a broken import".
      //
      // CHECKED WITH THE REAL PARSER, not a proxy for it. The first version counted
      // brackets, which counts the ones inside string literals and regexes too —
      // `/\\btie\\b/` and every bracketed sentence in a disclosure — so it declared
      // every removal malformed and reported the whole sweep unmeasured. A
      // heuristic standing in for a decidable question is a check that answers
      // something other than what it was asked.
      const parses = Boolean(without) && parsesAsModule(without)
      if (without && without !== factsSrc && parses) {
        writeFileSync(factsPath, without)
        for (const t of targets) {
          const p = join(WORK, t)
          if (existsSync(p)) writeFileSync(p, m.apply(originals.get(p)))
        }
        const r2 = runGuard()
        // Unmeasured, not load-bearing, when the removal broke the run.
        loadBearing = r2.crashed ? null : !(r2.status !== 0 && r2.failures.includes(m.expect))
        writeFileSync(factsPath, factsSrc)
      } else {
        loadBearing = null
      }
    }
  }
  for (const [p, src] of originals) writeFileSync(p, src)
  results.push({ ...m, verdict, load_bearing: loadBearing, apply: undefined })
  const mark = { CAUGHT: '  caught', SURVIVED: '  SURVIVED', INERT: '  INERT', 'RED-BUT-UNNAMED': '  RED-BUT-UNNAMED' }[verdict]
  const lb = verdict !== 'CAUGHT' ? '' : loadBearing === true ? ' [load-bearing]' : loadBearing === false ? ' [REDUNDANT — another check names it]' : ' [redundancy unmeasured]'
  console.log(`${mark.padEnd(20)} ${m.list.padEnd(20)} ${String(m.entry).slice(0, 52).replace(/\n/g, ' ')}${lb}`)
}

const by = v => results.filter(r => r.verdict === v)
console.log()
const redundant = results.filter(r => r.verdict === 'CAUGHT' && r.load_bearing === false)
console.log(`guard-sweep: ${results.length} entries — ${by('CAUGHT').length} caught, ${by('SURVIVED').length} survived, ${by('RED-BUT-UNNAMED').length} red but unnamed, ${by('INERT').length} inert`)
console.log(`guard-sweep: of the caught, ${redundant.length} are REDUNDANT — the mutation is still caught and named with the entry deleted, so something else covers that property`)
// THE RESIDUAL, ON EVERY BRANCH — including the clean one, because a limitation
// printed only when something is wrong is printed exactly when it does not matter.
console.log('guard-sweep: what a clean sweep does NOT establish — that the lists are COMPLETE.')
console.log('             Every entry biting says nothing about the entry nobody wrote. That is the')
console.log('             half of issue 3 no instrument here can close, and it is why the lists stay')
console.log('             a statement of intent rather than a claim of coverage.')

if (argv.includes('--json')) console.log(JSON.stringify(results, null, 2))
const unmeasured = results.filter(r => r.verdict === 'CAUGHT' && r.load_bearing === null)
if (unmeasured.length) console.log(`guard-sweep: ${unmeasured.length} entr(ies) whose redundancy could not be measured — the entry could not be cleanly removed, so nothing is claimed about them`)
if (by('SURVIVED').length || by('RED-BUT-UNNAMED').length || by('INERT').length) process.exit(1)
