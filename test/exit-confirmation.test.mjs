// THE REPRODUCIBLE for the second half of #18 — the loop exits on one blind A/B win.
//
//   node test/exit-confirmation.test.mjs
//
// COMMITTED FAILING.
//
// #18 names two halves. The measuring half landed at `e917952`: a round that made
// things worse is now visible and recoverable. This is the other one, and the issue
// has carried its design, decided and unimplemented, since 2026-08-24.
//
// WHAT IS THERE NOW. `loop.js` breaks the round loop the first time one critic
// picks the candidate:
//
//   if (candidateWon) { pieceOutcome = { status: 'WON', ... }; break }
//
// One forced binary going our way ends the run.
//
// WHY THAT IS NOT ENOUGH, and this is measured rather than argued. #18's second
// comment records five `gauntlet-ab-critic` spawns against ONE unchanged artifact
// pair, byte-identical deployed prompt, same side assignment: **A 3 — B 2**. A
// single fresh judge picks the minority side with probability ~0.4. So "won one
// blind A/B" is one sample from a near-coin, and the loop treats it as terminal.
//
// The same measurement killed the obvious alternative. Four of the five judges
// reported `margin: clear` — on BOTH sides of a 3-2 split. The field reported high
// confidence for A and high confidence for B on the same unchanged pair, so
// thresholding on `margin` would have licensed exactly the exits it was meant to
// block. `margin` is required in AB_SCHEMA today for record-keeping, and gating on
// it is refused on evidence.
//
// THE PROPERTY. A win ARMS the exit; it does not fire it.
//
//   1. one win does not end the run — the loop continues;
//   2. NO BUILD happens between the armed round and the confirming round, so the
//      artifact is byte-identical across them and the confirmation measures one
//      thing only: whether an independent judge reaches the same verdict;
//   3. the confirming critic is a SEPARATE SPAWN — fresh context, not the same
//      agent asked twice;
//   4. the candidate sits on the OPPOSITE SIDE in the confirming round, so
//      position bias cannot be common-mode across the two;
//   5. both wins -> WON;
//   6. the confirming critic picking the reference DISARMS — the run builds on
//      that critic's gap and continues, rather than exiting on the earlier win.
//
// WHAT THIS DOES NOT CLAIM. Not fidelity to the source. The source's exit is
// universal over judges — "don't stop until each sub-agent is utterly wowed" —
// and two-in-a-row is `exists twice consecutively`. It is a step from exists
// toward for-all, and the honest wording is the mechanism, not the lineage. At
// p ~ 0.4 this takes a false exit from 0.4 per round to 0.16 per attempt: real,
// and still one in six. The anchor for this change is HARNESS — our own five
// spawns — not SOURCE.

import { runLoop, ok, eq } from './harness.mjs'

// Paths deliberately avoid the words "candidate" and "reference": sibling tests
// grep prompts for those words, and a path containing one trips a check for a
// reason unrelated to what is being measured.
const CANDIDATE = '/tmp/x/mybuild.html'
const REFERENCE = '/tmp/x/theoriginal.html'
const TOKEN = '/tmp/x/run.token'
const GOAL = 'a goal worth looping over'
const ARGS = { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN }

// ---------------------------------------------------------------------------
// 1-4. A single win arms, and the confirming round is a fresh critic on the
//      opposite side with no build in between.
// ---------------------------------------------------------------------------
{
  const r = await runLoop({
    args: ARGS,
    rounds: [
      { candidateWins: false, gap: 'GAP-1' },
      { candidateWins: true, gap: 'GAP-2-unused-the-candidate-won' },
      { candidateWins: true, gap: 'GAP-3-unused-the-confirmation-won' },
    ],
  })

  eq(r.result.outcome.status, 'WON', 'two consecutive wins end the run')
  eq(r.result.outcome.round, 3, 'the run ends at the CONFIRMING round, not the arming one')

  const critics = r.labels.filter(l => l.endsWith(':ab'))
  const builders = r.labels.filter(l => l.endsWith(':build'))
  eq(critics.length, 3, 'three critics ran — one per round, the third being the confirmation')
  // The arming round must not trigger a build. Round 1 loses and builds; round 2
  // wins and arms; round 3 confirms. So exactly ONE build.
  eq(builders.length, 1, 'exactly one builder ran — neither the arming round nor the confirming round builds, so the artifact is unchanged across the confirmation')

  // The confirmation is a separate spawn, not the same agent consulted twice.
  const armLabel = critics[1]
  const confirmLabel = critics[2]
  ok(armLabel !== confirmLabel, `the confirming critic is a separate spawn — got the same label twice (${confirmLabel})`)

  // Sides must differ across the two. loop.js's sides() flips by round parity,
  // so this should hold without new machinery — asserted because "should hold
  // for free" is exactly the kind of claim that stops being true silently.
  const armed = r.result.history[1]
  const confirmed = r.result.history[2]
  ok(armed && confirmed, 'both the arming and confirming rounds are recorded in history')
  ok(armed.candidateSide !== confirmed.candidateSide,
     `the candidate must sit on the opposite side in the confirming round — got ${armed && armed.candidateSide} then ${confirmed && confirmed.candidateSide}, so position bias is common-mode across the pair and the confirmation measures nothing it was meant to`)

  console.log('exit-confirmation: a win arms, and a fresh critic on the opposite side confirms it OK')
}

// ---------------------------------------------------------------------------
// 5. A confirming critic that picks the reference DISARMS.
//
// The run must not exit on the earlier win. It builds on the disagreeing
// critic's gap and carries on — the arming win is discarded, not banked.
// ---------------------------------------------------------------------------
{
  const r = await runLoop({
    args: ARGS,
    rounds: [
      { candidateWins: true, gap: 'GAP-1-armed' },
      { candidateWins: false, gap: 'GAP-2-DISARMS-and-is-built-on' },
      { candidateWins: true, gap: 'GAP-3-re-armed' },
      { candidateWins: true, gap: 'GAP-4-confirms' },
    ],
  })

  eq(r.result.outcome.status, 'WON', 'the run ends once a win is actually confirmed')
  eq(r.result.outcome.round, 4, 'it ends at round 4 — the disarmed win at round 1 did not end it, and re-arming had to happen again')

  const builders = r.labels.filter(l => l.endsWith(':build'))
  // Round 1 arms (no build). Round 2 disarms and builds. Round 3 re-arms (no
  // build). Round 4 confirms (no build). Exactly one build.
  eq(builders.length, 1, 'the disarming round is the only one that builds — an arming win and a confirming win both skip the builder')

  // The build must be driven by the DISARMING critic's gap, not the armed one's.
  const buildPrompt = r.prompts.find(p => p.label.endsWith(':build') && /GAP-2-DISARMS/.test(p.prompt))
  ok(buildPrompt, 'the builder was given the disarming critic\'s gap — the round that disagreed is the one that says what to fix')

  console.log('exit-confirmation: a confirming critic that picks the reference disarms and the run continues OK')
}

// ---------------------------------------------------------------------------
// 6. The verdict states the exit it actually reached, and what it does not buy.
//
// #18's design names four residuals that must ship with the mechanism. A
// mechanism whose limits are not written down is a mechanism that will be
// quoted past them.
// ---------------------------------------------------------------------------
{
  const r = await runLoop({
    args: ARGS,
    rounds: [
      { candidateWins: true, gap: 'G1' },
      { candidateWins: true, gap: 'G2' },
    ],
  })

  eq(r.result.outcome.status, 'WON', 'two wins from the first round on still end the run')

  const enforced = JSON.stringify(r.result.enforced || [])
  ok(/two consecutive/i.test(enforced) && /opposite/i.test(enforced),
     'the verdict states the exit actually reached — two consecutive blind A/B wins, two separately spawned critics, candidate on opposite sides, artifact unchanged between them')

  const disclosed = JSON.stringify(r.result.not_enforced || [])
  // Each of these is a way the confirmed exit can still be wrong, and each is
  // named in #18's decided design.
  ok(/model family/i.test(disclosed),
     'not_enforced says both critics share a model family, so a shared blind spot survives confirmation')
  ok(/narrow/i.test(disclosed),
     'not_enforced says a narrow win still exits, because margin gates nothing')
  ok(/reproducib/i.test(disclosed),
     'not_enforced says the confirmation measures judge reproducibility, not artifact improvement')

  console.log('exit-confirmation: the verdict states the exit reached and the four ways it can still be wrong OK')
}

// No trailing summary line. drift-guard requires an assertion behind every
// printed pass, and a global "OK" after the last block has none — the
// throwing-assertion suites in this repo (loop.test.mjs) end on their last
// case for exactly that reason. Caught by the guard, not by review.
