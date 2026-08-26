// Every mutation the coverage sweep pins must still find its target.
//
//   node test/sweep-needles.test.mjs
//
// THE DEFECT THIS EXISTS FOR, and it happened on this branch. scripts/coverage-sweep.mjs
// pins each property by a literal string: it replaces that text, runs the suite, and
// requires the suite to go red. Rename the code and the string stops matching — the
// mutation cannot be applied, the property silently stops being tested, and the only thing
// that notices is a sweep that takes ~50 minutes and runs weekly. Two renames on 2026-08-26
// (`arm` -> `grounding` in oracle-add, and blanking the resolved path rather than the
// caller's spelling in oracle-extract) disarmed two properties, and the first anyone knew
// was a red scheduled run three commits later.
//
// The sweep already reports this, as COULD NOT RUN. What it cannot do is report it in the
// push that caused it. This asks the same question in milliseconds, so a rename is caught
// by the gate that runs on every commit rather than by the one that runs on Mondays. It
// reads the sweep's own exported list, so there is no second copy of the properties and no
// parser to go blind.
//
// WHAT THIS DOES NOT ESTABLISH, and the distinction is the whole reason the sweep still
// runs: a needle that is PRESENT says nothing about whether mutating it is still caught. A
// property can point at live code and be tested by nothing at all. Only the sweep, which
// applies the mutation and requires the suite to fail, answers that.

import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SWEEP = join(ROOT, 'scripts', 'coverage-sweep.mjs')

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }

// THE LIST IS IMPORTED, never restated and no longer re-parsed. The first version of this
// file eval'd the PROPERTIES literal out of the sweep's source, which made it the THIRD
// parser of one list — and the first of the three had already gone blind once. The sweep
// exports the array now and runs only when invoked, so this reads what it sweeps. #46 RC4.
let entries = []
try {
  const mod = await import(pathToFileURL(SWEEP).href)
  entries = mod.PROPERTIES
} catch (e) {
  fail(`scripts/coverage-sweep.mjs could not be imported: ${String(e.message).split('\n')[0]}`)
}
if (!Array.isArray(entries)) { fail('scripts/coverage-sweep.mjs exports no PROPERTIES array'); entries = [] }

// A SCAN THAT MATCHES NOTHING CANNOT FAIL INFORMATIVELY — drift-guard's lesson, and this
// file is one bad import away from auditing an empty list and reporting success.
if (!failures && entries.length < 50) {
  fail(`only ${entries.length} pinned properties were read out of the sweep, which is fewer than this repo has had for a long time — an empty audit passes`)
}

console.log(`sweep-needles: every pinned mutation still finds its target (${entries.length} properties)`)
const cache = new Map()
const read = f => { if (!cache.has(f)) cache.set(f, readFileSync(join(ROOT, f), 'utf8')); return cache.get(f) }

// A MUTATION IN FLIGHT MAKES THIS QUESTION UNASKABLE FOR ONE FILE, and until it did this
// file was the reason the sweep's verdicts meant nothing.
//
// scripts/mutate.mjs replaces a needle's text and then runs the suite. run-all discovers
// this file, this file failed because the needle it demands had just been deleted, and
// mutate read any non-zero exit as CAUGHT — for 113 of 117 properties, whether or not
// anything else tested them. The check's PASS condition was being satisfied by the thing
// being broken, which is the failure this repo names in two files and which I then built.
//
// So the stand-down is scoped to the file mutate names, not to the whole run: a stale
// needle in any OTHER file still fails loudly during a sweep. What is given up is narrow
// and stated — a mutation of one file also hides a genuinely stale needle in that same
// file, for the duration of that one mutation. Every push-time run has GAUNTLET_MUTATION
// unset and checks all 117.
const MUTATING = process.env.GAUNTLET_MUTATION || null
let stoodDown = 0

let duplicated = 0
for (const [name, file, find] of entries) {
  let body
  try { body = read(file) } catch { fail(`${JSON.stringify(name)} targets ${file}, which does not exist`); continue }
  const n = body.split(find).length - 1
  if (n === 0 && MUTATING && resolve(ROOT, file) === resolve(MUTATING)) {
    stoodDown++
  } else if (n === 0) {
    fail(`${JSON.stringify(name)}: ${file} no longer contains the text this property mutates, so the sweep cannot test it at all — ${JSON.stringify(find.length > 80 ? find.slice(0, 80) + '…' : find)}`)
  } else if (n > 1) {
    // REPORTED, NOT FAILED. mutate.mjs replaces the first occurrence, so more than one is a
    // hazard — the first might be a comment. It is not a defect on its own: three
    // properties have matched twice for a long time and the sweep reports every one of them
    // CAUGHT, which is the measurement this file cannot make.
    duplicated++
  }
}
if (stoodDown) {
  console.log(`          ${stoodDown} needle(s) in ${MUTATING} stood down: a mutation of that file is in flight, so their absence is expected rather than stale.`)
  console.log('          Every other file was still checked, and a push-time run checks all of them.')
}
if (duplicated) console.log(`          ${duplicated} needle(s) match more than once; mutate replaces the first. Not a failure — the sweep reports whether each is still caught.`)

console.log('sweep-needles: stating what this suite cannot establish')
console.log('          NOT MEASURED: whether mutating a needle is still CAUGHT. A property can point at')
console.log('          live code and be tested by nothing. Only scripts/coverage-sweep.mjs answers that,')
console.log('          by applying the mutation and requiring the suite to go red — which is why it still')
console.log('          runs on a schedule and why this file is not a replacement for it.')

if (failures) {
  console.error(`\nsweep-needles: ${failures} pinned propert(ies) cannot be tested — the sweep will report them COULD NOT RUN and exit 1.`)
  process.exit(1)
}
console.log(`\nsweep-needles: OK — ${entries.length} properties, every one still pointing at live code.`)
