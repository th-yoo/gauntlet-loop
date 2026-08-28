// Pinned disclosures, checked against what the loop actually does.
//
//   node test/disclosure-behaviour.test.mjs
//
// ISSUE 54. loop.js's not_enforced list asserted "the source gets width by
// decomposing the goal, WHICH THIS LOOP DOES NOT DO", and the loop decomposes.
// That sentence was pinned: drift-facts held it, drift-guard failed if it
// vanished, and guard-sweep confirmed the pin bit. All of it faithfully protected
// a false statement, because a disclosure is pinned for PRESENCE and nothing
// checked it was TRUE.
//
// Each case below drives the loop and asserts the behaviour its disclosure
// claims, and names that disclosure in the assertion so scripts/disclosure-audit.mjs
// can see the two are wired together. The claims that CANNOT be driven are not
// here — they are recorded in docs/disclosure-adjudications.jsonl with the reason,
// because "this one has no behavioural form" is half the answer rather than a gap
// in it.
//
// NOTHING HERE SPAWNS.

import { runLoop } from './harness.mjs'

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }

const ARGS = { goal: 'g', candidate: '/x/a.md', reference: '/x/b.md', token: '/t' }
const win = (margin = 'clear') => ({ candidateWins: true, gap: 'g', margin })
const lose = (margin = 'clear') => ({ candidateWins: false, gap: 'still short', margin })

console.log('disclosure-behaviour: A NARROW WIN STILL EXITS')
{
  // The disclosure says the margin does not gate the exit. Both rounds narrow.
  const r = (await runLoop({ args: ARGS, rounds: [win('narrow'), win('narrow')] })).result
  ok(r.outcome && r.outcome.status === 'WON',
     `A NARROW WIN STILL EXITS — two narrow wins produced status ${r.outcome && r.outcome.status}, so the margin gated the exit and the disclosure is false`)
  const margins = (r.history || []).map(h => h.margin)
  ok(margins.every(m => m === 'narrow'), `both rounds were narrow — got ${margins.join(', ')}`)
  console.log(`          two narrow wins => ${r.outcome && r.outcome.status}`)
}

console.log('disclosure-behaviour: A RUN CANCELLED WHILE ARMED STOPPED WITH ONE UNCONFIRMED WIN, WHICH IS NOT A WIN')
{
  // Round 1 wins and arms. The breaker then reports the token gone, before the
  // confirming critic can run. The run must NOT be a win.
  const r = (await runLoop({
    args: ARGS,
    rounds: [win(), win()],
    breaker: round => round < 2,
  })).result
  ok(r.outcome && r.outcome.status !== 'WON',
     `A RUN CANCELLED WHILE ARMED STOPPED WITH ONE UNCONFIRMED WIN, WHICH IS NOT A WIN — the run reported ${r.outcome && r.outcome.status} after being cancelled between the arming win and its confirmation`)
  const armed = (r.history || []).filter(h => h.armed).length
  ok(armed >= 1, 'the run did arm before it was cancelled, or this case is testing nothing')
  console.log(`          armed then cancelled => ${r.outcome && r.outcome.status} (armed rounds: ${armed})`)
}

console.log('disclosure-behaviour: THE CONFIRMATION MEASURES JUDGE REPRODUCIBILITY, NOT ARTIFACT IMPROVEMENT')
{
  // The claim is that the confirming critic judges the SAME bytes: nothing is
  // built between the arming round and the confirming one. If a build happened,
  // the confirmation would be measuring a changed artifact.
  let builds = 0
  const r = (await runLoop({
    args: ARGS,
    rounds: [lose(), win(), win()],
    builder: () => { builds++; return { changed: 'yes', where: '/x/a.md', snapshot: '/tmp/snap', failed: null, ambiguity: null } },
  })).result
  const armedAt = (r.history || []).find(h => h.armed)
  const confirmedAt = (r.history || []).find(h => h.confirmed)
  ok(armedAt && confirmedAt, 'the run armed and confirmed, or this case is testing nothing')
  // One build for the losing round only. A build between arm and confirm would
  // make it two or more after arming.
  ok(builds === 1,
     `THE CONFIRMATION MEASURES JUDGE REPRODUCIBILITY, NOT ARTIFACT IMPROVEMENT — ${builds} builder run(s) occurred, so the confirming critic did not judge the same bytes the arming critic did`)
  console.log(`          one losing round built once; nothing built between arm and confirm (builds=${builds})`)
}

console.log('disclosure-behaviour: THERE IS NO RATCHET; REGRESSIONS ARE MEASURED AND NOT REVERTED')
{
  // A build happens, and the loop keeps going forward from it. Nothing restores a
  // previous artifact: the disclosure says regressions are recorded rather than
  // undone, and a revert would show up as the run refusing to advance.
  const snapshots = []
  const r = (await runLoop({
    args: ARGS,
    rounds: [lose(), lose(), win(), win()],
    builder: (round) => { snapshots.push(round); return { changed: 'yes', where: '/x/a.md', snapshot: `/tmp/snap-${round}`, failed: null, ambiguity: null } },
  })).result
  ok(r.outcome && r.outcome.status === 'WON', `the run reached a verdict — got ${r.outcome && r.outcome.status}`)
  ok(snapshots.length >= 2,
     `THERE IS NO RATCHET; REGRESSIONS ARE MEASURED AND NOT REVERTED — only ${snapshots.length} build(s) ran, so the loop did not advance through successive rounds and a revert cannot be ruled out`)
  // Each build is a new round, never a repeat of an earlier one, which is what
  // reverting and re-running would look like.
  ok(new Set(snapshots).size === snapshots.length,
     `a round was built twice (${snapshots.join(', ')}) — that is the shape a revert-and-retry leaves`)
  console.log(`          builds at rounds ${snapshots.join(', ')}; none repeated, none reverted`)
}

console.log('disclosure-behaviour: The breaker is checked at ROUND BOUNDARIES, not continuously')
{
  // The claim is about WHEN the probe runs: once per round, not during one.
  const seen = []
  const r = (await runLoop({
    args: ARGS,
    rounds: [lose(), lose(), win(), win()],
    breaker: round => { seen.push(round); return true },
  })).result
  ok(seen.length > 0, 'the breaker was consulted at all')
  const perRound = new Map()
  for (const rd of seen) perRound.set(rd, (perRound.get(rd) || 0) + 1)
  const repeated = [...perRound.entries()].filter(([, n]) => n > 1)
  ok(repeated.length === 0,
     `The breaker is checked at ROUND BOUNDARIES, not continuously — round(s) ${repeated.map(([rd, n]) => `${rd}×${n}`).join(', ')} consulted it more than once, which is not a boundary check`)
  ok(seen.length === new Set(seen).size, 'one consultation per round')
  console.log(`          consulted once each at rounds ${seen.join(', ')} (status ${r.outcome && r.outcome.status})`)
}

console.log('disclosure-behaviour: THE SPLIT IS CHECKED ONE WAY ONLY')
{
  // The disclosure claims the whole-artifact check is ASYMMETRIC BY DESIGN: a
  // loss is a positive detection, a win is consistency and NOT proof the seam
  // was correct. Both directions are driven here, in one case, because the
  // asymmetry is a single property and testing only one side would confirm the
  // half that is comfortable.
  const pieces = [
    { name: 'render', observable: 'open the frame' },
    { name: 'audio', observable: 'play it' }]
  const critic = (round, side) => ({ winner: side.candidateSide, why: 'w', gap: 'g', inspected: 'i' })

  const lost = (await runLoop({
    args: ARGS, critic,
    lead: { decomposes: true, split_criterion: 'each subsystem renders alone', pieces },
    whole: { candidateWins: false, gap: 'the sections contradict across the seam', margin: 'clear' },
  })).result
  ok(lost.split_check && lost.split_check.ran === true,
     'THE SPLIT IS CHECKED ONE WAY ONLY — every piece won and no whole-artifact check ran, so the one check that can falsify a split did not happen')
  ok(lost.outcome && lost.outcome.status === 'SPLIT_UNSOUND',
     `a losing whole-artifact check must be a positive DETECTION — got ${lost.outcome && lost.outcome.status}`)

  const held = (await runLoop({
    args: ARGS, critic,
    lead: { decomposes: true, split_criterion: 'each subsystem renders alone', pieces },
    whole: { candidateWins: true, margin: 'clear' },
  })).result
  ok(held.outcome && held.outcome.status === 'WON',
     `a passing whole-artifact check must let the run win — got ${held.outcome && held.outcome.status}`)
  // THE ASYMMETRY ITSELF. A win is recorded, and the verdict must not upgrade it
  // into proof the seam was right — the disclosure says so in as many words.
  ok(held.split_check.candidateWon === true, 'the passing check is recorded rather than assumed')
  ok((held.not_enforced || []).some(d => /CHECKED ONE WAY ONLY/.test(String(d))),
     'the run that PASSED the whole-artifact check still carries the disclosure saying a pass proves nothing — without it, a passing check reads as a cleared seam')
  console.log(`          losing whole-check => ${lost.outcome.status}; passing => ${held.outcome.status}, and the pass still discloses it proves nothing`)
}
console.log('disclosure-behaviour: stating what this cannot establish')
console.log('          NOT ESTABLISHED: that naming a disclosure in an assertion makes the assertion')
console.log('          check it. These cases were written to test the claim, and a reader who doubts')
console.log('          one should read it rather than trust the wiring — the audit that counts them is')
console.log('          a floor, one level down from the defect that produced it.')

// --------------------------------------------------------------------------
// WHO WROTE THE GOAL FIRST — asked, recorded, and disclosed on every branch.
// Issue #41. The loop cannot infer the ordering: it is a temporal fact whose
// operands include a string that arrives with no time on it, which is why #27's
// direction trial ran at chance. So the operator is asked, the answer is recorded
// as an ATTESTATION, and the three states are three different disclosures —
// "not asked" and "answered no" being different facts.
//
// Each branch asserts its own disclosure is present AND the other two are absent.
// A single always-emitted sentence would satisfy a presence check on any one of
// them, which is the shape this file exists to refuse.
// --------------------------------------------------------------------------
const AUTHORED = {
  unasked: 'NOBODY WAS ASKED WHETHER THE GOAL WAS WRITTEN BEFORE THE CANDIDATE WAS OPENED',
  independent: 'THE GOAL IS ATTESTED AS WRITTEN BEFORE THE CANDIDATE WAS OPENED',
  after: 'THE GOAL WAS WRITTEN AFTER THE CANDIDATE WAS READ',
}

console.log('disclosure-behaviour: NOBODY WAS ASKED WHETHER THE GOAL WAS WRITTEN BEFORE THE CANDIDATE WAS OPENED')
{
  const r = (await runLoop({ args: ARGS, rounds: [win(), win()] })).result
  const ne = (r.not_enforced || []).join('\n')
  ok(r.goal_authored && r.goal_authored.attested === null,
     `with no goal_authored argument the verdict records ${JSON.stringify(r.goal_authored)} — null is the only honest value, because unasked is not the same as independent`)
  ok(r.goal_authored && r.goal_authored.verified === false, 'and it never claims to have verified an attestation it cannot check')
  ok(ne.includes(AUTHORED.unasked), 'and the run says nobody was asked')
  ok(!ne.includes(AUTHORED.independent) && !ne.includes(AUTHORED.after),
     'and it does not also emit an answer nobody gave')
  console.log('          attested null, verified false, and the unasked disclosure alone')
}

console.log('disclosure-behaviour: THE GOAL IS ATTESTED AS WRITTEN BEFORE THE CANDIDATE WAS OPENED')
{
  const r = (await runLoop({ args: { ...ARGS, goal_authored: 'independently' }, rounds: [win(), win()] })).result
  const ne = (r.not_enforced || []).join('\n')
  ok(r.goal_authored && r.goal_authored.attested === 'independently', `the attestation is recorded — got ${JSON.stringify(r.goal_authored)}`)
  ok(r.goal_authored && r.goal_authored.verified === false, 'and it is still marked unverified, because nothing here can check it')
  ok(ne.includes(AUTHORED.independent) && !ne.includes(AUTHORED.unasked),
     'and the run stops saying nobody was asked once somebody has been')
}

console.log('disclosure-behaviour: THE GOAL WAS WRITTEN AFTER THE CANDIDATE WAS READ')
{
  const r = (await runLoop({ args: { ...ARGS, goal_authored: 'after-reading-candidate' }, rounds: [win(), win()] })).result
  const ne = (r.not_enforced || []).join('\n')
  ok(r.goal_authored && r.goal_authored.attested === 'after-reading-candidate', `the answer is recorded as given — got ${JSON.stringify(r.goal_authored)}`)
  ok(ne.includes(AUTHORED.after) && !ne.includes(AUTHORED.independent),
     'and a win under a goal written against the candidate is disclosed as measuring the goal as much as the work')
}

console.log('disclosure-behaviour: an attestation the loop cannot read is refused, not dropped')
{
  let threw = null
  await runLoop({ args: { ...ARGS, goal_authored: 'yes' }, rounds: [win(), win()] }).catch(e => { threw = e })
  ok(threw !== null, 'goal_authored: "yes" ran anyway — an attestation this loop cannot read is one nobody made, and the verdict would report it as unasked while the operator believed they had answered')
  ok(threw && /goal_authored must be one of/.test(String(threw.message)),
     `and it must say what the accepted values are — got ${threw && String(threw.message).slice(0, 90)}`)
}


if (failures) {
  console.error(`\ndisclosure-behaviour: ${failures} failure(s) — a pinned disclosure that the loop contradicts is a false claim with a guard in front of it.`)
  process.exit(1)
}
console.log('\ndisclosure-behaviour: OK — nine disclosures driven against the loop and confirmed.')
