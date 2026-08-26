// THE REPRODUCIBLE for #46 option 5 — the sweep's verdict has no reader, and this
// is the reader.
//
//   node test/sweep-status.test.mjs
//
// WHAT IS BEING CHECKED, AND WHY IT IS NOT THE OBVIOUS THING. The easy test here
// would be "does it print the last conclusion", which passes on a script that
// prints an all-clear whenever anything goes wrong — and a reader that says
// nothing-to-see when it could not ask is worse than no reader, because the
// operator now believes something. That is this project's own rule: a check whose
// PASS condition is satisfied by the thing being broken measures nothing. So the
// cases below are built as inputs that SHOULD break it:
//
//   - gh absent (PATH stripped)          -> must say it could not ask
//   - gh present and failing (fake gh)   -> must say it could not ask
//   - gh printing garbage (fake gh)      -> must say it could not ask, not crash
//   - a cancelled run                    -> must NOT read as a pass (#46 S6: a
//                                           cancelled run is no verdict at all)
//
// and in every one of them the all-clear token must be ABSENT.
//
// THE RESIDUAL IS ASSERTED ON EVERY BRANCH. `CLAUDE.md`: a limitation printed only
// when nothing is being asserted is printed exactly when it does not matter. The
// green branch is the one that most needs it, because the instance #46 was filed
// on was a GREEN run carrying two defects.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = join(ROOT, 'scripts', 'sweep-status.mjs')

let failures = 0
const ok = (cond, m) => { if (cond) console.log(`  ok    ${m}`); else { console.error(`  FAIL  ${m}`); failures++ } }

const { render, CLEAR_TOKEN, RESIDUAL_MARK } = await import(SCRIPT)

const HEAD = 'a'.repeat(40)
const OTHER = 'b'.repeat(40)

// ---------------------------------------------------------------------------
// Every branch, rendered once, then asserted against.
// ---------------------------------------------------------------------------
const BRANCHES = {
  unavailable: render({ status: 'unavailable', reason: 'gh not found' }, HEAD),
  none:        render({ status: 'none' }, HEAD),
  noVerdict:   render({ status: 'no-verdict', conclusion: 'cancelled', run: '111', sha: HEAD, when: '2026-08-26T00:00:00Z' }, HEAD),
  failure:     render({ status: 'failure', conclusion: 'failure', run: '222', sha: HEAD, when: '2026-08-26T00:00:00Z' }, HEAD),
  successHead: render({ status: 'success', conclusion: 'success', run: '333', sha: HEAD, when: '2026-08-26T00:00:00Z' }, HEAD),
  successOld:  render({ status: 'success', conclusion: 'success', run: '444', sha: OTHER, when: '2026-08-26T00:00:00Z' }, HEAD),
}

console.log('sweep-status: the all-clear is reserved for a run that actually passed on this tree')
ok(BRANCHES.successHead.includes(CLEAR_TOKEN), 'a successful run on this commit prints the all-clear')
for (const name of ['unavailable', 'none', 'noVerdict', 'failure', 'successOld']) {
  ok(!BRANCHES[name].includes(CLEAR_TOKEN),
     `${name} does not print the all-clear — it would be an all-clear the evidence does not support`)
}

console.log('sweep-status: the residual is stated on every branch, not only when it is convenient')
for (const [name, text] of Object.entries(BRANCHES)) {
  ok(text.includes(RESIDUAL_MARK), `${name} states its residual`)
}

console.log('sweep-status: a red run says which two findings it cannot tell apart')
ok(BRANCHES.failure.includes('222'), 'the failing run is named, so it can be opened')
ok(BRANCHES.failure.includes('NOT CAUGHT') && BRANCHES.failure.includes('COULD NOT RUN'),
   'the red branch names both findings the exit code conflates — one bit cannot distinguish them (#46 S8)')

console.log('sweep-status: a verdict about another commit is not a verdict about this one')
ok(/no sweep verdict of its own/i.test(BRANCHES.successOld),
   'a run against a different commit says this tip has no verdict of its own (#46 S6)')
ok(!/no sweep verdict of its own/i.test(BRANCHES.successHead),
   'a run against THIS commit does not claim the tip is unswept — otherwise the line is decoration')

console.log('sweep-status: a cancelled run is not a pass and not a failure')
ok(/no verdict/i.test(BRANCHES.noVerdict), 'a cancelled run is reported as no verdict')

// ---------------------------------------------------------------------------
// The integration cases. These run the real script against a real broken
// environment rather than asking render() a question.
// ---------------------------------------------------------------------------
function runWith(env) {
  return spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', env: { ...process.env, ...env }, timeout: 30_000 })
}

console.log('sweep-status: an environment that cannot answer is reported, never assumed clean')
{
  const r = runWith({ PATH: '' })
  ok(r.status === 0, `gh missing exits 0 rather than failing the session start (got ${r.status})`)
  ok(String(r.stdout).includes('COULD NOT ASK'), 'gh missing says it could not ask')
  ok(!String(r.stdout).includes(CLEAR_TOKEN), 'gh missing does not print the all-clear')
}

const shim = mkdtempSync(join(tmpdir(), 'sweep-status-'))
try {
  const write = body => {
    writeFileSync(join(shim, 'gh'), `#!/bin/sh\n${body}\n`)
    chmodSync(join(shim, 'gh'), 0o755)
  }

  write('echo "gh: not authenticated" >&2\nexit 1')
  {
    const r = runWith({ PATH: `${shim}:${process.env.PATH}` })
    ok(r.status === 0 && String(r.stdout).includes('COULD NOT ASK'), 'a gh that fails says it could not ask')
    ok(!String(r.stdout).includes(CLEAR_TOKEN), 'a gh that fails does not print the all-clear')
  }

  write('echo "<!DOCTYPE html>"')
  {
    const r = runWith({ PATH: `${shim}:${process.env.PATH}` })
    ok(r.status === 0 && String(r.stdout).includes('COULD NOT ASK'), 'a gh that prints non-JSON says it could not ask rather than crashing')
    ok(!String(r.stdout).includes(CLEAR_TOKEN), 'a gh that prints non-JSON does not print the all-clear')
  }

  write('echo "[]"')
  {
    const r = runWith({ PATH: `${shim}:${process.env.PATH}` })
    ok(r.status === 0 && !String(r.stdout).includes(CLEAR_TOKEN), 'no runs at all is not an all-clear')
  }
} finally {
  rmSync(shim, { recursive: true, force: true })
}

// ---------------------------------------------------------------------------
// THE WIRING. A reader nothing invokes is the defect this repository has been
// walking since #42, so the trigger is asserted and not assumed: the project's
// SessionStart hook must name this script, and the script it names must exist.
// ---------------------------------------------------------------------------
console.log('sweep-status: the trigger exists, and names a script that exists')
{
  const SETTINGS = join(ROOT, '.claude', 'settings.json')
  let cfg = null
  try { cfg = JSON.parse(readFileSync(SETTINGS, 'utf8')) } catch (e) { cfg = null }
  ok(cfg !== null, `.claude/settings.json parses — a malformed settings file silently disables every setting in it (${SETTINGS})`)

  const commands = (cfg?.hooks?.SessionStart ?? []).flatMap(g => g.hooks ?? []).filter(h => h.type === 'command').map(h => h.command)
  ok(commands.some(c => c.includes('scripts/sweep-status.mjs')),
     'a SessionStart command hook invokes scripts/sweep-status.mjs — without it this file tests a reader nobody reads')
  ok(existsSync(SCRIPT), 'the script the hook names is present in the tree')
}

console.log('sweep-status: stating what this file does NOT establish')
console.log('          NOT MEASURED: that the hook FIRES. That happens at session start, outside this')
console.log('          process, and depends on the operator trusting this project\'s settings. What is')
console.log('          checked here is that the wiring names a script that exists and that the script')
console.log('          refuses to invent an all-clear. Whether anyone acts on the line it prints is')
console.log('          #46 option 4, and no check can carry that.')

if (failures) {
  console.error(`\nsweep-status: ${failures} failure(s) — the reader is claiming more than it knows.`)
  process.exit(1)
}
console.log('\nsweep-status: OK — the all-clear is earned, the residual is on every branch, and an unanswerable environment says so.')
