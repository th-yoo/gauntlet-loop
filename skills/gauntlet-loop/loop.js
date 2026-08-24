export const meta = {
  name: 'gauntlet-loop',
  description: 'The loop: a builder and a fresh blind critic per round, A/B against a real reference, one gap back each time. No round cap — it runs until the candidate wins or the operator stops it',
  whenToUse: 'When you have a goal and a concrete reference artifact that is better than what you have. This is the method the name refers to; gauntlet.js is a different instrument (a review panel) that does not loop. Start it with /gauntlet-loop:loop, stop it with /gauntlet-loop:cancel-loop.',
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
// The "really harsh critic" clause above is a REQUIREMENT, not decoration: it is
// the only property the source gives the judge. It is implemented in the live
// A/B prompt below ("BE A REALLY HARSH CRITIC") and in the critic's standing
// agent definition, agents/gauntlet-ab-critic.md. Both are pinned by
// test/drift-guard.mjs against COMMENT-STRIPPED source, because a clause that
// survives only in a comment like this one is exactly the failure that check
// exists to catch (issue #16).
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
//   args.token     (required) absolute path to the RUN TOKEN — a file whose
//                  EXISTENCE means "keep looping". Removing it stops the run at
//                  the next round boundary. This is the circuit breaker, and it
//                  is the operator's half of the source's stop rule: "Keep
//                  looping until our output wins or I stop the run."
//
// There is deliberately no round cap and no `args.maxRounds`. The baseline
// prompt contains no round language at all — its three stop clauses are "it
// should keep going", "Don't stop until each sub-agent is utterly wowed" and
// "/loop until it's utterly perfect", every one of them conditioned on quality.
// The meta-prompt forbids the parameter by name: "Do not prescribe the
// architecture, exact decomposition, or a fixed number of rounds", and the
// guide adds "there should be no arbitrary final round." A cap this file chose
// for itself — even a large one, even a documented one — is the arbitrary final
// round wearing a different label. So the terminators are exactly the two the
// source names, plus the two any real program needs:
//
//   WON       the candidate beat the reference in a blind A/B  (source)
//   CANCELLED the operator removed the run token               (source: "or I stop the run")
//   BUDGET    the operator's token target ran out              (an operator stop, pre-committed)
//   ERROR     an agent returned nothing
//
// Nothing else stops this loop. If no budget is set and nobody cancels, it runs
// until the candidate wins or the host's own runaway backstop trips. That is
// the method, and it is why the token is required rather than optional.

const GOAL = args && args.goal
const CANDIDATE = args && args.candidate
const REFERENCE = args && args.reference
const INSPECT = (args && args.inspect) || null
const TOKEN = args && args.token

if (!GOAL) throw new Error('args.goal is required')
if (!CANDIDATE) throw new Error('args.candidate is required — an absolute path, built if absent')
if (!REFERENCE) throw new Error(
  'args.reference is required. The bar is the most important part of this method: without a ' +
  'concrete thing to compare against, the critic invents its own comparison and approves ' +
  'everything. If you have no reference, you do not have a gauntlet loop — you have a builder.'
)
if (!TOKEN) throw new Error(
  'args.token is required — an absolute path to a file whose existence means "keep looping". ' +
  'This loop has no round cap by design, so the token IS the stop: removing it ends the run at ' +
  'the next round boundary. Create it before launching (the /gauntlet-loop:loop command does), ' +
  'and remove it with /gauntlet-loop:cancel-loop. A run with no token is a run nobody can stop.'
)

// ---------------------------------------------------------------------------
// BLINDNESS LEAK CHECK. The ARTIFACT A/B lines rendered into the critic
// prompt below show CANDIDATE and REFERENCE verbatim. args.reference is
// documented above as accepting a path, a URL, OR a prose description. If the
// two strings are not the same KIND of string, the two lines look nothing
// alike (a local path vs. a URL or a paragraph) and the critic can tell which
// side is the candidate from the formatting alone, before it looks at either
// artifact — the A/B is not blind at all. This cannot be fixed by prompt
// wording, so it is detected here and reflected honestly in the verdict's
// enforced/not_enforced lists rather than asserted away.
//
// The test is a shape CLASS on both arguments, not a list of the URL forms
// that happened to be tried. An earlier version asked only "does REFERENCE
// start with / and contain no whitespace", which passes `//example.com/ref`
// — a protocol-relative URL — and silently shipped the blindness claim it
// exists to withhold. Classifying both sides catches that shape without ever
// being told about it, along with `C:\ref`, `./ref` and anything else that
// renders differently from an absolute POSIX path.
//
// Both sides must land in `abs-path`, not merely in the same class: the
// builder is told to "modify the artifact in place at the path above", so a
// CANDIDATE that is not a writable absolute path is not a run this loop can
// execute, whatever it does to the formatting.
// ---------------------------------------------------------------------------
function shapeOf(s) {
  if (/\s/.test(s)) return 'prose'
  if (/^\/\//.test(s) || /^[a-z][a-z0-9+.-]*:/i.test(s)) return 'url'   // //host/x, https://x, C:\x
  if (/^\//.test(s)) return 'abs-path'
  return 'other'                                                        // ./x, ../x, x/y, ~/x
}
const SIDES_LOOK_ALIKE = shapeOf(REFERENCE) === 'abs-path' && shapeOf(CANDIDATE) === 'abs-path'
if (!SIDES_LOOK_ALIKE) {
  const blame = shapeOf(REFERENCE) !== 'abs-path'
    ? `args.reference does not look like an absolute filesystem path comparable to args.candidate (it reads as ${shapeOf(REFERENCE)})`
    : `args.candidate does not look like an absolute filesystem path comparable to args.reference (it reads as ${shapeOf(CANDIDATE)})`
  log(`WARNING: ${blame}. This run's blind A/B is NOT ` +
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
if (!(budget && budget.total)) {
  log('NOTE: no budget target set. This loop has no round cap, so the only things that will ' +
      `stop it are the candidate winning, an agent failing, or you removing the run token at ` +
      `${TOKEN} (/gauntlet-loop:cancel-loop). That is the faithful configuration, and it means ` +
      'nobody but you will stop it. Set a budget target if you want a pre-committed ceiling.')
}

// ---------------------------------------------------------------------------
// THE CIRCUIT BREAKER.
//
// The run token is a file on disk. This script cannot see it: a Workflow script
// has no filesystem access, and loop.js may not import or require anything (the
// drift guard enforces that, because those calls throw in the real runtime).
// So the check has to be delegated, and the choice of WHO checks is the whole
// design:
//
//   not the critic  — it holds Bash and is the blind party. Handing it a path
//                     inside the run's own scratch layout gives it one more
//                     thread to pull on when working out which artifact is
//                     ours. Round 1 of the first live run had a critic identify
//                     both sides by diffing them against the filesystem; the
//                     answer to that is not to hand the next one a map.
//   not the builder — it is the party being stopped. A cancel signal read and
//                     reported by the thing it cancels is a self-report, and
//                     this file's own rule is that a quantity derived
//                     downstream of the decision under test cannot audit it.
//   a third party   — an agent whose entire tool allowlist is Bash, which never
//                     sees the goal, the artifacts, or the verdict, and whose
//                     only output is whether one named path exists.
//
// It costs one cheap spawn per round. That is the price of the property being
// structural instead of promised.
//
// It fails SAFE, exactly like budgetLeft(): a breaker that returns nothing, or
// anything other than a clear PRESENT, stops the run. Failing open here would
// mean an uncancellable loop with no cap, which is the one outcome this
// mechanism exists to prevent.
// ---------------------------------------------------------------------------
const BREAKER_SCHEMA = {
  type: 'object',
  required: ['token'],
  properties: {
    token: { type: 'string', enum: ['PRESENT', 'ABSENT'], description: 'PRESENT if the file exists, ABSENT if it does not. Report what the test returned; do not guess and do not create the file.' },
    evidence: { type: 'string', description: 'the exact command you ran and its exact output' },
  },
}

async function tokenPresent(round) {
  const probe = await agent(
    `Report whether ONE file exists. This is the whole task — do not read it, do not create it,
do not modify it, and do not look at anything else on the filesystem.

    ${TOKEN}

Run exactly this and report what it prints:

    test -e ${JSON.stringify(TOKEN)} && echo PRESENT || echo ABSENT

Return that word in \`token\`, and the command plus its literal output in \`evidence\`. If the
command cannot be run at all, return ABSENT — a breaker that cannot be read is a breaker that
has failed, and this run stops rather than continuing uncancellable.`,
    { label: `round-${round}:breaker`, phase: 'Loop', schema: BREAKER_SCHEMA, agentType: 'gauntlet-loop:gauntlet-breaker' }
  )
  if (!probe) {
    log(`WARNING: the breaker returned nothing at round ${round} — treating the run as cancelled rather than continuing a loop nobody can stop`)
    return false
  }
  if (probe.token !== 'PRESENT') return false
  return true
}

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
let breakerSpawns = 0 // every breaker probe, including the one that reports the cancel

while (true) {
  round++

  // Budget first: it is free to check, so a run that is already out of money
  // does not pay for a breaker probe to be told so.
  if (budgetLeft() < ROUND_RESERVE) {
    outcome = { status: 'BUDGET', why: `stopped with ~${Math.round(budgetLeft() / 1000)}k left — under the ${ROUND_RESERVE / 1000}k a round needs` }
    break
  }
  // Then the breaker, BEFORE the critic — so a cancel costs at most one cheap
  // probe, never a critic and a builder. Round 1 checks too: that is what
  // catches a mistyped token path before the run spends anything real.
  breakerSpawns++
  if (!(await tokenPresent(round))) {
    outcome = {
      status: 'CANCELLED',
      why: round === 1
        ? `the run token at ${TOKEN} was already absent before round 1 — either the operator cancelled immediately, or it was never created (check the path)`
        : `the operator removed the run token at ${TOKEN}; stopped at the round ${round} boundary after ${history.length} completed round(s)`,
    }
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

BE A REALLY HARSH CRITIC. That is the one property this method asks of the judge, and it
is the whole reason a separate judge exists. Not cruel — exacting. Start from the position
that neither artifact is good enough yet, and make the winner earn the verdict rather than
collect it for being close. Visible effort is not quality: an artifact that plainly took
work is not thereby better than one that did not. If neither looks first-rate, say which
is nearer and say plainly what is still missing from it.

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
  //
  // `verdict.why` is deliberately NOT forwarded. It was, until issue #11: the
  // prompt carried "Context on what separated them:\n${verdict.why}". `why` is
  // a required AB_SCHEMA field whose description asks for "what separates
  // them, concretely" — in practice a LIST of differences. Forwarding it hands
  // the builder a menu of other things to fix immediately under four lines of
  // prose insisting it fix one, and the reason those four lines exist is
  // stated in them: a round that changes five things makes the next verdict
  // uninterpretable. So `why` was a second, unbounded gap channel aimed at the
  // one control property this loop has. It is still collected, still recorded
  // in `history`, and still reported to the human — it just does not reach the
  // builder.
  // Cost if this is the wrong call: the builder gets less context per round
  // and may need more rounds to close the same gap. That is measurable
  // (rounds-to-win) and reversible in one line. The opposite error is not
  // measurable — it degrades every verdict after it.
  const built = await agent(
    `You are building toward this goal:
${GOAL}

THE CANDIDATE: ${CANDIDATE}
${round === 1 ? '\nIf it does not exist yet, build the first version now.\n' : ''}
A critic compared it blind against a reference and the candidate lost. It named ONE gap —
the single largest thing standing between them:

    ${verdict.gap}

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
// Report. A loop the operator stopped has NOT failed — the source is explicit
// that the bar need not be reachable and that the operator stopping is the
// normal ending: "A hard bar does not need to be realistically reachable. My
// game did not become better than Call of Duty. I stopped the run while it was
// still improving." What matters is whether the gaps were getting smaller.
// ---------------------------------------------------------------------------

const sidesUsed = history.map(h => h.candidateSide)
const balanced = sidesUsed.filter(x => x === 'A').length + ' as A / ' + sidesUsed.filter(x => x === 'B').length + ' as B'

// Honest per-outcome round-count claim. No branch here can say "no fixed round
// count" and be lying, because there is no longer a number to hide: the cap was
// removed, not raised. What each branch still has to be honest about is WHICH
// terminator fired, since "the operator stopped it" and "it ran out of money"
// and "it won" are three different results that prose flattens into "it ended".
const ROUND_COUNT_CLAIM = (() => {
  if (outcome.status === 'WON') {
    return `no round cap existed and none was needed — the loop ran ${outcome.round} round(s) and stopped on the candidate winning the blind A/B`
  }
  if (outcome.status === 'CANCELLED') {
    return history.length === 0
      ? `no round cap existed; the run never started a round because the token at ${TOKEN} was absent at the first check`
      : `no round cap existed — the loop ran ${history.length} round(s) and stopped because the OPERATOR removed the run token, which is the source's own second terminator ("until our output wins or I stop the run"). The candidate had not won when it stopped`
  }
  if (outcome.status === 'BUDGET') {
    return `no round cap existed — the loop ran ${history.length} round(s) and stopped on the operator's pre-committed budget target, not on a round count`
  }
  return `no round cap existed — the loop ended in ${outcome.status} after ${history.length} round(s), which is a failure to continue rather than any of the three real stops (win, operator cancel, budget)`
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
    ...(SIDES_LOOK_ALIKE ? [
      'the critic was never TOLD which artifact was the candidate — sides alternate by round parity and the prompt never uses the word "candidate"',
    ] : []),
    `a FRESH critic every round (${criticSpawns} separate critic spawn(s); ${history.length} produced a recorded verdict), so none defended its own prior verdict`,
    'the critic ran as an agent type whose tool allowlist has no Write or Edit — it could not use those TOOLS to alter either artifact (it still holds Bash; see not_enforced)',
    'the builder ran as an agent type with no Agent/ListAgents/SendMessage — it could not reach or spawn a critic',
    'the builder was handed the gap STRING and nothing else from the verdict — the critic\'s `why` field is not forwarded (it is collected and recorded, but never reaches the build prompt), and the builder never learned the sides, the critic\'s identity, or the run\'s history',
    'one gap SLOT is required per round by the schema (AB_SCHEMA.gap is in `required`) — the critic cannot omit a gap entirely (see not_enforced for what this does not buy)',
    `the run was interruptible at EVERY round boundary: the token at ${TOKEN} was checked ${breakerSpawns} time(s), before the critic spawned each round, by an agent type whose whole tool allowlist is Bash and which never saw the goal, either artifact, or any verdict`,
    'the breaker fails SAFE — a probe that returns nothing, or anything other than PRESENT, stops the run. An uncancellable loop cannot be produced by the breaker failing',
    ROUND_COUNT_CLAIM,
  ],

  not_enforced: [
    SIDES_LOOK_ALIKE
      ? 'The critic is told not to infer which artifact is the candidate, but nothing prevents it. A generated artifact and a real one often differ in ways that give it away.'
      : `this run's args.reference/args.candidate pair was not a comparable filesystem path pair (reference read as ${shapeOf(REFERENCE)}, candidate as ${shapeOf(CANDIDATE)}). The two ARTIFACT lines rendered in visibly different shapes, so this run's A/B was NOT blind — the loop's own formatting gave away which side was the candidate before the critic looked at either one.`,
    'The critic is instructed to be a really harsh critic — the source\'s one requirement on the judge — in both its standing agent definition and the round prompt. Nothing verifies that a harsh INSTRUCTION produced a harsh CRITIC. A lenient verdict and an exacting one are indistinguishable from here: no calibration trial ran, and the loop reads only the letter that came back.',
    'Position bias is averaged across rounds by alternation, not eliminated within a round.',
    'Critic and builder share a model family, so the critic may be blind to exactly the mistakes the builder is prone to making.',
    'The critic holds Bash and KillShell, which can write files directly (redirection, heredocs, etc.) — nothing mechanically stops it from altering either artifact through Bash instead of Write/Edit. The no-Write/no-Edit property above is real but narrow (prompt-deep, not structural).',
    'AB_SCHEMA.gap is a free-text string: nothing stops several gaps being packed into it (e.g. "Gap 1: ... Gap 2: ..."). Only one gap SLOT is enforced, not one gap.',
    'Nothing verifies that the named gap is really the LARGEST — only that exactly one slot came back.',
    'No calibration: this loop never checks that the critic could have failed. gauntlet.js\'s gate 7 does that and is not wired in here.',
    'The breaker is checked at ROUND BOUNDARIES, not continuously. Removing the token while a critic or builder is mid-flight does not abort that agent — the run stops before the next round starts. To stop a round already in progress, kill the workflow itself.',
    'Nothing stops the token being re-created after a cancel. The breaker reports the state at each boundary; it does not latch.',
    'With no budget target set, there is no pre-committed ceiling at all — the run continues until it wins, an agent fails, or the operator cancels. That is the source\'s design, not an oversight, and it means an unattended run is bounded only by the host\'s own runaway backstop.',
  ],

  reading_note:
    'Stopping on CANCELLED or BUDGET is not failure. The source is explicit that a hard bar "does ' +
    'not need to be realistically reachable" and that the operator stopping is the normal ending — ' +
    'Shumer stopped his own run "while it was still improving". Read `gaps_in_order` instead: if the ' +
    'gaps got smaller and more specific, the loop was working. If the last round names the same gap ' +
    'as the first, it was not — and that is the signal to read, not the verdict.',
}
