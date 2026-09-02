// The regression check runs alongside the NEXT round's critic, and still lands on its own round.
//
//   node test/regression-overlap.test.mjs
//
// WHY IT WAS DEFERRED. Measured on wf_b1395dfb-e04, a live browser run: A/B critics took
// 195 minutes over 9 spawns, regression checks 134 minutes over 15 — 36% of the entire
// run's agent time. Every one of those minutes was spent waiting on a question nothing was
// blocked on. After a build there are new bytes; the regression check compares them against
// the pre-build snapshot, and the NEXT round's A/B critic compares the same bytes against
// the reference. Both only read. Neither needs the other's answer. They ran in series
// because one line awaited.
//
// WHY IT IS SAFE HERE AND WOULD NOT BE ELSEWHERE. Decision 0003 settled that there is no
// automatic revert: the regression verdict is RECORDED and the operator decides. No branch
// waits on it, so deferring changes WHEN it is written, not what it says. If a regression
// ever sent the round back, this overlap would have to go — the loop would be building on
// bytes a pending check might reject.
//
// WHAT DEFERRAL CAN BREAK, and therefore what this file is about: a verdict landing on the
// WRONG ROUND. The promise carries its own entry, sides and snapshot for exactly that
// reason, and the first draft failed a different way — the state was declared inside the
// round loop, so it reset every iteration and quietly restored the serial behaviour while
// looking parallel.
//
// NOTHING HERE SPAWNS.

import { runLoop, ok, eq } from './harness.mjs'

const ARGS = { goal: 'a goal worth looping over', candidate: '/x/a.md', reference: '/x/b.md', token: '/t' }
const lose = [{ candidateWins: false, gap: 'g', margin: 'clear' }]
const snap = round => ({ changed: 'c', where: 'w', snapshot: `/x/.gauntlet-snapshots/a.md.t.round-${round}` })

console.log('regression-overlap: each verdict lands on the round that produced it')
{
  let n = 0
  const r = await runLoop({
    args: ARGS, rounds: lose, builder: snap,
    breaker: () => { n++; return n <= 3 },
    // A DIFFERENT answer per round. With one shared answer a misfiled verdict is invisible:
    // every round would carry the same text and the test would pass on a loop that recorded
    // round 1's result three times.
    regressionCheck: round => ({ prefers: 'new', why: `verdict-for-round-${round}` }),
  })
  const h = r.result.history || []
  eq(h.length, 3, 'three rounds ran')
  for (const e of h) {
    ok(e.regression, `round ${e.round} has a regression verdict`)
    eq(e.regression.why, `verdict-for-round-${e.round}`,
       `round ${e.round} carries ITS OWN verdict, not a neighbour's`)
    ok(String(e.regression.snapshot).endsWith(`round-${e.round}`),
       `and its own snapshot — got ${e.regression.snapshot}`)
  }
}

console.log('regression-overlap: a run that ends with one in flight still records it')
{
  // THE EXIT PATH. The last round's check has no successor to overlap with, so it is
  // settled when the piece finishes. Without that, a run would show a build with no check
  // beside it — and the round most likely to be dropped is the final one, which is the one
  // an operator reads first.
  let n = 0
  const r = await runLoop({
    args: ARGS, rounds: lose, builder: snap,
    breaker: () => { n++; return n <= 1 },
    regressionCheck: round => ({ prefers: 'previous', why: `final-round-${round}` }),
  })
  const h = r.result.history || []
  eq(h.length, 1, 'exactly one round ran')
  ok(h[0].regression, 'and its regression check was still recorded after the run stopped')
  eq(h[0].regression.why, 'final-round-1', 'with its own verdict')
  eq(h[0].regressed, true, 'and a preference for the PREVIOUS version is still flagged as a regression')
}

console.log('regression-overlap: a check that returns nothing is reported, not silently absent')
{
  let n = 0
  const r = await runLoop({
    args: ARGS, rounds: lose, builder: snap,
    breaker: () => { n++; return n <= 1 },
    regressionCheck: () => null,
  })
  const h = (r.result.history || [])[0]
  eq(h.regression, null, 'no verdict is recorded')
  ok(/returned nothing/.test(h.regression_why_not || ''),
     `and the round says why rather than leaving the absence unexplained — got ${h.regression_why_not}`)
}

console.log('regression-overlap: stating what this cannot establish')
console.log('          NOT MEASURED HERE: the speedup. Harness agents resolve immediately, so the')
console.log('          overlap is unobservable in a stub — what this file proves is the property')
console.log('          deferral could BREAK (a verdict on the wrong round), not the property it was')
console.log('          done for. The 36% figure comes from a real run\'s timestamps and only another')
console.log('          real run can confirm it moved.')
