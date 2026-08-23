export const meta = {
  name: 'gauntlet',
  description: 'Run the gauntlet: blind bar, seeded-defect critic calibration, lens-split critics, grounding verifier, terminal cross-check round',
  whenToUse: 'After the operator has passed gates 0, 1 and 4 by hand. This script owns gate 2 onward; it never decides whether the run happens.',
  phases: [
    { title: 'Design', detail: 'gate 2 — one agent emits lenses, the calibration target, and the need restatement' },
    { title: 'Bar', detail: 'gates 3/5/6 — bar writer never receives the artifact' },
    { title: 'Calibrate', detail: 'gate 7 — blind seeder plants one in-lane defect; a deployed critic is measured against it' },
    { title: 'Review', detail: 'round 1 — one critic per lens, dispatched together, blind to each other' },
    { title: 'Verify', detail: 'grounding verifier — exists / says / supports over pooled findings' },
    { title: 'Round2', detail: 'terminal cross-check — fresh spawns, each attacks a finding it did not author' },
  ],
}

// ---------------------------------------------------------------------------
// INPUT
//
//   args.artifact   (required) absolute path to the thing under review
//   args.scratch    (required) absolute path to an EMPTY dir the seeder may
//                   write into. Must not be inside the artifact's own tree.
//   args.lenses     (optional) EITHER an integer 1-4 (gate 2 names the lenses,
//                   the SKILL.md default is 3; 1 asks for the width-1 outing)
//                   OR an array of {key, lane} the operator fixed in advance,
//                   which makes a run reproducible and lets a miss be
//                   attributed to a named lens. An empty array falls back to
//                   gate 2's own count rather than requesting a 0-width run.
//   args.calibratedLens (optional) a key from args.lenses. Overrides gate 2's
//                   nomination. Use it when you already know which lens's miss
//                   is most expensive.
//   args.need       (optional) operator's restatement of the need. Supplying
//                   this is stronger than letting gate 2 derive it, because
//                   gate 2 has read the artifact and the bar writer must not
//                   inherit the artifact's own framing (gate 5).
//
// The script has NO filesystem access. Every file touch is done by an agent.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AGENT TYPES — this is where independence stops being a promise.
//
// These are defined in ../../agents/*.md with a `tools:` allowlist:
//   bar-writer  has no Read/Grep/Glob/Bash  -> it CANNOT open the artifact
//   critic      has no Agent/ListAgents/SendMessage -> it CANNOT reach a peer
//   verifier    same, and no Write/Edit
//   seeder      has no web tools, no Agent
//
// The plugin loader DOES namespace plugin agents — verified against a live
// ListAgents call after installing. They surface as `gauntlet-loop:gauntlet-*`,
// not the bare `gauntlet-*` name, so the four values below carry that prefix.
const AT = {
  bar: 'gauntlet-loop:gauntlet-bar-writer',
  seeder: 'gauntlet-loop:gauntlet-seeder',
  critic: 'gauntlet-loop:gauntlet-critic',
  verifier: 'gauntlet-loop:gauntlet-verifier',
}

const ARTIFACT = args && args.artifact
const SCRATCH = args && args.scratch
const OPERATOR_NEED = (args && args.need) || null

// args.lenses is either a count (gate 2 names them — the SKILL.md default) or
// an explicit array (the operator named them, so the run is reproducible).
const RAW_LENSES = args && args.lenses
const EXPLICIT_LENSES = Array.isArray(RAW_LENSES) && RAW_LENSES.length
  ? RAW_LENSES.slice(0, 4).map(l => ({ key: l.key, lens: l.lens || l.lane }))
  : null
// Floor is 1, not 2: SKILL.md's gate 1 width-1 refusal (bar writer, one
// critic, verifier, no cross-check) is a real, recorded outing and the
// operator must be able to ask for it. An empty explicit array ([]) carries
// no lens — it is not a request for a 0-width run — so it must fall back to
// gate 2's own count exactly as an absent args.lenses would.
const WANT_LENSES = EXPLICIT_LENSES
  ? Math.max(1, EXPLICIT_LENSES.length)
  : Math.max(1, Math.min(4, (Array.isArray(RAW_LENSES) ? null : RAW_LENSES) || 3))
const CALIBRATED_OVERRIDE = (args && args.calibratedLens) || null

if (!ARTIFACT) throw new Error('args.artifact is required — absolute path to the artifact under review')
if (!SCRATCH) throw new Error('args.scratch is required — an empty dir the seeder can write an isolated copy into')

// ---------------------------------------------------------------------------
// THE CRITIC CONTRACT
//
// Lifted from critic-prompt.md. The drift-guard test asserts that every
// required element below still appears in that file, so the two cannot
// silently diverge. Edit critic-prompt.md and this together or the test fails.
// ---------------------------------------------------------------------------

const ANCHOR_RULE = `THE ANCHOR RULE — hard constraint
Every finding needs an anchor OUTSIDE the artifact. The artifact read back at
itself is not evidence: "section X contradicts section Y" is an observation
about text, not proof it fails. Valid types only:
  SOURCE  — a paper/post/doc you opened. URL + the sentence you rely on.
  REPO    — a file on this machine. path:line + quote.
  HARNESS — a demonstrable behavior of the tool. The command you ran.
  TRACE   — a scenario walked step by step to a state where someone following
            the artifact is stuck or does the wrong thing. This is the ONLY
            route by which an internal contradiction becomes admissible.
If your best anchor is "in my judgment", you do not have a finding.`

const OUTPUT_CONTRACT = `OUTPUT — exactly this, nothing before or after.

FINDING <id>-1
severity: high | med | low
  high = someone following the artifact reaches a wrong decision on an
         expensive call
  med  = the artifact is right but cannot be executed as written
  low  = correct and executable, but weaker than it needs to be
claim: <one sentence: what is wrong, and what it costs>
location: line(s) N-M
falsifier: <a specific observation that would prove this finding wrong —
            checkable by someone else, not "if I am mistaken">
anchor: <SOURCE|REPO|HARNESS|TRACE> <pointer>
anchor-says: <verbatim quote, or <=25-word paraphrase>
edit: <the exact change and where>
behavior-delta: <what someone reading the revised artifact does differently>

GETS-RIGHT: <one thing it gets right you would fight to keep, and the failure
             that returns if it were removed>
FAILED-ATTACK: <the strongest attack you tried that did NOT survive: the
                attack, the anchor you went looking for, why it did not hold>
SPILLOVER: <optional, one line each>

Missing GETS-RIGHT or FAILED-ATTACK is malformed and will be returned.`

// Byte-identical body for every deployed critic AND for the calibration
// critic. That identity is the whole point of gate 7: a stand-in measures a
// critic nobody is using.
function criticPrompt(artifactPath, lens, otherLenses, bar, n) {
  return `You are one of ${n} critics reviewing the artifact at ${artifactPath}. Read it now.

STANCE
You are helping this work, not defending a position and not refuting it.
Truth-seeking, not consensus-seeking: do not converge with the other critics,
and do not manufacture disagreement either. Uncertain is not wrong — if you
cannot anchor a doubt, drop it. An unanchored finding costs this review more
than a finding you never raised. Scored on precision, not volume.

STAY IN YOUR LANE
Other critics cover: ${otherLenses.join('; ') || '(none)'}. Anything outside yours goes under
SPILLOVER as one line, not as a finding.

${ANCHOR_RULE}

THE FROZEN BAR — written by an agent that never saw the artifact. You may find
it fails a criterion; you may not rewrite the criterion.
${bar}

YOUR LENS
${lens}

BUDGET: read once, spend the rest on anchors. Max 5 findings. Fewer is normal.

${OUTPUT_CONTRACT}`
}

// ---------------------------------------------------------------------------
// SCHEMAS
// ---------------------------------------------------------------------------

const DESIGN_SCHEMA = {
  type: 'object',
  required: ['need_restatement', 'lenses', 'calibration_lens', 'calibration_reason', 'acceptance_rule', 'findings_for_operator'],
  properties: {
    need_restatement: {
      type: 'string',
      description: 'The underlying NEED, stated without naming the artifact\'s own proposed solution. This is all the bar writer will ever see.',
    },
    lenses: {
      // minItems follows WANT_LENSES rather than a hardcoded 2: the Design
      // prompt above asks for "exactly WANT_LENSES" lenses, and a schema
      // floor higher than that count would make the prompt and the schema
      // contradict each other whenever an operator asks for fewer than 2
      // (a width-1 run). maxItems stays a flat ceiling — gate 2 may still
      // propose extra candidates up to 4; only the extras beyond WANT_LENSES
      // get discarded by the slice below.
      type: 'array', minItems: WANT_LENSES, maxItems: 4,
      items: {
        type: 'object', required: ['key', 'lens'],
        properties: {
          key: { type: 'string', description: 'short slug' },
          lens: { type: 'string', description: 'the full lens instruction handed to that critic' },
        },
      },
    },
    calibration_lens: { type: 'string', description: 'key of the lens to calibrate — the one where a miss is most expensive' },
    calibration_reason: { type: 'string', description: 'why a miss in THAT lens costs most. "it is listed first" is not a reason.' },
    acceptance_rule: { type: 'string', description: 'what makes a finding count, and the stop condition' },
    findings_for_operator: {
      type: 'string',
      description: 'If you believe this run is premature or misaimed, say so HERE. This is a report to the operator, not a veto — you do not decide whether the run happens.',
    },
  },
}

const BAR_SCHEMA = {
  type: 'object',
  required: ['criteria', 'gate3_form', 'bar_text'],
  properties: {
    criteria: {
      type: 'array', minItems: 2,
      items: {
        type: 'object', required: ['id', 'criterion', 'passes_when', 'fails_when'],
        properties: {
          id: { type: 'string' },
          criterion: { type: 'string' },
          passes_when: { type: 'string', description: 'gate 6: a concrete case this criterion PASSES' },
          fails_when: { type: 'string', description: 'gate 6: a concrete case this criterion FAILS. If you cannot name one, the criterion cannot fire — replace it.' },
        },
      },
    },
    gate3_form: { type: 'string', enum: ['recorded-outcomes', 'structural-prior'] },
    bar_text: { type: 'string', description: 'the frozen bar exactly as critics will receive it' },
  },
}

const SEED_SCHEMA = {
  type: 'object',
  required: ['seeded_path', 'removed_verbatim', 'inserted_verbatim', 'location', 'defect_kind', 'why_in_lane'],
  properties: {
    seeded_path: { type: 'string', description: 'absolute path of the isolated copy you wrote' },
    removed_verbatim: { type: 'array', items: { type: 'string' }, description: 'EXACT strings you deleted. The leak check greps critic output for these.' },
    inserted_verbatim: { type: 'array', items: { type: 'string' }, description: 'EXACT strings you added' },
    location: { type: 'string' },
    defect_kind: { type: 'string' },
    why_in_lane: { type: 'string', description: 'why this defect lands inside the calibrated critic\'s lane, not beside it' },
  },
}

const CAL_JUDGE_SCHEMA = {
  type: 'object',
  required: ['caught', 'in_lane', 'reasoning'],
  properties: {
    caught: { type: 'boolean', description: 'did the critic name the PLANTED defect (not merely file something near it)' },
    in_lane: { type: 'boolean', description: 'did the plant land inside the calibrated lens' },
    reasoning: { type: 'string' },
  },
}

// ---------------------------------------------------------------------------
// PHASE: DESIGN (gate 2 — no veto)
// ---------------------------------------------------------------------------

phase('Design')

const design = await agent(
  `You are gate 2 of the gauntlet. Read the artifact at ${ARTIFACT} in full, then emit the
orchestration for the review of it.

YOU HAVE NO VETO. The operator already ruled at gates 0, 1 and 4 — the only gates that
weigh what being wrong costs, and the only ones the operator can run for free. Your job is
to emit the orchestration, not to decide whether the run happens. If you discover a reason
the run is premature, that is a FINDING you report in findings_for_operator; the operator
rules on it. Do not refuse, do not stall, do not emit an empty lens set.

Emit:

1. need_restatement — the underlying NEED, with the artifact's own proposed solution
   stripped out. If the artifact says "move to JWTs", the need is "stateless auth". The bar
   writer will see THIS AND NOTHING ELSE — never the artifact — so it must stand alone and
   must not smuggle the artifact's framing back in.

2. lenses — exactly ${WANT_LENSES}, each a different angle of attack, each written as a full
   instruction to a critic. Distinct lenses, not restatements of one. Agent count is
   monotonic but lens DIVERSITY is what buys coverage: identical critics converge on
   meaningless consensus.

3. calibration_lens + calibration_reason — which single lens gets gate-7 calibrated. Pick
   the one where a MISS IS MOST EXPENSIVE, not the one listed first. For a spec that is
   almost always the acceptance criteria: a criterion that cannot fail silently licenses
   everything downstream of it. State the cost, not the ordering.

4. acceptance_rule — what makes a finding count, and the stop condition.`,
  { label: 'gate2:design', phase: 'Design', schema: DESIGN_SCHEMA }
)

if (!design) throw new Error('gate 2 returned nothing — cannot orchestrate a run without an orchestration')

const LENSES = EXPLICIT_LENSES || design.lenses.slice(0, WANT_LENSES)
const NEED = OPERATOR_NEED || design.need_restatement
const wantCal = CALIBRATED_OVERRIDE || design.calibration_lens
const calLens = LENSES.find(l => l.key === wantCal) || LENSES[0]
if (CALIBRATED_OVERRIDE && calLens.key !== CALIBRATED_OVERRIDE) {
  log(`WARNING: args.calibratedLens "${CALIBRATED_OVERRIDE}" is not a key in the lens set — falling back to "${calLens.key}"`)
}
if (EXPLICIT_LENSES) log('gate 2: operator supplied the lens set; gate 2\'s own lenses discarded')

log(`gate 2: ${LENSES.length} lenses [${LENSES.map(l => l.key).join(', ')}] · calibrating "${calLens.key}" — ${design.calibration_reason}`)
if (design.findings_for_operator && design.findings_for_operator.trim() && !/^(none|n\/a|nothing)\b/i.test(design.findings_for_operator.trim())) {
  log(`gate 2 REPORTS TO OPERATOR (not a veto): ${design.findings_for_operator}`)
}
if (OPERATOR_NEED) log('gate 5: using the OPERATOR-supplied need restatement, not gate 2\'s')

// ---------------------------------------------------------------------------
// PHASE: BAR (gates 3, 5, 6)
//
// Structural property this buys over prose: the bar writer is never told where
// the artifact is. It cannot read what it was not pointed at.
// ---------------------------------------------------------------------------

phase('Bar')

const bar = await agent(
  `You are writing the acceptance bar for a review. You have NOT been told what the artifact
is, where it lives, or who wrote it. That is deliberate and you must not go looking: if you
locate and read the artifact, the bar is contaminated and the whole review is void. Work
only from the need below.

THE NEED
${NEED}

Write criteria that something meeting this need must satisfy. Two hard requirements:

GATE 3 — the bar must be anchored OUTSIDE any particular solution. Either
  (a) recorded outcomes — what has actually happened in comparable cases, or
  (b) a structural prior — a law, invariant, conservation, or count that any
      solution must satisfy whatever it claims about itself.
  "A good solution will handle errors well" is neither. Declare which form you used.

GATE 6 — every criterion must be able to FIRE IN BOTH DIRECTIONS. For each one, name a
  concrete case where it PASSES and a concrete case where it FAILS. A criterion for which
  you cannot construct a failing case cannot discriminate; delete it and write another. A
  saturated criterion that never engages is worse than no criterion, because it reads as
  coverage.

Then emit bar_text: the frozen bar exactly as critics will receive it.`,
  { label: 'gate5:blind-bar', phase: 'Bar', schema: BAR_SCHEMA, agentType: AT.bar }
)

if (!bar) throw new Error('bar writer returned nothing — critics cannot run against no bar')

const unfireable = bar.criteria.filter(c => !c.fails_when || !c.fails_when.trim())
if (unfireable.length) log(`gate 6 WARNING: ${unfireable.length} criteria have no failing case`)
log(`gate 3/5/6: ${bar.criteria.length} criteria, form=${bar.gate3_form}, written blind`)

// ---------------------------------------------------------------------------
// PHASE: CALIBRATE (gate 7)
//
// VOID != miss. A VOID means the measurement never happened and cannot consume
// the retry; a miss consumes it and the retry uses a DIFFERENT plant.
// Two VOIDs -> NO VERDICT. Missed twice -> NO VERDICT.
// ---------------------------------------------------------------------------

phase('Calibrate')

const otherLensNames = LENSES.filter(l => l.key !== calLens.key).map(l => l.lens)

async function calibrationAttempt(attempt, priorKinds) {
  const seed = await agent(
    `You are seeding a defect to test whether a reviewer can catch one. You have NOT seen the
reviewer's prompt and must not go looking for it — knowing how the reviewer is instructed
would let you tune the defect to evade it, which measures evasion rather than capability.

1. Read the artifact at ${ARTIFACT}.
2. Write a COMPLETE copy to ${SCRATCH}/seeded-${attempt}${extOf(ARTIFACT)} with exactly ONE
   defect introduced.
3. The defect must land inside this lane, because that is the reviewer being measured:
     ${calLens.lens}
   A plant outside this lane VOIDS the measurement — the reviewer is instructed to stay in
   its lane, so an out-of-lane plant measures obedience, not capability.
${priorKinds.length ? `4. A previous attempt already used: ${priorKinds.join('; ')}. Use a DIFFERENT kind of defect — re-running the same plant fits the reviewer to the test.` : ''}

ISOLATION — the copy must stand alone. Strip anything that would let a reader recover the
original: cross-references to the source path, "see the original", version headers, adjacent
duplicated statements of the same fact.

DIAGNOSE THE LEAK CHANNEL BEFORE YOU CHOOSE. If the text you remove is recoverable from
public sources or from a model's own prior knowledge, no sandbox closes that channel and a
tighter re-run only yields a FALSE PASS. Prefer ground truth that is specific to this
artifact and not recallable from anywhere else.

Record removed_verbatim as the EXACT strings you deleted. A grep for them in the reviewer's
output is how a leak is proven, so they must match byte for byte.`,
    { label: `gate7:seeder-${attempt}`, phase: 'Calibrate', schema: SEED_SCHEMA, agentType: AT.seeder }
  )

  if (!seed || !seed.seeded_path) return { status: 'VOID', why: 'seeder produced no isolated copy' }

  // Byte-identical to a DEPLOYED critic. It is not told it is being calibrated.
  const calCritic = await agent(
    criticPrompt(seed.seeded_path, calLens.lens, otherLensNames, bar.bar_text, LENSES.length),
    { label: `gate7:critic-${attempt}`, phase: 'Calibrate', agentType: AT.critic }
  )

  if (!calCritic) return { status: 'VOID', why: 'calibration critic returned nothing' }

  // LEAK CHECK — code, not judgment. A match proves it reached the original.
  const leaked = (seed.removed_verbatim || []).filter(s => s && s.length > 12 && calCritic.indexOf(s) !== -1)
  if (leaked.length) {
    return { status: 'VOID', why: `leak — critic output contains ${leaked.length} verbatim string(s) the seeder removed`, seed, leaked }
  }

  const judged = await agent(
    `Judge one calibration trial. You are not deciding whether the artifact is good.

THE PLANT (sealed note, written before the reviewer ran)
  location: ${seed.location}
  kind: ${seed.defect_kind}
  removed: ${JSON.stringify(seed.removed_verbatim)}
  inserted: ${JSON.stringify(seed.inserted_verbatim)}
  seeder's in-lane argument: ${seed.why_in_lane}

THE CALIBRATED LANE
${calLens.lens}

THE REVIEWER'S OUTPUT
${calCritic}

Two independent questions:
  caught  — did the reviewer name THE PLANTED DEFECT? Filing something else in the same
            region is not catching it. Be strict: a vague finding that happens to overlap
            the location does not count.
  in_lane — does the plant actually sit inside the calibrated lane as described? If the
            seeder's in-lane argument does not hold, the trial is void regardless of the
            outcome, because the reviewer was instructed not to file outside its lane.`,
    { label: `gate7:judge-${attempt}`, phase: 'Calibrate', schema: CAL_JUDGE_SCHEMA, effort: 'high' }
  )

  if (!judged) return { status: 'VOID', why: 'calibration judge returned nothing', seed }
  if (!judged.in_lane) return { status: 'VOID', why: `plant landed outside the calibrated lane — ${judged.reasoning}`, seed }
  if (judged.caught) return { status: 'PASS', seed, judged }
  return { status: 'MISS', seed, judged }
}

function extOf(p) {
  const base = p.slice(p.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot) : '.txt'
}

let voids = 0
let misses = 0
let calibration = null
const usedKinds = []

for (let attempt = 1; attempt <= 4; attempt++) {
  const r = await calibrationAttempt(attempt, usedKinds)
  if (r.seed && r.seed.defect_kind) usedKinds.push(r.seed.defect_kind)

  if (r.status === 'VOID') {
    voids++
    log(`gate 7 attempt ${attempt}: VOID (${r.why}) — does not consume the retry [voids=${voids}]`)
    if (voids >= 2) { calibration = { verdict: 'NO VERDICT', why: 'two VOIDs — the measurement never happened twice' }; break }
    continue
  }
  if (r.status === 'MISS') {
    misses++
    log(`gate 7 attempt ${attempt}: MISS — consumes the retry [misses=${misses}]`)
    if (misses >= 2) { calibration = { verdict: 'NO VERDICT', why: 'the deployed critic missed a planted in-lane defect twice' }; break }
    continue
  }
  calibration = { verdict: 'CALIBRATED', lens: calLens.key, attempt, why: r.judged.reasoning }
  log(`gate 7: CALIBRATED on lens "${calLens.key}" at attempt ${attempt}`)
  break
}

if (!calibration) calibration = { verdict: 'NO VERDICT', why: 'calibration did not resolve within 4 attempts' }

if (calibration.verdict === 'NO VERDICT') {
  log('gate 7 returned NO VERDICT — the panel does not spawn. This is the designed outcome, not a failure of the run.')
  return {
    verdict: 'NO VERDICT',
    stage: 'gate 7',
    why: calibration.why,
    voids, misses,
    bar: bar.bar_text,           // blind, survives the halt — do not re-pay gate 5
    need: NEED,
    lenses: LENSES.map(l => l.key),
    note: 'A halted run\'s blind artifacts survive it. Carry `bar` and `need` into the rerun.',
  }
}

// ---------------------------------------------------------------------------
// PHASE: REVIEW (round 1 — concurrent, blind to each other)
// ---------------------------------------------------------------------------

phase('Review')

const round1 = (await parallel(
  LENSES.map(l => () =>
    agent(
      criticPrompt(ARTIFACT, l.lens, LENSES.filter(o => o.key !== l.key).map(o => o.lens), bar.bar_text, LENSES.length),
      { label: `critic:${l.key}`, phase: 'Review', agentType: AT.critic }
    ).then(out => (out ? { key: l.key, lens: l.lens, output: out } : null))
  )
)).filter(Boolean)

if (!round1.length) {
  return { verdict: 'NO VERDICT', stage: 'round 1', why: 'every critic returned empty', bar: bar.bar_text, need: NEED }
}
log(`round 1: ${round1.length}/${LENSES.length} critics returned`)

const pooled = round1.map(r => `===== CRITIC ${r.key} =====\n${r.output}`).join('\n\n')

// ---------------------------------------------------------------------------
// PHASE: VERIFY (grounding — exists / says / supports)
// ---------------------------------------------------------------------------

phase('Verify')

const verifier = await agent(
  `You are the grounding verifier. You are NOT judging whether findings are right
— you check whether their anchors hold. A finding with a true conclusion and a
false premise still fails here.

TRIAGE first: if acting on a finding would be cheap and would not change what
the artifact instructs, mark UNVERIFIED-CHEAP and skip. Verify only findings
whose edit changes an instruction.

Then, per finding, check separately:
  (a) EXISTS  — open the URL, read the file at that line, run the command,
                re-walk the trace yourself.
  (b) SAYS    — it states what anchor-says claims. Quote what it really says.
  (c) SUPPORTS— it bears on the claim: same setting, no silent leap from
                "measured under A" to "therefore under B".

VERDICT: GROUNDED | GROUNDED-WEAK (state the weaker claim that survives) |
NOT-GROUNDED (anchor absent, misquoted, self-referential, circular, or the
trace reaches a different state when you walk it).

ABSENCE CLAIMS: you cannot verify a negative by also failing to find it. Search
with different terms than the critic used. Still nothing → GROUNDED-WEAK, and
list your terms.

Do not add findings. Do not soften NOT-GROUNDED because a finding seems true
anyway — put that under JUDGMENT-CALLS.

Self-reference auto-fails: an anchor pointing back into ${ARTIFACT} is NOT-GROUNDED
unless it is a TRACE you re-walked to the same stuck state.

FINDINGS TO VERIFY
${pooled}`,
  { label: 'verifier:grounding', phase: 'Verify', effort: 'high', agentType: AT.verifier }
)

// ---------------------------------------------------------------------------
// PHASE: ROUND 2 (terminal — fresh spawns, cross-check)
//
// Structural property: these are new agent() calls. A round-1 critic continued
// would defend its own findings instead of cross-checking them.
// ---------------------------------------------------------------------------

phase('Round2')

const round2 = (await parallel(
  round1.map(r => () =>
    agent(
      `Round 2. Last scheduled round — the verdict stands as computed after it.

You hold lens "${r.key}": ${r.lens}

${ANCHOR_RULE}

POOLED FINDINGS
${pooled}

VERIFIER REPORT
${verifier || '(verifier returned nothing — treat every anchor as unverified)'}

1. WITHDRAW your NOT-GROUNDED findings, or supply one new anchor of a
   DIFFERENT type. Do not re-argue the failed anchor. Withdrawing costs
   nothing; defending an ungrounded finding costs your precision score.
2. NARROW your GROUNDED-WEAK findings to the form the anchor actually
   supports, and reassess severity there.
3. CROSS-CHECK — pick the strongest finding you did NOT author and try to
   knock it down. You are hunting a finding that reads well, survived
   grounding, and is still wrong. Same anchor rules; an attack without an
   anchor is an opinion. If it holds, say so and say what you tried.
     CROSS-CHECK <id>: KNOCKED-DOWN | HELD
     attack: / basis: / outcome:
4. NEW FINDINGS — max 2, only for a gap none of us covered. "None" is normal.

Every refutation ends with ADJACENT: <a different defect your own reasoning
surfaced, or "none">. Measured twice: the best finding arrived inside a
refutation of a weaker claim.`,
      { label: `round2:${r.key}`, phase: 'Round2', agentType: AT.critic }
    ).then(out => (out ? { key: r.key, output: out } : null))
  )
)).filter(Boolean)

log(`round 2: ${round2.length} cross-checks returned — terminal`)

// ---------------------------------------------------------------------------
// VERDICT — assembled, not asserted
// ---------------------------------------------------------------------------

const uncalibrated = LENSES.length - 1

return {
  verdict: 'COMPLETE',
  artifact: ARTIFACT,

  calibration: {
    ...calibration,
    voids,
    misses,
    caveat: uncalibrated > 0
      ? `${uncalibrated}-of-${LENSES.length} lenses uncalibrated — one calibrated critic licenses one critic, not a verdict computed from all of them`
      : null,
  },

  bar: { text: bar.bar_text, form: bar.gate3_form, criteria: bar.criteria, written_blind: true },
  need: NEED,
  acceptance_rule: design.acceptance_rule,

  round1: round1.map(r => ({ lens: r.key, output: r.output })),
  grounding: verifier,
  round2: round2.map(r => ({ lens: r.key, output: r.output })),

  // Properties this run made STRUCTURAL — a thing the run cannot lose, not a
  // property the operator adds. Each is enforced by a tool allowlist in
  // agents/*.md or by code in this script, never by asking an agent nicely.
  enforced: [
    `bar writer ran as "${AT.bar}", whose tool allowlist has no Read, Grep, Glob or Bash — it could not open the artifact even if instructed to`,
    `critics ran as "${AT.critic}", whose allowlist has no Agent, ListAgents or SendMessage — no critic could discover or address a peer`,
    `critics have no Write or Edit — none could use those TOOLS to alter the artifact the others were reading (they still hold Bash; see not_enforced)`,
    `verifier ran as "${AT.verifier}" and could not delegate its own checking`,
    'seeder was never handed the critic prompt',
    'calibration critic ran the byte-identical deployed prompt and was not told it was a trial',
    'leak check is a literal string match over the critic output, not a judgment',
    'VOID and MISS are counted separately in code; only MISS consumes the retry',
    'round 2 agents are fresh agent() calls, not continuations of round-1 critics',
  ],

  // Say what you did NOT enforce. Do not claim independence you did not buy.
  not_enforced: [
    'The seeder holds Read, so nothing mechanically stopped it from opening critic-prompt.md or this script and tuning the plant to evade the critic. That restraint is prompt-deep.',
    'The bar writer cannot read files, but it retains WebSearch/WebFetch — a published artifact could in principle be reached over the network.',
    'Isolation of the seeded copy is best-effort. If the removed text is recoverable from public sources or the model\'s own prior, no sandbox closes that channel and a tighter re-run yields a false pass rather than a catch.',
    'n=1 per calibrated lens — one planted defect, one session.',
    'Critics share a model family unless the operator varied it. Judge-panel correlation is measured ACROSS families; varying only the lens does not buy independent votes.',
    'Critics hold Bash and KillShell, which can write files directly (redirection, heredocs, etc.) — nothing mechanically stops a critic from altering the artifact through Bash instead of Write/Edit. The no-Write/no-Edit property above is real but narrow: it is prompt-deep, not a structural write-block.',
  ],

  reporting_note: 'Zero surviving findings is not a clean sheet until the refutation bodies are read. Report as: PASS — no critic broke it under <framing>. Untested shared belief: <the premise every critic assumed>.',
}
