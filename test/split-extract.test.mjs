// THE REPRODUCIBLE for issue 21: the loop records its splits and nothing accumulates them.
//
//   node test/split-extract.test.mjs
//
// ISSUE 21 asked for four things. Three were already in loop.js by the time this
// was written, and saying so is part of the fix:
//
//   1. `args.critics` is a run parameter, not a constant        — loop.js:203
//   2. every round records its split and each critic's margin   — loop.js:1449
//   3. every round records the position breakdown               — split.positions[].side
//   4. accumulated across runs, those splits ARE the trials     — NOTHING DID THIS
//
// Without (4) the first three are a diary. p never narrows, and the interval that
// spans "the tunnel buys nothing" (N=1) to "the tunnel is unaffordable" (N=19)
// stays exactly as wide as it was after five trials.
//
// WHAT MAKES THIS WORK AT k=1, which the issue could not have known: #18's
// confirmation arm. A win ARMS the exit; the next round spawns a fresh critic
// against the UNCHANGED artifact with the sides flipped. That is two independently
// spawned judges on identical bytes at opposite positions — a paired q-trial —
// and every armed run produces one at the default k=1, at no extra cost.
//
// THE VERDICTS HERE ARE DRIVEN THROUGH THE STUBBED HARNESS, never hand-written.
// A hand-built history is a structure I invented agreeing with a reader I wrote;
// what must be parsed is the shape loop.js actually emits.
//
// NOTHING HERE SPAWNS.

import { extractTrials, estimate, impliedN, wilson, trialKey } from '../scripts/split-extract.mjs'
import { runLoop } from './harness.mjs'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }
const eq = (got, want, m) => ok(got === want, `${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)

const ARGS = { goal: 'g', candidate: '/x/a.md', reference: '/x/b.md', token: '/t' }
const run = async (rounds, extra = {}) =>
  (await runLoop({ args: { ...ARGS, ...extra }, rounds })).result

console.log('split-extract: an armed-then-confirmed run yields one paired trial')
{
  const v = await run([{ candidateWins: true, gap: 'g', margin: 'clear' },
                       { candidateWins: true, gap: 'g', margin: 'narrow' }])
  const t = extractTrials(v, 'run-1')
  eq(t.length, 1, 'exactly one trial from an arm/confirm pair')
  eq(t[0].kind, 'arm-confirm', 'and it is the paired kind')
  eq(t[0].judges, 2, 'two judges')
  eq(t[0].disagreed, false, 'both picked the candidate, so they agreed')
  // THE SIDES MUST DIFFER, and this is the property that makes the pair worth
  // anything: two judges agreeing from the SAME position would be a weaker
  // observation than two agreeing from opposite ones.
  ok(t[0].sides[0] !== t[0].sides[1],
     `the confirming critic judged from the same side (${t[0].sides.join(',')}) — the pair then cannot separate judge variance from position`)
}

console.log('split-extract: a disarmed run yields a paired trial that DISAGREED')
{
  const v = await run([{ candidateWins: true, gap: 'g', margin: 'clear' },
                       { candidateWins: false, gap: 'still short', margin: 'narrow' },
                       { candidateWins: true, gap: 'g', margin: 'clear' },
                       { candidateWins: true, gap: 'g', margin: 'clear' }])
  const t = extractTrials(v, 'run-2')
  const dis = t.filter(x => x.disagreed)
  ok(t.length >= 2, `expected at least two paired trials from an arm, a disarm, and a re-arm — got ${t.length}`)
  eq(dis.length, 1, 'exactly one of them is a disagreement')
  eq(dis[0].minority, 1, 'and its minority count is one')
}

console.log('split-extract: a single critic is NOT a split')
{
  // BOUNDED BY THE BREAKER, because loop.js has no round cap: a run whose
  // candidate never wins never stops, and the harness runaway guard fires at
  // round 51. That is the loop behaving as designed and the test forgetting it.
  const v = (await runLoop({
    args: ARGS,
    rounds: [{ candidateWins: false, gap: 'g', margin: 'clear' },
             { candidateWins: false, gap: 'g', margin: 'clear' }],
    breaker: r => r < 3,
  })).result
  const t = extractTrials(v, 'run-3')
  // Losing rounds never arm, so there is no pair and no panel. Counting a lone
  // critic as a unanimous panel of one would add a zero-disagreement observation
  // to the denominator for free — the cheapest possible way to make p look small.
  eq(t.filter(x => x.kind === 'within-round').length, 0,
     'a round with one critic contributes no within-round trial')
}

console.log('split-extract: k>1 yields a within-round trial carrying the positions')
{
  const v = await run([{ candidateWins: true, gap: 'g', margin: 'clear' },
                       { candidateWins: true, gap: 'g', margin: 'clear' }], { critics: 3 })
  const t = extractTrials(v, 'run-4').filter(x => x.kind === 'within-round')
  ok(t.length >= 1, `expected a within-round trial at k=3 — got ${t.length}`)
  eq(t[0].judges, 3, 'three judges in the round')
  ok(new Set(t[0].sides).size > 1,
     `all three critics judged from the same side (${t[0].sides.join(',')}) — within-round position splitting is what separates position bias from judge variance, and issue 21 asks for it by name`)
}

console.log('split-extract: a decomposed run pairs each piece with ITSELF')
{
  // THE CASE THAT DISTINGUISHES THE RIGHT RULE FROM THE WRONG ONE, and the only
  // one that can: with a single piece, "the next history entry" and "the next
  // entry for this piece" are the same entry, so every run so far agrees with
  // both. With two pieces the history interleaves —
  //
  //     one@r1(armed)  two@r1(armed)  one@r2(confirmed)  two@r2(confirmed)
  //
  // — and adjacency pairs piece TWO's arm with piece ONE's confirm: two
  // different artifacts recorded as one paired observation of the same bytes,
  // while piece one's real pair is dropped because its neighbour is piece two.
  const v = (await runLoop({
    args: ARGS,
    lead: { decomposes: true, split_criterion: 'two files', pieces: [
      { name: 'one', observable: 'o1', candidate: '/x/p1.md', reference: '/x/r1.md' },
      { name: 'two', observable: 'o2', candidate: '/x/p2.md', reference: '/x/r2.md' }] },
    rounds: Array.from({ length: 4 }, () => ({ candidateWins: true, gap: 'g', margin: 'clear' })),
  })).result
  const t = extractTrials(v, 'run-pieces')
  eq(t.length, 2, 'each of the two pieces contributes its own arm/confirm pair')
  const pieces = t.map(x => x.piece).sort()
  eq(pieces.join(','), 'one,two', `the two trials must come from different pieces — got ${pieces.join(',')}`)
  for (const x of t) {
    ok(x.sides[0] !== x.sides[1], `a pair judged from one side (${x.sides.join(',')}) is not a paired observation`)
  }

  // AND THEIR UNIT KEYS MUST DIFFER. Both pieces arm at round 1 and confirm at
  // round 2, so a key of (run, kind, rounds) collides and the ledger drops one of
  // two genuine observations. A key that is too coarse does not inflate the
  // denominator — it shrinks it, which is harder to notice.
  const keys = new Set(t.map(trialKey))
  eq(keys.size, 2, `the two pieces produced ${keys.size} distinct unit key(s) for ${t.length} trials — a collision silently discards an observation`)
}

console.log('split-extract: re-ingesting a run cannot inflate the denominator')
{
  const v = await run([{ candidateWins: true, gap: 'g', margin: 'clear' },
                       { candidateWins: true, gap: 'g', margin: 'narrow' }])
  const a = extractTrials(v, 'run-5'), b = extractTrials(v, 'run-5')
  const keys = new Set([...a, ...b].map(trialKey))
  eq(keys.size, a.length, 'the same run ingested twice yields the same units, not twice as many')
  const other = extractTrials(v, 'run-6')
  ok(trialKey(other[0]) !== trialKey(a[0]), 'a different run is a different unit')
}

console.log('split-extract: N is DERIVED from p, never tabulated')
{
  // Issue 21's own table. If these stop matching, either the arithmetic moved or
  // the issue's numbers were wrong; a hardcoded table would hide both.
  eq(impliedN(0.05), 1, 'at p=0.05 a single critic already holds the 5% bar — the tunnel buys nothing')
  eq(impliedN(0.40), 4, 'at p=0.40 four critics reach it — the tunnel is right and affordable')
  eq(impliedN(0.85), 19, 'at p=0.85 nineteen are needed — the approach is not affordable at all')
  eq(impliedN(0), 1, 'a judge that never dissents needs no line')
  eq(impliedN(1), Infinity, 'a judge that always dissents is never safe at any N')
}

console.log('split-extract: p counts JUDGES, not panels')
{
  // THE REPRODUCIBLE for issue 70. The case beside this one builds five trials of
  // five judges and asserts p === 0.4, calling it "2/5, which is what #20
  // measured". Those digits agree by coincidence: 2 disagreeing PANELS over 5
  // panels prints the same as #20's 2 minority JUDGES over 5 judges, and that
  // coincidence is why nothing noticed the estimator was counting the wrong unit.
  //
  // Here the two readings cannot coincide. Two trials, two judges each, split 1-1:
  //   per-panel  2/2 = 100%  -> impliedN = Infinity
  //   per-judge  2/4 =  50%  -> impliedN = 5
  // The first is what the ledger printed on the first real ingest this repository
  // ever did, under the headline "no affordable N reaches it, which falsifies the
  // composition rather than tuning it".
  const split = n => Array.from({ length: n }, (_, i) => ({
    run: 'r', kind: 'within-round', rounds: [i], judges: 2, minority: 1, disagreed: true,
    sides: ['A', 'B'], candidate_wins_by_side: { A: 1, B: 0 }, judgements_by_side: { A: 1, B: 1 },
  }))
  const e = estimate(split(2))
  eq(e.trials, 2, 'two trials were recorded')
  eq(e.p, 0.5, 'p must be minority judges over judges (2/4), which is the quantity impliedN consumes — not split panels over panels (2/2)')
  eq(e.N_at_point, 5, 'and N follows from that p rather than from Infinity')
  // A panel that is unanimous contributes judges to the denominator and none to
  // the numerator. Without this, "count judges" could be satisfied by counting
  // only the judges of panels that split, which is the same defect one level in.
  const mixed = [...split(1), { run: 'r', kind: 'within-round', rounds: [9], judges: 2, minority: 0,
    disagreed: false, sides: ['A', 'B'], candidate_wins_by_side: { A: 1, B: 1 }, judgements_by_side: { A: 1, B: 1 } }]
  eq(estimate(mixed).p, 0.25, 'a unanimous panel still contributes its judges to the denominator (1 minority of 4)')
}

console.log('split-extract: the estimate reports the SPAN, not a point')
{
  // REBUILT so it reconstructs #20 LITERALLY rather than by coincidence. It used to
  // build five trials of five judges with two panels splitting, assert 0.4 and call
  // that "#20's 2/5" — but 2 panels over 5 panels only prints the same digits as 2
  // judges over 5 judges. That coincidence is what hid #70 in the fixture written to
  // catch it. #20 was ONE panel: five judges on one unchanged pair, split 3-2.
  const trials = [{ run: 'r', kind: 'within-round', rounds: [1], judges: 5, minority: 2,
    disagreed: true, sides: ['A', 'B'],
    candidate_wins_by_side: { A: 5, B: 0 }, judgements_by_side: { A: 5, B: 5 } }]
  const e = estimate(trials)
  eq(e.trials, 1, 'one trial — #20 was a single panel of five')
  eq(e.judges, 5, 'and five judges in it')
  eq(e.disagreements, 2, 'two of the five landed on the minority side')
  eq(e.split_panels, 1, 'and that panel is recorded as split, kept separate from the judge count')
  eq(e.p, 0.4, 'p is 2/5 JUDGES, which is the quantity #20 measured and impliedN consumes')
  ok(e.wilson[0] < 0.2 && e.wilson[1] > 0.7,
     `the interval on 2/5 should still be wide (got ${e.wilson.map(x => x.toFixed(2)).join('-')}) — issue 21 is about the SPAN, and a narrow one here would mean the arithmetic is wrong`)
  ok(e.N_at_low < e.N_at_point && e.N_at_point < e.N_at_high,
     `N must increase with p across the interval — got ${e.N_at_low}, ${e.N_at_point}, ${e.N_at_high}`)
  // POSITION BIAS, separated rather than assumed absent.
  ok(e.by_side.A && e.by_side.B, 'both sides are reported')
  eq(e.by_side.A.candidate_wins, 5, 'the candidate won every judgement it had on A in this fixture')
  eq(e.by_side.B.candidate_wins, 0, 'and never when it was on B — which is what a position-biased set looks like')
}

console.log('split-extract: an empty history claims nothing')
{
  const e = estimate([])
  eq(e.trials, 0, 'no trials')
  eq(e.p, null, 'p is null rather than 0 — no observation is not an observation of zero')
  eq(e.wilson, null, 'and there is no interval to report')
  eq(extractTrials({}, 'r').length, 0, 'a verdict with no history yields nothing')
  eq(extractTrials(null, 'r').length, 0, 'and neither does no verdict at all')
}

console.log('split-ledger: accumulation across runs, deduped by unit')
{
  // The CLI is exercised as a subprocess rather than imported: it runs on import,
  // and a module that does work when required cannot be unit-tested without doing
  // that work. SPLIT_LEDGER points it at a scratch file so the tracked ledger is
  // never written by a test.
  const tmp = join(tmpdir(), `split-ledger-test-${process.pid}`)
  rmSync(tmp, { recursive: true, force: true })
  mkdirSync(tmp, { recursive: true })
  const ledger = join(tmp, 'splits.jsonl')
  const vAgree = join(tmp, 'agree.json')
  const vDisagree = join(tmp, 'disagree.json')
  writeFileSync(vAgree, JSON.stringify(await run([{ candidateWins: true, gap: 'g', margin: 'clear' },
                                                   { candidateWins: true, gap: 'g', margin: 'narrow' }])))
  writeFileSync(vDisagree, JSON.stringify(await run([{ candidateWins: true, gap: 'g', margin: 'clear' },
                                                      { candidateWins: false, gap: 's', margin: 'narrow' },
                                                      { candidateWins: true, gap: 'g', margin: 'clear' },
                                                      { candidateWins: true, gap: 'g', margin: 'clear' }])))
  const cli = (...a) => spawnSync(process.execPath,
    ['scripts/split-ledger.mjs', ...a],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, SPLIT_LEDGER: ledger }, timeout: 60_000 })

  const empty = cli('--report')
  ok(/UNMEASURED/.test(empty.stdout),
     'an empty ledger reports p as UNMEASURED — a report that prints nothing reads as a low disagreement rate, which is the opposite of what no data means')

  cli('--ingest', vAgree, '--run', 'runA')
  cli('--ingest', vDisagree, '--run', 'runB')
  const before = readFileSync(ledger, 'utf8').split('\n').filter(Boolean).length
  ok(before >= 3, `expected at least three trials accumulated across two runs, got ${before}`)

  // RE-INGEST. The same verdict read twice must add nothing: a rate over rows
  // counts how many times the file was read, not how many things were judged.
  cli('--ingest', vAgree, '--run', 'runA')
  cli('--ingest', vDisagree, '--run', 'runB')
  const after = readFileSync(ledger, 'utf8').split('\n').filter(Boolean).length
  eq(after, before, `re-ingesting the same runs changed the ledger from ${before} to ${after} rows — the denominator counts reads rather than trials`)

  const rep = cli('--report').stdout
  // THE UNITS MUST BE IN THE LINE. "disagreement p = 2/2" over trials, with the
  // arithmetic below consuming a per-judge rate, is exactly how #70 read as a
  // result rather than as a category error.
  ok(/dissent p = \d+\/\d+ JUDGES = /.test(rep),
     `the report must state p over JUDGES and say so — got: ${(rep.match(/split-ledger: .*p = .*/) || ['(no p line)'])[0]}`)
  ok(/panel\(s\) split/.test(rep), 'and must still report how many panels split, which is a different number')
  ok(/Wilson 95% CI/.test(rep), 'with an interval, because issue 21 is about the span rather than the point')
  ok(/critics needed/.test(rep), 'and the implied N at both ends of that interval')
  ok(/position breakdown/.test(rep), 'and the position breakdown, which is what separates side bias from judge variance')
  ok(/NOT ESTABLISHED/.test(rep), 'and the residual: these runs are not a sampling frame')
  rmSync(tmp, { recursive: true, force: true })
}

console.log('split-extract: stating what this cannot establish')
console.log('          NOT MEASURED: p itself. This accumulates trials the loop produces; until runs')
console.log('          happen the ledger is empty and the interval stays as wide as #20 left it.')
console.log('          NOT MEASURED: whether an arm/confirm pair is exchangeable with a within-round')
console.log('          pair. Both are two judges on the same bytes, and nothing here shows they draw')
console.log('          from one distribution — they are counted separately for that reason.')

if (failures) {
  console.error(`\nsplit-extract: ${failures} failure(s) — recorded splits that nothing accumulates are a diary, not a measurement.`)
  process.exit(1)
}
console.log('\nsplit-extract: OK — trials extracted from real verdicts, units deduped, N derived, span reported.')
