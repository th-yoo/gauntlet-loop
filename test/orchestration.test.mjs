import { runGauntlet, ok, eq } from './harness.mjs'

// An explicit lens set must be honored verbatim, and gate 2's own lenses
// discarded. The calibration lens is gate 2's call, not the operator's --
// args.calibratedLens was removed when this merged with fix/dogfood-findings,
// because SKILL.md gives that choice to gate 2 ("the one where a miss is most
// expensive") and an operator override lets the operator second-guess the one
// party positioned to make it. What replaces it is stricter, not weaker: if
// gate 2 names a lens that is not in the set it emitted, the run falls back to
// the first lens AND records that it did, so a fallback can never be read as
// an aimed calibration.
const r = await runGauntlet({
  args: {
    artifact: '/tmp/x/artifact.md',
    scratch: '/tmp/x/scratch',
    lenses: [
      { key: 'alpha', lane: 'lane A' },
      { key: 'beta', lane: 'lane B' },
    ],
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
// gate 2 nominated 'gate2one', which is not in the operator's set, so this is
// the malformed-nomination path: fall back to the first lens and say so.
eq(r.result.calibration.lens, 'alpha', 'a calibration lens outside the operator\'s set falls back to the first lens of that set')
eq(r.result.calibration.calibration_lens_fallback, true, 'and the fallback is RECORDED, so it cannot be read as an aimed calibration')
ok(!r.result.round1.some(x => x.lens.startsWith('gate2')), 'gate 2 lenses discarded when operator supplied a set')

console.log('orchestration: lens resolution OK')

// An empty explicit array ([]) is truthy in JS but carries no lens — it must
// not be mistaken for an operator-supplied set, or LENSES ends up [] and
// calLens becomes undefined. It must fall back to gate 2's own lens set,
// same as if args.lenses were never supplied.
{
  const r = await runGauntlet({
    args: {
      artifact: '/tmp/x/artifact.md',
      scratch: '/tmp/x/scratch',
      lenses: [],
    },
    design: {
      need_restatement: 'the need',
      lenses: [
        { key: 'g1', lens: 'lens one' },
        { key: 'g2', lens: 'lens two' },
        { key: 'g3', lens: 'lens three' },
      ],
      calibration_lens: 'g1',
      calibration_reason: 'because',
      acceptance_rule: 'rule',
      findings_for_operator: 'none',
    },
  })
  eq(r.result.round1.map(x => x.lens).sort(), ['g1', 'g2', 'g3'], 'empty explicit lens array falls back to gate 2\'s lens set')
  console.log('orchestration: empty lens array falls back rather than throwing OK')
}

const BASE = {
  artifact: '/tmp/x/artifact.md',
  scratch: '/tmp/x/scratch',
  lenses: [
    { key: 'alpha', lane: 'lane A' },
    { key: 'beta', lane: 'lane B' },
  ],
}

const seed = n => ({
  seeded_path: `/tmp/x/scratch/seeded-${n}.md`,
  // The merged script runs a control arm; a seed with no control copy is a
  // VOID by contract, so every fixture carries one on an unrelated root.
  control_path: `/tmp/x/control/trial-${n}/subject.md`,
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
  eq(barCall.agentType, 'gauntlet-loop:gauntlet-bar-writer', 'bar writer ran as the exact live agent type')
  console.log('orchestration: bar writer never receives the artifact path OK')
}

// The seeder must not receive the critic prompt. The distinguishing string is
// the anchor rule, which every critic carries and the seeder must not.
{
  const r = await runGauntlet({ args: BASE })
  const seeder = r.prompts.find(p => p.label.startsWith('gate7:seeder'))
  ok(!seeder.prompt.includes('THE ANCHOR RULE'), 'seeder prompt does not carry the critic contract')
  eq(seeder.agentType, 'gauntlet-loop:gauntlet-seeder', 'seeder ran as the exact live agent type')
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
  eq(cal.agentType, 'gauntlet-loop:gauntlet-critic', 'calibration critic ran as the exact live agent type')
  eq(deployed.agentType, 'gauntlet-loop:gauntlet-critic', 'deployed critic ran as the exact live agent type')
  const verifier = r.prompts.find(p => p.label === 'verifier:grounding')
  ok(verifier, 'the verifier ran')
  eq(verifier.agentType, 'gauntlet-loop:gauntlet-verifier', 'verifier ran as the exact live agent type')
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
  ok(r2.every(p => p.agentType === 'gauntlet-loop:gauntlet-critic'), 'round 2 critics ran as the exact live agent type')
  eq(r.result.calibration.caveat === null, false, 'a 2-lens run with 1 calibrated lens carries the uncalibrated caveat')
  console.log('orchestration: round 2 spawns fresh and terminal OK')
}

// Width-1: an integer count of 1 must be honored, not floored up to 2. This
// is SKILL.md's gate 1 width-1 refusal (bar writer, one critic, verifier, no
// cross-check) — a deliberate, minimal outing the operator must be able to
// request, not a 0-spawn no-op.
{
  const r = await runGauntlet({
    args: {
      artifact: '/tmp/x/artifact.md',
      scratch: '/tmp/x/scratch',
      lenses: 1,
    },
  })
  eq(r.result.verdict, 'COMPLETE', 'a width-1 run still completes')
  eq(r.result.round1.length, 1, 'a width-1 request spawns exactly one critic')
  eq(r.result.calibration.caveat, null, 'a fully calibrated width-1 run carries no uncalibrated caveat')
  console.log('orchestration: width-1 run spawns one critic, no caveat OK')
}

// Fix-wave #1: critics hold Bash (see agents/gauntlet-critic.md), so "cannot
// alter what the others were reading" overclaims a structural guarantee.
// The enforced bullet must scope the claim to the tools actually denied, and
// the residual (Bash can still write files) must be disclosed.
{
  const r = await runGauntlet({ args: BASE })
  const writeBullet = r.result.enforced.find(b => /no Write or Edit/i.test(b))
  ok(writeBullet, 'the critic Write/Edit bullet is present')
  // Wording is theirs after the merge and is stronger than the phrasing this
  // test was written against: it names the channel that IS closed rather than
  // hedging the claim. Assert the property, not the sentence.
  ok(/file-editing tool call/i.test(writeBullet), 'the bullet claims only the channel the allowlist actually closes')
  ok(!/^critics cannot alter the artifact$/i.test(writeBullet.trim()), 'the bullet does not claim a blanket write-block')
  const residual = r.result.not_enforced.find(b => /general shell and can write files/i.test(b))
  ok(residual, 'the Bash residual is disclosed in not_enforced')
  ok(/false as stated/i.test(residual), 'and the disclosure says outright that the blanket claim would be false')
  console.log('orchestration: critic Write/Edit claim narrowed to the tool allowlist, Bash residual disclosed OK')
}

// DESIGN_SCHEMA.lenses.minItems must track WANT_LENSES, not sit at a hardcoded
// 2. The gate-2 prompt asks for "exactly N" lenses; a schema floor above N
// contradicts the prompt it is attached to, and at N=1 (gate 1's width-1
// refusal) it makes the request unsatisfiable. Previously untestable: the
// harness discarded the schema argument, a gap recorded in the SDD ledger.
{
  const r = await runGauntlet({ args: { ...BASE, lenses: 1 } })
  const design = r.prompts.find(p => p.label === 'gate2:design')
  ok(design && design.schema, 'the gate-2 design call was given a schema, and the harness now records it')
  eq(design.schema.properties.lenses.minItems, 1, 'a width-1 request asks the schema for exactly 1 lens, not 2')
  eq(design.schema.properties.lenses.maxItems, 4, 'maxItems stays a flat ceiling')
  ok(/exactly 1\b/.test(design.prompt), 'and the prompt asks for exactly that many, so prompt and schema agree')
}
{
  const r = await runGauntlet({ args: { ...BASE, lenses: 3 } })
  const design = r.prompts.find(p => p.label === 'gate2:design')
  eq(design.schema.properties.lenses.minItems, 3, 'a 3-lens request asks the schema for exactly 3')
  console.log('orchestration: DESIGN_SCHEMA.minItems tracks WANT_LENSES, so prompt and schema cannot contradict OK')
}
