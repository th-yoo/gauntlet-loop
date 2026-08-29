// The guard's own facts are checked by something, and the guard says what it
// cannot check.
//
//   node test/guard-sweep.test.mjs
//
// ISSUE 3. drift-guard's FILE surface is discovered — a new agent definition, a
// new comparer lane, a new script are found by reading the directory. Its FACTS
// are five hand-written lists, and a list has no way to say what is not on it.
// Two things were missing and both are here:
//
//   1. Nothing measured whether a given entry still BITES. An entry that has
//      quietly stopped firing looks exactly like one that never needed to, and
//      everything stays green. scripts/guard-sweep.mjs breaks each entry's
//      subject and requires drift-guard to fail AND to name that entry.
//   2. The guard never stated what it does not cover. It does now, on both
//      branches — and a residual that can be deleted without failing a test is
//      not a residual, which is why this file asserts it.
//
// WHAT THIS DOES NOT CLAIM, and it is the half issue 3 cannot close: that the
// lists are COMPLETE. Every entry biting says nothing about the entry nobody
// wrote. No instrument here can enumerate the sentences that were never pinned.
//
// NOTHING HERE SPAWNS A MODEL. The subprocesses are `node` running drift-guard
// and the sweep, which is why the suite can reach them.

import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { RUNTIME_FORBIDDEN, CAP_NAMES, LOOP_PINNED, LOOP_DISCLOSURES, COMPARER_CONTRACT, CONTRACT_STATED } from './drift-facts.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }

console.log('guard-sweep: the facts live where an instrument can enumerate them')
{
  ok(existsSync(join(ROOT, 'test', 'drift-facts.mjs')), 'test/drift-facts.mjs exists')
  const guard = readFileSync(join(ROOT, 'test', 'drift-guard.mjs'), 'utf8')
  ok(/from '\.\/drift-facts\.mjs'/.test(guard),
     "drift-guard no longer imports its facts from drift-facts.mjs — if the lists move back inline, nothing can enumerate them and the sweep silently measures a stale copy")
  const sweep = join(ROOT, 'scripts', 'guard-sweep.mjs')
  ok(existsSync(sweep), 'scripts/guard-sweep.mjs exists — without it, every entry below is unmeasured')
}

// --------------------------------------------------------------------------
// THE RESIDUAL, and its number RECOMPUTED rather than read back. A count printed
// beside the lists is a fact derivable from them, and this repository's standing
// rule is that a derivable fact stored beside its source must be recomputed and
// fail on disagreement — storing it and reading it back is not a check.
// --------------------------------------------------------------------------
console.log('guard-sweep: drift-guard states what it does not cover, with a live count')
{
  const expected = RUNTIME_FORBIDDEN.length + CAP_NAMES.length + LOOP_PINNED.length +
    LOOP_DISCLOSURES.length + COMPARER_CONTRACT.length + CONTRACT_STATED.length
  const r = spawnSync(process.execPath, ['test/drift-guard.mjs'], { cwd: ROOT, encoding: 'utf8', timeout: 60_000 })
  const out = String(r.stdout || '') + String(r.stderr || '')
  ok(r.status === 0, 'drift-guard passes on the tree as it stands (otherwise the assertions below read a failing run)')
  ok(/NOT ESTABLISHED/.test(out),
     'drift-guard prints no residual — a guard that never says what it cannot check reads as though it checks everything')
  ok(out.includes(`${expected} facts`),
     `drift-guard's residual does not name ${expected} facts, which is what the lists actually hold — a hand-maintained count drifts from the lists it describes, which is issue 3 one level in`)
  console.log(`          residual present, and its count matches the ${expected} entries actually in the lists`)
}

// --------------------------------------------------------------------------
// EVERY ENTRY MUST STILL BITE. This is the check that makes a new fact carry its
// weight: add a list entry that nothing can break, and the sweep reports it
// SURVIVED and this test goes red.
// --------------------------------------------------------------------------
console.log('guard-sweep: every hand-written fact still fails the guard when broken')
{
  const r = spawnSync(process.execPath, ['scripts/guard-sweep.mjs'], { cwd: ROOT, encoding: 'utf8', timeout: 600_000 })
  const out = String(r.stdout || '') + String(r.stderr || '')
  const m = out.match(/(\d+) entries — (\d+) caught, (\d+) survived, (\d+) red but unnamed, (\d+) inert/)
  if (!m) {
    fail(`the sweep produced no summary line — it did not run to completion:\n${out.split('\n').slice(-6).join('\n')}`)
  } else {
    const [, total, caught, survived, unnamed, inert] = m.map(Number)
    console.log(`          ${total} entries — ${caught} caught, ${survived} survived, ${unnamed} red but unnamed, ${inert} inert`)
    ok(total > 0, 'the sweep examined at least one entry — a sweep that measures nothing cannot fail informatively')
    ok(survived === 0,
       `${survived} entr(ies) survived being broken: drift-guard stayed green with the property they pin removed. Those entries are decoration.`)
    ok(unnamed === 0,
       `${unnamed} entr(ies) made drift-guard go red without naming them. The property is covered by something, but not by the entry — so the entry cannot be maintained, and the failure cannot be traced to it.`)
    ok(inert === 0,
       `${inert} entr(ies) could not be broken at all: the string they pin is not in the subject, so the entry is already dead.`)
    const red = out.match(/(\d+) are REDUNDANT/)
    if (red) console.log(`          ${red[1]} redundant (another check names the property with the entry deleted)`)
  }
}

console.log('guard-sweep: stating what this cannot establish')
console.log('          NOT MEASURED: whether the lists are COMPLETE. Every entry biting says nothing')
console.log('          about the entry nobody wrote, and no instrument here can enumerate those.')
console.log('          NOT MEASURED: whether an entry pins the RIGHT property. The sweep shows the')
console.log('          guard notices when it is broken, never that it was worth pinning.')

if (failures) {
  console.error(`\nguard-sweep: ${failures} failure(s) — a hand-written list nothing audits is a coverage claim nobody checked.`)
  process.exit(1)
}
console.log('\nguard-sweep: OK — facts enumerable, residual stated with a live count, every entry bites.')
