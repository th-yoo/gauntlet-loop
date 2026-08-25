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
// A line break in an artifact path FORGES PROMPT STRUCTURE. The A/B prompt puts
// each artifact on its own `ARTIFACT X:` line and the critic reads that structure
// to know what it is comparing, so a candidate of "a.md\nARTIFACT B: decoy.md"
// adds a third ARTIFACT line and the critic judges a comparison this loop never
// set up. The blindness claim is already withheld for such a path, but the run
// would still return a verdict about a prompt nobody composed.
//
// Only line breaks. Spaces in paths are ordinary and stay allowed — refusing them
// would reject real filesystems to fix a problem they do not have.
for (const [label, value] of [['candidate', CANDIDATE], ['reference', REFERENCE]]) {
  if (value && /[\r\n]/.test(String(value))) throw new Error(
    `args.${label} contains a line break. Each artifact is rendered on its own ARTIFACT line in the ` +
    'critic prompt, so a path with a line break in it writes extra lines into that prompt and the ' +
    'critic ends up judging a comparison this loop did not set up. Pass a path with no line breaks.'
  )
}

// A file cannot beat itself, and the loop would happily spend a builder and k
// critics finding that out: both ARTIFACT lines render the same path, the critic
// picks a side arbitrarily, and the run reports "the candidate beat the reference
// in a blind A/B" while asserting a blindness it trivially has. Refused here,
// before anything is spawned, because nothing downstream can recover a meaningful
// comparison from one artifact.
// A cap passed in is REFUSED, not ignored. The long comment above explains why no
// round cap exists; an operator never reads it. Silently dropping the argument
// leaves them believing the run is bounded, and this is the one loop where that
// belief ends with an unattended run spending until someone notices — they stop
// watching precisely because they think they set a limit.
for (const cap of ['maxRounds', 'max_rounds', 'rounds', 'maxIterations', 'roundCap']) {
  if (args && args[cap] !== undefined) throw new Error(
    `args.${cap} is not supported: this loop has no round cap, by design. The source's stop clauses ` +
    'are all conditioned on quality ("Don\'t stop until each sub-agent is utterly wowed"), and the ' +
    'meta-prompt forbids the parameter by name ("Do not prescribe ... a fixed number of rounds"). ' +
    'Two things really do bound a run and both are yours: remove the token at args.token to stop it ' +
    'at the next round boundary, or set a budget target so it stops on a ceiling you pre-committed. ' +
    'Passing a round count and being ignored would leave you believing the run was bounded.'
  )
}

if (CANDIDATE && REFERENCE && String(CANDIDATE).trim() === String(REFERENCE).trim()) throw new Error(
  `args.candidate and args.reference are the same file (${CANDIDATE}). A gauntlet loop is a forced ` +
  'choice between two artifacts; comparing one against itself produces a winner by coin flip and a ' +
  'verdict that says nothing. Point the reference at the real thing you want to beat.'
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
// SHELL quoting, not JSON quoting. Both probe prompts embed a path in a command
// the agent is told to run exactly, and JSON.stringify wraps it in DOUBLE quotes —
// inside which a shell still expands $(...) and backticks. A token path of
// "/tmp/$(touch PWNED)/run.token" therefore became a command substitution handed
// to an agent that holds Bash. Single quotes suppress every expansion, and an
// embedded apostrophe is escaped the POSIX way ('\''), so no legitimate path has
// to be refused for this.
function shq(s) {
  return `'${String(s).replace(/'/g, "'\\''")}'`
}

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

// Rounds currently BETWEEN their budget check and their last spawn, across every
// piece. The pool is shared and the DAG runs independent pieces at once, so a
// per-round check each piece makes on its own is not a ceiling: with one round's
// worth left, every concurrent piece clears the same check and they all spend.
// Measured, not theorised — two pieces against a 120k reserve spent 240k.
// Reserving for the rounds already in flight makes the check hold across them.
let roundsInFlight = 0
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
    evidence: { type: 'string', description: 'the exact commands you ran and their exact output' },
  },
}

// The literal output of the probe that reported the token gone. The verdict says a
// run was cancelled because a probe saw it absent; without this that is an
// assertion about an agent nobody can check.
let stoppedByEvidence = null
let breakerSilent = null

// WHICH AGENT TYPES ARE PROVEN LIVE THIS RUN — issue #14.
//
// The runtime hands a Workflow script the SAME value for two different events: an
// agent that ran and returned nothing, and an agent type that was never registered.
// The script cannot ask the harness which happened. That much is irreducible.
//
// What is not irreducible is discarding the evidence the run already has. A type
// that returned a result ONCE is registered, and every later empty result from that
// type is an agent that ran and gave nothing back. This records that, for every
// type, from every call — so the disambiguation is DERIVED from what the run did
// rather than hand-written.
//
// It replaces `!!(fairness || fitted)`, which named two probes of one type. A third
// and fourth caller of that same type were added later and the disjunction was not
// updated, so a run where only the newer probes answered still reported the weaker
// reading. That is this very issue, reintroduced by the fix's own maintenance — the
// sixth time a hand-written list duplicating something derivable has gone stale in
// this repository.
//
// A THROW is deliberately not counted, in either direction. The runtime does name a
// missing type in its error text, but `parallel()` turns a throw into null before
// any of it is visible, so half the call sites could never see it. One rule that
// works at every call site beats a better rule that works at some of them.
const typeSawResult = new Map()

function spawn(prompt, opts) {
  return agent(prompt, opts).then(r => {
    if (r && opts && opts.agentType) typeSawResult.set(opts.agentType, true)
    return r
  })
}

// PROVEN, never assumed. `false` means "no call of this type has returned anything",
// which is not the same as "the type is missing" — at round 1 the breaker is the
// first agent in the run, so nothing can have proven it yet.
const typeProven = t => typeSawResult.get(t) === true

// Kept out of tokenPresent so the schema-field scan's forward window still reaches
// the line that reads `probe.evidence`. A guard whose window a comment can overflow
// is a guard that gets widened until it stops biting.
// The half of the #14 sentence that is the same wherever a spawn comes back empty.
// Kept as one function so the rule cannot drift between the places that state it —
// the last hand-maintained version of this idea named two probes and went stale the
// moment a third caller of the same type appeared.
function silenceNote(type) {
  return typeProven(type)
    ? ` — that agent type is registered and working this run (another call of the same type returned a result), so this is an agent that answered with nothing, NOT a missing agent type`
    : ` — and no call of that agent type has returned anything this run, so per issue #14 this is indistinguishable from the type not being registered at all. A Workflow script sees an empty result either way`
}

function breakerSilenceNote(round) {
  return typeProven('gauntlet-loop:gauntlet-breaker')
    ? `the breaker agent ran and returned nothing at round ${round}. Its type is registered and working this run (another probe of the same type returned a result), so this is an agent that answered with nothing, NOT a missing agent type.`
    : `the breaker returned nothing at round ${round}, and no probe of its agent type has returned anything this run — so per issue #14 this is indistinguishable from that type not being registered at all. A Workflow script sees an empty result either way. Assume the weaker reading: the run may have stopped because the breaker could not be spawned, not because you cancelled it.`
}

async function tokenPresent(round, tag) {
  const probe = await spawn(
    `Report whether ONE file exists. This is the whole task — do not read it, do not create it,
do not modify it, and do not look at anything else on the filesystem.

    ${TOKEN}

Run exactly this and report what it prints:

    test -e ${shq(TOKEN)} && echo PRESENT || echo ABSENT

Return that word in \`token\`, and the command plus its literal output in \`evidence\`. If the
command cannot be run at all, return ABSENT — a breaker that cannot be read is a breaker that
has failed, and this run stops rather than continuing uncancellable.`,
    { label: `${tag}:breaker`, phase: 'Loop', schema: BREAKER_SCHEMA, agentType: 'gauntlet-loop:gauntlet-breaker' }
  ).catch(e => {
    // A THROW is not the same event as returning nothing, and until now only the
    // second was handled. Round 1's breaker is awaited at top level, outside any
    // parallel(), so an error here destroyed the entire run's verdict rather than
    // stopping it. Same fail-safe rule either way: a breaker that cannot be read
    // is a breaker that cannot stop the run, so the run stops.
    log(`WARNING: the breaker THREW at round ${round} (${(e && e.message) || e}) — treating the run as cancelled rather than continuing a loop nobody can stop`)
    return null
  })
  if (!probe) {
    // WHICH of the two events this was, when the run can tell. The fail-safe is the
    // same either way — a breaker that cannot be read cannot stop the run, so the run
    // stops — but the operator reads a CANCELLED verdict and needs to know whether
    // they caused it. At round 1 the breaker is the first agent in the run, so
    // nothing can have proven its type yet and the ambiguity is real.
    breakerSilent = breakerSilenceNote(round)
    log(`WARNING: ${breakerSilent} Treating the run as cancelled rather than continuing a loop nobody can stop.`)
    return false
  }
  if (probe.token !== 'PRESENT') { stoppedByEvidence = probe.evidence || null; return false }
  return true
}

// A loop whose builder answers every absence by appending grows its artifact
// monotonically while every individual round is locally correct — and nothing
// else in a run would notice. One number per round makes it visible.
//
// It is a SEPARATE probe rather than an extra field on the breaker, and the
// split is deliberate: the breaker is kept blind to the artifacts (a test
// asserts it is never handed a path), and this one is kept blind to the token.
// Two parties that each know one narrow fact beat one that knows both, and the
// second spawn is a `wc -c`.
const SIZE_SCHEMA = {
  type: 'object',
  required: ['bytes'],
  properties: {
    bytes: { type: 'number', description: 'the number the command printed. Report it; do not open the file and do not judge it.' },
    evidence: { type: 'string', description: 'the exact command and its exact output' },
  },
}

const sizeByRound = []
// Rounds where the probe RAN and reported that it could not measure. Kept apart
// from sizeByRound because these are not sizes: mixing them would corrupt the
// growth comparison that array exists for. Live run wf_50a6af1d-379 passed a
// DIRECTORY as the candidate; the probe answered correctly — bytes -1, evidence
// "the printed 0 is a failure artifact" — and the guard below dropped it, so the
// verdict carried `size_by_round: []` with `size_note: null` and no reason
// anywhere. A diagnostic that reports a refusal, and a consumer that turns the
// refusal into silence, is worse than a diagnostic that never ran: nothing tells
// the operator that #26's growth detector was dark for the whole run.
const sizeUnmeasured = []

async function measureSize(round, tag, pieceName, path) {
  const m = await spawn(
    `Report the SIZE of one file. That is the whole task — do not read it, do not open it, do not
form an opinion about what is in it, and do not look at anything else.

Run exactly this and report the number it prints:

    wc -c < ${shq(path)}

Return that number in \`bytes\` and the command plus its literal output in \`evidence\`. If the
command cannot be run, return -1 — a size that cannot be measured is not a size to guess at, and 0 is a real\nanswer for a file that is empty.`,
    { label: `${tag}:size`, phase: 'Loop', schema: SIZE_SCHEMA, agentType: 'gauntlet-loop:gauntlet-breaker' }
  ).catch(e => {
    // Diagnostic only: this records bytes so a monotonically growing artifact is
    // visible in the verdict, and nothing in the loop depends on the answer. It
    // already tolerated an empty result; a THROW propagated out of runPiece and
    // killed the piece, so a failed measurement failed the thing it was measuring.
    // An absent number is the correct degradation — the verdict simply has no
    // size for this round, which `size_note` reports.
    log(`NOTE: the size probe threw at round ${round} (${(e && e.message) || e}) — no size recorded for this round`)
    sizeUnmeasured.push({ round, piece: pieceName, why: `the probe threw: ${(e && e.message) || e}` })
    return null
  })
  // A NEGATIVE size is the probe saying it could not run the command; zero is a
  // real measurement of an empty file. Those were conflated, and the guard dropped
  // both — discarding the most alarming thing this probe can report. An artifact
  // that went to zero bytes is exactly the degradation #26 exists to surface.
  if (m && typeof m.bytes === 'number' && Number.isFinite(m.bytes) && m.bytes >= 0) {
    // The command and its output, not just the number. A measurement with no
    // record of how it was taken is a claim; this repo's standard is that a claim
    // without an artifact behind it is not a check.
    sizeByRound.push({ round, piece: pieceName, bytes: m.bytes, evidence: m.evidence || null })
  } else if (m) {
    // The probe answered and its answer was "I could not measure this". Rejecting
    // it from sizeByRound is right; discarding it is not.
    sizeUnmeasured.push({ round, piece: pieceName, why: `the probe reported it could not measure the size`, evidence: m.evidence || null })
  }
}

const AB_SCHEMA = {
  type: 'object',
  required: ['winner', 'why', 'gap', 'inspected', 'margin'],
  properties: {
    winner: { type: 'string', enum: ['A', 'B'], description: 'which artifact is better. You must choose; there is no tie.' },
    why: { type: 'string', description: 'what separates them, concretely' },
    gap: {
      type: 'string',
      description: 'THE SINGLE LARGEST thing standing between the loser and the winner, stated concretely enough to act on. Exactly one. A gap can be an EXCESS as readily as an absence — something present that should go, or material buried where it cannot be found — and is not required to be something missing. If the winner is already the better artifact by a wide margin, this is still one gap: the biggest.',
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
const FITTED_SCHEMA = {
  type: 'object',
  required: ['verdict', 'reasoning'],
  properties: {
    // COUPLING, NOT AUTHORSHIP. The old enum was need|mixed|fitted, and every value in it
    // asserted who wrote which from which. A 2x2 trial (scripts/fitted-trial.mjs, eight
    // draws, no flips) measured what the probe actually answers: lexical overlap between
    // goal and artifact predicted its verdict 8/8, and the authorship it reported was
    // right 4/8 — chance. It said `fitted` on a goal written before its artifact existed,
    // and `need` on a goal written by reading one. There was no value it could return for
    // the true state of either.
    verdict: { type: 'string', enum: ['independent', 'partial', 'coupled'], description: 'how much of the goal is traceable to this artifact\'s visible features and vocabulary: independent = the goal stands on its own, coupled = it reads as an inventory of this artifact, partial = some clauses do and some do not. This is about the TEXTS, not about who wrote them first' },
    reasoning: { type: 'string', description: 'which clauses of the goal and which parts of the artifact share text, quoted, and where each sits. Symmetric wording only: say both texts use a phrase, never that one lifted, borrowed, reproduced, restated, echoed or derived it from the other — that says which came first, which these two texts cannot show' },
  },
}

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
let fitted = null
let selfid = null

// The mirror of the fairness probe, and the half that was missing. The first
// probe asks the REFERENCE whether it attempts the goal; this one asks the
// CANDIDATE whether the goal is a description of it. Both failures decide a
// comparison before anyone looks, and neither is visible from inside it — but
// they are opposite, so they need opposite blindnesses. This prober is never
// told what the reference is; the other is never told what the candidate is.
//
// Concretely: the first live run of this build was not unfair to the reference,
// which was attempting the goal. It was fitted to the candidate — the artifact
// had been rewritten hours earlier to optimise exactly the two properties the
// goal then named. Nothing in the run could see that, and the operator who wrote
// both is the last party who will notice.
async function checkGoalFitted() {
  const f = await spawn(
    `You are asked the COUPLING question. Here is one artifact and one goal.

How much of this goal is traceable to the artifact's own visible features and vocabulary?

  independent  the goal stands on its own, and shares no wording distinctive to this artifact.
  coupled      the goal's clauses map onto the artifact's parts and share wording distinctive
               to it — most of the goal, not one clause of it.
  partial      some clauses share distinctive wording and some do not.

WHAT COUNTS AS DISTINCTIVE, because most of the disagreement lives here. Distinctive means
this artifact could have said it another way and did not: a coined phrase, an unusual verb, a
specific number, a named tool, a heading someone chose. It does NOT include the subject
itself, or the words any document on this subject would use, or the section names the genre
always uses — a document about session state saying "session state", or a decision record
with a "Drivers" or "Context" or "Decision" heading, is the genre talking and not this
artifact. Sharing only those is "independent".

THE GOAL:
${GOAL}

THE ARTIFACT: ${CANDIDATE}

Open the artifact and read it before answering. Read ONLY that file — not its neighbours, not
its history, not anything it links to. What sits beside it on disk is not part of this
question, and a probe that reads the directory is answering from the setup rather than from
the artifact.

You are not told what this will be compared against, and must not go looking for it.

You are NOT judging whether the artifact meets the goal — an artifact can be terrible at a
goal that describes it exactly.

You are NOT judging WHO WROTE WHICH FIRST, and must not say. Coupling has more than one
cause: a goal written by reading the artifact produces it, an artifact written to satisfy the
goal produces it, and so do a shared author and a shared house vocabulary. Two texts cannot
tell those apart. Report the overlap you can see and stop there.

THAT APPLIES TO YOUR WORDING TOO, and it is the part that is easy to miss. Write the overlap
SYMMETRICALLY — "both use the phrase X", "the goal's third clause and the heading on line 18
are the same words". Do not use lift, borrow, copy, take, derive, reproduce, restate,
paraphrase or reverse-engineer about these two texts IN ANY FORM — not reproduces, not
reproducing, and not negated either, because "the goal does not reproduce X" still casts the
goal as the party that might have copied. Do not contrast what you see against what an
AUTHOR would have written or could have stated before seeing the file. Every one of those
says which text came first, which is the thing you cannot see.

Saying the artifact's wording is unusual is fine and is the test above — "an ADR would more
often say Decision" is about the artifact's vocabulary, not about anybody's authorship. Name
the shared text and where it sits in each.`,
    { label: 'goal-fitted', phase: 'Loop', schema: FITTED_SCHEMA, agentType: 'gauntlet-loop:gauntlet-goal-check' }
  )
  if (!f) return null
  if (f.verdict === 'coupled') {
    log('WARNING: this goal and this candidate are not textually independent. ' +
        `${f.reasoning} The candidate answers a goal like that by construction, so verdicts on the ` +
        'coupled clauses measure the overlap and not the work. WHY they are coupled is not visible ' +
        'from here — a goal written after reading the candidate does this, and so does a candidate ' +
        'built to the goal, which is what a build round is for. You are the only party who knows ' +
        'which: if you wrote this goal with the candidate in front of you, nothing in this run is ' +
        'evidence that the candidate is better.')
  } else if (f.verdict === 'partial') {
    log(`NOTE: some clauses of this goal are traceable to the candidate's own wording. ${f.reasoning} Verdicts on those clauses measure the overlap, not the work.`)
  }
  return f
}

async function checkGoalFairness() {
  const f = await spawn(
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

const ARTIFACT_ROLE_SCHEMA = {
  type: 'object',
  required: ['role', 'what_it_is', 'reasoning'],
  additionalProperties: false,
  properties: {
    role: { type: 'string', enum: ['does-the-work', 'produces-an-instruction', 'could-not-open'], description: 'what an agent handed ONLY this artifact would do about the goal' },
    what_it_is: { type: 'string', description: 'what kind of object this is, in your own words' },
    reasoning: { type: 'string', description: 'what in the artifact settles it' },
  },
}

// THE PAIRING CHECK, and it deliberately never asks about the pairing.
//
// The first version asked one agent to judge both sides at once, and told it what
// the failure looked like: "a thing versus a recipe for making that thing", then a
// list of shapes — meta-prompt, template, spec, schema, build file. Every refusal
// it produced echoed that phrasing back, one of them citing the prompt as its
// source. Detecting a pattern the prompt just described is not detection, and the
// list was a registry: one entry per shape, and any shape not on it untested.
//
// So the agent is no longer asked for a verdict. It is asked ONE factual question
// about ONE artifact, with no mention of comparison, category errors or recipes:
// handed only this, would you DO the work or WRITE AN INSTRUCTION for someone else
// to do it. That is world knowledge, which belongs to the model. The verdict is
// derived below, which is a decision, and decisions belong to the checker.
//
// Three consequences fall out rather than being designed in:
//   - the agent cannot be told which answer is expensive, because it does not
//     produce the answer that costs anything;
//   - it never sees the two artifacts together, so the pairing cannot tell it
//     which side is the candidate (it can still recognise one from the tree —
//     that residual is measured, not claimed away);
//   - "could not open" stops being a special case and becomes one of the roles.
//
// NOT-COMPARABLE IS GONE. It had zero observations: the three the record held came
// from a two-verdict probe with no `generator` option, and their reasoning
// described the generator case. It was also the only refusal with no remedy —
// `generator` names the side to execute, `unreadable` names the path to fix, and
// that one just said no. A pairing that is genuinely incomparable and not a
// generator now runs, loses round 1, and is reported by `won_without_building`,
// which says exactly that in the verdict. A real case turning up is the evidence
// to bring the verdict back with.
let comparability = null

async function roleOf(path, n) {
  return spawn(
    `Answer ONE question about ONE artifact. Do not judge whether it is good.

THE GOAL SOMEONE IS PURSUING: ${GOAL}

THE ARTIFACT: ${path}
${INSPECT ? `\nHOW TO INSPECT IT:\n${INSPECT}\n` : ''}
THE QUESTION: if an agent were handed ONLY this artifact and told to pursue that goal, what would
it end up doing?

  does-the-work            — it would work on the goal itself. The artifact is the thing, or an
                             attempt at the thing, or the instructions for operating something that
                             does the thing right now.
  produces-an-instruction  — it would write or emit something for a DIFFERENT party to act on
                             later, and the goal would still be untouched when it finished.
  could-not-open           — the path does not exist, or is not readable, or is a directory where a
                             file was expected. Check this first.

Open it and read it before answering. Where it can be run or measured, run and measure it. If it
names a command, a path, a tool or a URL, follow one and see whether it resolves.

Being short, incomplete, badly written, or bad at the goal does not change the answer — a poor
attempt at the goal is still does-the-work. The question is only what an agent would END UP DOING,
not how well.

WHEN AN ARTIFACT DOES SOME OF THE WORK AND HANDS OFF THE REST, the goal settles it, not the amount
of work. Ask whether following this artifact to its end REACHES the goal:

  - It stops short BY DESIGN and names or implies a further party for the remainder
    -> produces-an-instruction, however much real work it does first. Scaffolding that provisions
       everything except the part that meets the goal is still a handoff.
  - It aims at the goal itself and merely falls short — buggy, partial, unfinished, wrong
    -> does-the-work. Failing at the goal is not the same as delegating it.

Say what kind of object it is in your own words, and what in it settles the answer.`,
    { label: `comparability:${n}`, phase: 'Loop', schema: ARTIFACT_ROLE_SCHEMA, agentType: 'gauntlet-loop:gauntlet-goal-check' }
  )
}

async function checkComparability() {
  // Each side alone, concurrently. parallel() resolves a thrower to null, and a
  // probe that DIED must not read as an answer: either side missing returns null,
  // which the refusal branches below treat as "not measured", never as a refusal.
  const [c, r] = await parallel([() => roleOf(CANDIDATE, 1), () => roleOf(REFERENCE, 2)])
  if (!c || !r) return null

  const sides = [{ path: CANDIDATE, ...c }, { path: REFERENCE, ...r }]
  const shut = sides.find(x => x.role === 'could-not-open')
  const writers = sides.filter(x => x.role === 'produces-an-instruction')

  // THE DERIVATION, and it is the whole decision. Kept here in three lines so it
  // can be read at once and broken by a mutation: an unopenable side beats
  // everything, then exactly one instruction-writer against one worker is the
  // asymmetry that makes a comparison meaningless, and anything else is a pairing
  // a judge can rule on — including two instruction-writers, which are at the same
  // level as each other.
  const verdict = shut ? 'unreadable' : (writers.length === 1 ? 'generator' : 'comparable')
  const blamed = shut || (verdict === 'generator' ? writers[0] : null)

  const out = {
    verdict,
    generator_side: blamed ? blamed.path : '',
    reasoning: sides.map(x => `${x.path} — ${x.what_it_is} (${x.role}): ${x.reasoning}`).join('  ||  '),
    sides: sides.map(x => ({ path: x.path, role: x.role, what_it_is: x.what_it_is })),
  }
  if (verdict !== 'comparable') {
    log(`REFUSING: the pairing is ${verdict}${out.generator_side ? ` (${out.generator_side})` : ''}. ${out.reasoning}`)
  }
  return out
}

const SELFID_SCHEMA = {
  type: 'object',
  required: ['verdict', 'self_identifying', 'reasoning'],
  additionalProperties: false,
  properties: {
    verdict: { type: 'string', enum: ['clean', 'self-identifying'], description: 'self-identifying if EITHER artifact gives away where it came from' },
    self_identifying: { type: 'array', items: { type: 'string' }, description: 'absolute paths of the artifacts that identify their own origin; empty when clean' },
    reasoning: { type: 'string', description: 'the specific content that gives it away, and what it was resolved against' },
  },
}

// CONTENT BLINDNESS — the second leak class, and the one SIDES_LOOK_ALIKE cannot
// see. That check reads the two ARTIFACT lines and asks whether the loop's own
// FORMATTING gave the sides away. It says nothing about what the files contain.
//
// Recorded as an event in wf_a0892913-ee6 rather than argued as a possibility: a
// critic ran `git branch --show-current`, `ls skills/gauntlet-loop/`, `git log
// --oneline --all` and read this project's run record, because one artifact cited
// line numbers in this project's source and quoted a report from its own tooling.
// Every citation resolved. SKILL.md had disclosed the class in prose — "a critic
// that greps the filesystem can still work out which side is yours from content"
// — and nothing measured it.
//
// The remedy is the one already used for formatting: do not prevent the leak,
// STOP CLAIMING the blindness. Prevention is not available — the critic's shell is
// what makes it inspect rather than skim, and an artifact whose subject is this
// repo identifies itself no matter what the harness does.
//
// It runs as `gauntlet-goal-check` rather than a type of its own, and that is a
// harness constraint rather than a preference. A dedicated `gauntlet-blindness`
// type was written first and never spawned: agent types are registered when the
// session loads the plugin, a type added mid-session does not exist, and issue
// #14 means the loop CANNOT TELL a missing type from an agent that returned
// nothing. The run reported "content blindness was NOT checked" and looked
// healthy. Registered types are the only ones that can be verified today.
// goal-check is the closest registered charter — a probe that reads artifacts,
// answers one question, and is never told the other side — and drift-guard
// already asserts it holds no Write, Edit, Agent, ListAgents or SendMessage.
// The mismatch, stated: its standing prompt is about goals, and this probe is
// not. The round prompt below carries the whole task.
//
// Why a probe and not a required field on the critic: a critic reporting on its
// own blindness is a quantity derived downstream of the decision under test. This
// prober never sees a verdict, is never told which artifact is the candidate, and
// reports per-path.
//
// Its residual, stated: a clean verdict is not proof of blindness. It means one
// prober resolved no origin evidence, and a leak it missed leaves the run exactly
// where it was before this probe existed. The check ratchets one way — it can
// withdraw a claim, never strengthen one.
async function checkSelfIdentification() {
  const f = await spawn(
    `Two artifacts are about to be compared blind, as A and B. A judge will be shown both and
never told which one was built for the comparison. Answer one question:

  Does either artifact's own content mark it out as the one belonging to the project this
  comparison is running inside?

ARTIFACT: ${CANDIDATE}
ARTIFACT: ${REFERENCE}

THE TEST IS A DIFFERENCE IN RELATIONSHIP TO THIS MACHINE. Not "can this file be traced to
somewhere on this machine" — both usually can. The question is:

  Does one artifact stand in a DIFFERENT relationship to this machine than the other does,
  in a way a judge with a shell could find?

Whatever you check, check it on BOTH and compare the answers. A property only identifies a
side when the two sides answer differently. Ways that difference shows up — examples, not a
closed list:

- ITS CONTENT POINTS HERE. It cites paths, line numbers, symbols, commits, branches, issue
  numbers, run identifiers or tool output that RESOLVE inside the current working tree, while
  the other artifact's references resolve elsewhere or nowhere. Try to resolve them.
- IT HAS BEEN EDITED AND THE OTHER HAS NOT. If both look like copies of documents installed
  elsewhere on this machine, FIND THOSE ORIGINALS AND DIFF BOTH. If one matches its original
  exactly and the other does not, the edited one is the one being worked on. Not checking is
  the most likely way to miss a real finding here.
- IT REFERS TO ITSELF as a draft, candidate, or work in progress, or its subject matter is the
  machinery running this comparison.
- ANY OTHER ASYMMETRY of the same kind — one has local history and the other does not, one is
  reachable from this project and the other is not.

NOT SELF-IDENTIFYING — and this is where a careless answer goes wrong:
- Being a copy of, or identical to, some file installed elsewhere on this machine — WHEN THE
  OTHER ARTIFACT IS TOO. A stock document sitting in a plugin cache says nothing about which
  side is the candidate, so long as its counterpart is equally stock. (If only one of them
  matches its original, that is the edited-and-the-other-not case above, and it is a finding.)
- Anything TRUE OF BOTH artifacts. If both are stock documents from the same source, or both
  cite the same external project, that is SYMMETRIC and it PRESERVES blindness rather than
  breaking it. Check the other artifact before reporting a finding, every time.
- Being newer, shorter, better written, or differently styled. Those are differences a judge
  must weigh, not provenance it can read off.

If you would have to flag both artifacts for the same reason, flag NEITHER and answer clean.

You are NOT told which was built for the comparison, you are not being asked to work it out,
and you must not report a guess. Read both with equal effort — reporting one because you
stopped looking after the first is the failure this probe exists to prevent.

You are not judging quality, completeness or which is better. A clean result is a normal and
useful answer, and it is the answer that lets the run keep its blindness claim; do not
manufacture a finding to look thorough.`,
    { label: 'blindness', phase: 'Loop', schema: SELFID_SCHEMA, agentType: 'gauntlet-loop:gauntlet-goal-check' }
  )
  if (!f) return null
  if (f.verdict === 'self-identifying') {
    log(`WARNING: content gives the sides away — ${f.self_identifying.join(', ')} identifies its own origin. ` +
        `${f.reasoning} A critic with a shell can establish which artifact belongs to this working tree without ` +
        'being told, so this run does not get to claim its A/B was blind. The run continues; the claim does not.')
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
          depends_on: { type: 'array', items: { type: 'string' }, description: 'names of pieces that must WIN before this one can be judged — only where judging this piece is meaningless until that one exists. Not "related to". An empty list is the common and correct answer.' },
        },
      },
    },
  },
}

let leadSpawns = 0
let decomposition = null

async function decompose() {
  leadSpawns++
  const plan = await spawn(
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

Where one piece genuinely cannot be judged until another exists, say so in depends_on --
naming a piece that must WIN first. Only real ordering: "cannot be judged yet", never "related
to" or "should come after in the document". An empty list is the common and correct answer,
and a wrong edge costs you parallelism or, worse, judges a piece before the thing it rests on
is there.

Also state your split criterion in one sentence. If that sentence is really "these are the
parts I think are weak", discard it and look again: a split drawn around known weaknesses
hides exactly those weaknesses, because every piece can pass while the whole is worse.`,
    { label: 'decompose', phase: 'Loop', schema: PIECE_SCHEMA, agentType: 'gauntlet-loop:gauntlet-lead' }
  ).catch(e => {
    // Also awaited at top level. Refusing to split is already a correct answer,
    // so a lead that errors degrades to exactly that — the artifact runs whole and
    // the verdict says the split never happened, instead of the run dying with
    // everything it had already paid for.
    log(`WARNING: the lead THREW (${(e && e.message) || e}) — running the artifact whole, which is this loop's behaviour when nothing splits`)
    return null
  })
  if (!plan) return null
  if (!plan.decomposes) return { refused: true, why: plan.split_criterion }
  // The observable check runs HERE, in code. A piece that cannot say what would
  // be inspected to judge it alone is dropped, whatever the prompt asked for.
  const withObservable = (plan.pieces || []).filter(p => p && p.name && typeof p.observable === 'string' && p.observable.trim().length > 0)
  // Names must be UNIQUE, because they are the key everything else uses: pieces
  // are stored in a Map by name, dependencies are resolved by name, and the
  // verdict counts them by name. Two pieces called the same thing collapse —
  // both run, the second overwrites the first, one outcome is discarded and the
  // other is counted twice, and the run reports that every piece was judged. A
  // lead is a language model; duplicate names are ordinary output. Later
  // duplicates are dropped here, which feeds the existing `kept.length < 2` rule,
  // so a "split" that was really one piece under two names runs whole instead.
  const seenNames = new Set()
  const kept = withObservable.filter(p => {
    const key = String(p.name).trim().toLowerCase()
    if (seenNames.has(key)) return false
    seenNames.add(key)
    return true
  })
  const dropped = (plan.pieces || []).length - kept.length
  if (kept.length < 2) return { refused: true, why: `fewer than two pieces survived with an observable and a distinct name (${kept.length} of ${(plan.pieces || []).length}); one piece is not a decomposition${withObservable.length > kept.length ? `, and ${withObservable.length - kept.length} shared a name with an earlier piece` : ''}`, dropped }
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

const probes = pendingProbe ? await parallel([() => checkGoalFairness(), () => checkGoalFitted(), () => checkSelfIdentification(), () => checkComparability()]) : [null, null, null, null]
fairness = probes[0]
fitted = probes[1]
selfid = probes[2]
comparability = probes[3]

// REFUSE BEFORE THE LEAD SPAWNS. Decomposition is the most expensive spawn in the
// run and it is next; a pairing that cannot be judged must not pay for it.
//
// A probe that DIED costs a measurement, not the run — the same rule every other
// component here follows. Only an answer refuses.
// EVERYTHING THESE REFUSALS DISCARD WAS ALREADY BOUGHT.
//
// The three probes above run in the same parallel() as the pairing check, so by
// the time a refusal fires the operator has paid for all four. Until this existed
// they got a category error and nothing else — while in run wf_836738df-380
// `goal_fairness` had independently returned `does-not-attempt` and the blindness
// probe had found BOTH artifacts byte-identical to files in the working tree.
// Both are actionable whether or not the pairing was comparable, and both were
// thrown away.
//
// This repo's rule is that a component's failure costs exactly what that component
// was buying. A pairing refusal should cost the pairing, not three unrelated
// measurements. One helper for all three refusals rather than three copies: the
// findings do not depend on WHY the run was refused.
//
// Reasoning strings are free prose and can run long, so they are truncated here;
// nothing else records them on a refused run, which is why they appear at all.
function probeFindings() {
  const clip = t => { const x = String(t || '').replace(/\s+/g, ' ').trim(); return x.length > 220 ? x.slice(0, 220) + '…' : x }
  const lines = []
  lines.push(fairness
    ? `goal_fairness: ${fairness.verdict}${fairness.verdict === 'attempts' ? '' : ` — the reference is for: ${clip(fairness.what_it_is_for)}`}`
    : 'goal_fairness: NOT MEASURED — the probe returned nothing, so whether the reference even attempts this goal is unknown')
  lines.push(fitted
    ? `goal_coupling: ${fitted.verdict}${fitted.verdict === 'independent' ? '' : ` — ${clip(fitted.reasoning)}`}`
    : 'goal_coupling: NOT MEASURED — the probe returned nothing, so whether the goal restates the candidate is unknown')
  lines.push(selfid
    ? `content blindness: ${selfid.verdict}${selfid.verdict === 'clean' ? '' : ` — ${(selfid.self_identifying || []).join(', ')} identifies its own origin`}`
    : 'content blindness: NOT MEASURED — the probe returned nothing, so a leak cannot be ruled out')
  // All three probes above are the same agent type as the pairing check, and the
  // pairing check just ANSWERED — that is why there is a refusal to attach this to.
  // So any "NOT MEASURED" here is knowably an agent that returned nothing rather
  // than a type that is missing, and saying it once beats repeating it per line.
  const note = typeProven('gauntlet-loop:gauntlet-goal-check')
    ? '\n  (any NOT MEASURED above is an agent that ran and returned nothing: the pairing check is the same agent type and it answered, so the type is registered — see issue #14.)'
    : ''
  return '\n\nALREADY MEASURED on the way to this refusal, and worth reading before you retry:\n  - ' + lines.join('\n  - ') + note
}

// FETCHABLE. `loop.js` runs in a sandbox with no filesystem — `shapeOf` is a pure
// string test, so a path that does not exist still reads as 'abs-path', SIDES_LOOK_ALIKE
// still holds, and the run POSITIVELY ASSERTS its A/B was blind while one side was
// never there. Built and confirmed: two full rounds and a verdict, against a
// reference that did not exist. The operator who prompted this fix mis-typed a
// reference path twice in one session; both times it was caught by hand.
//
// Folded into this probe rather than given its own spawn: the probe already opens
// both artifacts, and "one of these could not be opened" is an answer to the
// question it was already asking.
if (comparability && comparability.verdict === 'unreadable') {
  throw new Error(
    'REFUSED: an artifact could not be opened — ' + (comparability.generator_side || '(the probe did not name which)') +
    '. ' + comparability.reasoning + '\n\n' +
    'This does not fail loudly on its own. The path check is a string test, so a path that does not exist ' +
    'still looks like a path, the run still claims its A/B was blind, and a critic judges one real artifact ' +
    'against nothing. Check the path — a typo here costs a whole run.' + probeFindings())
}
if (comparability && comparability.verdict === 'generator') {
  const side = comparability.generator_side || '(the probe did not name which side)'
  throw new Error(
    'REFUSED: one of these two artifacts is a GENERATOR, not the thing itself — ' + side + ' is a recipe for ' +
    'producing something rather than an attempt at the goal. ' + comparability.reasoning + '\n\n' +
    'A blind A/B between a thing and a recipe for a thing is a category error, and it does not fail loudly: it ' +
    'returns WON at round 1 with no build round, which reads exactly like success. That happened twice, for 419k ' +
    'tokens, before this refusal existed.\n\n' +
    'THE FIX IS CHEAP AND THIS PAIRING IS PROBABLY FINE. Execute that side once — hand it to a fresh agent and ' +
    'keep what it produces — then pass the OUTPUT as the artifact. The same two sources come back comparable. ' +
    'This is what the source method already does: it judges rendered frames against real frames, not a prompt ' +
    'against a design document.' + probeFindings())
}
const decomposition_ = pendingProbe ? await decompose() : null
decomposition = decomposition_
if (decomposition && decomposition.refused) {
  log(`NOTE: not decomposed — ${decomposition.why}. Running the artifact whole, which is this loop's behaviour when nothing splits.`)
} else if (!decomposition) {
  log(`WARNING: the lead returned nothing, so nothing decided whether this artifact should be split. Running it whole — which is also what a lead that REFUSED to split produces, so do not read this run as a decomposition judgement.${silenceNote('gauntlet-loop:gauntlet-lead')}`)
} else if (decomposition) {
  log(`decomposed into ${decomposition.pieces.length} piece(s): ${decomposition.pieces.map(p => p.name).join(', ')}${decomposition.dropped ? ` (${decomposition.dropped} dropped for naming no observable)` : ''}`)
}

// One implicit piece when nothing decomposed: the whole artifact, unnamed, so
// every label and every prompt is byte-identical to the undecomposed run.
const PIECES = (decomposition && decomposition.pieces) || [{ name: null, candidate: CANDIDATE, reference: REFERENCE }]

const history = []
let outcome = null
let lastWon = null


async function runPiece(piece) {
  const PC = piece.candidate || CANDIDATE
  const PR = piece.reference || REFERENCE
  let round = 0
  let pieceOutcome = null

  while (true) {
  round++
  const TAG = piece.name ? `${piece.name}-round-${round}` : `round-${round}`

  // Budget first: it is free to check, so a run that is already out of money
  // does not pay for a breaker probe to be told so.
  if (budgetLeft() < ROUND_RESERVE * (roundsInFlight + 1)) {
    pieceOutcome = { status: 'BUDGET', why: roundsInFlight
      ? `stopped with ~${Math.round(budgetLeft() / 1000)}k left — under the ${ROUND_RESERVE / 1000}k a round needs once the ${roundsInFlight} round(s) already in flight on other pieces are reserved for`
      : `stopped with ~${Math.round(budgetLeft() / 1000)}k left — under the ${ROUND_RESERVE / 1000}k a round needs` }
    break
  }
  // Held from here to this round's last spawn. The body is NOT re-indented for
  // this wrapper — `break` inside a try still runs the finally, so all eight exit
  // paths below release the reservation, and a 190-line re-indent would bury the
  // change it is meant to make legible.
  roundsInFlight++
  try {
  // Then the breaker, BEFORE the critic — so a cancel costs at most one cheap
  // probe, never a critic and a builder. Round 1 checks too: that is what
  // catches a mistyped token path before the run spends anything real.
  let tokenOk
  if (pendingProbe !== null) { tokenOk = pendingProbe; pendingProbe = null }
  else { breakerSpawns++; tokenOk = await tokenPresent(round, TAG) }
  if (!tokenOk) {
    pieceOutcome = {
      status: 'CANCELLED',
      // `round` is per PIECE, so round 1 does NOT mean nothing has run: a later
      // piece's first round can find the token gone after other pieces have
      // completed rounds. Only an empty history licenses the "it may never have
      // existed" reading — anything else is an ordinary cancel, and saying
      // otherwise sends the operator hunting a path bug that is not there.
      why: history.length === 0
        ? `the run token at ${TOKEN} was already absent before any round ran — either the operator cancelled immediately, or it was never created (check the path)`
        : `the operator removed the run token at ${TOKEN}; stopped at the ${piece.name ? `"${piece.name}" round ${round}` : `round ${round}`} boundary after ${history.length} completed round(s)`,
    }
    break
  }

  await measureSize(round, TAG, piece.name, PC)

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
    const v = await spawn(
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
    // A null here is a critic that THREW, not one that returned nothing:
    // parallel() converts a throw per the runtime contract, so it never reached
    // the `critic_died` line inside spawnCritic. Dropping it silently shortened
    // the line, and a shorter line can satisfy the exit rule — the run then
    // reported "all N critics picked the candidate" with fewer than N votes.
    for (const p of rest) { if (p) positions.push(p); else critic_died = true }
  }

  // Fails SAFE, like the breaker and the budget: a round decided on a SHORTER
  // line than the operator asked for is a quietly weaker standard, applied at
  // the moment something is already going wrong.
  if (critic_died || positions.length === 0) {
    pieceOutcome = {
      status: 'ERROR',
      why: (CRITICS === 1
        ? `critic returned nothing at round ${round}`
        : `a critic returned nothing at round ${round} — a round is not decided on a partial line of ${CRITICS}`) +
        silenceNote('gauntlet-loop:gauntlet-ab-critic'),
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

  const entry = {
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
  }
  history.push(entry)

  // THE GAP GOES OUT LIVE, and this line is why.
  //
  // commands/loop.md Step 5 tells the operator: "Read gaps_in_order before the
  // verdict. Gaps that get smaller and more specific mean the loop is working; the
  // same gap restated in round 5 as in round 1 means it is not, and that is worth
  // stopping for." That instruction was unfollowable. `gaps_in_order` exists only
  // in the FINAL verdict, so the one judgement the operator is told to make WHILE
  // watching is the one the live output could not support — they saw vote counts
  // and nothing else.
  //
  // This is also the source's "live progress page" in the only form a Workflow
  // script can offer one: the script has no filesystem, so it cannot write a page,
  // but log() reaches the operator through /workflows as the run goes. Reporting
  // the gap the round actually produced is the substance that page was for.
  //
  // Truncated because a gap is free prose and can be a paragraph; the full text is
  // kept verbatim in the verdict. The truncation marker is deliberate — a silently
  // cut string reads as a gap the critic phrased tersely.
  const gapLive = String(primary.gap || '').replace(/\s+/g, ' ').trim()
  const gapShown = gapLive.length > 180 ? gapLive.slice(0, 180) + '… (full text in the verdict)' : gapLive
  const sizeLive = sizeByRound.filter(x => x.round === round && x.piece === (piece.name || null)).pop()
  log(`round ${round}${piece.name ? ` [${piece.name}]` : ''}: ${positions.length} critic(s) — ${positions.length - dissenters.length} for the candidate, ${dissenters.length} against — ${candidateWon ? 'CANDIDATE WINS' : 'reference still ahead'}` +
      `${sizeLive ? ` · ${sizeLive.bytes} bytes` : ''}` +
      `\n  gap: ${gapShown || '(the critic recorded no gap text)'}`)

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
  const built = await spawn(
    `You are building toward this goal:
${GOAL}

THE CANDIDATE: ${PC}
${round === 1 ? '\nIf it does not exist yet, build the first version now.\n' : ''}
A critic compared it blind against a reference and the candidate lost. It named ONE gap —
the single largest thing standing between them:

    ${primary.gap}

Fix that gap. Only that gap.

Closing it does not have to mean ADDING something. Most gaps are phrased as an absence —
"it never says X", "there is no Y" — and adding a section is the obvious answer, but often
the worse one: the material may already be present and buried, or in the wrong order, or
crowded out by something that should go. Removing, moving or rewriting what is already
there is closing the gap too, and an artifact that grows every round is usually losing.

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
    pieceOutcome = { status: 'ERROR', why: `builder returned nothing at round ${round}${piece.name ? ` of piece "${piece.name}"` : ''}` + silenceNote('gauntlet-loop:gauntlet-builder') }
    break
  }

  // All four fields the schema asks for. `failed` was being collected and dropped:
  // the builder is required to report what it tried that did not work, and that is
  // the only place a dead end gets recorded. Without it the next round's builder
  // walks into the same one and the verdict shows an operator nothing.
  entry.built = { changed: built.changed, where: built.where, ambiguity: built.ambiguity || null, failed: built.failed || null }
  } finally { roundsInFlight-- }
  }

  if (piece.name && pieceOutcome && pieceOutcome.status === 'WON') log(`piece "${piece.name}" won after ${round} round(s)`)
  return pieceOutcome
}

// ---------------------------------------------------------------------------
// HOW PIECES ARE DISPATCHED — a DAG, run at maximum width.
//
// The source ran "three rounds of SIX AGENTS each owning one directory"; its
// sequential pass was a later, targeted move on "coupled concerns", not the mode
// it worked in. Running every piece one at a time is that exception applied as
// the rule.
//
// TWO DIFFERENT RELATIONS, and conflating them costs either correctness or
// wall clock:
//
//   COUPLING   two pieces edit the SAME path. Mutual exclusion — two builders
//              writing one file race and the loser's work vanishes. Read off
//              the pieces, never judged.
//   DEPENDENCY B cannot be JUDGED until A has won. Ordering, not exclusion.
//              Named by the lead, because only it can see that a worked example
//              is meaningless before the thing it demonstrates exists.
//
// Both are expressed as promises rather than as a scheduler: every piece is
// launched at once, and each awaits its own dependencies and its own path's
// predecessor before running. So a piece starts the moment ITS prerequisites
// are satisfied — not when a layer finishes. That is the maximum parallelism
// the graph allows.
//
// A dependency that did not WIN does not release its dependents: they are
// SKIPPED, recorded, and never spawned. Without that, a run with no round cap
// waits forever on a piece that will never win.
// ---------------------------------------------------------------------------
const byName = new Map(PIECES.map(p => [p.name, p]))

// Edges to pieces that do not exist are dropped rather than guessed at.
const deps = new Map()
let droppedEdges = 0
for (const piece of PIECES) {
  const named = ((piece.depends_on || []).filter(d => {
    const ok = byName.has(d) && d !== piece.name
    if (!ok) droppedEdges++
    return ok
  }))
  deps.set(piece.name, named)
}

// A cycle deadlocks a promise graph silently — every piece waiting on another.
// Detected here and broken by dropping ALL edges, because a lead that produced a
// cycle has not given us an ordering we can trust part of.
function hasCycle() {
  const state = new Map()
  const walk = n => {
    if (state.get(n) === 'done') return false
    if (state.get(n) === 'open') return true
    state.set(n, 'open')
    for (const d of deps.get(n) || []) if (walk(d)) return true
    state.set(n, 'done')
    return false
  }
  return PIECES.some(p => walk(p.name))
}
let cycleBroken = false
if (PIECES.length > 1 && hasCycle()) {
  cycleBroken = true
  for (const k of deps.keys()) deps.set(k, [])
  log('WARNING: the lead named a dependency cycle. All ordering has been dropped and every piece ' +
      'runs as soon as its file is free — a cycle is not an ordering we can trust part of.')
}

// Once ANY piece stops the run — cancelled, out of budget, an agent failing —
// nothing further is spawned. Pieces already in flight finish, because they
// cannot be aborted; pieces still waiting on a dependency or on a file lock are
// skipped and recorded. Without this a cancel releases the next coupled piece
// and the run keeps spending after the operator has said stop.
let runStopped = null

const results = new Map()   // piece name -> outcome, once it has run
const skipped = []
const pathLock = new Map()  // candidate path -> promise chain, so coupled pieces never overlap

function runWhenReady(piece) {
  const started = (async () => {
    for (const d of deps.get(piece.name) || []) {
      await pieceRuns.get(d)
      const r = results.get(d)
      if (!r || r.status !== 'WON') {
        skipped.push({ piece: piece.name, because: `it depends on "${d}", which ${r ? `ended in ${r.status}` : 'never ran'}` })
        return null
      }
    }
    if (runStopped) {
      skipped.push({ piece: piece.name, because: `the run had already stopped (${runStopped.status}) before this piece started` })
      return null
    }
    const key = piece.candidate || CANDIDATE
    const prior = pathLock.get(key) || Promise.resolve()
    const mine = prior.then(() => {
      if (runStopped) {
        skipped.push({ piece: piece.name, because: `the run stopped (${runStopped.status}) while this piece waited for ${key}` })
        return null
      }
      return runPiece(piece)
    })
    pathLock.set(key, mine.catch(() => {}))
    const o = await mine
    if (o) results.set(piece.name, o)
    if (o && o.status !== 'WON' && !runStopped) runStopped = o
    return o
  })()
  return started
}

const pieceRuns = new Map()
for (const piece of PIECES) pieceRuns.set(piece.name, runWhenReady(piece))

const edgeCount = [...deps.values()].reduce((n, d) => n + d.length, 0)
if (PIECES.length > 1) {
  log(`${PIECES.length} pieces, ${edgeCount} dependency edge(s)${droppedEdges ? `, ${droppedEdges} edge(s) dropped as unknown` : ''} — ` +
      'each starts as soon as its own dependencies have won and its file is free')
}

const pieceOutcomes = await parallel(PIECES.map(p => () => pieceRuns.get(p.name)))

// A null here is a piece whose run DIED — parallel() turns a throw into null per
// the runtime contract, so an agent error inside a piece arrives as an absent
// outcome rather than a failed one. Skipping nulls meant the run then fell
// through to "every one of the N pieces beat the reference": a false WON, about
// a piece that was never judged at all. That is the one verdict an operator acts
// on, so it fails loudly and names the piece.
// A SKIPPED piece is also null, and it is a different event with a better
// explanation already recorded. Blaming it for crashing points the operator at
// the wrong piece and hides the one that actually failed — and which null is seen
// first is decided by nothing more than the lead's ordering.
const skippedNames = new Set(skipped.map(s => s.piece))
for (const [i, o] of pieceOutcomes.entries()) {
  if (!o && !outcome) {
    const name = (PIECES[i] && PIECES[i].name) || `#${i + 1}`
    if (!skippedNames.has(name)) {
      outcome = { status: 'ERROR', why: `piece "${name}" never produced an outcome — its run failed, so it was never judged. No verdict here covers it, and the other pieces' results say nothing about it.` }
    }
  }
  if (o && o.status !== 'WON' && !outcome) outcome = o
  if (o && o.status === 'WON') lastWon = o
}
// BACKSTOP, and believed unreachable today. `skipped` is non-empty only when a
// dependency did not WIN or the run had already stopped — and both of those mean
// some piece has a non-WON or absent outcome, which the loop above turns into
// `outcome` first. So this branch cannot be reached by any path currently in the
// file, and mutating it away breaks no test: that reads as dead code and is not.
//
// It is here for a change in the skip rules. If a piece ever becomes skippable
// for a reason that does NOT stop the run — a budget check per piece, a filter, a
// dependency satisfied some other way — this is the line that stops the run
// reporting success over work that was never judged.
if (!outcome && skipped.length) {
  outcome = { status: 'ERROR', why: `${skipped.length} piece(s) never ran because what they depend on did not win: ${skipped.map(s => `"${s.piece}" — ${s.because}`).join('; ')}` }
}

if (!outcome) {
  outcome = (PIECES.length === 1 && !PIECES[0].name)
    ? lastWon
    : { status: 'WON', why: `every one of the ${PIECES.length} pieces beat the reference in a blind A/B`, round: history.length, pieces: PIECES.map(p => p.name) }
}

// ---------------------------------------------------------------------------
// THE SPLIT CHECK — the only thing here that can falsify a decomposition.
//
// `not_enforced` has said this since the lead was added: "a plausible observable
// is not a correct seam. A split drawn around known weaknesses hides them, and
// every piece can win while the artifact as a whole is worse than the reference.
// Nothing in this run would notice that." That was an accurate disclosure of a
// hole, repeated every run, and nothing filled it. One live split in five runs
// and no check on it.
//
// What this is: after every piece has won its own A/B, ONE more blind A/B on the
// WHOLE candidate against the WHOLE reference. If the parts all won and the whole
// loses, the split hid something — a gap that lives between the pieces, in their
// ordering, their overlap, their contradictions, or in the region no piece
// claimed. No answer key is involved: the check is a comparison of the same kind
// the loop already runs, at a scope no piece covers.
//
// It can fail, which is the bar. It is also asymmetric, and the asymmetry is the
// point: a LOSS is a positive detection and downgrades the run to SPLIT_UNSOUND.
// A WIN is consistency, not proof — one whole-artifact critic agreeing with the
// pieces does not establish that the seam was correct, and nothing here should be
// read as if it did.
//
// NOT SOURCE FIDELITY. Neither primary text describes a whole-artifact round;
// the source stops when every sub-agent is wowed, which is what the piece
// verdicts already are. This is an ADDITION, disclosed as one, for the same
// reason k>1 is: it defends a property the source assumes rather than checks.
//
// Undecomposed runs do not pay for it. The artifact was judged whole every round
// already, so a whole-artifact A/B would be the same judgment a second time.
const DECOMPOSED = !!(decomposition && decomposition.pieces && PIECES.length > 1)
// why_not is always a sentence, never null. This value reaches the verdict by
// interpolation, so a null here prints "did not run: null" — a reader cannot tell
// that from a defect in the reporting, and it is one.
let split_check = {
  ran: false,
  why_not: DECOMPOSED
    ? 'the run never reached WON, so no winning split existed to falsify — this check only runs after every piece has beaten the reference'
    : 'nothing was split — the artifact was judged whole every round, so a whole-artifact A/B is the same judgment twice',
}

// Only meaningful when the pieces edited the artifact this check judges. Pieces
// may name their own candidate files, and then the builders never touched
// args.candidate — judging it would examine an untouched file and return a pass
// covering none of the work. The loop has no filesystem, so it cannot tell
// whether those files compose into args.candidate; it can only tell whether they
// ARE it.
const PIECES_EDIT_THE_WHOLE = PIECES.every(p => (p.candidate || CANDIDATE) === CANDIDATE)
if (DECOMPOSED && outcome.status === 'WON' && !PIECES_EDIT_THE_WHOLE) {
  const own = PIECES.filter(p => p.candidate && p.candidate !== CANDIDATE).map(p => `"${p.name}" -> ${p.candidate}`)
  split_check = { ran: false, why_not: `the pieces edited their own candidate files (${own.join(', ')}), not ${CANDIDATE}, so a whole-artifact A/B on that path would judge a file no builder touched. A pass there would cover none of the work` }
}
if (DECOMPOSED && outcome.status === 'WON' && PIECES_EDIT_THE_WHOLE) {
  const s = sides(history.length, 0, CANDIDATE, REFERENCE)
  // It is a critic and it is counted as one. Calling agent() directly rather than
  // through spawnCritic puts this call outside the counter, which is precisely how
  // the round-count/verdict-count bug got in — a caller that quietly escapes the
  // number the verdict prints.
  criticSpawns++
  // Wrapped, and not out of caution-by-habit. Every other agent() in this script
  // is inside parallel(), which turns a throw into null. This one is a bare await
  // that runs AFTER every piece has already won, so an uncaught throw here would
  // discard the entire verdict of a finished run — rounds, gaps, history, all of
  // it — at the most expensive possible moment. The check is allowed to fail. It
  // is not allowed to take the run down with it.
  let w = null
  let threw = null
  try {
    w = await spawn(criticPrompt(s, { name: null }), {
      label: 'split-check:whole', phase: 'Loop', schema: AB_SCHEMA, agentType: 'gauntlet-loop:gauntlet-ab-critic',
    })
  } catch (e) {
    threw = (e && e.message) || String(e)
    log(`WARNING: the whole-artifact split check threw (${threw}). The run's verdict stands; the split is unchecked.`)
  }
  if (threw) {
    split_check = { ran: false, why_not: `the whole-artifact critic threw (${threw}), so the split stands unchecked — read this run as if this check did not exist` }
  } else if (!w) {
    split_check = { ran: false, why_not: 'the whole-artifact critic returned nothing, so the split stands unchecked — read this run as if this check did not exist' + silenceNote('gauntlet-loop:gauntlet-ab-critic') }
  } else {
    const candidateSide = s.A === CANDIDATE ? 'A' : 'B'
    const candidateWon = w.winner === candidateSide
    split_check = { ran: true, candidateSide, winner: w.winner, candidateWon, margin: w.margin, why: w.why, gap: w.gap, inspected: w.inspected }
    if (!candidateWon) {
      log(`WARNING: every piece beat the reference and the WHOLE artifact did not. The split hid something: ${w.gap}`)
      outcome = {
        status: 'SPLIT_UNSOUND',
        why: `every piece beat the reference in its own blind A/B, and the whole artifact lost one — the ${PIECES.length}-way split hid a gap no piece could see`,
        round: history.length,
        pieces: PIECES.map(p => p.name),
      }
    } else {
      log('the whole artifact also beat the reference — the split survived its check')
    }
  }
}

// ---------------------------------------------------------------------------
// Report. A loop the operator stopped has NOT failed — the source is explicit
// that the bar need not be reachable and that the operator stopping is the
// normal ending: "A hard bar does not need to be realistically reachable. My
// game did not become better than Call of Duty. I stopped the run while it was
// still improving." What matters is whether the gaps were getting smaller.
// ---------------------------------------------------------------------------

// Every critic position in the run, the whole-artifact one included. It is
// counted in the spawn bullet, so leaving it out here would report a balance
// that silently omits a judge the same verdict says was paid for.
const sidesUsed = history.flatMap(h => h.split.positions.map(p => p.side))
  .concat(split_check.ran ? [split_check.candidateSide] : [])
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
  if (outcome.status === 'SPLIT_UNSOUND') {
    return `no round cap existed — every piece won its own A/B across ${history.length} round(s), and the run then FAILED the whole-artifact check. It did not stop early; it stopped because the decomposition was shown to be hiding something`
  }
  return `no round cap existed — the loop ended in ${outcome.status} after ${history.length} round(s), which is a failure to continue rather than any of the three real stops (win, operator cancel, budget)`
})()

// Recorded verdicts, not rounds. These are the same number at critics: 1 and
// diverge the moment escalation buys a second critic — a losing round records
// one verdict, a winning round records k. Interpolating history.length here
// understated them, which reads as if a critic had returned nothing.
// Two leak classes, one remedy. SIDES_LOOK_ALIKE covers the loop's own
// formatting; this covers what the files say about themselves. Either one being
// open means the blindness claim is withdrawn — a claim that survives a known
// leak is worse than no claim.
// Reconciled across BOTH fields, because a schema cannot make them agree. Either
// half indicating a leak withdraws the claim: this check is only ever allowed to
// take the blindness claim away, so where the two halves disagree, the half that
// takes it away wins.
const LEAKING_FILES = (selfid && Array.isArray(selfid.self_identifying) ? selfid.self_identifying : []).filter(Boolean)
const CONTENT_LEAKS = !!(selfid && (selfid.verdict === 'self-identifying' || LEAKING_FILES.length > 0))

// #14 NARROWED. That issue says the loop cannot tell an unregistered agent type
// from an agent that returned nothing, because a Workflow script sees an empty
// result either way. True of a type called ONCE — and not true of this one.
// The blindness probe runs as `gauntlet-goal-check`, the same type as the
// fairness and fitted probes, so a result from EITHER of those is proof the type
// is registered and spawnable in this session, which narrows a null from the
// third to an agent that ran and returned nothing.
//
// This does not close #14. A type used by exactly one call is still ambiguous,
// and the general fix — asking the runtime whether a type exists — is not
// available to a script with no filesystem and no registry access. What it does
// is remove the ambiguity in the one place it has actually cost something:
// wf_fdbb326d-333 spawned a probe against a type added mid-session, got null,
// and printed "content blindness was NOT checked" while looking perfectly healthy.
const GOAL_CHECK_SPAWNABLE = typeProven('gauntlet-loop:gauntlet-goal-check')

const recordedVerdicts = history.reduce((n, h) => n + ((h.split && h.split.positions.length) || 0), 0) + (split_check.ran ? 1 : 0)

return {
  outcome,
  rounds: history.length,
  stopped_by_evidence: stoppedByEvidence,
  // Set only when a probe's SILENCE stopped the run, and it records which of the two
  // events issue #14 conflates this run could actually tell apart. The log carries
  // the same sentence, but a log is not what an operator reads when a run comes back
  // CANCELLED — the verdict is, and "you cancelled this" and "an agent type may be
  // missing" are different problems with different fixes.
  stopped_by_silence: breakerSilent,
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

  // Measured by the breaker, which is Bash-only and never speaks to a critic.
  // A loop whose builder answers every absence by adding grows its artifact
  // monotonically while every individual round is locally correct; nothing else
  // in this run would notice.
  comparability,
  size_by_round: sizeByRound,
  size_unmeasured: sizeUnmeasured,
  // Grouped BY PIECE, because sizeByRound stops describing one file the moment
  // the lead splits: each piece measures its own path, so a flat series mixes
  // different artifacts. That breaks the monotonic test both ways — growth in one
  // piece is cancelled by another shrinking, and two files of different sizes read
  // as one artifact getting bigger. Whole-artifact runs are a single group and
  // behave exactly as before.
  size_note: (() => {
    const byPiece = new Map()
    for (const x of sizeByRound) {
      const k = x.piece || null
      if (!byPiece.has(k)) byPiece.set(k, [])
      byPiece.get(k).push(x.bytes)
    }
    const growers = []
    for (const [name, b] of byPiece) {
      if (b.length < 3) continue
      const grew = b.every((x, i) => i === 0 || x >= b[i - 1])
      const delta = b[b.length - 1] - b[0]
      if (grew && delta > 0) growers.push({ name, from: b[0], to: b[b.length - 1], delta })
    }
    if (!growers.length) {
      // No growth to report is not the same as nothing to report. When every
      // round's measurement was refused there is no growth series at all, and
      // saying nothing lets an operator read a silent verdict as "size was fine".
      if (sizeUnmeasured.length && !sizeByRound.length) {
        const why = sizeUnmeasured[0].why
        return `SIZE WAS NEVER MEASURED — the probe ran ${sizeUnmeasured.length} time(s) and could not measure any of them (${why}). ` +
               'A directory, an unreadable path or a probe that could not run all land here. Nothing in this verdict ' +
               'reports whether the artifact grew, so the one check that would notice an artifact getting worse by ' +
               'accretion was dark for this run.'
      }
      return null
    }
    const what = growers.map(g => `${g.name ? `"${g.name}"` : 'the artifact'} ${g.from} to ${g.to} bytes, +${g.delta}`).join('; ')
    return `GREW EVERY ROUND — ${what}. Each gap may have been real and each fix may have addressed it; an artifact that only ever gets bigger is usually losing anyway. Check whether the builder is answering absences by appending.`
  })(),

  goal_coupling: fitted
    ? { verdict: fitted.verdict, reasoning: fitted.reasoning }
    : { verdict: 'unchecked', reasoning: null },

  goal_fairness: fairness
    ? { verdict: fairness.verdict, reference_is_for: fairness.what_it_is_for, parts_not_attempted: fairness.parts_not_attempted || null }
    : { verdict: 'unchecked', reference_is_for: null, parts_not_attempted: null },

  gaps_in_order: history.map(h => `${h.piece ? `${h.piece} ` : ''}round ${h.round}: ${h.gap}`),

  dependency_graph: decomposition && decomposition.pieces
    ? { edges: [...deps.entries()].filter(([, d]) => d.length).map(([n, d]) => `${d.join(' + ')} -> ${n}`), dropped_edges: droppedEdges, cycle_broken: cycleBroken, skipped }
    : null,

  decomposition: decomposition && decomposition.pieces
    ? { split_criterion: decomposition.split_criterion, pieces: decomposition.pieces.map(p => ({ name: p.name, observable: p.observable })), dropped_for_no_observable: decomposition.dropped || 0, lead_spawns: leadSpawns }
    : {
        split_criterion: null,
        pieces: [],
        // Only a lead that ANSWERED can refuse. Silence goes in its own field so a
        // reader cannot mistake it for a judgement the lead never made.
        refused: decomposition ? decomposition.why : null,
        no_plan_returned: decomposition ? null : 'the lead returned nothing, so no decomposition judgement was made at all — this run was NOT decomposed, and that is not the same as a lead deciding it should not be' + silenceNote('gauntlet-loop:gauntlet-lead'),
        lead_spawns: leadSpawns,
      },

  enforced: [
    ...(SIDES_LOOK_ALIKE && !CONTENT_LEAKS ? [
      'the critic was never TOLD which artifact was the candidate — sides alternate by round parity and the prompt never uses the word "candidate"',
    ] : []),
    decomposition && decomposition.pieces
      ? `the run ended only when EVERY one of the ${decomposition.pieces.length} piece(s) beat the reference, each with its own rounds, its own builder and its own critics, with pieces that edit the SAME path never running at once${split_check.ran ? ', AND the whole artifact then beat the whole reference in one further blind A/B — every piece winning was not sufficient on its own' : ' (the whole-artifact check that would also have been required did not run: ' + split_check.why_not + ')'}`
      : 'the artifact was judged whole — one piece, so "every piece satisfied" is one judgment, not a set',
    CRITICS === 1
      ? 'the exit was ONE critic picking the candidate in one round — a line of one, which satisfies "every judge" vacuously (args.critics defaults to 1)'
      : `the exit required ALL ${CRITICS} critics in a single round to pick the candidate, each spawned fresh, with positions split across the line by (round + index) parity`,
    `a FRESH critic every round (${criticSpawns} separate critic spawn(s); ${recordedVerdicts} produced a recorded verdict), so none defended its own prior verdict`,
    'the critic ran as an agent type whose tool allowlist has no Write or Edit — it could not use those TOOLS to alter either artifact (it still holds Bash; see not_enforced)',
    'the builder ran as an agent type with no Agent/ListAgents/SendMessage — it could not reach or spawn a critic',
    'the builder was handed the gap STRING and nothing else from the verdict — the critic\'s `why` field is not forwarded (it is collected and recorded, but never reaches the build prompt), and the builder never learned the sides, the critic\'s identity, or the run\'s history',
    'one gap SLOT is required per round by the schema (AB_SCHEMA.gap is in `required`) — the critic cannot omit a gap entirely (see not_enforced for what this does not buy)',
    `the run was interruptible at EVERY round boundary: the token at ${TOKEN} was checked ${breakerSpawns} time(s), before the critic spawned each round, by an agent type whose whole tool allowlist is Bash and which never saw the goal, either artifact, or any verdict`,
    'the breaker fails SAFE — a probe that returns nothing, or anything other than PRESENT, stops the run. An uncancellable loop cannot be produced by the breaker failing',
    ROUND_COUNT_CLAIM,
  ],

  not_enforced: [
    // THE PAIRING CHECK COVERS args.candidate/args.reference AND NOTHING ELSE.
    //
    // It runs before decompose(), which is the only place it CAN run — refusing a
    // hopeless pairing must not pay for the most expensive spawn in the run — and
    // at that moment the pieces do not exist. A piece may then carry its own
    // `candidate`/`reference` (see runPiece), and those pairings were never asked
    // about: a piece can be judged against a generator, or against a path that
    // cannot be opened, and the run proceeds.
    //
    // This is the class this repo keeps rediscovering rather than a new one. When
    // the lead landed it made `round` per-piece and five whole-artifact assumptions
    // elsewhere silently became false. This check was written afterwards and became
    // the sixth, in the same session that recorded the lesson.
    //
    // Disclosed rather than fixed, deliberately: checking per piece costs one spawn
    // per piece, and nothing has yet measured how often a lead assigns its own
    // paths. Adding that width on a case nobody has observed would be structure
    // added because the task seems to want it.
    ...((DECOMPOSED && PIECES.some(p => (p.candidate && p.candidate !== CANDIDATE) || (p.reference && p.reference !== REFERENCE)))
      ? [`the pairing check covered ${CANDIDATE} against ${REFERENCE} only. ${PIECES.filter(p => (p.candidate && p.candidate !== CANDIDATE) || (p.reference && p.reference !== REFERENCE)).map(p => `"${p.name}"`).join(', ')} ` +
         `was judged against its own path, and NO comparability, generator or readability check was made for it — the probe runs before the lead spawns, so the pieces did not exist yet. Any verdict on those pieces carries none of the pairing guarantees the whole-artifact verdict does.`]
      : []),
    CONTENT_LEAKS
      ? `this run's A/B was NOT blind on content: ${LEAKING_FILES.length ? `${LEAKING_FILES.join(', ')} identifies its own origin` : 'the blindness probe reported a leak but did not name which artifact carries it, so treat BOTH as compromised'}. ${selfid.reasoning} A critic holding Bash can resolve that evidence against the working tree and establish which artifact belongs to it without being told, which is what happened in wf_a0892913-ee6. Staging the files under neutral names does not touch this, and no verdict in this run should be read as one a blind judge reached.`
      : selfid
        ? 'The critic is told not to infer which artifact is the candidate, and a blindness probe resolved no origin evidence in either artifact. That is one prober finding nothing, not proof of blindness: it can withdraw the claim, never strengthen it, and a leak it missed leaves this run where it was before the probe existed.'
        : (GOAL_CHECK_SPAWNABLE
            ? 'CONTENT BLINDNESS WAS NOT CHECKED — the blindness probe returned nothing. Its agent type is registered and working this run (a sibling probe of the same type returned a result), so this is an agent that ran and gave nothing back, NOT a missing agent type. Nothing here looked at whether either artifact says where it came from; the critic is told not to infer which one is the candidate, and nothing prevents it.'
            : 'CONTENT BLINDNESS WAS NOT CHECKED — the blindness probe returned nothing, and NO probe of its agent type returned anything this run, so per issue #14 this is indistinguishable from that agent type not being registered at all: a Workflow script sees an empty result either way. Assume the weaker reading. Nothing here looked at whether either artifact says where it came from; the critic is told not to infer which one is the candidate, and nothing prevents it.'),
    SIDES_LOOK_ALIKE
      ? null
      : `this run's args.reference/args.candidate pair was not a comparable filesystem path pair (reference read as ${shapeOf(REFERENCE)}, candidate as ${shapeOf(CANDIDATE)}). The two ARTIFACT lines rendered in visibly different shapes, so this run's A/B was NOT blind — the loop's own formatting gave away which side was the candidate before the critic looked at either one.`,
    'The critic is instructed to be a really harsh critic — the source\'s one requirement on the judge — in both its standing agent definition and the round prompt. Nothing verifies that a harsh INSTRUCTION produced a harsh CRITIC. A lenient verdict and an exacting one are indistinguishable from here: no calibration trial ran, and the loop reads only the letter that came back.',
    'NO RATCHET, and that is a decision rather than an omission (issue #18, 2026-08-24). The builder edits the candidate in place, so a round that makes it worse is permanent, and the loop holds no prior version to compare against: a Workflow script has no filesystem, so a snapshot and a revert would both be spawned-agent actions this script cannot observe. It therefore cannot tell an improvement from a regression from a lateral move — read `gaps_in_order` for that, and stop the run yourself if the gaps stop getting smaller.',
    CRITICS === 1
      ? 'Position bias is averaged across rounds by alternation, not eliminated within a round.'
      : 'Position bias is split across the line within each round, which measures it rather than eliminating it. It is not removed.',
    `The ${CRITICS} critic(s) share a model family and prompt, so their verdicts are not independent judgments; k copies resample one model's habits. Nothing here measures how much independence the line actually supplies, and no arithmetic over k should be read as if it did.`,
    decomposition && decomposition.pieces
      ? (split_check.ran
          ? `THE SPLIT IS CHECKED ONE WAY ONLY. A lead agent chose these ${decomposition.pieces.length} piece(s) on the criterion "${decomposition.split_criterion}", and after every piece won, one blind A/B judged the WHOLE candidate against the WHOLE reference — it ${split_check.candidateWon ? 'also picked the candidate' : 'picked the reference, and this run is SPLIT_UNSOUND'}. That check is asymmetric by design: a loss is a positive detection, a win is consistency and NOT proof the seam was correct. One whole-artifact critic agreeing with the pieces does not establish that a defect spanning them would have been caught, and nothing here measures how often it would be. The whole-artifact round is also an ADDITION — neither primary text describes one; the source stops when every sub-agent is wowed, which is what the piece verdicts already are.`
          : `THE SPLIT IS NOT CHECKED. A lead agent chose these ${decomposition.pieces.length} piece(s) and nothing verified the choice: its criterion was "${decomposition.split_criterion}". Each piece was required to name what would be inspected to judge it alone, and pieces that named none were dropped in code — but a plausible observable is not a correct seam. A split drawn around known weaknesses hides them, and every piece can win while the artifact as a whole is worse than the reference. The whole-artifact check that would have noticed did not run: ${split_check.why_not}`)
      : 'NOT DECOMPOSED — the artifact was judged whole. The source divides a goal into pieces that are improved and judged independently; where that is not done, every gap this loop finds is a whole-artifact gap, and defects local to one part compete with each other for the single gap slot each round.',
    fairness && fairness.verdict === 'does-not-attempt'
      ? `THE REFERENCE DOES NOT ATTEMPT THIS GOAL — it is for: ${fairness.what_it_is_for}. Every verdict in this run is about the choice of goal, not about the work: the reference was marked down on a dimension it never entered. Nothing here is evidence that the candidate is better than the reference at what the reference is for.`
      : null,
    // WHY THIS SAYS COUPLED AND NOT FITTED. It used to assert that the operator wrote the
    // goal from the candidate. scripts/fitted-trial.mjs measured that claim against ground
    // truth established by construction: eight draws, no flips, lexical overlap predicting
    // the verdict 8/8 and authorship 4/8. It called a goal written BEFORE its artifact
    // `fitted`, and cleared as a `need` a goal written by reading one. The overlap it sees
    // is real; the direction it inferred from it was chance. The last clause of each branch
    // is the same sentence the else-branch used to carry alone — the loop knew direction was
    // unknowable and stopped saying so exactly when it started asserting it.
    fitted && fitted.verdict === 'coupled'
      ? `THE GOAL AND THE CANDIDATE ARE NOT TEXTUALLY INDEPENDENT. ${fitted.reasoning} The candidate answers a goal like that by construction, so no verdict here is evidence that the candidate is better ON THE CLAUSES THAT OVERLAP. Nothing here can see when the goal was written or by whom, and coupling has several causes — a goal written from the candidate, a candidate built to the goal, one author for both. If you wrote this goal with the candidate in front of you, no verdict in this run is evidence about the work.`
      : fitted && fitted.verdict === 'partial'
        ? `PART OF THE GOAL IS TRACEABLE TO THE CANDIDATE'S OWN WORDING. ${fitted.reasoning} Verdicts on those clauses measure the overlap, not the work. Nothing here can see when the goal was written or by whom.`
        : 'The goal is operator-supplied, and reads as independent of the candidate. That is a fact about the two texts: nothing here can see when the goal was written or by whom, and a goal written after looking at the candidate can be phrased so that it does not overlap with it.',
    'k>1 is an ADDITION, not source fidelity. Both primary texts say one critic per piece, singular; the source gets width by decomposing the goal, which this loop does not do. What k restores is the source\'s property — every judge satisfied — by a mechanism the source does not describe.',
    'Critic and builder share a model family, so the critic may be blind to exactly the mistakes the builder is prone to making.',
    'THE BLINDNESS PROBE MODELS THE FILESYSTEM ONLY, and the critic and builder both hold WebSearch and WebFetch. ' +
    'The probe resolves an artifact\'s citations against this working tree, so a `clean` verdict means neither artifact ' +
    'gives away its origin TO A READER OF THIS DISK. It says nothing about the network: a reference with a published ' +
    'copy can be fetched and compared, which identifies which side is the shipped one, and a builder can retrieve a fix ' +
    'from the web rather than composing it — a live retrieval channel distinct both from the model\'s own prior and from ' +
    'anything on disk, and the one issue #25 does not cover. Neither agent needs the network for its stated job.',
    'The critic holds Bash and KillShell, which can write files directly (redirection, heredocs, etc.) — nothing mechanically stops it from altering either artifact through Bash instead of Write/Edit. The no-Write/no-Edit property above is real but narrow (prompt-deep, not structural).',
    'AB_SCHEMA.gap is a free-text string: nothing stops several gaps being packed into it (e.g. "Gap 1: ... Gap 2: ..."). Only one gap SLOT is enforced, not one gap.',
    'Nothing verifies that the named gap is really the LARGEST — only that exactly one slot came back.',
    'NO CALIBRATION ANYWHERE. Nothing in this plugin checks that a critic could have failed — no defect is planted, no control is run on a clean copy, and a critic that approves everything is indistinguishable from a critic that is right. The seeded-defect machinery that used to do this lived in the review panel and was deleted with it; this is now the plugin\'s largest unmeasured property, not a lane that exists elsewhere.',
    'The breaker is checked at ROUND BOUNDARIES, not continuously. Removing the token while a critic or builder is mid-flight does not abort that agent — the run stops before the next round starts. To stop a round already in progress, kill the workflow itself.',
    'Nothing stops the token being re-created after a cancel. The breaker reports the state at each boundary; it does not latch.',
    'With no budget target set, there is no pre-committed ceiling at all — the run continues until it wins, an agent fails, or the operator cancels. That is the source\'s design, not an oversight, and it means an unattended run is bounded only by the host\'s own runaway backstop.',
  ].filter(Boolean),

  split_check,
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
