import { runGauntlet, ok, eq } from './harness.mjs'

// An explicit lens set must be honored verbatim, and calibratedLens must
// override whatever gate 2 nominated.
const r = await runGauntlet({
  args: {
    artifact: '/tmp/x/artifact.md',
    scratch: '/tmp/x/scratch',
    lenses: [
      { key: 'alpha', lane: 'lane A' },
      { key: 'beta', lane: 'lane B' },
    ],
    calibratedLens: 'beta',
  },
  // gate 2 nominates 'alpha' and offers three lenses of its own; both must lose
  design: {
    need_restatement: 'the need',
    lenses: [
      { key: 'gate2one', lens: 'g1' },
      { key: 'gate2two', lens: 'g2' },
      { key: 'gate2three', lens: 'g3' },
    ],
    calibration_lens: 'gate2one',
    calibration_reason: 'because',
    acceptance_rule: 'rule',
    findings_for_operator: 'none',
  },
})

eq(r.result.round1.map(x => x.lens).sort(), ['alpha', 'beta'], 'operator lens set honored')
eq(r.result.calibration.lens, 'beta', 'calibratedLens override honored')
ok(!r.result.round1.some(x => x.lens.startsWith('gate2')), 'gate 2 lenses discarded when operator supplied a set')

console.log('orchestration: lens resolution OK')

const BASE = {
  artifact: '/tmp/x/artifact.md',
  scratch: '/tmp/x/scratch',
  lenses: [
    { key: 'alpha', lane: 'lane A' },
    { key: 'beta', lane: 'lane B' },
  ],
  calibratedLens: 'alpha',
}

const seed = n => ({
  seeded_path: `/tmp/x/scratch/seeded-${n}.md`,
  removed_verbatim: [`removed string number ${n} long enough to count`],
  inserted_verbatim: ['wrong'],
  location: 'line 10',
  defect_kind: `kind-${n}`,
  why_in_lane: 'in lane',
})

// A VOID must NOT consume the retry: void once, then pass, and the run
// proceeds to a full panel.
{
  const r = await runGauntlet({
    args: BASE,
    seeds: [seed(1), seed(2)],
    judges: [
      { caught: false, in_lane: false, reasoning: 'landed in the other lane' }, // VOID
      { caught: true, in_lane: true, reasoning: 'named it' },                   // PASS
    ],
  })
  eq(r.result.verdict, 'COMPLETE', 'a VOID then a PASS still reaches a panel')
  eq(r.result.calibration.voids, 1, 'the VOID was counted')
  eq(r.result.calibration.misses, 0, 'the VOID was not counted as a miss')
  ok(r.result.round1.length === 2, 'panel spawned after calibration passed')
  console.log('orchestration: VOID does not consume the retry OK')
}

// Two VOIDs terminate with NO VERDICT and never spawn the panel.
{
  const r = await runGauntlet({
    args: BASE,
    seeds: [seed(1), seed(2)],
    judges: [
      { caught: false, in_lane: false, reasoning: 'out of lane' },
      { caught: false, in_lane: false, reasoning: 'out of lane again' },
    ],
  })
  eq(r.result.verdict, 'NO VERDICT', 'two VOIDs terminate')
  eq(r.result.stage, 'gate 7', 'terminated at gate 7')
  ok(!r.labels.some(l => l.startsWith('critic:')), 'panel never spawned')
  ok(typeof r.result.bar === 'string' && r.result.bar.length > 0, 'the blind bar survives the halt')
  console.log('orchestration: two VOIDs -> NO VERDICT, bar survives OK')
}

// Two genuine misses terminate, and the retry used a different plant.
{
  const r = await runGauntlet({
    args: BASE,
    seeds: [seed(1), seed(2)],
    judges: [
      { caught: false, in_lane: true, reasoning: 'missed it' },
      { caught: false, in_lane: true, reasoning: 'missed it again' },
    ],
  })
  eq(r.result.verdict, 'NO VERDICT', 'two misses terminate')
  eq(r.result.misses, 2, 'both counted as misses')
  const seeders = r.prompts.filter(p => p.label.startsWith('gate7:seeder'))
  eq(seeders.length, 2, 'two seeder attempts')
  ok(seeders[1].prompt.includes('kind-1'), 'the retry seeder was told which defect kind was already used')
  ok(seeders[1].prompt.includes('DIFFERENT'), 'the retry seeder was ordered to use a different plant')
  console.log('orchestration: two misses -> NO VERDICT, retry differs OK')
}

// The leak check must fire on a verbatim removed string, and a leak is a VOID
// rather than a pass — even though the judge would have said "caught".
//
// Only ONE seed is supplied: attempt 1 leaks (VOID), attempt 2 gets no seed
// (VOID), so the run terminates at two VOIDs and the judge is never reached.
// Supplying a second seed here would let attempt 2 pass and the judge WOULD be
// called, which is correct behaviour but tests nothing about the leak.
{
  const s = seed(1)
  const r = await runGauntlet({
    args: BASE,
    seeds: [s],
    judges: [{ caught: true, in_lane: true, reasoning: 'would have passed' }],
    criticOut: label =>
      label.startsWith('gate7:critic')
        ? `I compared against the original which said "${s.removed_verbatim[0]}" so the text is wrong.`
        : 'FINDING x-1\nGETS-RIGHT: a\nFAILED-ATTACK: b',
  })
  eq(r.result.verdict, 'NO VERDICT', 'a leaked trial cannot reach a panel')
  eq(r.result.voids, 2, 'the leak counted as a VOID, not as a pass')
  eq(r.result.misses, 0, 'a leak is never a miss')
  const judgeCalls = r.labels.filter(l => l.startsWith('gate7:judge')).length
  eq(judgeCalls, 0, 'a leaked trial short-circuits before the judge is even asked')
  console.log('orchestration: leak grep fires and voids the trial OK')
}

// The blind bar's prompt must not contain the artifact path. This is the
// claim gate 5 rests on, and it is checkable directly.
{
  const r = await runGauntlet({ args: BASE })
  const barCall = r.prompts.find(p => p.label === 'gate5:blind-bar')
  ok(barCall, 'the bar writer ran')
  ok(!barCall.prompt.includes(BASE.artifact), 'bar prompt does not contain the artifact path')
  ok(barCall.agentType && barCall.agentType.includes('bar-writer'), 'bar writer ran as the restricted type')
  console.log('orchestration: bar writer never receives the artifact path OK')
}

// The seeder must not receive the critic prompt. The distinguishing string is
// the anchor rule, which every critic carries and the seeder must not.
{
  const r = await runGauntlet({ args: BASE })
  const seeder = r.prompts.find(p => p.label.startsWith('gate7:seeder'))
  ok(!seeder.prompt.includes('THE ANCHOR RULE'), 'seeder prompt does not carry the critic contract')
  ok(seeder.agentType && seeder.agentType.includes('seeder'), 'seeder ran as the restricted type')
  console.log('orchestration: seeder never receives the critic prompt OK')
}

// The calibration critic must be byte-identical to a deployed critic apart
// from the artifact path it is pointed at. A stand-in measures nobody.
{
  const r = await runGauntlet({ args: BASE })
  const cal = r.prompts.find(p => p.label.startsWith('gate7:critic'))
  const deployed = r.prompts.find(p => p.label === 'critic:alpha')
  ok(cal && deployed, 'both the calibration critic and the deployed critic ran')
  const normalise = s => s.replace(/\/tmp\/x\/scratch\/seeded-\d+\.md/g, 'PATH').replace(BASE.artifact, 'PATH')
  eq(normalise(cal.prompt), normalise(deployed.prompt), 'calibration critic prompt is byte-identical to the deployed one')
  ok(!cal.prompt.toLowerCase().includes('calibrat'), 'the calibration critic is not told it is being calibrated')
  console.log('orchestration: calibration critic is the deployed critic OK')
}

// Round 2 must be fresh spawns, one per lens, and must carry the pooled
// findings rather than continuing a round-1 agent.
{
  const r = await runGauntlet({ args: BASE })
  const r2 = r.prompts.filter(p => p.label.startsWith('round2:'))
  eq(r2.length, 2, 'one round-2 spawn per lens')
  ok(r2.every(p => p.prompt.includes('CROSS-CHECK')), 'round 2 orders a cross-check')
  ok(r2.every(p => p.prompt.includes('Last scheduled round')), 'round 2 is declared terminal to the worker')
  eq(r.result.calibration.caveat === null, false, 'a 2-lens run with 1 calibrated lens carries the uncalibrated caveat')
  console.log('orchestration: round 2 spawns fresh and terminal OK')
}
