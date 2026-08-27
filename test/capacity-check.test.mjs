// THE REPRODUCIBLE for issue 50: a design that could only produce one answer.
//
//   node test/capacity-check.test.mjs
//
// A pre-registration fixes what a result will MEAN before the result is known.
// It does nothing about a design that could only have produced one outcome, and a
// pre-registered reading of an uninformative design is still uninformative.
//
// WHY THIS DOES NOT CHECK THE PROSE, which was the obvious build and is the wrong
// one. The run issue 50 cites — docs/runs/2026-08-26-pairing-stability.md — states
// its own capacity in its own words, at line 90: "it did not come back against its
// author, AND IT COULD HAVE." That sentence is exactly what the issue disputes,
// and a check requiring it would have passed the very run that motivated the
// issue. A capacity claim written by the author of the design is the thing under
// suspicion, so the question is put to the LEDGER instead: across every row the
// design produced, did this field ever take a second value?
//
// WHAT IT CANNOT DO, stated here because the issue's own framing is pre-run: this
// reads capacity that was OBSERVED, after the fact. Whether a design COULD have
// disagreed is not decidable from a design description. Issue 50's pre-run half
// stays open; what this closes is the ability to skip the post-hoc half.
//
// NOTHING HERE SPAWNS.

import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }

const run = (env = {}) => {
  const r = spawnSync(process.execPath, ['scripts/capacity-check.mjs'],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env }, timeout: 120_000 })
  return { status: r.status, out: String(r.stdout || '') + String(r.stderr || '') }
}

console.log('capacity-check: every constant in every ledger is accounted for')
{
  const r = run()
  const m = r.out.match(/(\d+) ledger\(s\), (\d+) unexplained constant\(s\)/)
  ok(m, 'the check produced its summary line')
  if (m) {
    console.log(`          ${m[1]} ledger(s), ${m[2]} unexplained`)
    ok(Number(m[2]) === 0,
       `${m[2]} field(s) took exactly one value across their ledger with nothing on record saying what that means. A claim resting on such a field varying is a claim the batch could not have contradicted — which is issue 50's mechanism, in this repository's own evidence.`)
  }
  ok(r.status === 0, 'and the check passes')
}

console.log('capacity-check: it can still FAIL — the adjudications are load-bearing')
{
  // WITHOUT THIS CASE the check above is satisfied by a check that never fires.
  // Pointing it at an empty adjudication file must bring back every constant.
  const r = run({ CAPACITY_ADJUDICATIONS: join(ROOT, 'test', 'no-such-adjudications.jsonl') })
  ok(r.status !== 0,
     'with no adjudications on file the check still passed — then it is not reading them, and a green run says nothing')
  const m = r.out.match(/(\d+) unexplained constant\(s\)/)
  ok(m && Number(m[1]) > 0,
     'and it reported no unexplained constants either, so the detection itself is inert')

  // THE FIELD BRANCH SPECIFICALLY, and the first version of this case did not
  // reach it. The check has two ways to report: a whole LEDGER too small to vary,
  // and an individual FIELD that never varied. Asking only for a non-zero exit is
  // satisfied by the ledger branch alone — so disabling field detection entirely
  // left this passing, twice, under two different mutations. A check with two
  // paths needs a case per path, or one path is decoration.
  const fieldLines = r.out.split('\n').filter(l => /one value across \d+ rows/.test(l))
  ok(fieldLines.length > 0,
     'no FIELD-level constant was reported with adjudications withheld — the per-field detection is inert, and the non-zero exit above came from the ledger-size branch alone')
  const ledgerLines = r.out.split('\n').filter(l => /the LEDGER never varied/.test(l))
  ok(ledgerLines.length > 0,
     'no LEDGER-level finding was reported either — the two branches are checked separately because either can be disabled while the other keeps the exit code red')
  console.log(`          with adjudications withheld: ${m[1]} unexplained — ${fieldLines.length} field-level, ${ledgerLines.length} ledger-level`)
}

console.log('capacity-check: the adjudications say what the constant COSTS, not merely that it exists')
{
  const path = join(ROOT, 'docs', 'capacity-adjudications.jsonl')
  ok(existsSync(path), 'docs/capacity-adjudications.jsonl exists')
  if (existsSync(path)) {
    const rows = readFileSync(path, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
    ok(rows.length > 0, 'it has entries')
    for (const a of rows) {
      ok(a.ledger && a.field, 'each entry names a ledger and a field')
      ok(a.verdict, `${a.ledger} ${a.field}: no verdict`)
      // A REASON, not a shrug. "Constant by design" with nothing after it is the
      // rubber stamp this whole check exists to avoid becoming.
      ok(a.why && a.why.length > 120,
         `${a.ledger} ${a.field}: the reason is ${a.why ? a.why.length : 0} characters. An adjudication that does not say what the constant costs is a rubber stamp, and a rubber stamp is worse than no check because it looks like one.`)
    }
    console.log(`          ${rows.length} adjudication(s), each naming a ledger, a verdict and a reason`)
  }
}

console.log('capacity-check: the residual is stated on the passing branch')
{
  const r = run()
  ok(/NOT ESTABLISHED/.test(r.out),
     'the check prints no residual when it passes — a limitation printed only on failure is printed exactly when it does not matter')
  ok(/OBSERVED/.test(r.out),
     'and it does not distinguish observed capacity from design capacity, which is the half of issue 50 it cannot close')
}

console.log('capacity-check: stating what this cannot establish')
console.log('          NOT ESTABLISHED: whether a design COULD have disagreed, before it ran. That is')
console.log('          not decidable from a design description, and the run issue 50 cites asserts its')
console.log('          own capacity in prose while its pairings were chosen for clarity.')
console.log('          NOT ESTABLISHED: that a VARIED field makes a claim sound. Variation only makes')
console.log('          unfalsifiable-by-construction less likely; it is necessary, never sufficient.')
console.log('          NOT COVERED: measurements with no ledger. The pairing run that motivated issue')
console.log('          50 lives in prose alone, so nothing here can reach it — which is its own finding.')

if (failures) {
  console.error(`\ncapacity-check: ${failures} failure(s) — a design that could only answer one way is not evidence, whatever was pre-registered about it.`)
  process.exit(1)
}
console.log('\ncapacity-check: OK — constants enumerated from the ledgers, each adjudicated with a cost, residual stated.')
