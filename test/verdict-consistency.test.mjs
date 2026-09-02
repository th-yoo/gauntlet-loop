// A verdict whose LETTER and PATH disagree is not a verdict.
//
//   node test/verdict-consistency.test.mjs
//
// THE RUN THIS EXISTS FOR. 2026-09-02, wf_ffceec20-6ba. Six A/B rounds. The three that put
// the artifact-being-improved at position A were all read correctly. Of the three that put
// it at B, TWO came back describing both artifacts accurately and attaching the
// descriptions to the wrong letters:
//
//   round 1: winner B. Its shortfall quoted `LINE_SCORES[count] * level` as the WINNER's
//            weakness — a string that appears twice in one artifact and zero times in the
//            other, so the judge plainly meant the other side. The loop read B as the side
//            being improved and ARMED THE EXIT.
//   round 6: winner B, gap "A has no start/menu screen, no level or lines counter, no
//            persisted high score, no sound" while crediting B with "title screen with
//            level picker, Best/Level/Speed/Lines readouts". Checked against the files:
//            menu 0 vs 42, Lines 0 vs 21, Best 0 vs 21, particle 0 vs 19. Backwards.
//            ARMED AGAIN.
//
// Nothing downstream could tell either from a real preference: valid enum, coherent prose,
// a genuine defect named, a margin. Two of six rounds, both arming the exit.
//
// THE CHECK. The critic now also names the losing FILE. A path cannot inverate the way a
// positional letter can, so the two are independent expressions of one fact and must agree
// — over-determined, computable with no filesystem and no answer key, from what the loop
// already knows about which side it dealt.
//
// NOTHING HERE SPAWNS.

import { runLoop, ok, eq } from './harness.mjs'

const CANDIDATE = '/tmp/x/mybuild.html'
const REFERENCE = '/tmp/x/theoriginal.html'
const TOKEN = '/tmp/x/run.token'
const GOAL = 'a goal worth looping over'
const ARGS = { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN }

console.log('verdict-consistency: a letter/path mismatch is refused, not counted and not repaired')
{
  // The inversion, reproduced. The critic picks the side the loop calls the winner, and
  // names THAT SAME side's path as the loser — which is what a judge does when it has the
  // letters mapped the wrong way round.
  let n = 0
  const r = await runLoop({
    args: ARGS,
    breaker: () => { n++; return n <= 3 },
    critic: (round, s) => ({
      winner: s.candidateSide,
      loser_path: CANDIDATE,          // it picked the candidate side AND calls it the loser
      why: 'w', gap: 'g', inspected: 'i', margin: 'decisive', shortfall: 's',
    }),
  })
  ok(r.result.outcome.status !== 'WON',
     `a run whose every verdict is self-contradictory must not report a win — got ${r.result.outcome.status}`)
  ok(/named a loser that was not on the losing side/.test(r.result.outcome.why || ''),
     `and the verdict says what was wrong with them — got: ${String(r.result.outcome.why).slice(0, 160)}`)
  ok(/cannot tell what the judges meant|guessing is worse/.test(r.result.outcome.why || ''),
     'and says plainly that it stopped rather than guessed')
}

console.log('verdict-consistency: the disagreement is recorded verbatim, both readings kept')
{
  let n = 0
  const r = await runLoop({
    args: ARGS,
    breaker: () => { n++; return n <= 2 },
    critic: (round, s) => ({
      winner: s.candidateSide, loser_path: CANDIDATE,
      why: 'w', gap: 'g', inspected: 'i', margin: 'decisive', shortfall: 's',
    }),
  })
  // Two places, because a round whose whole line is refused breaks before its history
  // entry is written: the round record when some positions survived, the OUTCOME when none
  // did. Reading only one of them was this test's first version, and it went red against a
  // loop that was recording them correctly in the other.
  const rec = [...(r.result.history || []).flatMap(h => h.inconsistent_verdicts || []),
               ...((r.result.outcome && r.result.outcome.inconsistent_verdicts) || [])]
  ok(rec.length > 0, 'the refused verdicts are on the record, not merely dropped')
  const one = rec[0]
  ok(one.claimed_loser === CANDIDATE, 'the path the critic named is kept as it wrote it')
  ok(one.loser_by_side && one.loser_by_side !== one.claimed_loser,
     'alongside the path that was actually on the losing side — both readings, so a reader can see the disagreement rather than a conclusion')
  ok(/disagree/.test(one.why || ''), 'with a sentence saying why it was not counted')
}

console.log('verdict-consistency: a consistent verdict is untouched — the check does not eat good rounds')
{
  // THE CONTROL, and it is the assertion that matters. Without it this file passes against
  // a loop that refuses EVERY verdict, which would be a far worse defect than the one it
  // was written for: the run would simply never end and nothing here would notice.
  const r = await runLoop({
    args: ARGS,
    rounds: [{ candidateWins: true, margin: 'decisive' }],
  })
  eq(r.result.outcome.status, 'WON', 'a verdict whose letter and path agree still wins normally')
  const rec = (r.result.history || []).flatMap(h => h.inconsistent_verdicts || [])
  eq(rec.length, 0, 'and nothing is recorded as inconsistent')
}

console.log('verdict-consistency: a critic that omits the path is not treated as inconsistent')
{
  // The field is schema-required, so an empty one means the runtime let something through
  // rather than that the judge disagreed with itself. Refusing there would convert a
  // schema problem into a stopped run and blame the judge for it.
  const r = await runLoop({
    args: ARGS,
    rounds: [{ candidateWins: true, margin: 'decisive', loser_path: '' }],
  })
  eq(r.result.outcome.status, 'WON', 'an absent path is not read as a contradiction')
}

console.log('verdict-consistency: stating what this cannot establish')
console.log('          NOT CHECKED: that the surviving verdicts are RIGHT. This catches a judge whose')
console.log('          letter and path disagree. A judge that mislabels both consistently — reading one')
console.log('          file and calling it by the other name throughout, path included — produces a')
console.log('          verdict this cannot distinguish from a real preference. Only comparing quoted')
console.log('          evidence against the files would reach that, and the loop has no filesystem.')
