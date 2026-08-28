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
// RC3 — one script in `scripts/` spawns a live model and must never run on a
//   runner. `run-all` sets GAUNTLET_SUITE=1 on every descendant and
//   `test/containment.test.mjs` asserts the refusal, so this is already mechanical.
//   What this checks is that the workflow does not weaken it.
//
//   The spawner is DISCOVERED here, never named. test/containment.test.mjs forbids
//   any file under test/ from containing its stem at all — even in a comment —
//   because a mutation sweep runs these files and this repo once reached spawn
//   depth 13. Deriving it also means a second spawner added later is covered
//   without this file being edited.

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { isInert } from './inert-binaries.mjs'
import { namesAModel } from '../scripts/model-shaped.mjs'

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

// COMMENTS ARE STRIPPED BEFORE ANY ASSERTION READS THE FILE.
//
// Without this, prose satisfies every check below: a workflow explaining that a
// model-spawner must never run would be flagged AS running it, and a comment merely
// naming sqlite3 would satisfy the toolchain requirement. Both directions are wrong
// and the second is the dangerous one — it passes.
//
// This is the third time this defect has appeared here. 65fc73f fixed it in
// containment; the same scan in drift-guard was counting an `eq(` written inside a
// comment as an assertion until it was fixed today. A rule that keeps recurring in
// new scans is a rule the next scan will need too.
//
// A `#` inside a quoted YAML scalar would be over-stripped. No value in this file
// contains one, and the failure mode is a false FAIL — loud, not silent.
function stripYamlComments(src) {
  return src.split('\n').map(l => l.replace(/(^|\s)#.*$/, '$1')).join('\n')
}

if (wf) {
  const text = stripYamlComments(wf.text)

  console.log('ci-workflow: it triggers without anyone remembering')
  ok(/^\s*(on:|"on":)/m.test(text), `${wf.f} has no trigger block`)
  ok(/\bpush\b/.test(text), `${wf.f} does not trigger on push — a workflow that runs only by hand is the state #44 is about`)

  console.log('ci-workflow: the runtime is pinned, not floating')
  // A floating runtime turns an unrelated upstream release into a red suite, which
  // is the other way CI gets switched off.
  ok(/node-version:\s*['"]?\d/.test(text), `${wf.f} does not pin a node-version — an unpinned runtime makes an upstream release look like a defect here`)

  console.log('ci-workflow: every binary the corpus needs is guaranteed')
  console.log(`          derived from oracle/corpus.jsonl: ${NEEDED.join(', ') || '(none)'}`)
  // MATCHED AGAINST THE REQUIRED LIST, not against the file. Scanning the whole
  // workflow passed on the step's own success message: removing sqlite3 from the
  // verification loop left `echo "toolchain present: ... sqlite3"` behind, and the
  // check went green against a string that verifies nothing. Caught by mutation,
  // not by reading — a guard satisfied by a message is the same defect as one
  // satisfied by a comment.
  const required = (text.match(/REQUIRED="([^"]*)"/) || [, ''])[1].split(/\s+/).filter(Boolean)
  console.log(`          workflow verifies: ${required.join(', ') || '(nothing)'}`)
  if (!required.length) {
    fail(`${wf.f} has no REQUIRED="..." toolchain list — nothing in it checks that the runner can execute the corpus acceptance commands`)
  }
  for (const bin of NEEDED) {
    if (!required.includes(bin)) {
      fail(`${wf.f} does not verify "${bin}", which oracle-report runs when it re-checks a corpus acceptance command — a workflow missing it goes red for something that is not a defect, and a CI that cries wolf gets switched off`)
    }
  }

  console.log('ci-workflow: it does not weaken the model-spawn containment')
  ok(!/GAUNTLET_SUITE\s*:\s*['"]?0/.test(text), `${wf.f} sets GAUNTLET_SUITE=0 — that is the flag test/containment.test.mjs relies on to keep a live model from being spawned on a runner`)
  // The stems are read off disk, so this file never contains one.
  //
  // ISSUE #61: this asked "is the binary model-shaped" against a private regex
  // that knew ONE name, under a comment claiming parity with containment — parity
  // that ended at #55, when containment inverted to "is this binary known INERT".
  // Measured before changing it: a spawner whose binary was `codex` left the count
  // here unchanged, and so did one called `nimbusrun`, while containment caught
  // both. The other route — reusing the shared name list — cannot catch
  // `nimbusrun` either, and must not: that name is in the negative arm #57 asserts
  // never matches, so widening the list would destroy the crossing that proves it
  // discriminates.
  //
  // So the rule is containment's, from the module they now share: a binary nobody
  // has vouched for is a candidate spawner. An unknown runner fails CLOSED here.
  const SPAWN_CALL = /\b(spawnSync|spawn|execFileSync|execFile|execSync|exec)\s*\(\s*['"`]([^'"`\n]+)['"`]/g
  const spawnerStems = readdirSync(join(ROOT, 'scripts'))
    .filter(f => f.endsWith('.mjs'))
    .filter(f => [...readFileSync(join(ROOT, 'scripts', f), 'utf8').matchAll(SPAWN_CALL)]
                   .some(m => !isInert(m[2])))
    .map(f => f.replace(/\.mjs$/, ''))
  console.log(`          model-spawners discovered in scripts/: ${spawnerStems.length}`)
  if (!spawnerStems.length) {
    // A scan matching nothing cannot fail informatively — containment's own lesson.
    console.log('          (none found: either there are none, or the discovery pattern has gone blind)')
  }
  // A SCAN THAT FINDS NOTHING CANNOT FAIL INFORMATIVELY, and this one used to say
  // so in a console.log and pass anyway — so disabling the discovery entirely left
  // the workflow assertion below iterating an empty list, green, checking nothing.
  // That is the zero-result branch #55 named in containment, live here. There are
  // model-spawners in scripts/; if that ever stops being true, this line is what
  // tells you to delete the check rather than keep trusting it.
  ok(spawnerStems.length > 0,
     'no model-spawner was discovered in scripts/, so the workflow assertion below iterates an empty list and establishes nothing. Either the discovery has gone blind, or the spawners are gone and this check should be removed rather than left reporting success.')
  for (const stem of spawnerStems) {
    ok(!new RegExp(`(^|[^A-Za-z0-9_-])${stem}([^A-Za-z0-9_-]|$)`).test(text),
       `${wf.f} references the model-spawner "${stem}" — it must never run on a runner`)
  }
  // A DIFFERENT QUESTION FROM THE ONE ABOVE, and it takes the other rule. That
  // scan asks which SCRIPTS are candidate spawners, where an unknown binary must
  // fail closed. This asks whether the workflow TEXT names a model runner, which
  // is what scripts/model-shaped.mjs is for and what #57 crossed against a
  // 13-name battery with a negative arm. Neither is a private copy now.
  ok(!namesAModel(text), `${wf.f} names a model binary — no workflow here should invoke one`)
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
