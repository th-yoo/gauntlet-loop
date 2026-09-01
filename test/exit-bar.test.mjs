// The exit bar is the source's, not ours — decision 0007's three deltas, as checks.
//
//   node test/exit-bar.test.mjs
//
// The operator's standing objection to this repo is one sentence: "our k is too small."
// Every prior session translated it into critics-per-piece or fan-out width — numbers the
// primary source does not contain — and left the number it DOES contain at 1.
//
// The source (mshumer/Claude-of-Duty/prompt.md, 941 bytes, quoted in references.md) puts
// its count at a scope we ran once:
//
//   3/4: "You should /loop on each item and have a separate sub-agent check it visually
//         ... and if it doesn't look triple A, it should keep going."
//   5/6: "Don't stop until EACH sub-agent is utterly wowed with the quality when compared
//         with the actual Call of Duty game. It should literally compare THEM side by side
//         blind and say which one looks better."
//
// "That separate sub-agent" of 3 and "each sub-agent" of 5 are the same agent. So the
// per-item critic's exit test is a WHOLE-ARTIFACT blind A/B, and every one of the N item
// critics must be wowed before anything stops. k = N falls out of the structure; it is
// not a setting. Three deltas follow, and this file is one block per delta.
//
// WHY THESE CAN FAIL: each block below failed against loop.js as it stood at eeb129b,
// which is the commit that recorded the decision and changed no code. They were written
// first and watched red — the repo's rule is that reasoning about a fix before the
// reproducible exists produces claims the artifact then refutes.
//
// NOTHING HERE SPAWNS. The harness answers every agent call.

import { runLoop, ok, eq } from './harness.mjs'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LOOP = readFileSync(join(ROOT, 'skills', 'gauntlet-loop', 'loop.js'), 'utf8')

const CANDIDATE = '/tmp/x/mybuild.html'
const REFERENCE = '/tmp/x/theoriginal.html'
const TOKEN = '/tmp/x/run.token'
const GOAL = 'a goal worth looping over'
const TWO = { decomposes: true, split_criterion: 'each subsystem renders alone', pieces: [
  { name: 'render', observable: 'open the frame' },
  { name: 'audio', observable: 'play it' }] }

// ---------------------------------------------------------------------------
// DELTA B — the per-piece critic judges the WHOLE artifact.
//
// Was: "JUDGE ONLY THIS PART: <piece>. Differences outside this part are not yours to
// weigh — another critic owns them." That is the exact opposite of sentence 5, and it is
// what made our whole-artifact judgement count 1 instead of N.
// ---------------------------------------------------------------------------
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    lead: TWO,
    critic: (round, s) => ({ winner: s.candidateSide, why: 'w', gap: 'g', inspected: 'i', margin: 'decisive' }),
  })
  // `:ab`, not any `render-round-1:` prompt — that piece also spawns `:breaker` and
  // `:size`, and the first draft of this test grabbed `:size` and passed four assertions
  // against a prompt that never contained the scope line in the first place.
  const p = r.prompts.find(x => x.label === 'render-round-1:ab')
  ok(p, 'a piece critic was spawned at all')
  ok(!/JUDGE ONLY THIS PART/.test(p.prompt),
     'the piece critic is no longer told to judge only its part — that instruction forbids the comparison sentence 5 requires')
  ok(!/not yours to weigh/.test(p.prompt),
     'and is no longer told that differences outside its part belong to another critic')
  // PINNED AS A SENTENCE, not as the word "whole". The first version asserted
  // /WHOLE/ && /whole/i, and the coverage sweep reported the property NOT CAUGHT:
  // deleting the sentence that assigns the winner's scope leaves "Compare them side by
  // side, WHOLE against whole" standing one line later, so the loose match survived the
  // mutation that removes the instruction. The claim under test is specifically that the
  // WINNER is whole-scoped — the critic's gap may still be about its item — so that is
  // the clause to hold.
  ok(/THE WINNER YOU PICK IS ABOUT THE WHOLE ARTIFACTS/.test(p.prompt),
     'the critic is told the WINNER it picks is about the whole artifacts, not about its item')
  // \s+ across the phrase: the prompt is hard-wrapped, so this clause carries a newline
  // inside it. A literal-space regex here went red against a prompt that says exactly this.
  ok(/not the\s+limit of what you weigh/.test(p.prompt),
     'and that its item bounds where it looks, not what it may weigh')
  // Sentence 3 survives: the item is still where this critic looks for its gap. Dropping
  // it entirely would make the N critics N copies of one judge with no division of
  // attention at all, which is not what the source says either.
  ok(/render/.test(p.prompt) && /open the frame/.test(p.prompt),
     'the piece is still named as where this critic looks first — sentence 3 is not discarded, only sentence 5 is added')
  console.log('exit-bar: the piece critic judges the whole artifact and looks at its own item OK')
}

// ---------------------------------------------------------------------------
// DELTA B, the count. N pieces => N whole-artifact judgements at the exit, and the
// verdict says so with a number an operator can read against the source's "each".
// ---------------------------------------------------------------------------
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    lead: TWO,
    critic: (round, s) => ({ winner: s.candidateSide, why: 'w', gap: 'g', inspected: 'i', margin: 'decisive' }),
  })
  eq(r.result.outcome.status, 'WON', 'two pieces, both critics wowed on the whole artifact — the run wins')
  ok(r.result.exit_bar, 'the verdict carries an exit_bar block')
  eq(r.result.exit_bar.wowed_required, 2,
     'the number of whole-artifact judgements required is the number of pieces — this is the source\'s "each sub-agent", and the operator\'s "k"')
  eq(r.result.exit_bar.wowed, 2, 'and every one of them came back wowed')
  eq(r.result.exit_bar.scope, 'whole-artifact',
     'the scope those judgements were made at is named, because that is the thing that was wrong')
  console.log('exit-bar: k at the exit is the piece count, reported as a number OK')
}

// ---------------------------------------------------------------------------
// DELTA C — "utterly wowed", not "preferred at all". A narrow win does not exit.
//
// This reverses an evidence-based choice and decision 0007 says why it does not block:
// the source's own operator stopped a run that never reached the bar, and removing the
// run token is that off-switch here. So the cost of an unreliable margin field is rounds,
// not a wrong verdict.
// ---------------------------------------------------------------------------
{
  let rounds = 0
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    lead: TWO,
    // The breaker stops the run after a few rounds, standing in for the operator who
    // removes the token. Without it a bar that is never met would loop forever, which is
    // the source's design and not something a test should sit through.
    breaker: () => { rounds++; return rounds <= 8 },
    critic: (round, s) => ({ winner: s.candidateSide, why: 'w', gap: 'g', inspected: 'i', margin: 'narrow' }),
  })
  ok(r.result.outcome.status !== 'WON',
     `every critic preferred the candidate NARROWLY and the run did not exit — got ${r.result.outcome.status}`)
  ok(r.result.exit_bar && r.result.exit_bar.wowed < r.result.exit_bar.wowed_required,
     'the verdict says how far short of the bar it stopped, rather than only that it stopped')
  console.log('exit-bar: a narrow win no longer exits OK')
}

// DELTA C, THE DIRECTION IT FAILS IN. Decision 0007 pre-committed this and the first
// implementation did the opposite: it filtered for `margin === 'narrow'`, so a critic that
// omitted the field, or returned a value outside the enum, was not narrow and passed the
// bar. Both were reproduced returning WON before this block existed.
//
// The schema requires `margin`, but the offline runtime does not validate schemas and
// `margin` reaches the loop as `v.margin || null` — which is exactly how two live runs
// once won with the separation unstated. A field that GATES has to be read as an
// allow-list, or the gate is open whenever the answer is unreadable.
{
  // The two cases a schema-enforcing runtime can actually deliver. OMITTING the field is
  // deliberately not one of them: AB_SCHEMA requires `margin`, the harness defaults it on
  // both of its paths for that reason, and a case built by omission would be testing an
  // input the real runtime refuses. What it can deliver is a value the enum does not
  // contain, or an explicit null — and loop.js reads `v.margin || null`, so both arrive
  // at the same place the fail-open bug lived.
  for (const [label, margin] of [['outside the enum', 'moderate'], ['null', null]]) {
    let rounds = 0
    const r = await runLoop({
      args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
      lead: TWO,
      breaker: () => { rounds++; return rounds <= 8 },
      critic: (round, s) => ({ winner: s.candidateSide, why: 'w', gap: 'g', inspected: 'i', margin }),
    })
    ok(r.result.outcome.status !== 'WON',
       `a margin that is ${label} is NOT wowed and does not exit — got ${r.result.outcome.status}`)
  }
  console.log('exit-bar: an unreadable margin fails closed, costing a round rather than ending the run OK')
}

// A decisive win does exit — the control that keeps the block above from passing because
// the loop stopped exiting for everything.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    lead: TWO,
    critic: (round, s) => ({ winner: s.candidateSide, why: 'w', gap: 'g', inspected: 'i', margin: 'decisive' }),
  })
  eq(r.result.outcome.status, 'WON', 'a decisive win still exits — the bar rose, it did not close')
  console.log('exit-bar: the bar rose rather than closing OK')
}

// ---------------------------------------------------------------------------
// DELTA A — not wowed sends the run back to building, rather than relabelling a run
// that already ended. Sentence 4: "if it doesn't look triple A, it should keep going."
// ---------------------------------------------------------------------------
{
  // Narrow until round 4, decisive after. If the bar is a gate, the run keeps building
  // through the narrow rounds and then wins. If it were a postmortem, it would have
  // exited at the first narrow win and never seen round 4.
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    lead: TWO,
    critic: (round, s) => ({
      winner: s.candidateSide, why: 'w', gap: `gap-${round}`, inspected: 'i',
      margin: round < 4 ? 'narrow' : 'decisive',
    }),
  })
  eq(r.result.outcome.status, 'WON', 'the run kept going through the narrow rounds and won when the critics were wowed')
  // PER PIECE, not the total. The first draft asserted `history.length >= 4`, which two
  // pieces satisfy with two rounds each — the arm-and-confirm pair every winning piece
  // already runs. It passed against the unfixed loop. A pass condition the broken thing
  // meets measures nothing, so the count that matters is how far ONE piece got: under the
  // old postmortem it armed at 1 and confirmed at 2 and never saw a decisive round.
  const renderRounds = r.result.history.filter(h => h.piece === 'render').length
  ok(renderRounds >= 4,
     `the "render" piece itself ran past the round where a narrow win used to exit — got ${renderRounds} round(s)`)
  ok(r.result.history.some(h => h.piece === 'render' && h.built),
     'and at least one of those rounds actually built, which is what "keep going" means')
  console.log('exit-bar: falling short of the bar sends the run back to building OK')
}

// ---------------------------------------------------------------------------
// WHAT THE BUILDER IS TOLD ON A ROUND THE CANDIDATE WON BUT DID NOT CLEAR THE BAR.
//
// This branch did not exist before the bar rose: the builder only ever ran on a round the
// candidate LOST, so the prompt could assert that flatly and hand over `gap`. AB_SCHEMA
// defines `gap` as "the single largest thing standing between the LOSER and the winner",
// so on a candidate win it describes the REFERENCE. The first version of the exit-bar
// change routed that text to the builder under the sentence "the candidate lost" — a false
// premise and a gap pointing at the wrong artifact, on every narrow-win round. Reproduced
// before this block was written: a critic whose gap read "THE REFERENCE lacks a table of
// contents" produced exactly that prompt.
//
// `shortfall` is the field that answers what the WINNER still needs, and it exists for
// this branch.
// ---------------------------------------------------------------------------
{
  let rounds = 0
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    breaker: () => { rounds++; return rounds <= 3 },
    critic: (round, s) => ({
      winner: s.candidateSide, why: 'w', inspected: 'i', margin: 'narrow',
      gap: 'THE REFERENCE lacks a table of contents',
      shortfall: 'THE CANDIDATE still has no worked example',
    }),
  })
  const b = r.prompts.find(p => /:build$/.test(p.label))
  ok(b, 'a not-wowed win still sends the round to the builder — "keep going" means building')
  ok(!/the candidate lost/.test(b.prompt),
     'the builder is NOT told the candidate lost on a round the candidate won')
  ok(/was NOT\s+utterly wowed/.test(b.prompt),
     'it is told what actually happened: the critic picked the candidate and was not wowed')
  ok(b.prompt.includes('THE CANDIDATE still has no worked example'),
     'and it is handed the SHORTFALL — what the winner still needs')
  ok(!b.prompt.includes('THE REFERENCE lacks a table of contents'),
     'not the gap, which on a round the candidate won describes the reference')
  console.log('exit-bar: a not-wowed win builds on the shortfall, under a true premise OK')
}

// The other side of that branch: the candidate LOST, so `gap` is the right text and the
// original premise is the true one. Without this the block above passes against a loop
// that sends the shortfall on every round, including the ones it must not.
{
  let rounds = 0
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    // Bounded by the breaker, not by the harness runaway guard. Letting the guard stop it
    // makes runLoop THROW, and the first draft of this block caught that and carried on
    // with an empty prompt list — an assertion about a prompt that was never collected.
    breaker: () => { rounds++; return rounds <= 2 },
    rounds: [{ candidateWins: false, gap: 'THE CANDIDATE has no error handling', why: 'w', inspected: 'i', margin: 'clear', shortfall: 'unused on this branch' }],
  })
  const b = (r.prompts || []).find(p => /:build$/.test(p.label))
  ok(b, 'a lost round builds too')
  ok(/the candidate lost/.test(b.prompt), 'and is told so, because it did')
  ok(b.prompt.includes('THE CANDIDATE has no error handling'), 'and gets the gap, not the shortfall')
  ok(!b.prompt.includes('unused on this branch'), 'the shortfall does not reach the builder on a lost round')
  console.log('exit-bar: a lost round still builds on the gap, under the original premise OK')
}

// A critic that is not wowed and names NOTHING to close. Falling back to `gap` here would
// reinstate the defect on exactly the rounds where the field is missing, so the round is
// skipped and the reason recorded — building on a critic that named nothing is building
// on noise.
{
  let rounds = 0
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    breaker: () => { rounds++; return rounds <= 3 },
    critic: (round, s) => ({
      winner: s.candidateSide, why: 'w', inspected: 'i', margin: 'narrow',
      gap: 'THE REFERENCE lacks a table of contents',
      shortfall: 'none',
    }),
  })
  ok(!r.prompts.some(p => /:build$/.test(p.label)),
     'no builder ran — there was nothing to build')
  ok((r.result.history || []).some(h => h.build_skipped),
     'and the round records that the builder was skipped, rather than the skip being silent')
  ok(/describes the reference/.test((r.result.history || []).find(h => h.build_skipped).build_skipped),
     'the record says why the loser-facing gap was not used as a fallback')
  console.log('exit-bar: not wowed with no shortfall named skips the build and says so OK')
}

// A run that reaches WON having built NOTHING, but did not win immediately. Until the bar
// rose those were the same event, and `won_without_building` said "Every piece won its
// first round, so the builder never ran" — which the skip branch made false. Reproduced at
// 4 rounds, 0 builds, WON, still carrying that sentence.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    critic: (round, s) => ({
      winner: s.candidateSide, why: 'w', gap: 'g', inspected: 'i',
      margin: round < 3 ? 'narrow' : 'decisive',
      shortfall: round < 3 ? 'none' : 'x',
    }),
  })
  eq(r.result.outcome.status, 'WON', 'the run won after rounds it did not clear the bar on')
  ok(r.result.history.length > 1 && !r.result.history.some(h => h.built),
     `and built nothing across ${r.result.history.length} round(s)`)
  ok(!/won its first round/.test(r.result.won_without_building),
     'the verdict does NOT claim the run won immediately — it did not')
  ok(/byte-identical/.test(r.result.won_without_building),
     'it says the winning artifact is the one the run started with')
  ok(/the critic, not the work/.test(r.result.won_without_building),
     'and names what actually changed between the failing rounds and the winning ones')
  console.log('exit-bar: winning with zero builds after failed rounds is reported as itself OK')
}

// The original cause still reports the original sentence — without this the block above
// passes against a loop that prints the skip wording on every zero-build run.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    rounds: [{ candidateWins: true, gap: 'unused', margin: 'decisive' }],
  })
  eq(r.result.outcome.status, 'WON', 'a run that wins from round 1 still wins')
  ok(/won its first round/.test(r.result.won_without_building),
     'and is still described as having won immediately, because it did')
  console.log('exit-bar: winning immediately is still reported as winning immediately OK')
}

// The round record carries the two fields that now decide it. `wowed` is not recoverable
// from `candidateWon`, and `shortfall` is what the builder was handed — a reader auditing
// which text went to the builder cannot check it against a field the record omits.
{
  let rounds = 0
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    breaker: () => { rounds++; return rounds <= 2 },
    critic: (round, s) => ({ winner: s.candidateSide, why: 'w', gap: 'g', inspected: 'i', margin: 'narrow', shortfall: 'the recorded shortfall' }),
  })
  const h = r.result.history[0]
  eq(h.candidateWon, true, 'the candidate won the round')
  eq(h.wowed, false, 'and the record says it did not clear the bar — a fact candidateWon cannot carry')
  eq(h.shortfall, 'the recorded shortfall', 'and the shortfall the builder was given is on the round')
  console.log('exit-bar: the round records wowed and shortfall, the fields that now decide it OK')
}

// The exit_bar note must not claim whole-artifact scope on a run that had none. Same
// overclaim as `scope`, one field over — the twin the repo's own rule says to look for.
{
  const r = await runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN },
    lead: { decomposes: true, split_criterion: 'c', pieces: [
      { name: 'render', observable: 'open the frame', candidate: '/tmp/x/render.js', reference: '/tmp/x/ref-render.js' },
      { name: 'audio', observable: 'play it', candidate: '/tmp/x/audio.js', reference: '/tmp/x/ref-audio.js' }] },
    critic: (round, s) => ({ winner: s.candidateSide, why: 'w', gap: 'g', inspected: 'i', margin: 'decisive' }),
  })
  ok(!/whole candidate against the whole reference/.test(r.result.exit_bar.note),
     `the note does not claim whole-artifact comparisons a per-piece-paths run never made — got: ${r.result.exit_bar.note}`)
  ok(/scope_note/.test(r.result.exit_bar.note), 'and points the reader at the field that explains it')
  console.log('exit-bar: the note does not overclaim scope the run did not have OK')
}

// THE LINE IS ONLY PAID FOR WHILE THE ROUND CAN STILL END. The escalation guard stopped
// at a first-critic dissent, because a lost round is lost whatever the rest say. The bar
// created a second settled case — a candidate win the first critic calls narrow cannot be
// wowed by anything that follows — and the guard did not know about it, so a k=4 run
// bought three verdicts per narrow round that could not change the outcome. It also made
// commands/loop.md's cost promise false: "only a round that could end costs two".
{
  const spawned = margin => runLoop({
    args: { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN, critics: 4 },
    // Stops after round 1: the token reads present for round 1 and absent for round 2, so
    // exactly one round's critic line is spawned and counted. A never-tripping breaker
    // here ran to the harness runaway guard instead, which throws and counts nothing.
    breaker: round => round <= 1,
    critic: (round, s) => ({ winner: s.candidateSide, why: 'w', gap: 'g', inspected: 'i', margin, shortfall: 's' }),
  }).then(r => r.labels.filter(l => /^round-1:ab/.test(l)).length)

  // A narrow first verdict settles the round: one critic, not four.
  eq(await spawned('narrow'), 1,
     'a round that can no longer clear the bar stops after the first critic')
  // The control. Without it this passes against a loop that never escalates at all, which
  // would silently reduce every k>1 run to k=1 — the failure this check must not permit.
  eq(await spawned('decisive'), 4,
     'a round that can still end pays for the whole line — the guard narrowed, it did not close')
  console.log('exit-bar: the critic line is paid for only while the round can still end OK')
}

// The allow-list must stay a SUBSET of the schema's enum. Two literals that must agree,
// recomputed here rather than asserted in a comment beside them — a comment claiming two
// literals agree is the shape this repo keeps finding to be false.
{
  const enumMatch = LOOP.match(/margin: \{ type: 'string', enum: \[([^\]]+)\]/)
  ok(enumMatch, 'the margin enum is still findable in AB_SCHEMA — if this fails the check went blind, not green')
  const enumVals = enumMatch[1].split(',').map(x => x.trim().replace(/^'|'$/g, ''))
  const allowMatch = LOOP.match(/const WOWED_MARGINS = new Set\(\[([^\]]+)\]\)/)
  ok(allowMatch, 'the wowed allow-list is still findable')
  const allowVals = allowMatch[1].split(',').map(x => x.trim().replace(/^'|'$/g, ''))
  for (const v of allowVals) {
    ok(enumVals.includes(v),
       `WOWED_MARGINS contains ${JSON.stringify(v)}, which the margin enum does not offer — the bar would be unreachable through that value`)
  }
  ok(allowVals.length < enumVals.length,
     'at least one enum value does NOT clear the bar — an allow-list containing the whole enum is a gate that cannot fail')
  console.log(`exit-bar: the allow-list (${allowVals.join(', ')}) is a proper subset of the enum (${enumVals.join(', ')}) OK`)
}

// ---------------------------------------------------------------------------
// THE RETRACTION. loop.js asserted, in a comment and in a pinned disclosure, that a
// whole-artifact round is "NOT SOURCE FIDELITY" because "the source stops when every
// sub-agent is wowed, which is what the piece verdicts already are." Piece verdicts were
// produced under an instruction forbidding exactly that comparison. The claim was false
// and it is the reason the defect survived five runs of accurate disclosure.
//
// Checked against the file rather than the verdict: a disclosure the loop no longer emits
// can still sit in the source as a comment teaching the next reader the wrong thing.
//
// PRESENCE, NOT ABSENCE, and the repo has been here before. The first draft of this block
// asserted the old sentences were GONE from loop.js. It went red against the fixed file,
// because an honest retraction quotes what it retracts — the same trap `CONTRACT_STATED`
// hit when a rule forbidding an old phrase tripped on the comments that quote it to
// explain the defect, and the same one the sweep needles concatenate their find strings to
// dodge. Absence of a string is the wrong question here. What matters is whether the loop
// still ACTS on the claim, and that is settled behaviourally in the first block above,
// where the emitted prompt is read. What is left for this block is that the file tells the
// next reader the truth.
// ---------------------------------------------------------------------------
{
  ok(/RETRACTED, decision 0007/.test(LOOP),
     'loop.js marks the retraction where the false claim was made, rather than quietly deleting it')
  ok(/each sub-agent is utterly wowed/.test(LOOP),
     'and quotes the source sentence that decides it, so the next reader can check it against references.md')
  // The claim only counts as retracted if the retraction sits with it. A file that says
  // "RETRACTED" somewhere and repeats the false equation somewhere else has not retracted
  // anything, and this is the assertion that would notice.
  const i = LOOP.indexOf('which is what the piece verdicts already are')
  ok(i === -1 || /RETRACTED, decision 0007/.test(LOOP.slice(Math.max(0, i - 900), i)),
     'every surviving instance of the false equation is inside the retraction that corrects it, not standing as the file\'s own claim')
  console.log('exit-bar: the retracted claim is marked as retracted, not left standing OK')
}

// ---------------------------------------------------------------------------
// WHAT THIS FILE DOES NOT ESTABLISH. Stated on the passing branch, because a residual
// printed only on failure is printed exactly when nobody is relying on the verdict.
// ---------------------------------------------------------------------------
console.log('exit-bar: stating what this cannot establish')
console.log('          NOT CHECKED: that the source\'s structure produces a BETTER artifact. These')
console.log('          checks establish that the loop now exits where the source exits, and not that')
console.log('          exiting there is right. The margin field they now gate on was measured')
console.log('          unreliable (4 of 5 spawns reported `clear` on both sides of a 3-2 split);')
console.log('          decision 0007 accepts that cost as rounds rather than correctness, because')
console.log('          the source\'s own bar is not required to be reachable and the operator\'s')
console.log('          token removal is the off-switch. Whether N whole-artifact judgements buy')
console.log('          coverage or only variance is UNMEASURED — 0007 names the run that would say.')
