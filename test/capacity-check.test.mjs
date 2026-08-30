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
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REAL_ADJ = join(ROOT, 'docs', 'capacity-adjudications.jsonl')
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

console.log('capacity-check: constants inside a COHORT are found, not only whole-ledger ones')
{
  // WITHOUT THIS the cohort pass can be deleted and everything still passes — a
  // mutation removing it survived the first version of this file. It is the pass
  // that reaches issue 50's own instance: `correct` is true on all 48 rows of
  // oracle/results.jsonl carrying a `pairing`, while varying across the whole
  // ledger. A whole-ledger scan cannot see that, and the pairing run is precisely
  // a subset.
  const r = run({ CAPACITY_ADJUDICATIONS: join(ROOT, 'test', 'no-such-adjudications.jsonl') })
  const cohortLines = r.out.split('\n').filter(l => /a distinct experiment inside this ledger/.test(l))
  ok(cohortLines.length > 0,
     'no cohort was reported with adjudications withheld — a constant that holds inside a subset is invisible to a whole-ledger scan, and the run issue 50 cites IS a subset')
  console.log(`          ${cohortLines.length} cohort(s) detected`)
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

console.log('capacity-check: the residual is stated on the passing branch, and it is THE residual')
{
  const r = run()
  ok(/NOT ESTABLISHED/.test(r.out),
     'the check prints no residual when it passes — a limitation printed only on failure is printed exactly when it does not matter')
  ok(/OBSERVED/.test(r.out),
     'and it does not distinguish observed capacity from design capacity, which is the half of issue 50 it cannot close')
  // PINNED BY SENTENCE, not by the section heading — issue 50's pre-run half is held
  // by these words and nothing else, so a residual paragraph that kept its header and
  // lost its content would still pass a /NOT ESTABLISHED/ match. The claims, each its
  // own anchor: pre-run capacity is undecidable from a description; the author's own
  // capacity claim is the thing under suspicion; and variation does not make a claim
  // sound, it only makes unfalsifiable-by-construction less likely.
  ok(/Whether a design COULD have disagreed is not decidable from a design/.test(r.out),
     'the pre-run half is stated: capacity before the run is not decidable from the design description')
  ok(/written by the design's author is the/.test(r.out),
     'and why a stated capacity sentence cannot close it: the author\'s claim is the thing under suspicion')
  ok(/does not make a claim sound/.test(r.out),
     'and the varied-field caveat: variation is necessary for falsification, never sufficient for soundness')
}

console.log('capacity-check: stating what this cannot establish')
console.log('          NOT ESTABLISHED: whether a design COULD have disagreed, before it ran. That is')
console.log('          not decidable from a design description, and the run issue 50 cites asserts its')
console.log('          own capacity in prose while its pairings were chosen for clarity.')
console.log('          NOT ESTABLISHED: that a VARIED field makes a claim sound. Variation only makes')
console.log('          unfalsifiable-by-construction less likely; it is necessary, never sufficient.')
console.log('          NOT COVERED: measurements that emit no ledger at all. This scans every tracked')
console.log('          .jsonl, so the reach is whatever has been written down; a run recorded only in')
console.log('          prose is invisible to it, and nothing here can tell you such a run exists.')
const STALE_WHY = 'a stale adjudication naming a subject that exists nowhere, written at full length so the rubber-stamp floor cannot be what rejects it — the question under test is whether anything notices that this row excuses nothing'

console.log('capacity-check: an adjudication that excuses nothing is reported, not counted')
{
  // BUILT: a row naming a ledger and a field that exist nowhere. Every version of
  // this check before it accepted the row and stayed green, and so did the other
  // two adjudication files in this repository — the accounting counted a reading
  // that had no subject. The first probe LOOKED caught, because the rubber-stamp
  // length floor fired on a short `why`; this one is written long enough that
  // only the staleness can reject it.
  const dir = mkdtempSync(join(tmpdir(), 'capacity-stale-'))
  const f = join(dir, 'adjudications.jsonl')
  const real = existsSync(REAL_ADJ) ? readFileSync(REAL_ADJ, 'utf8').trimEnd() + '\n' : ''
  writeFileSync(f, real + JSON.stringify({ ledger: 'runs/no-such-ledger.jsonl', field: 'invented_field', verdict: 'accepted', why: STALE_WHY }) + '\n')
  const r = run({ CAPACITY_ADJUDICATIONS: f })
  ok(/UNSPENT ADJUDICATION\s+runs\/no-such-ledger\.jsonl invented_field/.test(r.out),
     `an adjudication for a ledger and field that do not exist was not reported: ${JSON.stringify(r.out.split('\n').filter(l => /ADJUDICATION|unexplained/.test(l)).slice(0, 3))}`)
  ok(r.status !== 0, 'the stale adjudication was reported but the check still passed — a finding nothing acts on is a comment')

  // AND A ROW WITH NO READABLE KEY, which every earlier version dropped inside a
  // catch. Invisible to every lookup, so it can never be spent and could never be
  // reported either.
  writeFileSync(f, real + JSON.stringify({ verdict: 'accepted', why: STALE_WHY }) + '\n')
  const r2 = run({ CAPACITY_ADJUDICATIONS: f })
  ok(/UNREADABLE ADJUDICATION/.test(r2.out), 'a row with neither ledger nor field was dropped in silence')
  ok(r2.status !== 0, 'an unreadable adjudication left the check green')

  // AND IT STAYS QUIET when every row matches, or every run is a finding.
  if (real) {
    writeFileSync(f, real)
    const r3 = run({ CAPACITY_ADJUDICATIONS: f })
    ok(!/UNSPENT ADJUDICATION|UNREADABLE ADJUDICATION/.test(r3.out),
       'the tracked adjudications reported themselves as unspent — then every consumer sees a finding on every run and the report means nothing')
  }
}


if (failures) {
  console.error(`\ncapacity-check: ${failures} failure(s) — a design that could only answer one way is not evidence, whatever was pre-registered about it.`)
  process.exit(1)
}
console.log('\ncapacity-check: OK — constants enumerated from the ledgers, each adjudicated with a cost, residual stated.')
