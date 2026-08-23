export const meta = {
  name: 'gauntlet-loop',
  description: 'The loop: a builder and a fresh blind critic per round, A/B against a real reference, one gap back each time, until the candidate wins or the budget stops it',
  whenToUse: 'When you have a goal and a concrete reference artifact that is better than what you have. This is the method the name refers to; gauntlet.js is a different instrument (a review panel) that does not loop.',
  phases: [
    { title: 'Loop', detail: 'build → blind A/B → one gap → build again' },
  ],
}

// ---------------------------------------------------------------------------
// This is Matt Shumer's Gauntlet Loop, implemented from the primary source:
// github.com/mshumer/Claude-of-Duty/prompt.md, headed "This is the entire
// prompt that produced this repository". The load-bearing sentences:
//
//   "You should /loop on each item and have a separate sub-agent check it
//    visually to ensure it looks triple A. That separate sub-agent should be a
//    really harsh critic, and if it doesn't look triple A, it should keep going."
//
//   "Don't stop until each sub-agent is utterly wowed with the quality when
//    compared with the actual Call of Duty game. It should literally compare
//    them side by side blind and say which one looks better."
//
// Four properties follow, and this file exists because the review panel in
// gauntlet.js has none of them:
//
//   1. IT LOOPS. gauntlet.js is a pipeline that runs once. Nothing there
//      iterates, so nothing there can improve.
//   2. THERE IS A BUILDER. Without one, nothing changes between rounds and the
//      loop degenerates into re-reading the same artifact.
//   3. ONE CRITIC, not a panel. Singular throughout the source.
//   4. ONE GAP comes back, not a findings list. "the biggest remaining gap".
//
// And the stop rule, from Shumer's own guide, which forbids what gauntlet.js
// hardcodes: "Do not tell it to do three rounds and stop. Tell it to keep
// looping... there should be no arbitrary final round." The real terminator is
// the candidate winning, or the operator's budget running out.
// ---------------------------------------------------------------------------

// INPUT
//   args.goal      (required) what you are trying to produce, in your words
//   args.candidate (required) absolute path to the artifact. Built if absent.
//   args.reference (required) the bar: a path, a URL, or a precise description
//                  of a real thing that is currently better. "The bar is the
//                  most important part" — a vague bar makes the critic invent a
//                  comparison and approve everything, which practitioners name
//                  as this method's most common failure.
//   args.inspect   (optional) how to look at the artifacts — a command to run,
//                  a thing to open. Passed verbatim to the critic.
//   args.maxRounds (optional) a safety cap, NOT a target. Omit it and the loop
//                  runs on budget alone, which is the faithful behaviour.

const GOAL = args && args.goal
const CANDIDATE = args && args.candidate
const REFERENCE = args && args.reference
const INSPECT = (args && args.inspect) || null
const MAX_ROUNDS = (args && args.maxRounds) || null

if (!GOAL) throw new Error('args.goal is required')
if (!CANDIDATE) throw new Error('args.candidate is required — an absolute path, built if absent')
if (!REFERENCE) throw new Error(
  'args.reference is required. The bar is the most important part of this method: without a ' +
  'concrete thing to compare against, the critic invents its own comparison and approves ' +
  'everything. If you have no reference, you do not have a gauntlet loop — you have a builder.'
)

// A round costs a builder plus a critic. Leave headroom so the loop stops on
// its own terms rather than dying mid-round when the budget runs out.
const ROUND_RESERVE = 120000
function budgetLeft() {
  return budget && budget.total ? budget.remaining() : Infinity
}
if (!MAX_ROUNDS && !(budget && budget.total)) {
  log('WARNING: no maxRounds and no budget target. The source says not to fix a round count, ' +
      'but something has to stop this. Defaulting to 8 rounds — set a budget to do better.')
}
const HARD_CAP = MAX_ROUNDS || (budget && budget.total ? 40 : 8)

const AB_SCHEMA = {
  type: 'object',
  required: ['winner', 'why', 'gap', 'inspected'],
  properties: {
    winner: { type: 'string', enum: ['A', 'B'], description: 'which artifact is better. You must choose; there is no tie.' },
    why: { type: 'string', description: 'what separates them, concretely' },
    gap: {
      type: 'string',
      description: 'THE SINGLE LARGEST thing standing between the loser and the winner, stated concretely enough to act on. Exactly one. If the winner is already the better artifact by a wide margin, this is still one gap — the biggest.',
    },
    inspected: { type: 'string', description: 'what you actually opened, ran or rendered to reach this verdict' },
    margin: { type: 'string', enum: ['decisive', 'clear', 'narrow'], description: 'how far apart they are' },
  },
}

const BUILD_SCHEMA = {
  type: 'object',
  required: ['changed', 'where'],
  properties: {
    changed: { type: 'string', description: 'what you changed, factually. No self-assessment.' },
    where: { type: 'string', description: 'files and locations touched' },
    ambiguity: { type: 'string', description: 'if the gap as stated was ambiguous, how you read it' },
    failed: { type: 'string', description: 'anything you tried that did not work' },
  },
}

// ---------------------------------------------------------------------------
// Blind A/B. The critic is shown two artifacts as A and B and never told which
// is the candidate.
//
// Position bias is real and Math.random() throws in this runtime, so the sides
// alternate deterministically by round parity: the candidate is A on even
// rounds, B on odd. Over a run the position averages out, and any single
// round's verdict is reproducible.
// ---------------------------------------------------------------------------

function sides(round) {
  const candidateIsA = round % 2 === 0
  return {
    A: candidateIsA ? CANDIDATE : REFERENCE,
    B: candidateIsA ? REFERENCE : CANDIDATE,
    candidateSide: candidateIsA ? 'A' : 'B',
  }
}

phase('Loop')

const history = []
let round = 0
let outcome = null

while (true) {
  round++

  if (round > HARD_CAP) {
    outcome = { status: 'CAP', why: `hit the ${HARD_CAP}-round cap without the candidate winning` }
    break
  }
  if (budgetLeft() < ROUND_RESERVE) {
    outcome = { status: 'BUDGET', why: `stopped with ~${Math.round(budgetLeft() / 1000)}k left — under the ${ROUND_RESERVE / 1000}k a round needs` }
    break
  }

  // --- judge -------------------------------------------------------------
  // A FRESH critic every round. Not a continuation: a critic that has seen its
  // own prior verdicts defends them, and one that has seen the builder's
  // history is no longer blind.
  const s = sides(round)

  const verdict = await agent(
    `Compare two artifacts and pick the better one. You are not told which is which.

THE GOAL these are being judged against:
${GOAL}

ARTIFACT A: ${s.A}
ARTIFACT B: ${s.B}
${INSPECT ? `\nHOW TO INSPECT THEM:\n${INSPECT}\n` : ''}
Open them. Where they can be run or measured, run and measure them — a verdict backed by
something you executed beats one backed by reading.

Then:

1. WINNER — A or B. You must choose. If they seem equal, look harder and find the
   dimension that separates them; a tie is a critic declining to look closely enough.

2. WHY — what actually separates them. Concrete.

3. GAP — the single largest thing standing between the loser and the winner. Exactly one,
   and the LARGEST, not the easiest to fix. Concrete enough that someone could act on it
   without asking you what you meant. "Materials look wrong" is not a gap; "surface shading
   has no specular response, so metal reads as matte plastic under the same light" is.

4. INSPECTED — what you actually opened, ran or rendered.

Do not try to work out which artifact was generated and which is the reference. If you
find yourself reasoning about provenance instead of quality, throw that reasoning away and
look again.`,
    { label: `round-${round}:ab`, phase: 'Loop', schema: AB_SCHEMA, agentType: 'gauntlet-loop:gauntlet-ab-critic' }
  )

  if (!verdict) {
    outcome = { status: 'ERROR', why: `critic returned nothing at round ${round}` }
    break
  }

  const candidateWon = verdict.winner === s.candidateSide
  history.push({
    round,
    candidateSide: s.candidateSide,
    winner: verdict.winner,
    candidateWon,
    margin: verdict.margin || null,
    why: verdict.why,
    gap: verdict.gap,
    inspected: verdict.inspected,
  })

  log(`round ${round}: candidate was ${s.candidateSide}, critic chose ${verdict.winner} — ${candidateWon ? 'CANDIDATE WINS' : 'reference still ahead'}${verdict.margin ? ` (${verdict.margin})` : ''}`)

  if (candidateWon) {
    outcome = { status: 'WON', why: `the candidate beat the reference in a blind A/B at round ${round}`, round }
    break
  }

  // --- build -------------------------------------------------------------
  // One gap. The builder never sees the critic's identity or the run's history,
  // and never learns whether it is A or B.
  const built = await agent(
    `You are building toward this goal:
${GOAL}

THE CANDIDATE: ${CANDIDATE}
${round === 1 ? '\nIf it does not exist yet, build the first version now.\n' : ''}
A critic compared it blind against a reference and the candidate lost. It named ONE gap —
the single largest thing standing between them:

    ${verdict.gap}

${verdict.why ? `Context on what separated them:\n${verdict.why}\n` : ''}
Fix that gap. Only that gap.

Not the one you find more interesting, not three while you are in there, not a refactor you
noticed on the way. The loop closes the biggest gap repeatedly, and a round that changes five
things makes the next verdict uninterpretable — nobody can tell which change moved it.

Modify the artifact in place at the path above. The critic inspects the real thing, never a
description of it, so anything you leave only in your report does not exist as far as this
loop is concerned.

Do not assess your own work. Do not say whether it now matches or should pass — you do not
know, and a fresh critic decides next round. Report what you changed, factually.`,
    { label: `round-${round}:build`, phase: 'Loop', schema: BUILD_SCHEMA, agentType: 'gauntlet-loop:gauntlet-builder' }
  )

  if (!built) {
    outcome = { status: 'ERROR', why: `builder returned nothing at round ${round}` }
    break
  }

  history[history.length - 1].built = { changed: built.changed, where: built.where, ambiguity: built.ambiguity || null }
}

// ---------------------------------------------------------------------------
// Report. A loop that stopped on budget or cap has NOT failed — the source is
// explicit that the bar need not be reachable and that the operator stopping is
// the normal ending. What matters is whether the gaps were getting smaller.
// ---------------------------------------------------------------------------

const sidesUsed = history.map(h => h.candidateSide)
const balanced = sidesUsed.filter(x => x === 'A').length + ' as A / ' + sidesUsed.filter(x => x === 'B').length + ' as B'

return {
  outcome,
  rounds: history.length,
  goal: GOAL,
  candidate: CANDIDATE,
  reference: REFERENCE,
  history,

  position_balance: balanced,

  gaps_in_order: history.map(h => `round ${h.round}: ${h.gap}`),

  enforced: [
    'the critic never learned which artifact was the candidate — sides alternate by round parity',
    `a FRESH critic every round (${history.length} separate spawns), so none defended its own prior verdict`,
    'the critic ran as an agent type with no Write or Edit — it could not fix what it judged',
    'the builder ran as an agent type with no Agent/ListAgents/SendMessage — it could not reach or spawn a critic',
    'the builder never saw the critic\'s reasoning beyond the single gap, and never learned the sides',
    'exactly one gap per round, enforced by the schema',
    'no fixed round count — the loop ended on a win, the budget, or an explicit cap',
  ],

  not_enforced: [
    'The critic is told not to infer which artifact is the candidate, but nothing prevents it. A generated artifact and a real one often differ in ways that give it away.',
    'Position bias is averaged across rounds by alternation, not eliminated within a round.',
    'Critic and builder share a model family, so the critic may be blind to exactly the mistakes the builder is prone to making.',
    'Nothing verifies that the named gap is really the LARGEST — only that exactly one came back.',
    'No calibration: this loop never checks that the critic could have failed. gauntlet.js\'s gate 7 does that and is not wired in here.',
  ],

  reading_note:
    'Stopping on BUDGET or CAP is not failure. The source is explicit that a hard bar "does not ' +
    'need to be realistically reachable" and that the operator stopping is the normal ending. ' +
    'Read `gaps_in_order` instead: if the gaps got smaller and more specific, the loop was working. ' +
    'If round 8 names the same gap as round 1, it was not — and that is the signal to read, not the verdict.',
}
