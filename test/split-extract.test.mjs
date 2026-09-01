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
// confirmation arm. A WOWED win ARMS the exit; the next round spawns a fresh critic
// against the UNCHANGED artifact with the sides flipped. That is two independently
// spawned judges on identical bytes at opposite positions — a paired q-trial —
// and every armed run produces one at the default k=1, at no extra cost.
//
// THE VERDICTS HERE ARE DRIVEN THROUGH THE STUBBED HARNESS, never hand-written.
// A hand-built history is a structure I invented agreeing with a reader I wrote;
// what must be parsed is the shape loop.js actually emits.
//
// THE CONFIRMING ROUND IS NEVER `margin: 'narrow'` HERE, and that changed under decision
// 0007. The bar is now the source's — a round no critic is wowed by builds instead of
// arming — so a fixture whose confirming round was narrow no longer confirms, and three
// blocks below ran to the harness runaway guard at round 51. Their subject is trial
// extraction, not the exit bar: the margins were decoration showing the field is recorded
// on both kinds of round, and they are now `clear` on the rounds that must confirm. The
// LOSING rounds keep their narrow margins, because a margin on a round the candidate lost
// gates nothing and never did. The exit bar itself has cases on both sides in
// test/exit-bar.test.mjs; nothing here is asserting anything about it.
//
// NOTHING HERE SPAWNS.

import { extractTrials, estimate, impliedN, wilson, trialKey, discordance, errorFromDiscordance } from '../scripts/split-extract.mjs'
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
                       { candidateWins: true, gap: 'g', margin: 'clear' }])
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
  eq(dis[0].for_candidate, 1, 'one judge picked the candidate')
  eq(dis[0].against_candidate, 1, 'and one did not — both counts are recorded, neither called the error')
  eq(discordance(dis[0]), 1, 'a pair that disagreed is one discordant pair of one')
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
                       { candidateWins: true, gap: 'g', margin: 'clear' }])
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

console.log('split-extract: the estimand does not move with k — and the two rates it replaced do')
{
  // THE REPRODUCIBLE for issue 71, computed rather than asserted. For judges erring
  // independently with probability q, a panel of k has `a` judges on the wrong side
  // with binomial probability. A ledger is built that REALISES that distribution
  // exactly — C(k,a) q^a (1-q)^(k-a) of the rows carry each `a`, scaled to integers —
  // so every rate below is the expectation, not a sample. Nothing here reads a
  // number off the issue; the key is derived from q and k.
  //
  // Then the crossing: the property claimed (k-independence) against the confound
  // the old estimators measured instead (k). An estimand that is really "how wide
  // was the panel" moves down this table; one that is really about the judge holds.
  const C = (n, r) => { let x = 1; for (let i = 1; i <= r; i++) x = x * (n - i + 1) / i; return x }
  const q = 0.4
  const ledgerAt = k => {
    const scale = 5 ** k                      // makes every binomial term an integer at q = 2/5
    const rows = []
    for (let a = 0; a <= k; a++) {
      const count = Math.round(C(k, a) * q ** a * (1 - q) ** (k - a) * scale)
      for (let i = 0; i < count; i++) rows.push({
        run: 'r', kind: 'within-round', rounds: [rows.length], judges: k,
        for_candidate: k - a, against_candidate: a, disagreed: a > 0 && a < k,
        sides: ['A', 'B'], candidate_wins_by_side: { A: k - a, B: 0 }, judgements_by_side: { A: k, B: 0 },
      })
    }
    return rows
  }
  const close = (x, y) => Math.abs(x - y) < 1e-9
  const dExpected = 2 * q * (1 - q)
  const oldMinRate = rows => rows.reduce((s, t) => s + Math.min(t.for_candidate, t.against_candidate), 0) / rows.reduce((s, t) => s + t.judges, 0)
  const oldSplitRate = rows => rows.filter(t => t.disagreed).length / rows.length
  const seen = { d: [], min: [], split: [] }
  for (const k of [2, 3, 5]) {
    const rows = ledgerAt(k)
    const e = estimate(rows)
    ok(close(e.d, dExpected), `at k=${k} the discordant-pair rate must be 2q(1-q) = ${dExpected} — got ${e.d}`)
    ok(close(e.q, q), `and the per-judge error recovered from it must be q = ${q} — got ${e.q}`)
    ok(close(e.by_k[k].d, e.d), 'the per-k breakdown agrees with the pooled figure when only one k is present')
    seen.d.push(e.d); seen.min.push(oldMinRate(rows)); seen.split.push(oldSplitRate(rows))
  }
  ok(seen.d.every(x => close(x, seen.d[0])), `d is the same at k=2,3,5 — got ${seen.d.map(x => x.toFixed(3)).join(', ')}`)
  ok(!close(seen.min[0], seen.min[2]), `the OLD minority-per-judge rate must move with k, or this crossing proves nothing — got ${seen.min.map(x => x.toFixed(3)).join(', ')}`)
  ok(!close(seen.split[0], seen.split[2]), `and so must the panel-split rate — got ${seen.split.map(x => x.toFixed(3)).join(', ')}`)
  ok(seen.min.every(x => x < q), `the old rate is biased low at every k (true q = ${q}) — got ${seen.min.map(x => x.toFixed(3)).join(', ')}`)
  // POOLED ACROSS k. Rows from k=2 and k=5 are samples of one quantity now, so the
  // pooled estimate is the same number; under the old estimator it was a mixture
  // of two distributions reported as one.
  const pooled = estimate([...ledgerAt(2), ...ledgerAt(5)])
  ok(close(pooled.d, dExpected) && close(pooled.q, q), `pooling k=2 and k=5 panels still reads d = ${dExpected}, q = ${q} — got d=${pooled.d}, q=${pooled.q}`)
  eq(Object.keys(pooled.by_k).join(','), '2,5', 'and the per-k table shows both')
  console.log(`          d = ${seen.d.map(x => x.toFixed(3)).join(' = ')} across k; the replaced rate read ${seen.min.map(x => x.toFixed(3)).join(', ')}`)
}

console.log('split-extract: q is the root below one half, and above d = 1/2 it is reported at the boundary')
{
  ok(Math.abs(errorFromDiscordance(2 * 0.2 * 0.8) - 0.2) < 1e-12, 'd = 0.32 reads as q = 0.2, not 0.8 — the assumption that a judge beats a coin, made explicit')
  eq(errorFromDiscordance(0.5), 0.5, 'd = 1/2 is q = 1/2')
  eq(errorFromDiscordance(0.9), 0.5, 'd above 1/2 has no q that produces it in expectation, and is reported at 1/2 rather than as a number')
  eq(errorFromDiscordance(0), 0, 'no disagreement reads as no error — under the same assumption')
  eq(errorFromDiscordance(null), null, 'and no d is no q')
}

console.log('split-extract: a row from before issue 71 is counted as unreadable, never as a panel')
{
  const legacy = { run: 'r', kind: 'within-round', rounds: [1], judges: 2, minority: 1, disagreed: true,
    sides: ['A', 'B'], candidate_wins_by_side: { A: 1, B: 0 }, judgements_by_side: { A: 1, B: 1 } }
  const fresh = { run: 'r', kind: 'within-round', rounds: [2], judges: 2, for_candidate: 2, against_candidate: 0, disagreed: false,
    sides: ['A', 'B'], candidate_wins_by_side: { A: 1, B: 1 }, judgements_by_side: { A: 1, B: 1 } }
  const e = estimate([legacy, fresh])
  eq(e.trials, 1, 'only the row carrying both counts is a trial')
  eq(e.legacy_rows, 1, 'and the other is named as a legacy row')
  eq(e.d, 0, 'the estimate is over the readable row alone')
}

console.log('split-extract: the estimate reports the SPAN, not a point')
{
  // REBUILT so it reconstructs #20 LITERALLY rather than by coincidence. It used to
  // build five trials of five judges with two panels splitting, assert 0.4 and call
  // that "#20's 2/5" — but 2 panels over 5 panels only prints the same digits as 2
  // judges over 5 judges. That coincidence is what hid #70 in the fixture written to
  // catch it. #20 was ONE panel: five judges on one unchanged pair, split 3-2.
  const trials = [{ run: 'r', kind: 'within-round', rounds: [1], judges: 5, for_candidate: 3, against_candidate: 2,
    disagreed: true, sides: ['A', 'B'],
    candidate_wins_by_side: { A: 5, B: 0 }, judgements_by_side: { A: 5, B: 5 } }]
  const e = estimate(trials)
  eq(e.trials, 1, 'one trial — #20 was a single panel of five')
  eq(e.judges, 5, 'and five judges in it')
  eq(e.split_panels, 1, 'and that panel is recorded as split')
  // 3-2 is 3*2 = 6 discordant pairs of the 10 a panel of five contains. That is
  // ABOVE one half — more disagreement than independent judges produce in
  // expectation — so the one panel the whole parameter rested on reads as q at
  // its boundary, with an interval over ONE panel that spans nearly everything.
  eq(e.d, 0.6, 'd is 6 of 10 pairs — which no min() decided')
  eq(e.d_above_half, true, 'and it is flagged as above one half')
  eq(e.q, 0.5, 'so q is reported at the boundary rather than as a number below it')
  ok(e.d_wilson[0] < 0.2 && e.d_wilson[1] > 0.9,
     `the interval on one panel must be wide (got ${e.d_wilson.map(x => x.toFixed(2)).join('-')}) — issue 21 is about the SPAN, and a narrow one here would mean the arithmetic is wrong`)
  ok(e.N_at_low <= e.N_at_point && e.N_at_point <= e.N_at_high,
     `N must not decrease across the interval — got ${e.N_at_low}, ${e.N_at_point}, ${e.N_at_high}`)
  // POSITION BIAS, separated rather than assumed absent.
  ok(e.by_side.A && e.by_side.B, 'both sides are reported')
  eq(e.by_side.A.candidate_wins, 5, 'the candidate won every judgement it had on A in this fixture')
  eq(e.by_side.B.candidate_wins, 0, 'and never when it was on B — which is what a position-biased set looks like')
}

console.log('split-extract: an empty history claims nothing')
{
  const e = estimate([])
  eq(e.trials, 0, 'no trials')
  eq(e.d, null, 'd is null rather than 0 — no observation is not an observation of zero')
  eq(e.q, null, 'and so is q')
  eq(e.d_wilson, null, 'and there is no interval to report')
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
                                                   { candidateWins: true, gap: 'g', margin: 'clear' }])))
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
  ok(/discordance d = \d+% of judge PAIRS on the same bytes disagreed, over \d+ PANEL\(s\)/.test(rep),
     `the report must state d over PAIRS and its unit as PANELS — got: ${(rep.match(/split-ledger: discordance.*/) || ['(no d line)'])[0]}`)
  ok(/panel\(s\) split/.test(rep), 'and must still report how many panels split, which is a different number')
  ok(/by k — k=2: d=/.test(rep), 'and the per-k breakdown, which is where a drift with k would show')
  ok(/IF a judge beats a coin/.test(rep) && /two\s+roots/.test(rep), 'and states the assumption under which q follows from d, and why it is an assumption')
  ok(/Wilson 95% CI/.test(rep), 'with an interval, because issue 21 is about the span rather than the point')
  ok(/critics needed/.test(rep), 'and the implied N at both ends of that interval')
  ok(/position breakdown/.test(rep), 'and the position breakdown, which is what separates side bias from judge variance')
  ok(/NOT ESTABLISHED/.test(rep), 'and the residual: these runs are not a sampling frame')
  rmSync(tmp, { recursive: true, force: true })
}

console.log('split-extract: stating what this cannot establish')
console.log('          NOT MEASURED: d itself. This accumulates trials the loop produces; until runs')
console.log('          happen the ledger is empty and the interval stays as wide as #20 left it.')
console.log('          NOT MEASURED: which side of any split was right. q follows from d only if a judge')
console.log('          beats a coin, and the k-independence shown above is a property of that model.')
console.log('          NOT MEASURED: whether an arm/confirm pair is exchangeable with a within-round')
console.log('          pair. Both are two judges on the same bytes, and nothing here shows they draw')
console.log('          from one distribution — they are counted separately for that reason.')

if (failures) {
  console.error(`\nsplit-extract: ${failures} failure(s) — recorded splits that nothing accumulates are a diary, not a measurement.`)
  process.exit(1)
}
console.log('\nsplit-extract: OK — trials extracted from real verdicts, units deduped, N derived, span reported.')
