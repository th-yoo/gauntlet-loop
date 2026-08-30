// THE REPRODUCIBLE for the second half of #69 — `why` was fixed and its twin was not.
//
//   node test/breaker-cause.test.mjs
//
// COMMITTED FAILING.
//
// 90bd4b3 corrected `outcome.why`: it reads `breakerSilent`, so a breaker that never
// answered no longer reads as a token seen absent. Verified live on run
// wf_fbbc08f8-24f, where `why` was right.
//
// The SAME verdict still said, in `enforced`:
//
//   no round cap existed; the run never started a round because the token at
//   <path> was absent at the first check
//
// ROUND_COUNT_CLAIM, branching on `history.length` exactly as `why` used to. The token
// was on disk throughout. #69's own residual said this in as many words — "not
// established whether other verdict fields branch on a proxy for a fact they hold
// directly" — and it was left open.
//
// It is worse than the original, for two reasons. It ships inside `enforced`, where a
// reader takes a line for something the run ESTABLISHED rather than for narration. And a
// verdict that contradicts itself across two fields tells a reader who checks that the
// run agrees with itself.
//
// SHAPE, NOT SITE. This asserts the property over EVERY string in enforced/not_enforced
// rather than naming ROUND_COUNT_CLAIM, because naming one site at a time is what
// produced a second site. The crossing is the same one #69 used: both causes produce an
// identical observable — CANCELLED, zero rounds — so a field reading `breakerSilent`
// separates them and a field reading `history.length` cannot.
//
// NOTHING HERE SPAWNS.

import { runLoop } from './harness.mjs'

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }

const ARGS = { goal: 'g', candidate: '/x/a.md', reference: '/x/b.md', token: '/tmp/gauntlet-cause.token' }
const win = () => ({ candidateWins: true, gap: 'g', margin: 'clear' })

// Identical outcomes. The only difference is whether a probe ever spoke.
const silent = (await runLoop({ args: ARGS, rounds: [win(), win()], breaker: () => null })).result
const absent = (await runLoop({ args: ARGS, rounds: [win(), win()], breaker: () => false })).result

console.log('breaker-cause: both stops look identical from outside, so the cause must come from the run')
for (const [name, r] of [['breaker silent', silent], ['breaker said ABSENT', absent]]) {
  ok(r.outcome && r.outcome.status === 'CANCELLED', `${name}: expected CANCELLED, got ${r.outcome && r.outcome.status}`)
  ok((r.history || []).length === 0, `${name}: expected an empty history, got ${(r.history || []).length}`)
}

console.log('breaker-cause: `why` names the breaker, not the token  (fixed at 90bd4b3)')
{
  const why = String(silent.outcome && silent.outcome.why)
  ok(/breaker/i.test(why) && !/was absent at the first check|already absent/i.test(why),
     `got: ${JSON.stringify(why)}`)
}

console.log('breaker-cause: and NO OTHER FIELD claims the token was absent either')
{
  const claims = [...(silent.enforced || []), ...(silent.not_enforced || [])]
  // THE PROPERTY, NOT THE OLD WORDING. This first matched the exact sentence the defect
  // shipped with, so a mutation that fell through to a DIFFERENT false sentence about the
  // token passed it. When the breaker was silent the run observed nothing about the token,
  // so no line may mention the token and absence together, however it is phrased.
  const offender = claims.map(String).find(c => /token/i.test(c) && /absent/i.test(c))
  ok(!offender,
     `the breaker never answered and a field other than \`why\` still asserts the token was absent. It sits in enforced/not_enforced, where a reader takes it for something the run established, and it contradicts \`why\` in the same verdict. Got: ${JSON.stringify(offender)}`)
}

console.log('breaker-cause: a breaker that DID report ABSENT still says so, everywhere')
{
  const why = String(absent.outcome && absent.outcome.why)
  ok(/token/i.test(why), `the token really was gone and \`why\` no longer says so: ${JSON.stringify(why)}`)
  // SPECIFIC, because the loose version was satisfied by the wrong line. Asking only
  // whether SOME enforced line mentions the token passed while ROUND_COUNT_CLAIM had been
  // mutated away entirely — the interruptibility line names the token path too, so the
  // check could not tell a conditioned claim from a deleted one. Verified by mutation:
  // replacing the branch with a constant now fails here by name.
  const claims = [...(absent.enforced || []), ...(absent.not_enforced || [])].map(String)
  ok(claims.some(c => /no round cap existed/i.test(c) && /token/i.test(c)),
     `the breaker reported ABSENT and the round-count claim no longer says the token was the reason — the fix deleted the claim instead of conditioning it. Lines seen: ${JSON.stringify(claims.filter(c => /no round cap/i.test(c)))}`)
}

if (failures) {
  console.error(`\nbreaker-cause: ${failures} failure(s) — one verdict must not contradict itself across two fields.`)
  process.exit(1)
}
console.log('\nbreaker-cause: OK — every field names the cause the run observed.')
