// A shortfall that cannot name the artifact it is about is a fact about the critic.
//
//   node test/shortfall-anchor.test.mjs
//
// OBSERVED LIVE, 2026-09-02, wf_b1395dfb-e04 round 9. The candidate won narrowly on a real
// defect in the other artifact — its own score panel disagreeing with its own game-over
// modal in one frame — so the round was not wowed and went to the builder on the SHORTFALL,
// which is the branch decision 0007 added. The shortfall read:
//
//   "I was not able to force and directly witness a clean row-complete -> line-clear ->
//    shift-down -> score/lines-increment event on doc-1 within this session; my attempts
//    repeatedly created holes under overhangs."
//
// That is a fact about the CRITIC. It was fluent, non-empty and not the word "none", so the
// only test in place passed it to a builder, which was handed "fix: I could not manage to
// clear a line" as the round's work. Nothing in the candidate could be changed to satisfy
// it. The round was spent.
//
// The critic was being HONEST — it admitted a limit rather than inventing a defect, which
// is what its prompt asks for. The loop took that honesty and spent a build on it.
//
// THE ANCHOR, and it is the same one `loser_path` uses one field over: the shortfall must
// NAME the artifact it is about, and the loop checks that name against the side it dealt.
// It must be the WINNER's path, because shortfall looks from the winner up to first-rate.
// A critic with no artifact to name writes "none" and puts the limit in `inspected`.
//
// NOTHING HERE SPAWNS.

import { runLoop, ok, eq } from './harness.mjs'

const CAND = '/tmp/x/mybuild.html'
const REF = '/tmp/x/theoriginal.html'
const ARGS = { goal: 'a goal worth looping over', candidate: CAND, reference: REF, token: '/tmp/x/run.token' }

// The candidate always wins narrowly here, so every round takes the not-wowed branch —
// which is the only branch that consumes a shortfall.
const narrowWin = extra => (round, s) => ({
  winner: s.candidateSide, loser_path: REF,
  why: 'w', gap: 'g', inspected: 'i', margin: 'narrow', ...extra,
})

const bounded = async (extra, rounds = 2) => {
  let n = 0
  return runLoop({ args: ARGS, breaker: () => { n++; return n <= rounds }, critic: narrowWin(extra) })
}

console.log('shortfall-anchor: a shortfall naming no artifact does not reach a builder')
{
  const r = await bounded({ shortfall: 'I could not reproduce a line clear in this session.', shortfall_path: 'none' })
  ok(!r.labels.some(l => /:build$/.test(l)), 'no builder ran on a shortfall that is about the critic')
  const skipped = (r.result.history || []).filter(h => h.build_skipped)
  ok(skipped.length > 0, 'and the round records that the build was skipped on purpose')
  ok(/fact about the critic, not about the work/.test(skipped[0].build_skipped),
     `and says why — got: ${String(skipped[0].build_skipped).slice(0, 200)}`)
}

console.log('shortfall-anchor: a shortfall naming the LOSER is incoherent and does not reach a builder')
{
  // Shortfall looks from the WINNER up. Naming the artifact that just lost is the same
  // incoherence `loser_path` catches, one field over.
  const r = await bounded({ shortfall: 'the other one is missing a menu', shortfall_path: REF })
  ok(!r.labels.some(l => /:build$/.test(l)), 'no builder ran on a shortfall pointed at the loser')
  const skipped = (r.result.history || []).filter(h => h.build_skipped)
  ok(skipped.length > 0 && /rather than the artifact it picked/.test(skipped[0].build_skipped),
     `and the reason names both paths — got: ${String((skipped[0] || {}).build_skipped).slice(0, 200)}`)
}

console.log('shortfall-anchor: a shortfall naming the WINNER is built on — the check does not eat real work')
{
  // THE CONTROL, and the assertion that matters most. Without it this file passes against a
  // loop that refuses EVERY shortfall, which would silently disable the entire not-wowed
  // build branch decision 0007 exists to provide — a worse defect than the one fixed here,
  // and invisible, because a run would simply loop without ever building.
  const r = await bounded({ shortfall: 'no start screen and no persisted best score', shortfall_path: CAND })
  const b = r.prompts.find(p => /:build$/.test(p.label))
  ok(b, 'a shortfall about the winning artifact still reaches a builder')
  ok(b.prompt.includes('no start screen and no persisted best score'), 'with its text intact')
  eq((r.result.history || []).filter(h => h.build_skipped).length, 0, 'and nothing is recorded as skipped')
}

console.log('shortfall-anchor: the path is recorded on the round, so a reader can check it')
{
  const r = await bounded({ shortfall: 'x', shortfall_path: CAND })
  const h = (r.result.history || [])[0]
  eq(h.shortfall_path, CAND, 'the artifact the shortfall named is on the record beside the shortfall itself')
}

console.log('shortfall-anchor: stating what this cannot establish')
console.log('          NOT CHECKED, and this is the honest limit: a critic that writes an inspection')
console.log('          limit AND names the winner\'s path anyway passes every test here. The anchor')
console.log('          enforces COHERENCE between two fields; it cannot read the prose and decide')
console.log('          what the sentence is about. What it buys is that a critic following its own')
console.log('          schema — "write none if this is not about an artifact" — now has a place to be')
console.log('          honest that the loop acts on, where before there was no signal at all.')
