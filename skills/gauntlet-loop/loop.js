export const meta = {
  name: 'gauntlet-loop',
  description: 'The loop: a builder and a fresh blind critic per round, A/B against a real reference, one gap back each time. No round cap — it runs until the candidate wins or the operator stops it',
  whenToUse: 'When you have a goal and a concrete reference artifact that is already better than what you have, and you want to keep closing the gap until a blind judge picks yours. Start it with /gauntlet-loop:loop, stop it with /gauntlet-loop:cancel-loop.',
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
// Four properties follow, and each one is load-bearing:
//
//   1. IT LOOPS. A pipeline that runs once cannot improve anything; the whole
//      method is that the artifact changes and gets judged again.
//   2. THERE IS A BUILDER. Without one, nothing changes between rounds and the
//      loop degenerates into re-reading the same artifact.
//   3. ONE CRITIC PER JUDGMENT, not a panel of lenses. Singular throughout the
//      source, and the default here. `args.critics` may set k>1, but that is
//      REPLICATION of the identical forced choice — same prompt, same lens,
//      only the position varies — never a set of different lenses pooling
//      findings. The line exists because the source's stop condition quantifies
//      over judges ("Don't stop until EACH sub-agent is utterly wowed") and a
//      line of one satisfies that vacuously.
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
// And the stop rule, from Shumer's own guide: "Do not tell it to do three
// rounds and stop. Tell it to keep
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

// HOW MANY CRITICS. `k` is not a ceiling and not a resource limit — it IS the
// exit rule: the candidate must get past every one of them in a single round.
// Setting k=4 chooses a standard; declining to set it chooses k=1, which is a
// line of one soldier and the reason a single favourable verdict could end a
// run. Default 1, which is byte-for-byte the old behaviour.
//
// The source specifies no number. Both texts say "a separate sub-agent" and "a
// separate critic", singular, per piece — its width comes from DECOMPOSING the
// goal, not from stacking judges on one piece. We have one piece and cannot
// decompose it honestly, so k>1 restores the source's PROPERTY (every judge
// satisfied) by a mechanism the source does not describe. That is an addition,
// and the verdict says so rather than claiming precedent.
const CRITICS = (args && args.critics !== undefined) ? args.critics : 1
if (!Number.isInteger(CRITICS) || CRITICS < 1) throw new Error(
  'args.critics must be a positive integer — the number of fresh blind critics the candidate ' +
  'must get past in a single round. Default 1. It is the exit rule, not a maximum: the round ' +
  'spawns one and escalates to the rest only when that one lets the candidate through.'
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

// A round costs a builder plus up to k critics. Leave headroom so the loop stops
// on its own terms rather than dying mid-round when the budget runs out. At
// k=1 this is the literal 120000 the file carried before.
const BUILD_RESERVE = 60000
const CRITIC_RESERVE = 60000
const ROUND_RESERVE = BUILD_RESERVE + CRITICS * CRITIC_RESERVE
// Defensive: nothing else in this plugin consumes `budget`, so
// `budget.remaining` has never met the real runtime. Handle it being a plain number rather than a function, and handle
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

async function tokenPresent(round, tag) {
  const probe = await agent(
    `Report whether ONE file exists. This is the whole task — do not read it, do not create it,
do not modify it, and do not look at anything else on the filesystem.

    ${TOKEN}

Run exactly this and report what it prints:

    test -e ${JSON.stringify(TOKEN)} && echo PRESENT || echo ABSENT

Return that word in \`token\`, and the command plus its literal output in \`evidence\`. If the
command cannot be run at all, return ABSENT — a breaker that cannot be read is a breaker that
has failed, and this run stops rather than continuing uncancellable.`,
    { label: `${tag}:breaker`, phase: 'Loop', schema: BREAKER_SCHEMA, agentType: 'gauntlet-loop:gauntlet-breaker' }
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
  required: ['winner', 'why', 'gap', 'inspected', 'margin'],
  properties: {
    winner: { type: 'string', enum: ['A', 'B'], description: 'which artifact is better. You must choose; there is no tie.' },
    why: { type: 'string', description: 'what separates them, concretely' },
    gap: {
      type: 'string',
      description: 'THE SINGLE LARGEST thing standing between the loser and the winner, stated concretely enough to act on. Exactly one. If the winner is already the better artifact by a wide margin, this is still one gap — the biggest.',
    },
    inspected: { type: 'string', description: 'what you actually opened, ran or rendered to reach this verdict' },
    margin: { type: 'string', enum: ['decisive', 'clear', 'narrow'], description: 'REQUIRED. How far apart they are. This does not gate the exit — a narrow win still ends a round — but a win with the separation unstated cannot be audited afterwards, and the first two live runs of this loop both produced exactly that.' },
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
// alternate deterministically by (round + critic index) parity. With one critic
// that is exactly the old rule — the candidate is A on even rounds, B on odd —
// and with k critics the line is SPLIT WITHIN the round: consecutive indices
// land on opposite sides, so an even k is balanced and position bias separates
// from judge variance every round instead of averaging across rounds. Any
// single round remains reproducible.
// ---------------------------------------------------------------------------

function sides(round, i, cand, ref) {
  const candidateIsA = (round + i) % 2 === 0
  return {
    A: candidateIsA ? cand : ref,
    B: candidateIsA ? ref : cand,
    candidateSide: candidateIsA ? 'A' : 'B',
  }
}

// ---------------------------------------------------------------------------
// GOAL FAIRNESS. A blind A/B is a fair test only when both sides are trying to
// do the same thing. If the goal describes properties the candidate was built
// for and the reference never attempted, the comparison is settled before a
// critic looks: the reference loses on a dimension it never entered, and every
// verdict in the run is about the choice of goal rather than about the work.
//
// This is not hypothetical. The first live run of this build won every piece at
// round 1 against a reference that was not attempting the goal, with critics
// that were careful, honest and correct about every observation they made. The
// failure is invisible from inside the comparison — both critics see both
// artifacts, so neither can tell that one of them was never in the game.
//
// So it is checked by the one party that never sees both: an agent handed the
// GOAL and the REFERENCE only, never told what the candidate is. It reports
// whether the reference attempts the goal, and the run says so loudly and keeps
// going. It does not halt: an operator may have good reason to judge an artifact
// on a goal it never took on, and that judgment is theirs, not this script's.
// ---------------------------------------------------------------------------
const FAIRNESS_SCHEMA = {
  type: 'object',
  required: ['verdict', 'what_it_is_for'],
  properties: {
    verdict: { type: 'string', enum: ['attempts', 'partly', 'does-not-attempt'], description: 'does this artifact attempt the goal at all — not whether it succeeds' },
    what_it_is_for: { type: 'string', description: 'what the artifact is actually for, quoted from it where possible' },
    parts_not_attempted: { type: 'string', description: 'for `partly`: which parts of the goal it does not take on' },
  },
}

let fairness = null

async function checkGoalFairness() {
  const f = await agent(
    `Here is one artifact and one goal. Answer only: does this artifact attempt that goal at all?

THE GOAL:
${GOAL}

THE ARTIFACT: ${REFERENCE}

You are not told what this will be compared against and must not go looking. Read enough of
it to know what it is for, then say whether it is trying to do what the goal describes.

You are not judging quality. An excellent artifact that is not trying to do what the goal
describes is still \`does-not-attempt\`; a poor one that is trying is still \`attempts\`.`,
    { label: 'goal-fairness', phase: 'Loop', schema: FAIRNESS_SCHEMA, agentType: 'gauntlet-loop:gauntlet-goal-check' }
  )
  if (!f) return null
  if (f.verdict === 'does-not-attempt') {
    log(`WARNING: the reference does not attempt this goal. It is for: ${f.what_it_is_for}. ` +
        'A blind A/B against it will be decided by the choice of goal rather than by the work — the reference ' +
        'loses on a dimension it never entered. The run continues, because judging an artifact on a goal it ' +
        'never took on may be what you intend, but no verdict from this run is evidence that the candidate is better.')
  } else if (f.verdict === 'partly') {
    log(`NOTE: the reference attempts only part of this goal. Not attempted: ${f.parts_not_attempted}. ` +
        'Verdicts on those parts measure the goal, not the work.')
  }
  return f
}

// ---------------------------------------------------------------------------
// DECOMPOSITION. The source's first structural instruction: "Fan out sub-agents
// and have sub-agents tackle each one individually", and from the guide, "divide
// the goal into the smallest pieces that can be improved and judged
// independently. For each important piece, it should fan out a builder and a
// separate critic with fresh context."
//
// Width in the source comes from HERE, not from stacking judges on one piece:
// many pieces, one critic each, and "Don't stop until EACH sub-agent is utterly
// wowed" then quantifies over a real set. `args.critics` exists because this
// loop had no decomposition; where pieces exist, k=1 per piece is both cheaper
// and closer to the method.
//
// THE SPLIT CRITERION IS THE DANGEROUS PART. A split chosen because we already
// know where the artifact is weak is an answer key: it hides the defects it was
// drawn around, and every piece can pass while the whole is worse. So the lead
// is required to name, for each piece, WHAT WOULD BE INSPECTED to judge that
// piece alone. A piece with no observable is dropped here, in code, not argued
// about in the prompt.
//
// Refusing to split is a correct answer. Prose, specs and decisions usually do
// not decompose — their defects are properties of the whole (ordering, omission,
// coherence) and are invisible from inside any one section. When the lead
// refuses, or returns nothing, or nothing survives the observable check, the
// loop runs the artifact WHOLE, which is exactly its behaviour before this
// existed.
//
// Pieces run SEQUENTIALLY, one at a time. That is not a cost compromise: the
// source's own retrospective reports "Sequential single-owner passes beat
// parallel fan-out decisively... One sequential pass with a single owner per
// coupled concern moved it +1.00 and cut defects 66 -> 26."
// ---------------------------------------------------------------------------
const PIECE_SCHEMA = {
  type: 'object',
  required: ['decomposes', 'split_criterion', 'pieces'],
  properties: {
    decomposes: { type: 'boolean', description: 'false if this goal has no parts that can be judged independently. Refusing is a correct answer.' },
    split_criterion: { type: 'string', description: 'one sentence: what property of the artifacts made these the seams. Not "these are the weak parts".' },
    pieces: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'observable'],
        properties: {
          name: { type: 'string', description: 'short handle for this piece' },
          observable: { type: 'string', description: 'REQUIRED. What would be inspected to judge THIS piece alone — a command to run, a file to open, an output to look at. Not a topic.' },
          candidate: { type: 'string', description: 'absolute path, when this piece really is its own file' },
          reference: { type: 'string', description: 'absolute path to the matching part of the reference, when it is its own file' },
          focus: { type: 'string', description: 'when the piece is not a separate file: what a critic should attend to, and what it should ignore' },
        },
      },
    },
  },
}

let leadSpawns = 0
let decomposition = null

async function decompose() {
  leadSpawns++
  const plan = await agent(
    `Divide this goal into the smallest pieces that can be improved and judged INDEPENDENTLY.

THE GOAL:
${GOAL}

THE ARTIFACT BEING IMPROVED: ${CANDIDATE}
THE REFERENCE IT IS JUDGED AGAINST: ${REFERENCE}
${INSPECT ? `\nHOW TO INSPECT THEM:\n${INSPECT}\n` : ''}
Open both before deciding. How the reference is organised is evidence about the natural
seams, and it is evidence you did not invent.

For every piece you propose, name the OBSERVABLE: what would be inspected to judge that
piece alone — a command to run, a file to open, an output to look at. If you cannot name
one, it is not a piece.

Refusing to split is a correct answer. Most prose, specs and decisions do not decompose:
their defects are properties of the whole — what is missing, what order things come in —
and no single section is wrong. Say so and the loop will run the artifact whole.

Also state your split criterion in one sentence. If that sentence is really "these are the
parts I think are weak", discard it and look again: a split drawn around known weaknesses
hides exactly those weaknesses, because every piece can pass while the whole is worse.`,
    { label: 'decompose', phase: 'Loop', schema: PIECE_SCHEMA, agentType: 'gauntlet-loop:gauntlet-lead' }
  )
  if (!plan) return null
  if (!plan.decomposes) return { refused: true, why: plan.split_criterion }
  // The observable check runs HERE, in code. A piece that cannot say what would
  // be inspected to judge it alone is dropped, whatever the prompt asked for.
  const kept = (plan.pieces || []).filter(p => p && p.name && typeof p.observable === 'string' && p.observable.trim().length > 0)
  const dropped = (plan.pieces || []).length - kept.length
  if (kept.length < 2) return { refused: true, why: `fewer than two pieces carried an observable (${kept.length} of ${(plan.pieces || []).length}); one piece is not a decomposition`, dropped }
  return { pieces: kept, split_criterion: plan.split_criterion, dropped }
}

function criticPrompt(s, piece) {
  return `Compare two artifacts and pick the better one. You are not told which is which.

BE A REALLY HARSH CRITIC. That is the one property this method asks of the judge, and it
is the whole reason a separate judge exists. Not cruel — exacting. Start from the position
that neither artifact is good enough yet, and make the winner earn the verdict rather than
collect it for being close. Visible effort is not quality: an artifact that plainly took
work is not thereby better than one that did not. If neither looks first-rate, say which
is nearer and say plainly what is still missing from it.

THE GOAL these are being judged against:
${GOAL}
${piece && piece.name ? `\nJUDGE ONLY THIS PART: ${piece.name}\nWhat to inspect for it: ${piece.observable}${piece.focus ? `\n${piece.focus}` : ''}\nDifferences outside this part are not yours to weigh — another critic owns them.\n` : ''}
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
look again.`
}

phase('Loop')

let criticSpawns = 0 // every agent() call for a critic, including ones that return null — NOT history.length
let breakerSpawns = 0 // every breaker probe, including the one that reports the cancel

// The breaker goes FIRST, before the lead spawns. Decomposition reads both
// artifacts and is the most expensive spawn in the run; a cancel must not pay
// for it. This probe is round 1's probe, hoisted — it is not an extra one, and
// the loop below consumes its result rather than asking again.
breakerSpawns++
let pendingProbe = await tokenPresent(1, 'round-1')

fairness = pendingProbe ? await checkGoalFairness() : null
const decomposition_ = pendingProbe ? await decompose() : null
decomposition = decomposition_
if (decomposition && decomposition.refused) {
  log(`NOTE: not decomposed — ${decomposition.why}. Running the artifact whole, which is this loop's behaviour when nothing splits.`)
} else if (decomposition) {
  log(`decomposed into ${decomposition.pieces.length} piece(s): ${decomposition.pieces.map(p => p.name).join(', ')}${decomposition.dropped ? ` (${decomposition.dropped} dropped for naming no observable)` : ''}`)
}

// One implicit piece when nothing decomposed: the whole artifact, unnamed, so
// every label and every prompt is byte-identical to the undecomposed run.
const PIECES = (decomposition && decomposition.pieces) || [{ name: null, candidate: CANDIDATE, reference: REFERENCE }]

const history = []
let outcome = null
let lastWon = null


for (const piece of PIECES) {
  const PC = piece.candidate || CANDIDATE
  const PR = piece.reference || REFERENCE
  let round = 0
  let pieceOutcome = null

  while (true) {
  round++
  const TAG = piece.name ? `${piece.name}-round-${round}` : `round-${round}`

  // Budget first: it is free to check, so a run that is already out of money
  // does not pay for a breaker probe to be told so.
  if (budgetLeft() < ROUND_RESERVE) {
    pieceOutcome = { status: 'BUDGET', why: `stopped with ~${Math.round(budgetLeft() / 1000)}k left — under the ${ROUND_RESERVE / 1000}k a round needs` }
    break
  }
  // Then the breaker, BEFORE the critic — so a cancel costs at most one cheap
  // probe, never a critic and a builder. Round 1 checks too: that is what
  // catches a mistyped token path before the run spends anything real.
  let tokenOk
  if (pendingProbe !== null) { tokenOk = pendingProbe; pendingProbe = null }
  else { breakerSpawns++; tokenOk = await tokenPresent(round, TAG) }
  if (!tokenOk) {
    pieceOutcome = {
      status: 'CANCELLED',
      why: round === 1
        ? `the run token at ${TOKEN} was already absent before round 1 — either the operator cancelled immediately, or it was never created (check the path)`
        : `the operator removed the run token at ${TOKEN}; stopped at the round ${round} boundary after ${history.length} completed round(s)`,
    }
    break
  }

  // --- judge -------------------------------------------------------------
  // A FRESH critic every round, and k of them when the round could actually
  // end. Not continuations: a critic that has seen its own prior verdicts
  // defends them, and one that has seen the builder's history is no longer
  // blind.
  //
  // ESCALATION. A round the candidate LOSES cannot exit, so the rest of the
  // line could not have changed the outcome and is never spawned. Spend one
  // critic; buy the other k-1 only when the first one lets the candidate
  // through. The standard is untouched — every soldier must still let it
  // through — and the ones who could not have blocked it go unspawned.
  //
  // What is NOT done here, deliberately: escalating further on a split. That
  // is optional stopping — "there exists a line length at which they agreed" —
  // which is the same defect as the old exit, one level down. k is fixed
  // before the round starts and a split is a loss.
  const positions = []
  let critic_died = false

  async function spawnCritic(i) {
    const s = sides(round, i, PC, PR)
    criticSpawns++
    const v = await agent(
      criticPrompt(s, piece),
      {
        label: CRITICS === 1 ? `${TAG}:ab` : `${TAG}:ab:${i + 1}`,
        phase: 'Loop',
        schema: AB_SCHEMA,
        agentType: 'gauntlet-loop:gauntlet-ab-critic',
      }
    )
    if (!v) { critic_died = true; return null }
    return {
      i,
      side: s.candidateSide,
      winner: v.winner,
      candidateWon: v.winner === s.candidateSide,
      margin: v.margin || null,
      why: v.why,
      gap: v.gap,
      inspected: v.inspected,
    }
  }

  const firstVerdict = await spawnCritic(0)
  if (firstVerdict) positions.push(firstVerdict)

  if (firstVerdict && firstVerdict.candidateWon && CRITICS > 1) {
    const rest = await parallel(
      Array.from({ length: CRITICS - 1 }, (_, n) => () => spawnCritic(n + 1))
    )
    for (const p of rest) if (p) positions.push(p)
  }

  // Fails SAFE, like the breaker and the budget: a round decided on a SHORTER
  // line than the operator asked for is a quietly weaker standard, applied at
  // the moment something is already going wrong.
  if (critic_died || positions.length === 0) {
    pieceOutcome = {
      status: 'ERROR',
      why: CRITICS === 1
        ? `critic returned nothing at round ${round}`
        : `a critic returned nothing at round ${round} — a round is not decided on a partial line of ${CRITICS}`,
    }
    break
  }

  const dissenters = positions.filter(p => !p.candidateWon)
  const candidateWon = dissenters.length === 0

  // WHICH gap goes back, when more than one soldier blocked. Literal
  // restatement only: normalise whitespace and case, take the largest group of
  // two or more, else the earliest dissenter by spawn order (parallel()
  // resolves in input order, so this is reproducible rather than a race).
  // Gaps are free prose, so this will usually fall through to the first — that
  // is why the rule that fired is recorded, instead of being assumed to work.
  let gapSelection = null
  let primary
  if (candidateWon) {
    primary = positions[0]
  } else {
    const groups = new Map()
    for (const d of dissenters) {
      const key = String(d.gap).trim().replace(/\s+/g, ' ').toLowerCase()
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(d)
    }
    let best = null
    for (const g of groups.values()) {
      if (g.length >= 2 && (!best || g.length > best.length)) best = g
    }
    primary = best ? best[0] : dissenters[0]
    gapSelection = best
      ? { method: 'agreed-verbatim', agreed: best.length, from_critic: primary.i }
      : { method: 'first-by-spawn-order', dissenters: dissenters.length, from_critic: primary.i }
  }

  history.push({
    round,
    piece: piece.name,
    critics: CRITICS,
    candidateSide: primary.side,
    winner: primary.winner,
    candidateWon,
    margin: primary.margin,
    why: primary.why,
    gap: primary.gap,
    inspected: primary.inspected,
    split: {
      for_candidate: positions.length - dissenters.length,
      against_candidate: dissenters.length,
      positions,
    },
    gapSelection,
  })

  log(`round ${round}: ${positions.length} critic(s) — ${positions.length - dissenters.length} for the candidate, ${dissenters.length} against — ${candidateWon ? 'CANDIDATE WINS' : 'reference still ahead'}`)

  if (candidateWon) {
    pieceOutcome = {
      status: 'WON',
      why: CRITICS === 1
        ? `the candidate beat the reference in a blind A/B at round ${round}`
        : `all ${CRITICS} critics picked the candidate over the reference in a blind A/B at round ${round}`,
      round,
    }
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

THE CANDIDATE: ${PC}
${round === 1 ? '\nIf it does not exist yet, build the first version now.\n' : ''}
A critic compared it blind against a reference and the candidate lost. It named ONE gap —
the single largest thing standing between them:

    ${primary.gap}

Fix that gap. Only that gap.

Not the one you find more interesting, not three while you are in there, not a refactor you
noticed on the way. The loop closes the biggest gap repeatedly, and a round that changes five
things makes the next verdict uninterpretable — nobody can tell which change moved it.

Modify the artifact in place at the path above. The critic inspects the real thing, never a
description of it, so anything you leave only in your report does not exist as far as this
loop is concerned.

Do not assess your own work. Do not say whether it now matches or should pass — you do not
know, and a fresh critic decides next round. Report what you changed, factually.`,
    { label: `${TAG}:build`, phase: 'Loop', schema: BUILD_SCHEMA, agentType: 'gauntlet-loop:gauntlet-builder' }
  )

  if (!built) {
    pieceOutcome = { status: 'ERROR', why: `builder returned nothing at round ${round}${piece.name ? ` of piece "${piece.name}"` : ''}` }
    break
  }

  history[history.length - 1].built = { changed: built.changed, where: built.where, ambiguity: built.ambiguity || null }
  }

  // A piece winning does NOT end the run — the source stops when EVERY piece is
  // satisfied. Any other stop is a stop for the whole run, so it propagates.
  if (pieceOutcome && pieceOutcome.status !== 'WON') { outcome = pieceOutcome; break }
  lastWon = pieceOutcome
  if (piece.name) log(`piece "${piece.name}" won after ${round} round(s)`)
}

// An undecomposed run keeps the round's own WON verdict verbatim — it already
// says what the exit was, including how long the line was. A decomposed run
// needs a verdict about the SET, since no single piece winning ended it.
if (!outcome) {
  outcome = (PIECES.length === 1 && !PIECES[0].name)
    ? lastWon
    : { status: 'WON', why: `every one of the ${PIECES.length} pieces beat the reference in a blind A/B`, round: history.length, pieces: PIECES.map(p => p.name) }
}

// ---------------------------------------------------------------------------
// Report. A loop the operator stopped has NOT failed — the source is explicit
// that the bar need not be reachable and that the operator stopping is the
// normal ending: "A hard bar does not need to be realistically reachable. My
// game did not become better than Call of Duty. I stopped the run while it was
// still improving." What matters is whether the gaps were getting smaller.
// ---------------------------------------------------------------------------

const sidesUsed = history.flatMap(h => h.split.positions.map(p => p.side))
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

  // A piece that wins its FIRST round was never built on: the builder never ran,
  // no gap was ever acted on, and the loop did not loop. That is not a better
  // result than winning after five rounds — it usually means the bar was weak or
  // the goal was chosen to fit what the candidate already did. Counted here so
  // the verdict cannot report it as ordinary success.
  rounds_with_a_build: history.filter(h => h.built).length,

  goal_fairness: fairness
    ? { verdict: fairness.verdict, reference_is_for: fairness.what_it_is_for, parts_not_attempted: fairness.parts_not_attempted || null }
    : { verdict: 'unchecked', reference_is_for: null, parts_not_attempted: null },

  gaps_in_order: history.map(h => `${h.piece ? `${h.piece} ` : ''}round ${h.round}: ${h.gap}`),

  decomposition: decomposition && decomposition.pieces
    ? { split_criterion: decomposition.split_criterion, pieces: decomposition.pieces.map(p => ({ name: p.name, observable: p.observable })), dropped_for_no_observable: decomposition.dropped || 0, lead_spawns: leadSpawns }
    : { split_criterion: null, pieces: [], refused: decomposition ? decomposition.why : 'no lead returned a plan', lead_spawns: leadSpawns },

  enforced: [
    ...(SIDES_LOOK_ALIKE ? [
      'the critic was never TOLD which artifact was the candidate — sides alternate by round parity and the prompt never uses the word "candidate"',
    ] : []),
    decomposition && decomposition.pieces
      ? `the run ended only when EVERY one of the ${decomposition.pieces.length} piece(s) beat the reference, each with its own rounds, its own builder and its own critics, run sequentially`
      : 'the artifact was judged whole — one piece, so "every piece satisfied" is one judgment, not a set',
    CRITICS === 1
      ? 'the exit was ONE critic picking the candidate in one round — a line of one, which satisfies "every judge" vacuously (args.critics defaults to 1)'
      : `the exit required ALL ${CRITICS} critics in a single round to pick the candidate, each spawned fresh, with positions split across the line by (round + index) parity`,
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
    'NO RATCHET, and that is a decision rather than an omission (issue #18, 2026-08-24). The builder edits the candidate in place, so a round that makes it worse is permanent, and the loop holds no prior version to compare against: a Workflow script has no filesystem, so a snapshot and a revert would both be spawned-agent actions this script cannot observe. It therefore cannot tell an improvement from a regression from a lateral move — read `gaps_in_order` for that, and stop the run yourself if the gaps stop getting smaller.',
    CRITICS === 1
      ? 'Position bias is averaged across rounds by alternation, not eliminated within a round.'
      : 'Position bias is split across the line within each round, which measures it rather than eliminating it. It is not removed.',
    `The ${CRITICS} critic(s) share a model family and prompt, so their verdicts are not independent judgments; k copies resample one model's habits. Nothing here measures how much independence the line actually supplies, and no arithmetic over k should be read as if it did.`,
    decomposition && decomposition.pieces
      ? `THE SPLIT IS NOT CHECKED. A lead agent chose these ${decomposition.pieces.length} piece(s) and nothing verifies the choice: its criterion was "${decomposition.split_criterion}". Each piece was required to name what would be inspected to judge it alone, and pieces that named none were dropped in code — but a plausible observable is not a correct seam. A split drawn around known weaknesses hides them, and every piece can win while the artifact as a whole is worse than the reference. Nothing in this run would notice that.`
      : 'NOT DECOMPOSED — the artifact was judged whole. The source divides a goal into pieces that are improved and judged independently; where that is not done, every gap this loop finds is a whole-artifact gap, and defects local to one part compete with each other for the single gap slot each round.',
    fairness && fairness.verdict === 'does-not-attempt'
      ? `THE REFERENCE DOES NOT ATTEMPT THIS GOAL — it is for: ${fairness.what_it_is_for}. Every verdict in this run is about the choice of goal, not about the work: the reference was marked down on a dimension it never entered. Nothing here is evidence that the candidate is better than the reference at what the reference is for.`
      : 'The goal is operator-supplied and unchecked against the CANDIDATE. A goal written to describe what the candidate already does cannot discriminate, and nothing in this run would notice.',
    'k>1 is an ADDITION, not source fidelity. Both primary texts say one critic per piece, singular; the source gets width by decomposing the goal, which this loop does not do. What k restores is the source\'s property — every judge satisfied — by a mechanism the source does not describe.',
    'Critic and builder share a model family, so the critic may be blind to exactly the mistakes the builder is prone to making.',
    'The critic holds Bash and KillShell, which can write files directly (redirection, heredocs, etc.) — nothing mechanically stops it from altering either artifact through Bash instead of Write/Edit. The no-Write/no-Edit property above is real but narrow (prompt-deep, not structural).',
    'AB_SCHEMA.gap is a free-text string: nothing stops several gaps being packed into it (e.g. "Gap 1: ... Gap 2: ..."). Only one gap SLOT is enforced, not one gap.',
    'Nothing verifies that the named gap is really the LARGEST — only that exactly one slot came back.',
    'NO CALIBRATION ANYWHERE. Nothing in this plugin checks that a critic could have failed — no defect is planted, no control is run on a clean copy, and a critic that approves everything is indistinguishable from a critic that is right. The seeded-defect machinery that used to do this lived in the review panel and was deleted with it; this is now the plugin\'s largest unmeasured property, not a lane that exists elsewhere.',
    'The breaker is checked at ROUND BOUNDARIES, not continuously. Removing the token while a critic or builder is mid-flight does not abort that agent — the run stops before the next round starts. To stop a round already in progress, kill the workflow itself.',
    'Nothing stops the token being re-created after a cancel. The breaker reports the state at each boundary; it does not latch.',
    'With no budget target set, there is no pre-committed ceiling at all — the run continues until it wins, an agent fails, or the operator cancels. That is the source\'s design, not an oversight, and it means an unattended run is bounded only by the host\'s own runaway backstop.',
  ],

  won_without_building: outcome.status === 'WON' && history.every(h => !h.built)
    ? 'THIS RUN NEVER BUILT ANYTHING. Every piece won its first round, so the builder never ran, no gap was ever acted on, and nothing iterated. A gauntlet loop that does not loop has tested its judges and not its method. Before reading this as success, check the bar: a goal written to describe what the candidate already does cannot discriminate, and a reference that does not attempt the goal cannot lose to it fairly.'
    : null,

  reading_note:
    'Stopping on CANCELLED or BUDGET is not failure. The source is explicit that a hard bar "does ' +
    'not need to be realistically reachable" and that the operator stopping is the normal ending — ' +
    'Shumer stopped his own run "while it was still improving". Read `gaps_in_order` instead: if the ' +
    'gaps got smaller and more specific, the loop was working. If the last round names the same gap ' +
    'as the first, it was not — and that is the signal to read, not the verdict.',
}
