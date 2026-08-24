import { runLoop, ok, eq } from './harness.mjs'

// Deliberately do NOT spell "candidate" or "reference" inside these paths:
// the critic-never-told-which-is-which test greps the prompt for the word
// "candidate", and a path containing that word would trip the check for a
// reason that has nothing to do with loop.js's actual behavior.
const CANDIDATE = '/tmp/x/mybuild.html'
const REFERENCE = '/tmp/x/theoriginal.html'
const TOKEN = '/tmp/x/run.token'
const GOAL = 'a goal worth looping over'

// It stops when the candidate wins. Steered to win at round 3: exactly 3
// critics and 2 builders must have been spawned — a win must not trigger
// another build.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    rounds: [
      { candidateWins: false, gap: 'GAP-ROUND-1' },
      { candidateWins: false, gap: 'GAP-ROUND-2' },
      { candidateWins: true, gap: 'GAP-ROUND-3-unused-because-it-won' },
    ],
  })
  eq(r.result.outcome.status, 'WON', 'candidate winning stops the loop with status WON')
  eq(r.result.outcome.round, 3, 'the win is reported at round 3')
  const criticLabels = r.labels.filter(l => l.endsWith(':ab'))
  const builderLabels = r.labels.filter(l => l.endsWith(':build'))
  eq(criticLabels.length, 3, 'exactly 3 critics were spawned')
  eq(builderLabels.length, 2, 'exactly 2 builders were spawned — the winning round never triggers a build')
  console.log('loop: candidate win at round 3 stops the loop, no extra build OK')
}

// Sides alternate. Over 4 non-winning rounds the candidate must be A on even
// rounds and B on odd, and position_balance must match.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    breaker: r => r <= 4,
    rounds: [],
  })
  eq(r.result.outcome.status, 'CANCELLED', 'ran to the operator cancel without the candidate ever winning')
  eq(r.result.history.length, 4, 'four rounds ran')
  eq(r.result.history.map(h => h.candidateSide), ['B', 'A', 'B', 'A'], 'candidate is B on odd rounds, A on even rounds')
  eq(r.result.position_balance, '2 as A / 2 as B', 'reported position_balance matches the alternation')
  console.log('loop: sides alternate by round parity and position_balance matches OK')
}

// The critic is never told which is the candidate. Neither the word
// "candidate" nor a second, revealing occurrence of the candidate's path may
// appear in the critic prompt — the path may appear exactly once, in its
// ARTIFACT line.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    breaker: r => r <= 3,
    rounds: [],
  })
  const criticPrompts = r.prompts.filter(p => p.label.endsWith(':ab'))
  eq(criticPrompts.length, 3, 'three critic prompts captured')
  for (const p of criticPrompts) {
    ok(!/candidate/i.test(p.prompt), `critic prompt (${p.label}) never uses the word "candidate"`)
    const occurrences = p.prompt.split(CANDIDATE).length - 1
    eq(occurrences, 1, `candidate path appears exactly once in ${p.label}, only in its own ARTIFACT line`)
  }
  console.log('loop: critic prompt never identifies which side is the candidate OK')
}

// The builder gets exactly the one gap, and never the sides: no reference
// path, no ARTIFACT A/B markers, no winner leak.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    rounds: [
      { candidateWins: false, gap: 'THE-ONE-SPECIFIC-GAP-FOR-ROUND-1' },
      { candidateWins: true, gap: 'unused-because-round-2-wins' },
    ],
  })
  const build1 = r.prompts.find(p => p.label === 'round-1:build')
  ok(build1, 'round 1 builder ran')
  ok(build1.prompt.includes('THE-ONE-SPECIFIC-GAP-FOR-ROUND-1'), 'builder prompt carries that round\'s gap verbatim')
  ok(!build1.prompt.includes(REFERENCE), 'builder prompt does not contain the reference path')
  ok(!build1.prompt.includes('ARTIFACT A'), 'builder prompt does not contain "ARTIFACT A"')
  ok(!build1.prompt.includes('ARTIFACT B'), 'builder prompt does not contain "ARTIFACT B"')
  ok(!/\bwinner\b/i.test(build1.prompt), 'builder prompt never mentions a winner letter/field')
  console.log('loop: builder receives exactly one gap and never the sides OK')
}

// Fresh critic per round: N rounds produce N distinct critic agent() calls
// with distinct, sequential labels — not one continued agent.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    breaker: r => r <= 3,
    rounds: [],
  })
  const criticLabels = r.labels.filter(l => l.endsWith(':ab'))
  eq(criticLabels, ['round-1:ab', 'round-2:ab', 'round-3:ab'], 'each round spawns a distinctly, sequentially labeled critic')
  eq(new Set(criticLabels).size, criticLabels.length, 'labels are unique — no continued agent')
  console.log('loop: fresh critic per round, distinct labels OK')
}

// The circuit breaker is the stop. With a critic that never picks the candidate
// and a token removed after round 2, the loop must end CANCELLED after exactly
// 2 rounds — and the breaker must be probed BEFORE each critic, so the cancel
// costs one cheap probe rather than a critic and a builder.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    breaker: r => r <= 2,
    rounds: [],
  })
  eq(r.result.outcome.status, 'CANCELLED', 'removing the token stops the loop with status CANCELLED')
  eq(r.result.rounds, 2, 'exactly 2 rounds completed before the cancel')
  eq(r.labels.filter(l => l.endsWith(':ab')).length, 2, 'exactly 2 critics spawned — the cancelled round never spawned one')
  eq(r.labels.filter(l => l.endsWith(':build')).length, 2, 'exactly 2 builders spawned')
  eq(r.labels.filter(l => l.endsWith(':breaker')).length, 3, 'the breaker was probed 3 times: rounds 1 and 2 passed, round 3 reported the cancel')
  eq(r.labels[0], 'round-1:breaker', 'the very first spawn of the run is the breaker, not the critic')
  ok(/removed the run token/.test(r.result.outcome.why), 'the outcome names the operator cancel as the reason')
  ok(r.result.outcome.why.includes(TOKEN), 'the outcome names the token path, so the operator can tell which run stopped')
  console.log('loop: removing the run token stops the loop at the round boundary, before the next critic OK')
}

// The breaker is checked before the CRITIC, and the critic is the first thing a
// round spawns — so a cancel at round N+1 must leave the critic count at N.
// Ordering, not just counting: for every round, its breaker precedes its critic.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    breaker: r => r <= 3,
    rounds: [],
  })
  for (const round of [1, 2, 3]) {
    const b = r.labels.indexOf(`round-${round}:breaker`)
    const c = r.labels.indexOf(`round-${round}:ab`)
    ok(b !== -1 && c !== -1, `round ${round} spawned both a breaker and a critic`)
    ok(b < c, `round ${round}: the breaker probe (${b}) came before the critic (${c})`)
  }
  ok(!r.labels.includes('round-4:ab'), 'the cancelled round spawned no critic')
  ok(r.labels.includes('round-4:breaker'), 'the cancelled round spawned only the breaker')
  console.log('loop: every round probes the breaker before spawning its critic OK')
}

// A dead breaker fails SAFE. A probe that returns nothing must stop the run,
// not wave it through — failing open here is an uncancellable loop with no cap,
// the single outcome the mechanism exists to prevent.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    breaker: r => (r === 1 ? true : null),
    rounds: [],
    runawayGuard: 5,
  })
  eq(r.result.outcome.status, 'CANCELLED', 'a breaker that returns nothing stops the run rather than continuing')
  eq(r.result.rounds, 1, 'exactly 1 round completed before the dead probe')
  ok(r.logs.some(l => /the breaker returned nothing at round 2/.test(l)), 'a WARNING names the dead probe rather than reporting it as an operator cancel')
  console.log('loop: a breaker that returns nothing fails SAFE and stops the loop OK')
}

// A breaker that answers anything other than PRESENT is also a stop. The enum
// says PRESENT|ABSENT, but the check must not be `=== 'ABSENT'` — an
// out-of-enum answer is a broken probe, and broken probes stop the run.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    breaker: r => (r === 1 ? true : { token: 'MAYBE', evidence: 'a probe that ignored its schema' }),
    rounds: [],
    runawayGuard: 5,
  })
  eq(r.result.outcome.status, 'CANCELLED', 'a non-PRESENT answer stops the run, whatever word it used')
  eq(r.result.rounds, 1, 'exactly 1 round completed')
  console.log('loop: only PRESENT continues the loop — any other answer stops it OK')
}

// The breaker agent type is pinned, and it must be the isolated one. If this
// ever resolves to the critic or the builder, the probe is no longer a third
// party and the enforced bullet about it becomes false.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    breaker: r => r <= 1,
    rounds: [],
  })
  const probe = r.prompts.find(p => p.label === 'round-1:breaker')
  ok(probe, 'a breaker probe ran')
  eq(probe.agentType, 'gauntlet-loop:gauntlet-breaker', 'the breaker agent type is exactly gauntlet-loop:gauntlet-breaker')
  ok(probe.prompt.includes(TOKEN), 'the probe is told which path to test')
  ok(!probe.prompt.includes(CANDIDATE), 'the probe is never told the candidate path')
  ok(!probe.prompt.includes(REFERENCE), 'the probe is never told the reference path')
  ok(!probe.prompt.includes(GOAL), 'the probe is never told the goal')
  console.log('loop: the breaker is a third party — pinned agent type, and blind to goal and both artifacts OK')
}

// Budget stop: a budget whose remaining() falls below the reserve after
// round 1 must stop the loop with status BUDGET before round 2 starts.
{
  let calls = 0
  const budget = { total: 100000000, remaining: () => (calls++ === 0 ? 100000000 : 10) }
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    rounds: [{ candidateWins: false, gap: 'GAP-ROUND-1' }],
    budget,
  })
  eq(r.result.outcome.status, 'BUDGET', 'stops with status BUDGET once remaining() falls below the reserve')
  eq(r.result.rounds, 1, 'exactly 1 round ran before the stop')
  eq(r.labels.filter(l => l.endsWith(':ab')).length, 1, 'exactly 1 critic ran')
  ok(!r.labels.includes('round-2:ab'), 'no round 2 critic started')
  console.log('loop: budget stop prevents a further round OK')
}

// Required args: goal, candidate and reference each missing must throw, and
// the reference error must explain why a bar is mandatory.
{
  let threw = false
  try {
    await runLoop({ args: { candidate: CANDIDATE, reference: REFERENCE, token: TOKEN } })
  } catch (e) {
    threw = true
    ok(/args\.goal is required/.test(e.message), 'missing-goal error names the missing arg')
  }
  ok(threw, 'missing args.goal throws')
}
{
  let threw = false
  try {
    await runLoop({ args: { goal: GOAL, reference: REFERENCE } })
  } catch (e) {
    threw = true
    ok(/args\.candidate is required/.test(e.message), 'missing-candidate error names the missing arg')
  }
  ok(threw, 'missing args.candidate throws')
}
{
  let threw = false
  try {
    await runLoop({ args: { goal: GOAL, candidate: CANDIDATE, token: TOKEN } })
  } catch (e) {
    threw = true
    ok(/args\.reference is required/.test(e.message), 'missing-reference error names the missing arg')
    ok(/bar is the most important part/i.test(e.message), 'missing-reference error explains WHY a bar is mandatory, not a generic message')
  }
  ok(threw, 'missing args.reference throws')
}
console.log('loop: required args throw, and the reference error explains why a bar is mandatory OK')

// Agent types: critic calls use gauntlet-loop:gauntlet-ab-critic, builder
// calls use gauntlet-loop:gauntlet-builder. Pinned by exact equality.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    rounds: [
      { candidateWins: false, gap: 'GAP-ROUND-1' },
      { candidateWins: true, gap: 'unused' },
    ],
  })
  const critic1 = r.prompts.find(p => p.label === 'round-1:ab')
  const builder1 = r.prompts.find(p => p.label === 'round-1:build')
  const critic2 = r.prompts.find(p => p.label === 'round-2:ab')
  ok(critic1 && builder1 && critic2, 'round 1 critic+builder and round 2 critic all ran')
  eq(critic1.agentType, 'gauntlet-loop:gauntlet-ab-critic', 'round 1 critic agent type is exactly gauntlet-loop:gauntlet-ab-critic')
  eq(critic2.agentType, 'gauntlet-loop:gauntlet-ab-critic', 'round 2 critic agent type is exactly gauntlet-loop:gauntlet-ab-critic')
  eq(builder1.agentType, 'gauntlet-loop:gauntlet-builder', 'builder agent type is exactly gauntlet-loop:gauntlet-builder')
  console.log('loop: agent types pinned by exact equality OK')
}

// ---------------------------------------------------------------------------
// Fix-wave tests: binding the enforced/not_enforced claims to what is actually
// true, per artifact under review at .superpowers/sdd/2026-08-23-gauntlet-first-run.
// ---------------------------------------------------------------------------

// THERE IS NO ROUND CAP. This is the load-bearing test for the whole change:
// with the token always present, no budget, and a critic that never picks the
// candidate, nothing in loop.js stops the run. The old code stopped at 8. The
// proof is that the HARNESS's own runaway guard has to be the thing that fires
// — if loop.js still had a hidden default, this test would end quietly instead.
{
  let threw = null
  try {
    await runLoop({
      args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
      rounds: [],
      runawayGuard: 12,
    })
  } catch (e) { threw = e }
  ok(threw, 'an unbounded run does NOT stop on its own — no round cap exists in loop.js')
  ok(/harness runaway guard/.test(threw.message), 'it was the harness that stopped it, not loop.js')
  ok(/round 13/.test(threw.message), 'the loop ran past 8 — the old default cap is gone, not merely raised')
  console.log('loop: no round cap — an unbounded run runs past the old 8-round default until the harness stops it OK')
}

// ...and the NOTE that replaces the old cap WARNING must name the token as the
// thing that will stop the run, because with no budget it is the only thing.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN }, // no budget
    breaker: r => r <= 1,
    rounds: [],
  })
  const note = r.logs.find(l => /no budget target set/.test(l))
  ok(note, 'a run with no budget says so')
  ok(note.includes(TOKEN), 'the note names the token path — the operator cannot cancel a path they were never told')
  ok(/no round cap/.test(note), 'the note states plainly that there is no round cap')
  const claim = r.result.enforced.find(b => /no round cap existed/.test(b))
  ok(claim, 'the enforced round-count claim leads with the absence of a cap')
  ok(/OPERATOR removed the run token/.test(claim), 'a CANCELLED run attributes the stop to the operator, not to a limit')
  console.log('loop: the no-budget NOTE names the token, and CANCELLED credits the operator OK')
}
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    rounds: [{ candidateWins: true, gap: 'unused' }],
  })
  const claim = r.result.enforced.find(b => /no round cap existed/.test(b))
  ok(claim, 'a WON run states that no round cap existed')
  ok(/stopped on the candidate winning/.test(claim), 'and names the win as the reason it stopped')
  console.log('loop: WON outcome reports the win as the terminator, with no cap to mention OK')
}
{
  let calls = 0
  const budget = { total: 100000000, remaining: () => (calls++ === 0 ? 100000000 : 10) }
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    rounds: [{ candidateWins: false, gap: 'GAP-ROUND-1' }],
    budget,
  })
  const claim = r.result.enforced.find(b => /no round cap existed/.test(b))
  ok(claim, 'a BUDGET run also states that no round cap existed')
  ok(/pre-committed budget target/.test(claim), 'and attributes the stop to the budget, distinctly from an operator cancel')
  ok(!/removed the run token/.test(claim), 'a budget stop is not reported as a cancel')
  console.log('loop: BUDGET outcome is reported as its own terminator, distinct from a cancel OK')
}

// A token that is absent at the FIRST check must stop the run before it spends
// anything. This is the mistyped-path case: the operator names a token that was
// never created, and the failure has to be cheap and self-explaining rather
// than a run that quietly does nothing or, worse, one that runs uncancellable.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    breaker: () => false,
    rounds: [],
  })
  eq(r.result.outcome.status, 'CANCELLED', 'an absent token stops the run immediately')
  eq(r.result.rounds, 0, 'zero rounds ran')
  eq(r.labels.filter(l => l.endsWith(':ab')).length, 0, 'no critic was spawned')
  eq(r.labels.filter(l => l.endsWith(':build')).length, 0, 'no builder was spawned')
  eq(r.labels, ['round-1:breaker'], 'the entire run cost one breaker probe and nothing else')
  ok(/never created/.test(r.result.outcome.why), 'the reason distinguishes "never created" from a mid-run cancel')
  ok(/check the path/.test(r.result.outcome.why), 'and tells the operator what to check')
  console.log('loop: a token absent at the first check stops the run for the price of one probe OK')
}

// args.token is required, and the error has to explain why rather than just
// naming the field — a missing token means a run with no stop at all.
{
  let threw = false
  try {
    await runLoop({ args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE } })
  } catch (e) {
    threw = true
    ok(/args\.token is required/.test(e.message), 'missing-token error names the missing arg')
    ok(/no round cap/.test(e.message), 'the error explains that the token is the stop, since there is no cap')
    ok(/cancel-loop/.test(e.message), 'the error names the command that removes it')
  }
  ok(threw, 'missing args.token throws')
  console.log('loop: args.token is required, and the error says why a run without one cannot be stopped OK')
}

// #3: the spawn count is not history.length. A critic that returns null at
// round 2 means two critics were spawned but only one produced a verdict.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    critic: (round, s) => {
      if (round === 1) return { winner: s.referenceSide, why: 'why', gap: 'GAP-1', inspected: 'inspected' }
      return null
    },
  })
  eq(r.result.outcome.status, 'ERROR', 'a null-returning critic at round 2 ends the loop in ERROR')
  eq(r.result.history.length, 1, 'only round 1 produced a recorded verdict')
  eq(r.labels.filter(l => l.endsWith(':ab')).length, 2, 'two critics were actually spawned (round 1 and the failed round 2)')
  const spawnBullet = r.result.enforced.find(b => /separate critic spawn/i.test(b))
  ok(spawnBullet, 'a spawn-count bullet is present')
  ok(/\b2 separate critic spawn/.test(spawnBullet), 'the bullet reports the actual spawn count (2), not history.length (1)')
  ok(/1 produced a recorded verdict/.test(spawnBullet), 'the bullet also reports how many produced a recorded verdict')
  console.log('loop: spawn-count bullet counts actual spawns, not history.length OK')
}

// #4: the schema enforces one gap SLOT (a required string field), not one gap
// — nothing stops several gaps being packed into that one field.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    breaker: r => r <= 1,
    rounds: [],
  })
  const gapBullet = r.result.enforced.find(b => /gap SLOT/i.test(b))
  ok(gapBullet, 'a gap-slot bullet is present in enforced, replacing the old "exactly one gap" overclaim')
  const residual = r.result.not_enforced.find(b => /packed into it/i.test(b))
  ok(residual, 'the residual — several gaps packed into one string field — is disclosed in not_enforced')
  console.log('loop: gap claim narrowed to one gap SLOT, packing residual disclosed OK')
}

// #1: the critic's no-Write/no-Edit claim must be scoped to the tools it
// lacks, not to what it "could not fix" — it still holds Bash.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    breaker: r => r <= 1,
    rounds: [],
  })
  const writeBullet = r.result.enforced.find(b => /no Write or Edit/i.test(b))
  ok(writeBullet, 'the Write/Edit bullet is present')
  ok(/those TOOLS/i.test(writeBullet), 'the bullet claims only what the tool allowlist buys, not a blanket "could not fix"')
  const residual = r.result.not_enforced.find(b => /holds Bash and KillShell/i.test(b))
  ok(residual, 'the Bash residual is disclosed in not_enforced')
  console.log('loop: critic Write/Edit claim narrowed to the tool allowlist, Bash residual disclosed OK')
}

// #5: a URL or prose reference defeats the blind A/B formatting (the two
// ARTIFACT lines render in visibly different shapes), and the verdict must
// say so instead of asserting blindness it did not buy.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: 'https://example.com/theoriginal.html', token: TOKEN },
    breaker: r => r <= 1,
    rounds: [],
  })
  ok(r.logs.some(l => /WARNING: args\.reference does not look like an absolute filesystem path/.test(l)), 'a URL reference triggers the loud runtime warning')
  ok(!r.result.enforced.some(b => /never TOLD which artifact was the candidate/i.test(b)), 'the blindness bullet is withheld from enforced when the reference is a URL')
  const residual = r.result.not_enforced.find(b => /was not a comparable filesystem path/i.test(b))
  ok(residual, 'not_enforced explains this run\'s A/B was not blind')
  console.log('loop: URL reference downgrades the blindness claim instead of asserting it falsely OK')
}
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: 'the original Call of Duty main menu, side by side', token: TOKEN },
    breaker: r => r <= 1,
    rounds: [],
  })
  ok(r.logs.some(l => /WARNING: args\.reference does not look like an absolute filesystem path/.test(l)), 'a prose reference triggers the loud runtime warning')
  ok(!r.result.enforced.some(b => /never TOLD which artifact was the candidate/i.test(b)), 'the blindness bullet is withheld from enforced when the reference is prose')
  console.log('loop: prose reference downgrades the blindness claim instead of asserting it falsely OK')
}
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    breaker: r => r <= 1,
    rounds: [],
  })
  ok(!r.logs.some(l => /WARNING: args\.reference does not look like/.test(l)), 'a comparable-path reference triggers no blindness warning')
  ok(r.result.enforced.some(b => /never TOLD which artifact was the candidate/i.test(b)), 'the blindness bullet is present when the reference is a comparable path')
  const residual = r.result.not_enforced.find(b => /told not to infer/i.test(b))
  ok(residual, 'not_enforced still discloses that inference itself is not prevented')
  console.log('loop: comparable-path reference keeps the (narrower) blindness claim OK')
}

// #11: budgetLeft() must be defensive against the real runtime it has never
// met — a plain-number `remaining`, and a `remaining()` that throws — without
// crashing the loop, failing SAFE (stop) rather than open (infinite).
{
  const budget = { total: 100000000, remaining: 10 } // number, not a function
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    rounds: [],
    budget,
  })
  eq(r.result.outcome.status, 'BUDGET', 'a numeric (non-function) budget.remaining is read directly and still triggers the budget stop')
  eq(r.result.rounds, 0, 'stops before round 1 since remaining is already below the reserve')
  console.log('loop: budgetLeft() handles budget.remaining as a plain number without crashing OK')
}
{
  const budget = { total: 100000000, remaining: () => { throw new Error('boom') } }
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    rounds: [],
    budget,
  })
  eq(r.result.outcome.status, 'BUDGET', 'a throwing budget.remaining() fails SAFE to a budget stop rather than crashing the loop')
  eq(r.result.rounds, 0, 'stops before round 1 rather than proceeding on a broken budget')
  ok(r.logs.some(l => /budget\.remaining\(\) threw/.test(l)), 'a WARNING is logged when budget.remaining() throws')
  console.log('loop: budgetLeft() survives budget.remaining() throwing without crashing the loop OK')
}

// issue #11: `verdict.why` must not reach the builder. It is a REQUIRED
// AB_SCHEMA field holding the critic's full account of what separated the two
// artifacts — in practice a list of differences, i.e. a second, unbounded gap
// channel aimed at the one-change-per-round property the build prompt spends
// four lines defending. It is still collected and recorded; it is not
// forwarded.
{
  const WHY = 'WHY-FIELD-shading is flat, audio is missing, and the menu has no transitions'
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    rounds: [
      { candidateWins: false, gap: 'THE-ONE-GAP-FOR-ROUND-1', why: WHY },
      { candidateWins: true },
    ],
  })
  const build1 = r.prompts.find(p => p.label === 'round-1:build')
  ok(build1, 'round 1 builder ran')
  ok(build1.prompt.includes('THE-ONE-GAP-FOR-ROUND-1'), 'the gap still reaches the builder')
  ok(!build1.prompt.includes(WHY), 'the critic\'s `why` does NOT reach the builder')
  ok(!/separated them/i.test(build1.prompt), 'no "what separated them" context block is rendered into the build prompt')
  eq(r.result.history[0].why, WHY, '`why` is still collected and recorded in history for the human')
  const bullet = r.result.enforced.find(b => /`why` field is not forwarded/.test(b))
  ok(bullet, 'the enforced bullet claims the narrow property that is now actually true')
  console.log('loop: verdict.why is recorded but never forwarded to the builder OK')
}

// issue #12: the blindness gate is a shape CLASS over BOTH sides, not "starts
// with / and contains no whitespace". Every shape below renders visibly
// differently from an absolute POSIX path, so every one must withhold the
// blindness bullet and warn. Only the first is the reported incident; the rest
// are held-out shapes the fix was not induced from.
for (const [ref, what] of [
  ['//example.com/theoriginal.html', 'protocol-relative URL (the reported incident)'],
  ['C:\\x\\theoriginal.html', 'a Windows path'],
  ['./theoriginal.html', 'a relative path'],
  ['~/x/theoriginal.html', 'a tilde path'],
]) {
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: ref, token: TOKEN },
    breaker: r => r <= 1,
    rounds: [],
  })
  ok(r.logs.some(l => /WARNING: args\.reference does not look like an absolute filesystem path/.test(l)), `${what} triggers the blindness warning`)
  ok(!r.result.enforced.some(b => /never TOLD which artifact was the candidate/i.test(b)), `${what} withholds the blindness bullet from enforced`)
  ok(r.result.not_enforced.some(b => /was not a comparable filesystem path/i.test(b)), `${what} discloses the not-blind residual`)
}
console.log('loop: protocol-relative, Windows, relative and tilde references all withhold the blindness claim OK')

// ...and the same gate applies to args.candidate. A non-path candidate breaks
// the formatting symmetry just as thoroughly, and must be blamed by its own
// name rather than reported as a reference problem.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: 'mybuild.html', reference: REFERENCE, token: TOKEN },
    breaker: r => r <= 1,
    rounds: [],
  })
  ok(r.logs.some(l => /WARNING: args\.candidate does not look like an absolute filesystem path/.test(l)), 'a non-path candidate is named in the warning, not blamed on the reference')
  ok(!r.result.enforced.some(b => /never TOLD which artifact was the candidate/i.test(b)), 'a non-path candidate also withholds the blindness bullet')
  console.log('loop: a non-path candidate is caught and named rather than blamed on the reference OK')
}

// ---------------------------------------------------------------------------
// Issue #16. The source gives the judge exactly one property — "That separate
// sub-agent should be a really harsh critic" — and loop.js carried it only in
// the header comment that quotes the source. A comment is not a prompt.
//
// This asserts against the RENDERED prompt every round, not against the file:
// the file is drift-guard's job, and a check that reads the source could pass
// while the clause sits somewhere no agent is handed.
// ---------------------------------------------------------------------------
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    breaker: r => r <= 3,
    rounds: [],
  })
  const criticPrompts = r.prompts.filter(p => p.label.endsWith(':ab'))
  eq(criticPrompts.length, 3, 'three critic prompts captured')
  for (const p of criticPrompts) {
    ok(/harsh critic/i.test(p.prompt), `critic prompt (${p.label}) instructs the critic to be a harsh critic`)
    ok(/not good enough yet|good enough yet/i.test(p.prompt), `critic prompt (${p.label}) sets the default posture: not good enough yet`)
    // The harsh clause must not buy its strictness by breaking blindness — the
    // existing prompt tests forbid the word "candidate", and this is the same
    // property re-checked at the place the new text was added.
    ok(!/candidate/i.test(p.prompt), `the harsh clause did not reintroduce the word "candidate" in ${p.label}`)
  }
  console.log('loop: every round prompt carries the harsh-critic instruction, blindness intact OK')
}

// ...and it is disclosed as a PROMPT, not banked as a property. An instruction
// to be harsh is not evidence of a harsh critic, and the moment this bullet
// moves into `enforced` the verdict is claiming a calibration that never ran.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    breaker: r => r <= 1,
    rounds: [],
  })
  const residual = r.result.not_enforced.find(b => /harsh INSTRUCTION produced a harsh CRITIC/.test(b))
  ok(residual, 'not_enforced discloses that nothing verifies the instruction worked')
  ok(!r.result.enforced.some(b => /harsh/i.test(b)), 'enforced makes no harshness claim — a prompt instruction is not an enforced property')
  console.log('loop: harshness is disclosed as an unverified instruction, never claimed as enforced OK')
}
