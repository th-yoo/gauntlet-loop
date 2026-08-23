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
//                  as this method's most common failure. CAVEAT: the blind A/B
//                  below renders CANDIDATE and REFERENCE as two literal lines.
//                  If REFERENCE is not a filesystem path shaped like CANDIDATE
//                  (i.e. it is a URL or prose), the two lines look nothing
//                  alike and the critic can tell which is which from the
//                  formatting alone — see the runtime check below, which
//                  detects this and downgrades the blindness claim rather than
//                  letting it ship unexamined.
//   args.inspect   (optional) how to look at the artifacts — a command to run,
//                  a thing to open. Passed verbatim to the critic.
//   args.maxRounds (optional) a safety cap, NOT a target. Omit it and the loop
//                  runs on budget alone, which is the faithful behaviour.

const GOAL = args && args.goal
const CANDIDATE = args && args.candidate
const REFERENCE = args && args.reference
const INSPECT = (args && args.inspect) || null
// An explicit maxRounds:0 is a real cap (run zero rounds), not "unset". The
// old `(args.maxRounds) || null` treated 0 as falsy and silently fell through
// to the 8-round default — on the one parameter that governs spend, in a repo
// whose thesis is cost gating. Test the value's presence, not its truthiness.
const MAX_ROUNDS = (args && args.maxRounds != null) ? args.maxRounds : null

if (!GOAL) throw new Error('args.goal is required')
if (!CANDIDATE) throw new Error('args.candidate is required — an absolute path, built if absent')
if (!REFERENCE) throw new Error(
  'args.reference is required. The bar is the most important part of this method: without a ' +
  'concrete thing to compare against, the critic invents its own comparison and approves ' +
  'everything. If you have no reference, you do not have a gauntlet loop — you have a builder.'
)

// ---------------------------------------------------------------------------
// BLINDNESS LEAK CHECK. The ARTIFACT A/B lines rendered into the critic
// prompt below show CANDIDATE and REFERENCE verbatim. args.reference is
// documented above as accepting a path, a URL, OR a prose description. If it
// is not a filesystem path shaped like CANDIDATE, the two lines look nothing
// alike (a local path vs. a URL or a paragraph) and the critic can tell which
// side is the candidate from the formatting alone, before it looks at either
// artifact — the A/B is not blind at all. This cannot be fixed by prompt
// wording, so it is detected here and reflected honestly in the verdict's
// enforced/not_enforced lists rather than asserted away.
// ---------------------------------------------------------------------------
const REFERENCE_IS_COMPARABLE_PATH = /^\//.test(REFERENCE) && !/\s/.test(REFERENCE)
if (!REFERENCE_IS_COMPARABLE_PATH) {
  log('WARNING: args.reference does not look like an absolute filesystem path comparable to ' +
      'args.candidate (it looks like a URL or a prose description). This run\'s blind A/B is NOT ' +
      'blind: the two ARTIFACT lines will render in visibly different shapes, which gives away ' +
      'which side is the candidate before the critic looks at either one.')
}

// A round costs a builder plus a critic. Leave headroom so the loop stops on
// its own terms rather than dying mid-round when the budget runs out.
const ROUND_RESERVE = 120000
// Defensive: loop.js is the first consumer of `budget` in this plugin (
// gauntlet.js never touches it), so `budget.remaining` has never met the real
// runtime. Handle it being a plain number rather than a function, and handle
// it throwing, without crashing the loop — and fail SAFE (treat as exhausted)
// rather than fail open (treat as infinite), because silently spending past a
// broken budget is the one failure this file exists to prevent.
function budgetLeft() {
  if (!budget || !budget.total) return Infinity
  try {
    const r = typeof budget.remaining === 'function' ? budget.remaining() : budget.remaining
    if (typeof r === 'number' && Number.isFinite(r)) return r
    log(`WARNING: budget.remaining ${typeof budget.remaining === 'function' ? 'returned' : 'is'} ` +
        `not a finite number (${JSON.stringify(r)}) — treating the budget as exhausted rather than guessing`)
    return 0
  } catch (e) {
    log(`WARNING: budget.remaining() threw (${(e && e.message) || e}) — treating the budget as exhausted rather than guessing`)
    return 0
  }
}
if (MAX_ROUNDS == null && !(budget && budget.total)) {
  log('WARNING: no maxRounds and no budget target. The source says not to fix a round count, ' +
      'but something has to stop this. Defaulting to 8 rounds — set a budget to do better.')
}
const HARD_CAP = MAX_ROUNDS != null ? MAX_ROUNDS : (budget && budget.total ? 40 : 8)

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
let criticSpawns = 0 // every agent() call for a critic, including ones that return null — NOT history.length

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

  criticSpawns++
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

// Honest per-outcome round-count claim. "No fixed round count" is true of a
// WON run and false of the far more common default CAP run — this file's own
// HARD_CAP is a fixed number the moment neither maxRounds nor a budget is
// supplied. State what actually happened instead of a claim that contradicts
// the WARNING already logged above.
const ROUND_COUNT_CLAIM = (() => {
  if (outcome.status === 'WON') {
    return `no fixed round count bound this run — it stopped at round ${outcome.round} on the candidate winning, ahead of the ${HARD_CAP}-round cap`
  }
  if (outcome.status === 'CAP') {
    return `this run hit a FIXED cap of ${HARD_CAP} rounds${MAX_ROUNDS != null ? ' (operator-set via args.maxRounds)' : ' — the undocumented default, since neither maxRounds nor a budget was supplied'} without the candidate winning; round count was NOT open-ended here`
  }
  if (outcome.status === 'BUDGET') {
    return `the loop ended on budget after ${history.length} round(s), not a fixed round count`
  }
  return `the loop ended in ${outcome.status} after ${history.length} round(s) — neither a win, a budget stop, nor a completed cap`
})()

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
    ...(REFERENCE_IS_COMPARABLE_PATH ? [
      'the critic was never TOLD which artifact was the candidate — sides alternate by round parity and the prompt never uses the word "candidate"',
    ] : []),
    `a FRESH critic every round (${criticSpawns} separate critic spawn(s); ${history.length} produced a recorded verdict), so none defended its own prior verdict`,
    'the critic ran as an agent type whose tool allowlist has no Write or Edit — it could not use those TOOLS to alter either artifact (it still holds Bash; see not_enforced)',
    'the builder ran as an agent type with no Agent/ListAgents/SendMessage — it could not reach or spawn a critic',
    'the builder never saw the critic\'s reasoning beyond the single gap, and never learned the sides',
    'one gap SLOT is required per round by the schema (AB_SCHEMA.gap is in `required`) — the critic cannot omit a gap entirely (see not_enforced for what this does not buy)',
    ROUND_COUNT_CLAIM,
  ],

  not_enforced: [
    REFERENCE_IS_COMPARABLE_PATH
      ? 'The critic is told not to infer which artifact is the candidate, but nothing prevents it. A generated artifact and a real one often differ in ways that give it away.'
      : 'args.reference this run was not a comparable filesystem path (it looked like a URL or a prose description). The two ARTIFACT lines rendered in visibly different shapes, so this run\'s A/B was NOT blind — the loop\'s own formatting gave away which side was the candidate before the critic looked at either one.',
    'Position bias is averaged across rounds by alternation, not eliminated within a round.',
    'Critic and builder share a model family, so the critic may be blind to exactly the mistakes the builder is prone to making.',
    'The critic holds Bash and KillShell, which can write files directly (redirection, heredocs, etc.) — nothing mechanically stops it from altering either artifact through Bash instead of Write/Edit. The no-Write/no-Edit property above is real but narrow (prompt-deep, not structural).',
    'AB_SCHEMA.gap is a free-text string: nothing stops several gaps being packed into it (e.g. "Gap 1: ... Gap 2: ..."). Only one gap SLOT is enforced, not one gap.',
    'Nothing verifies that the named gap is really the LARGEST — only that exactly one slot came back.',
    'No calibration: this loop never checks that the critic could have failed. gauntlet.js\'s gate 7 does that and is not wired in here.',
  ],

  reading_note:
    'Stopping on BUDGET or CAP is not failure. The source is explicit that a hard bar "does not ' +
    'need to be realistically reachable" and that the operator stopping is the normal ending. ' +
    'Read `gaps_in_order` instead: if the gaps got smaller and more specific, the loop was working. ' +
    'If round 8 names the same gap as round 1, it was not — and that is the signal to read, not the verdict.',
}
