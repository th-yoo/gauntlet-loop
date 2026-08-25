// THE REPRODUCIBLE for #44 — nothing runs the suite on a second machine.
//
//   node test/ci-workflow.test.mjs
//
// #43's pre-push gate runs on the machine that wrote the code. It cannot, in
// principle, catch a defect whose whole nature is "works here, nowhere else" —
// and this repo has shipped exactly one of those: `ebb630a`, where all 14
// `oracle/corpus.jsonl` rows stored an absolute path from the authoring machine.
// On a second machine the suite was red and `oracle-report` exited 1; on the first
// every check was green. No local diligence would have found it.
//
// WHAT THIS FILE CAN AND CANNOT PROVE. It cannot run a second machine, so it does
// not assert that the suite passes there — only CI can, by doing it. What it
// asserts is that the thing which WOULD run there exists and is aimed correctly.
// The distinction is stated again at the bottom, on the branch carrying the verdict.
//
// A clone at a different absolute path was measured passing before this file was
// written (exit 0), so a local foreign-path check would be a regression guard, not
// a reproducible — it could not fail. It is deliberately not built: it would add
// ~28s to every run to re-prove something already true, and CI supplies a genuinely
// foreign machine rather than a foreign directory.
//
// Three root causes.
//
// RC1 — no workflow exists. `.github/` is absent, so the suite has run in exactly
//   one place for the life of the repo.
//
// RC2 — the suite needs a toolchain. `oracle-report` re-runs every corpus
//   acceptance command, and those shell out to compilers and interpreters. A
//   workflow missing one goes red for a reason that is not a defect, and a CI that
//   cries wolf is switched off — which returns the repo to RC1 with extra steps.
//   The required set is DERIVED from the corpus below, not hardcoded, so a row
//   added later that needs a new binary fails this check instead of failing CI.
//
// RC3 — `oracle-draw` spawns a live model and must never run on a runner.
//   `run-all` sets GAUNTLET_SUITE=1 on every descendant and
//   `test/containment.test.mjs` asserts the refusal, so this is already mechanical.
//   What this checks is that the workflow does not weaken it.

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WF_DIR = join(ROOT, '.github', 'workflows')

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, msg) => { if (!cond) fail(msg) }

// Binaries every POSIX runner has. Anything outside this that a corpus row needs
// has to be guaranteed by the workflow explicitly.
const ASSUMED_PRESENT = new Set([
  'cd', 'test', 'rm', 'sh', 'grep', 'tr', 'printf', 'echo', 'cat', 'true', 'false',
  'mkdir', 'cp', 'mv', 'set', 'exit', '[',
])

// DERIVED, not asserted. Each acceptance command is split on the shell operators
// that start a new command, and the first word of each segment is the binary it
// runs. If a row is added tomorrow that needs something new, this list grows by
// itself and the assertion below starts failing here rather than on a runner.
function requiredBinaries() {
  const rows = readFileSync(join(ROOT, 'oracle', 'corpus.jsonl'), 'utf8')
    .split('\n').filter(l => l.trim()).map(l => JSON.parse(l))
  const need = new Set()
  for (const r of rows) {
    const cmd = (r.evidence || {}).acceptance_command
    if (!cmd) continue
    for (const seg of cmd.split(/\|\||&&|\||;/)) {
      const word = seg.trim().split(/\s+/)[0] || ''
      const bin = word.replace(/^\$\(/, '').trim()
      if (!bin || bin.startsWith('"') || bin.startsWith("'") || bin.startsWith('[')) continue
      if (ASSUMED_PRESENT.has(bin)) continue
      if (bin.includes('/')) continue          // a path into the repo, not a system binary
      need.add(bin)
    }
  }
  return [...need].sort()
}

const NEEDED = requiredBinaries()

console.log('ci-workflow: a workflow exists that runs the suite')
let wf = null
if (!existsSync(WF_DIR)) {
  fail('.github/workflows/ is absent — the suite has only ever run on the machine that wrote it, and #43\'s pre-push gate runs there too, so no guard in this repo has ever executed anywhere else')
} else {
  const files = readdirSync(WF_DIR).filter(f => /\.ya?ml$/.test(f))
  ok(files.length > 0, '.github/workflows/ has no workflow file in it')
  const withSuite = files.map(f => ({ f, text: readFileSync(join(WF_DIR, f), 'utf8') }))
                         .filter(x => /node\s+test\/run-all\.mjs/.test(x.text))
  if (!withSuite.length) {
    fail(`no workflow runs \`node test/run-all.mjs\` — ${files.join(', ') || 'none'} present. A workflow that runs something narrower leaves the rest of the guards where they were.`)
  } else {
    wf = withSuite[0]
    console.log(`          ${wf.f} runs the suite`)
  }
}

if (wf) {
  const text = wf.text

  console.log('ci-workflow: it triggers without anyone remembering')
  ok(/^\s*(on:|"on":)/m.test(text), `${wf.f} has no trigger block`)
  ok(/\bpush\b/.test(text), `${wf.f} does not trigger on push — a workflow that runs only by hand is the state #44 is about`)

  console.log('ci-workflow: the runtime is pinned, not floating')
  // A floating runtime turns an unrelated upstream release into a red suite, which
  // is the other way CI gets switched off.
  ok(/node-version:\s*['"]?\d/.test(text), `${wf.f} does not pin a node-version — an unpinned runtime makes an upstream release look like a defect here`)

  console.log('ci-workflow: every binary the corpus needs is guaranteed')
  console.log(`          derived from oracle/corpus.jsonl: ${NEEDED.join(', ') || '(none)'}`)
  for (const bin of NEEDED) {
    // Either the workflow installs it, or it names it as assumed-present with the
    // runner image that provides it. Silence is what fails.
    if (!new RegExp(`(^|[^A-Za-z0-9_-])${bin}([^A-Za-z0-9_-]|$)`, 'm').test(text)) {
      fail(`${wf.f} never mentions "${bin}", which oracle-report runs when it re-checks a corpus acceptance command — a workflow missing it goes red for something that is not a defect, and a CI that cries wolf gets switched off`)
    }
  }

  console.log('ci-workflow: it does not weaken the model-spawn containment')
  ok(!/GAUNTLET_SUITE\s*:\s*['"]?0/.test(text), `${wf.f} sets GAUNTLET_SUITE=0 — that is the flag test/containment.test.mjs relies on to keep a live model from being spawned on a runner`)
  ok(!/oracle-draw/.test(text), `${wf.f} references oracle-draw, which spawns a live model. It must never run on a runner.`)
  ok(!/\bclaude\b/.test(text), `${wf.f} references the claude binary — no workflow here should invoke a model`)
}

// ---------------------------------------------------------------------------
// THE RESIDUAL, on the branch that carries the verdict.
// ---------------------------------------------------------------------------

console.log('ci-workflow: stating what this suite cannot establish')
console.log('          NOT MEASURED: whether the suite actually passes on a foreign machine.')
console.log('          This file reads a workflow file. Only a run proves the run works, and the first')
console.log('          one is the measurement — if it is red, that is the defect class #44 exists for,')
console.log('          reported by the only instrument that can see it.')

if (failures) {
  console.error(`\nci-workflow: ${failures} failure(s) — nothing runs the suite anywhere but here.`)
  process.exit(1)
}
console.log(`\nci-workflow: OK — the suite runs on push, runtime pinned, ${NEEDED.length} derived binaries guaranteed, containment intact.`)
