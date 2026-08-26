// THE REPRODUCIBLE for #18 — the loop has no ratchet, so a round that makes the
// artifact worse is permanent and can be exited on.
//
//   node test/ratchet.test.mjs
//
// COMMITTED FAILING.
//
// WHAT IS MISSING, in the file's own terms. The builder edits the artifact IN
// PLACE every round. `history` holds descriptions of what changed — no content,
// no path to a prior version, no copy. Every A/B in this loop compares the
// candidate against the REFERENCE, so nothing ever asks whether round N is better
// than round N-1, and a regression is invisible: the next round's critic sees the
// damaged artifact as the baseline and names a gap relative to that.
//
// This repository already recorded the mechanism, about the method it implements
// — `skills/gauntlet-loop/references.md`:
//
//   "Round 3 regressed (4.14 -> 4.05). An uncapped loop absorbs a bad round; a
//    capped one can terminate on it. The source method's answer is the ratchet —
//    keep the best candidate so far, replace it only on a head-to-head win. This
//    instrument has no ratchet..."
//
// written about `gauntlet.js`, which is gone, and equally true of `loop.js`,
// which is the file that actually loops.
//
// THE PROPERTY, in four parts, because a snapshot nobody compares is storage and a
// comparison nobody records is a spawn:
//
//   1. every built round carries an identifier for the version that existed
//      BEFORE it, so a regression is recoverable rather than merely regrettable;
//   2. a fresh critic is asked which of the two it prefers — the one comparison
//      this loop has never made;
//   3. when it prefers the PREVIOUS version, the record MARKS THE ROUND REGRESSED
//      and does NOT roll it back — see the scope note below;
//   4. the verdict discloses what a ratchet cannot do: it tells which of two
//      versions a critic preferred on the day, never an improvement from a
//      lateral move.
//
// SCOPE, AND IT IS A DECISION RATHER THAN AN OVERSIGHT: this asserts the MEASURING
// half. A regression must be visible and recoverable; it is not rolled back.
// Automatic revert hands rollback authority to an evaluator whose detection rate is
// n=1 (#29), and a wrong revert is worse than a wrong refusal — a refusal is loud and
// stops the run, a revert silently discards work and the next round's critic never
// sees what went. What is missing before that trade can be made is the rate at which
// rounds actually regress, which is exactly what this half produces.
//
// The no-revert assertion below is therefore an ASSERTION, not an absence: turning
// revert on has to change this line deliberately rather than quietly satisfy it.
//
// ALSO NOT ASSERTED: the exit condition. #18 carries a second half — "won one blind
// A/B" standing in for "utterly wowed" — a policy choice with a cost. A stricter exit
// is a decision, and bundling it here would hide it inside a fix.

import { runLoop } from './harness.mjs'

const CANDIDATE = '/tmp/x/mybuild.html'
const REFERENCE = '/tmp/x/theoriginal.html'
const TOKEN = '/tmp/x/run.token'
const base = { goal: 'a goal worth looping over', candidate: CANDIDATE, reference: REFERENCE, token: TOKEN }

let failures = 0
const ok = (cond, m) => { if (cond) console.log(`  ok    ${m}`); else { console.error(`  FAIL  ${m}`); failures++ } }

// Three rounds: the candidate loses twice, then wins. Two builds happen before
// the win, which is the smallest run in which "was round 2 better than round 1"
// is a question at all.
const THREE_ROUNDS = {
  args: base,
  breaker: rd => rd <= 4,
  rounds: [
    { candidateWins: false, gap: 'round 1 gap' },
    { candidateWins: false, gap: 'round 2 gap' },
    { candidateWins: true, gap: 'round 3 gap', margin: 'clear' },
  ],
}

console.log('ratchet: the run under test really does build more than once')
const run = await runLoop({ ...THREE_ROUNDS, ratchet: () => ({ prefers: 'new', why: 'stub: the new version is better' }) })
const built = (run.result.history || []).filter(h => h.built)
ok(built.length >= 2, `at least two rounds built (got ${built.length}) — with fewer, nothing below is a question`)
ok(run.result.outcome && run.result.outcome.status === 'WON', 'and the run ended on a win, which is the state a bad round can be exited on')

console.log('ratchet: every built round names the version that existed before it')
ok(built.every(h => h.snapshot),
   'each built round carries a snapshot identifier for the pre-build version. Today history holds descriptions of changes and nothing else, so a regression cannot be recovered — or even named')

console.log('ratchet: a fresh critic is asked which of the two versions is better')
ok(built.every(h => h.ratchet && h.ratchet.prefers),
   'each built round records a head-to-head verdict against its own predecessor. Every other comparison in this loop is against the REFERENCE, so nothing has ever asked whether the artifact got better')

console.log('ratchet: a round the critic declines is MARKED, and deliberately not rolled back')
const reverting = await runLoop({
  ...THREE_ROUNDS,
  // Round 2's build is judged worse than what round 1 left behind.
  ratchet: rd => rd === 2
    ? { prefers: 'previous', why: 'stub: round 2 made it worse' }
    : { prefers: 'new', why: 'stub: better' },
})
const r2 = (reverting.result.history || []).find(h => h.round === 2)
ok(r2 && r2.built, 'round 2 still built — a ratchet declines a result, it does not skip the work')
ok(r2 && r2.regressed === true,
   'and round 2 is marked regressed, naming the round whose build a fresh critic judged worse than what it replaced. Before this, that round was indistinguishable from any other')
ok(r2 && r2.ratchet && r2.ratchet.snapshot,
   'and the record carries the path of the version it lost to, so the regression is recoverable by hand rather than merely regrettable')
ok((reverting.result.history || []).filter(h => h.regressed).length === 1,
   'and only the declined round is marked — a flag that appears on every round names nothing')
ok(r2 && r2.reverted !== true,
   'and the round is NOT rolled back. Deliberate, and asserted so it cannot change quietly: revert hands rollback authority to an evaluator whose detection rate is n=1 (#29), and the rate at which rounds regress — the number that would justify it — is what this half exists to produce')

console.log('ratchet: the new version does not always land on the same side')
{
  const seen = []
  await runLoop({ ...THREE_ROUNDS, ratchet: (rd, ctx) => { seen.push(ctx.newIsA); return { prefers: 'new', why: 'stub' } } })
  ok(seen.length >= 2 && new Set(seen).size === 2,
     `the version under test appears on both sides across rounds (saw ${JSON.stringify(seen)}). A ratchet critic that always finds the new version at ARTIFACT A can answer "which is better" by position, and the snapshot path is recognisable enough to make that free`)
}

console.log('ratchet: a round with no snapshot says so, rather than reading as checked')
{
  const nosnap = await runLoop({ ...THREE_ROUNDS, snapshots: false, ratchet: () => ({ prefers: 'new', why: 'stub' }) })
  const b = (nosnap.result.history || []).filter(h => h.built)
  ok(b.length >= 2, 'the run still built')
  ok(b.every(h => h.snapshot === null), 'no snapshot is recorded when the builder reported none — an invented path is worse than an admitted absence')
  ok(b.every(h => h.ratchet === null && /no snapshot/.test(String(h.ratchet_why_not))),
     'and each such round names WHY the comparison could not be made. Silence here would make an unchecked round look exactly like one that was checked and found fine')
  ok(b.every(h => h.regressed === undefined),
     'and no round claims it did not regress, because nothing established that')
}

console.log('ratchet: the verdict discloses what the comparison cannot establish')
const disclosed = JSON.stringify(run.result.not_enforced || [])
ok(/lateral|improvement/i.test(disclosed),
   'not_enforced says the loop cannot tell an improvement from a lateral move — it knows which of two versions a critic preferred on the day, and nothing more')

console.log('ratchet: stating what this file does NOT establish')
console.log('          NOT ASSERTED: the exit condition. #18 also says "won one blind A/B" stands in')
console.log('          for "utterly wowed". That is a policy choice with a cost, not a defect, and')
console.log('          bundling it here would hide a decision inside a fix.')
console.log('          NOT MEASURED: whether the ratchet critic is right. It is one judge, once, on')
console.log('          two versions of one artifact — the same instrument whose n=1 detection rate is')
console.log('          #29, now asked a second question per round.')

if (failures) {
  console.error(`\nratchet: ${failures} failure(s) — a round that made the artifact worse is permanent and can be exited on.`)
  process.exit(1)
}
console.log('\nratchet: OK — every build is measured against what it replaced, and a declined one is named rather than rolled back.')
