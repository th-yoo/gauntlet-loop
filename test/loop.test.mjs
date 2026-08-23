import { runLoop, ok, eq } from './harness.mjs'

// Deliberately do NOT spell "candidate" or "reference" inside these paths:
// the critic-never-told-which-is-which test greps the prompt for the word
// "candidate", and a path containing that word would trip the check for a
// reason that has nothing to do with loop.js's actual behavior.
const CANDIDATE = '/tmp/x/mybuild.html'
const REFERENCE = '/tmp/x/theoriginal.html'
const GOAL = 'a goal worth looping over'

// It stops when the candidate wins. Steered to win at round 3: exactly 3
// critics and 2 builders must have been spawned — a win must not trigger
// another build.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE },
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
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, maxRounds: 4 },
    rounds: [],
  })
  eq(r.result.outcome.status, 'CAP', 'ran to the cap without the candidate ever winning')
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
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, maxRounds: 3 },
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
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE },
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
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, maxRounds: 3 },
    rounds: [],
  })
  const criticLabels = r.labels.filter(l => l.endsWith(':ab'))
  eq(criticLabels, ['round-1:ab', 'round-2:ab', 'round-3:ab'], 'each round spawns a distinctly, sequentially labeled critic')
  eq(new Set(criticLabels).size, criticLabels.length, 'labels are unique — no continued agent')
  console.log('loop: fresh critic per round, distinct labels OK')
}

// Cap: with maxRounds:2 and a critic that never picks the candidate, the
// loop must stop at CAP after exactly 2 rounds.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, maxRounds: 2 },
    rounds: [],
  })
  eq(r.result.outcome.status, 'CAP', 'hits the cap when the critic never picks the candidate')
  eq(r.result.rounds, 2, 'exactly 2 rounds ran')
  eq(r.labels.filter(l => l.endsWith(':ab')).length, 2, 'exactly 2 critics spawned')
  eq(r.labels.filter(l => l.endsWith(':build')).length, 2, 'exactly 2 builders spawned')
  console.log('loop: maxRounds cap stops the loop at exactly 2 rounds OK')
}

// Budget stop: a budget whose remaining() falls below the reserve after
// round 1 must stop the loop with status BUDGET before round 2 starts.
{
  let calls = 0
  const budget = { total: 100000000, remaining: () => (calls++ === 0 ? 100000000 : 10) }
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE },
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
    await runLoop({ args: { candidate: CANDIDATE, reference: REFERENCE } })
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
    await runLoop({ args: { goal: GOAL, candidate: CANDIDATE } })
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
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE },
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

// #2/#7: round-count claim must be conditional on outcome.status, and the
// default (no maxRounds, no budget) invocation must state the fixed cap
// plainly instead of contradicting its own WARNING.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE }, // no maxRounds, no budget
    rounds: [],
  })
  eq(r.result.outcome.status, 'CAP', 'default invocation with no maxRounds/budget hits a cap')
  eq(r.result.rounds, 8, 'the default cap is 8 rounds')
  const claim = r.result.enforced.find(b => /round count|FIXED cap/i.test(b))
  ok(claim, 'a round-count claim is present in enforced')
  ok(/FIXED cap of 8 rounds/.test(claim), 'the default CAP run states the fixed cap plainly')
  ok(!/no fixed round count/i.test(claim), 'the CAP claim does not also assert "no fixed round count"')
  ok(r.logs.some(l => /WARNING: no maxRounds and no budget target/.test(l)), 'the honest default-cap WARNING is still logged')
  console.log('loop: default invocation honestly reports the fixed 8-round cap instead of contradicting its own warning OK')
}
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE },
    rounds: [{ candidateWins: true, gap: 'unused' }],
  })
  const claim = r.result.enforced.find(b => /round count/i.test(b))
  ok(/no fixed round count/i.test(claim), 'a WON run correctly keeps the "no fixed round count" claim')
  console.log('loop: WON outcome keeps the no-fixed-round-count claim OK')
}
{
  let calls = 0
  const budget = { total: 100000000, remaining: () => (calls++ === 0 ? 100000000 : 10) }
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE },
    rounds: [{ candidateWins: false, gap: 'GAP-ROUND-1' }],
    budget,
  })
  const claim = r.result.enforced.find(b => /round count/i.test(b))
  ok(/ended on budget/.test(claim), 'a BUDGET run reports ending on budget, not a fixed round count')
  console.log('loop: BUDGET outcome round-count claim reflects the actual stop reason OK')
}

// #7: an explicit maxRounds:0 must cap at zero rounds, not silently fall
// through to the 8-round default (the old `|| null` treated 0 as absent).
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, maxRounds: 0 },
    rounds: [],
  })
  eq(r.result.outcome.status, 'CAP', 'maxRounds:0 is an explicit cap, not "no cap supplied"')
  eq(r.result.rounds, 0, 'zero rounds ran when maxRounds is explicitly 0')
  eq(r.labels.filter(l => l.endsWith(':ab')).length, 0, 'no critic spawned when maxRounds is explicitly 0')
  ok(!r.logs.some(l => /WARNING: no maxRounds and no budget target/.test(l)), 'explicit maxRounds:0 does not trigger the "no maxRounds" warning')
  console.log('loop: maxRounds:0 caps at zero rounds instead of silently defaulting to 8 OK')
}

// #3: the spawn count is not history.length. A critic that returns null at
// round 2 means two critics were spawned but only one produced a verdict.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE },
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
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, maxRounds: 1 },
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
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, maxRounds: 1 },
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
    args: { goal: GOAL, candidate: CANDIDATE, reference: 'https://example.com/theoriginal.html', maxRounds: 1 },
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
    args: { goal: GOAL, candidate: CANDIDATE, reference: 'the original Call of Duty main menu, side by side', maxRounds: 1 },
    rounds: [],
  })
  ok(r.logs.some(l => /WARNING: args\.reference does not look like an absolute filesystem path/.test(l)), 'a prose reference triggers the loud runtime warning')
  ok(!r.result.enforced.some(b => /never TOLD which artifact was the candidate/i.test(b)), 'the blindness bullet is withheld from enforced when the reference is prose')
  console.log('loop: prose reference downgrades the blindness claim instead of asserting it falsely OK')
}
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, maxRounds: 1 },
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
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE },
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
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE },
    rounds: [],
    budget,
  })
  eq(r.result.outcome.status, 'BUDGET', 'a throwing budget.remaining() fails SAFE to a budget stop rather than crashing the loop')
  eq(r.result.rounds, 0, 'stops before round 1 rather than proceeding on a broken budget')
  ok(r.logs.some(l => /budget\.remaining\(\) threw/.test(l)), 'a WARNING is logged when budget.remaining() throws')
  console.log('loop: budgetLeft() survives budget.remaining() throwing without crashing the loop OK')
}
