// A piece that owns one side of its comparison and inherits the other is not a comparison.
//
//   node test/piece-pairing.test.mjs
//
// THE DEFECT, reproduced before it was fixed. `checkComparability()` runs ONCE, at
// loop.js:1347, against args.candidate and args.reference. It never runs per piece. But a
// piece resolves its sides independently — `PC = piece.candidate || CANDIDATE`,
// `PR = piece.reference || REFERENCE` — so a lead that gives a piece its own candidate
// file and no matching reference fragment produces a critic comparing a MODULE against a
// WHOLE ARTIFACT. Measured on the unfixed loop: a piece named `engine` with
// candidate `/tmp/x/engine.js` and no reference had its critic handed
//
//     ARTIFACT A: /tmp/x/whole.html      ARTIFACT B: /tmp/x/engine.js
//
// and the run reported WON. That is precisely the category error the top-level pairing
// check exists to refuse — one side a thing, the other a part of a different thing — and
// the guard could not see it because it had already run, one level up.
//
// WHY THIS IS A STRUCTURAL RULE AND NOT ANOTHER PROBE. The obvious fix is to run the
// comparability probe per piece, at two spawns each. It is the wrong fix: the failure is
// visible in the PATHS ALONE, without opening either file. A piece that names its own
// candidate is asserting "this part is separable"; if that were true of the reference too
// it would have a counterpart to name. Naming exactly one side is the assertion contradicting
// itself, and no agent is needed to see it.
//
// NOTHING HERE SPAWNS.

import { runLoop, ok, eq } from './harness.mjs'

const ARGS = { goal: 'a goal worth looping over', candidate: '/tmp/x/index.html', reference: '/tmp/x/whole.html', token: '/tmp/x/run.token' }
const win = (round, s) => ({ winner: s.candidateSide, why: 'w', gap: 'g', inspected: 'i', margin: 'decisive', shortfall: 's' })

console.log('piece-pairing: a piece naming its own candidate but not its own reference is dropped')
{
  const r = await runLoop({
    args: ARGS,
    lead: { decomposes: true, split_criterion: 'one file each', pieces: [
      { name: 'engine', observable: 'run it', candidate: '/tmp/x/engine.js' },
      { name: 'render', observable: 'look at it', candidate: '/tmp/x/render.js' }] },
    critic: win,
  })
  // Reasons live in `dropped_half_paired`; `dropped_count` is the total across all three
  // drop causes. Reading the count alone would not distinguish this from a missing observable.
  const half = (r.result.decomposition || {}).dropped_half_paired || []
  ok(half.length >= 2, `both half-paired pieces must be dropped with a reason — got ${half.length}: ${JSON.stringify(half).slice(0, 200)}`)
  ok(/reference/i.test(JSON.stringify(half)),
     'and the reason must name the missing side, not just say "invalid"')
  ok(/not a comparison/i.test(JSON.stringify(half)),
     'and say why that is fatal rather than merely irregular')
  // With fewer than two pieces surviving, the artifact runs WHOLE — which is the correct
  // degradation: one whole-vs-whole comparison beats two meaningless fragment comparisons.
  const abPrompts = r.prompts.filter(p => /engine-round-\d+:ab/.test(p.label))
  eq(abPrompts.length, 0, 'and no critic is ever asked to judge the fragment against the whole reference')
}

console.log('piece-pairing: a piece naming BOTH sides is kept — the check does not eat real splits')
{
  // THE CONTROL. Without it this file passes against a loop that drops every piece with
  // any path at all, which would silently disable the multi-file parallelism the loop
  // already supports and which is the whole reason per-piece paths exist.
  const r = await runLoop({
    args: ARGS,
    lead: { decomposes: true, split_criterion: 'one file each', pieces: [
      { name: 'engine', observable: 'run it', candidate: '/tmp/x/engine.js', reference: '/tmp/x/ref-engine.js' },
      { name: 'render', observable: 'look at it', candidate: '/tmp/x/render.js', reference: '/tmp/x/ref-render.js' }] },
    critic: win,
  })
  eq(((r.result.decomposition || {}).dropped_half_paired || []).length, 0,
     'a properly paired piece must not be dropped')
  const p = r.prompts.find(x => x.label === 'engine-round-1:ab')
  ok(p, 'and its critic runs')
  ok(p.prompt.includes('/tmp/x/engine.js') && p.prompt.includes('/tmp/x/ref-engine.js'),
     'against its OWN two paths — a part compared with the matching part')
  ok(!p.prompt.includes('/tmp/x/whole.html'), 'and never against the whole reference')
}

console.log('piece-pairing: a piece naming NEITHER side is kept and inherits both')
{
  const r = await runLoop({
    args: ARGS,
    lead: { decomposes: true, split_criterion: 'facets of one file', pieces: [
      { name: 'feel', observable: 'play it', focus: 'how it responds' },
      { name: 'look', observable: 'see it', focus: 'how it reads' }] },
    critic: win,
  })
  eq(((r.result.decomposition || {}).dropped_half_paired || []).length, 0,
     'inheriting both sides is the ordinary case and stays legal')
  const p = r.prompts.find(x => x.label === 'feel-round-1:ab')
  ok(p && p.prompt.includes('/tmp/x/index.html') && p.prompt.includes('/tmp/x/whole.html'),
     'and the piece is judged whole against whole, which is what decision 0007 requires of it')
}

console.log('piece-pairing: stating what this cannot establish')
console.log('          NOT CHECKED: that a piece naming BOTH sides named the RIGHT counterpart. A lead')
console.log('          pointing a piece at an unrelated file in the reference produces a well-formed')
console.log('          pairing of two things that have nothing to do with each other, and only opening')
console.log('          them could tell. This rule catches the half-paired case, which is the one the')
console.log('          paths alone can prove wrong.')
