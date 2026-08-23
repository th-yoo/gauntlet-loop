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
