export const meta = {
  name: 'gauntlet',
  description: 'Run the gauntlet: blind bar, two-armed critic calibration, lens-split critics, grounding verifier, terminal cross-check with a tallied margin, and an optional blind A/B against a reference exemplar',
  whenToUse: 'After the operator has passed gates 0, 1 and the cost ceiling by hand. This script owns gate 2 onward; it never decides whether the run happens.',
  phases: [
    { title: 'Design', detail: 'gate 2 — one agent emits lenses, the calibration target, and the need restatement' },
    { title: 'Bar', detail: 'gates 3/5/6 — bar writer never receives the artifact; unfireable criteria are re-asked, then dropped' },
    { title: 'Calibrate', detail: 'gate 7 — two arms: a planted defect measures sensitivity, an unseeded control measures specificity' },
    { title: 'Review', detail: 'round 1 — one critic per lens, dispatched together, blind to each other' },
    { title: 'Verify', detail: 'grounding verifier — exists / says / supports over pooled findings' },
    { title: 'Round2', detail: 'terminal cross-check — fresh spawns, each attacks a finding it did not author; outcomes are tallied' },
    { title: 'Compare', detail: 'optional — blind A/B against a reference exemplar, labels stripped, forced choice, ensemble tallied' },
    { title: 'Report', detail: 'a durable run report written to disk, so a run survives the session that spawned it' },
  ],
}

// ---------------------------------------------------------------------------
// INPUT
//
//   args.artifact   (required) absolute path to the thing under review
//   args.scratch    (required) absolute path to an EMPTY dir the seeder may
//                   write into. Must not be inside the artifact's own tree.
//   args.lenses     (optional) integer 2-4. Default 3. Gate 2 names them.
//   args.need       (optional) operator's restatement of the need. Supplying
//                   this is stronger than letting gate 2 derive it, because
//                   gate 2 has read the artifact and the bar writer must not
//                   inherit the artifact's own framing (gate 5).
//   args.reference  (optional) absolute path to a REFERENCE EXEMPLAR — a real
//                   artifact of the kind this one wants to be. Supplying it
//                   opens the Compare lane: a blind A/B, labels stripped,
//                   forced choice, one vote per lens. This is the source
//                   method's own mechanism and it is strictly better evidence
//                   than a criteria bar, because a comparative judgment does
//                   not require the critic to invent a threshold. Use it
//                   whenever an exemplar exists.
//   args.report     (optional) set false to skip the durable run report.
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
//   isolator    has no web tools, no Agent — writes neutral-named copies
//   reporter    has no Read, no web tools — it can only write what it was told
//   judge       has only TodoWrite — it cannot go read the artifact and grade
//               a critic against its own opinion instead of against the plant
//
// The plugin loader namespaces plugin agents. Checked against ListAgents on
// 2026-08-24: it returned `gauntlet-loop:gauntlet-critic`,
// `gauntlet-loop:gauntlet-bar-writer`, `gauntlet-loop:gauntlet-isolator`,
// `gauntlet-loop:gauntlet-reporter`, `gauntlet-loop:gauntlet-seeder`,
// `gauntlet-loop:gauntlet-verifier` — hence the prefix below.
const AT = {
  bar: 'gauntlet-loop:gauntlet-bar-writer',
  seeder: 'gauntlet-loop:gauntlet-seeder',
  critic: 'gauntlet-loop:gauntlet-critic',
  verifier: 'gauntlet-loop:gauntlet-verifier',
  isolator: 'gauntlet-loop:gauntlet-isolator',
  reporter: 'gauntlet-loop:gauntlet-reporter',
  judge: 'gauntlet-loop:gauntlet-judge',
}

const ARTIFACT = args && args.artifact
const SCRATCH = args && args.scratch
const WANT_LENSES = Math.max(2, Math.min(4, (args && args.lenses) || 3))
const OPERATOR_NEED = (args && args.need) || null
const REFERENCE = (args && args.reference) || null
const WANT_REPORT = !(args && args.report === false)

if (!ARTIFACT) throw new Error('args.artifact is required — absolute path to the artifact under review')
if (!SCRATCH) throw new Error('args.scratch is required — an empty dir the seeder can write an isolated copy into')

// A removed string shorter than this cannot carry a leak check: short text
// recurs by chance in any critic's output, so matching it proves nothing and
// failing to match it proves nothing either. A plant whose removal is not
// leak-checkable is not a measurable trial — it VOIDs rather than passing
// quietly, which is the difference between a hole and a halt.
const LEAK_MIN_CHARS = 24

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

// Byte-identical body for every deployed critic, for the calibration critic,
// AND for the control critic. That identity is the whole point of gate 7: a
// stand-in measures a critic nobody is using, and a control run under a
// different prompt measures a different critic than the one it is controlling.
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
      type: 'array', minItems: 2, maxItems: 4,
      items: {
        type: 'object', required: ['key', 'lens'],
        properties: {
          key: { type: 'string', description: 'short slug' },
          lens: { type: 'string', description: 'the full lens instruction handed to that critic' },
        },
      },
    },
    calibration_lens: { type: 'string', description: 'key of the lens to calibrate — MUST be one of the keys you emitted above' },
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
  required: ['seeded_path', 'control_path', 'removed_verbatim', 'inserted_verbatim', 'location', 'defect_kind', 'why_in_lane'],
  properties: {
    seeded_path: { type: 'string', description: 'absolute path of the isolated copy WITH the defect' },
    control_path: { type: 'string', description: 'absolute path of the isolated copy WITHOUT the defect — same isolation treatment, byte-identical to the seeded copy except for the plant' },
    removed_verbatim: {
      type: 'array', items: { type: 'string' },
      description: `EXACT strings you deleted. The leak check greps critic output for these, so at least one must be ${LEAK_MIN_CHARS}+ characters or the trial is not leak-checkable and VOIDS.`,
    },
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

const CONTROL_JUDGE_SCHEMA = {
  type: 'object',
  required: ['filed_at_plant_site', 'reasoning'],
  properties: {
    filed_at_plant_site: {
      type: 'boolean',
      description: 'Did this critic — reviewing a copy with NO defect in it — file a finding at the location where the defect would have been, making the same or an equivalent claim? True means the earlier catch measured the critic\'s habit, not its detection.',
    },
    reasoning: { type: 'string' },
  },
}

const ROUND2_SCHEMA = {
  type: 'object',
  required: ['body', 'withdrawn', 'narrowed', 'cross_checks', 'new_findings'],
  properties: {
    body: { type: 'string', description: 'your full prose output, unabridged — the schema is a tally, never a substitute for the reasoning' },
    withdrawn: { type: 'array', items: { type: 'string' }, description: 'ids of your own findings you withdrew' },
    narrowed: { type: 'array', items: { type: 'string' }, description: 'ids you narrowed to what the anchor actually supports' },
    cross_checks: {
      type: 'array',
      items: {
        type: 'object', required: ['finding_id', 'outcome', 'basis'],
        properties: {
          finding_id: { type: 'string', description: 'the finding you attacked — one you did NOT author' },
          outcome: { type: 'string', enum: ['KNOCKED-DOWN', 'HELD'] },
          basis: { type: 'string', description: 'the anchor your attack rested on; an attack without one is an opinion' },
        },
      },
    },
    new_findings: { type: 'array', items: { type: 'string' }, description: 'claims only, max 2; "none" is normal' },
    adjacent: { type: 'array', items: { type: 'string' }, description: 'a different defect your own reasoning surfaced, per refutation' },
  },
}

const AB_ISOLATE_SCHEMA = {
  type: 'object',
  required: ['left_path', 'right_path', 'ours_side', 'treatment'],
  properties: {
    left_path: { type: 'string', description: 'absolute path of the copy you named LEFT' },
    right_path: { type: 'string', description: 'absolute path of the copy you named RIGHT' },
    ours_side: { type: 'string', enum: ['LEFT', 'RIGHT'], description: 'which side holds the artifact under review. This value is never shown to a comparing critic.' },
    treatment: { type: 'string', description: 'what you stripped from BOTH copies so neither can be identified by anything except its content' },
  },
}

const AB_VOTE_SCHEMA = {
  type: 'object',
  required: ['winner', 'largest_gap', 'why'],
  properties: {
    winner: { type: 'string', enum: ['LEFT', 'RIGHT'], description: 'you must pick one. A tie is not an available answer — that is the point of a forced choice.' },
    largest_gap: { type: 'string', description: 'the single largest gap between the loser and the winner, stated as the change that would close it' },
    why: { type: 'string', description: 'what you inspected to decide, in your lens' },
  },
}

// ---------------------------------------------------------------------------
// PHASE: DESIGN (gate 2 — no veto)
// ---------------------------------------------------------------------------

phase('Design')

const design = await agent(
  `You are gate 2 of the gauntlet. Read the artifact at ${ARTIFACT} in full, then emit the
orchestration for the review of it.

YOU HAVE NO VETO. The operator already ruled at gates 0, 1 and on the cost ceiling — the
only gates that weigh what being wrong costs, and the only ones the operator can run for
free. Your job is to emit the orchestration, not to decide whether the run happens. If you
discover a reason the run is premature, that is a FINDING you report in
findings_for_operator; the operator rules on it. Do not refuse, do not stall, do not emit
an empty lens set.

Emit:

1. need_restatement — the underlying NEED, with the artifact's own proposed solution
   stripped out. If the artifact says "move to JWTs", the need is "stateless auth". The bar
   writer will see THIS AND NOTHING ELSE — never the artifact — so it must stand alone and
   must not smuggle the artifact's framing back in.

2. lenses — exactly ${WANT_LENSES}, each a different angle of attack, each written as a full
   instruction to a critic. Distinct lenses, not restatements of one. Agent count is
   monotonic but lens DIVERSITY is what buys coverage: identical critics converge on
   meaningless consensus.

3. calibration_lens + calibration_reason — which single lens gets gate-7 calibrated. It MUST
   be one of the keys you just emitted; naming anything else is a malformed orchestration and
   is recorded as one. Pick the one where a MISS IS MOST EXPENSIVE, not the one listed first.
   For a spec that is almost always the acceptance criteria: a criterion that cannot fail
   silently licenses everything downstream of it. State the cost, not the ordering.

4. acceptance_rule — what makes a finding count, and the stop condition.`,
  { label: 'gate2:design', phase: 'Design', schema: DESIGN_SCHEMA }
)

if (!design) throw new Error('gate 2 returned nothing — cannot orchestrate a run without an orchestration')

const LENSES = design.lenses.slice(0, WANT_LENSES)
const NEED = OPERATOR_NEED || design.need_restatement
const calLensExact = LENSES.find(l => l.key === design.calibration_lens)
const calLens = calLensExact || LENSES[0]
const calLensFallback = !calLensExact

log(`gate 2: ${LENSES.length} lenses [${LENSES.map(l => l.key).join(', ')}] · calibrating "${calLens.key}" — ${design.calibration_reason}`)
if (calLensFallback) {
  log(`gate 2 MALFORMED: named calibration lens "${design.calibration_lens}" is not one of the lenses it emitted. Fell back to "${calLens.key}" — which is the listed-first default gate 2 was told not to use. Recorded in the verdict; do not read the calibration as aimed.`)
}
if (design.findings_for_operator && design.findings_for_operator.trim() && !/^(none|n\/a|nothing)\b/i.test(design.findings_for_operator.trim())) {
  log(`gate 2 REPORTS TO OPERATOR (not a veto): ${design.findings_for_operator}`)
}
if (OPERATOR_NEED) log('gate 5: using the OPERATOR-supplied need restatement, not gate 2\'s')

// ---------------------------------------------------------------------------
// PHASE: BAR (gates 3, 5, 6)
//
// Structural property this buys over prose: the bar writer is never told where
// the artifact is. It cannot read what it was not pointed at.
//
// Gate 6 is ENFORCED here rather than warned about. A criterion with no
// concrete failing case cannot discriminate, and one with no concrete passing
// case is unmeetable — a bar written blind is the likeliest place for both.
// The writer gets one correction pass, then the dead criteria are dropped, and
// if fewer than two survive there is no bar and the run does not proceed.
// ---------------------------------------------------------------------------

phase('Bar')

const BAR_TASK = `You are writing the acceptance bar for a review. You have NOT been told what the artifact
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
  criterion for which you cannot construct a passing case is unmeetable by anything, which
  is the characteristic failure of a bar written without seeing the work. A saturated
  criterion that never engages is worse than no criterion, because it reads as coverage.

Then emit bar_text: the frozen bar exactly as critics will receive it.`

function deadCriteria(criteria) {
  return (criteria || []).filter(c =>
    !c.fails_when || !c.fails_when.trim() || !c.passes_when || !c.passes_when.trim()
  )
}

let bar = await agent(BAR_TASK, { label: 'gate5:blind-bar', phase: 'Bar', schema: BAR_SCHEMA, agentType: AT.bar })
if (!bar) throw new Error('bar writer returned nothing — critics cannot run against no bar')

let dead = deadCriteria(bar.criteria)
let barRepaired = false

if (dead.length) {
  log(`gate 6: ${dead.length} criteria cannot fire in both directions — re-asking the bar writer once`)
  const repaired = await agent(
    `${BAR_TASK}

CORRECTION PASS. Your previous bar had ${dead.length} criteria that cannot fire in both
directions: ${dead.map(c => c.id).join(', ')}. For each, you either gave no concrete failing
case (it cannot discriminate) or no concrete passing case (nothing can meet it). Replace
them. Keep the criteria that were sound. Do not go looking for the artifact — you still have
not been told what it is.`,
    { label: 'gate6:bar-repair', phase: 'Bar', schema: BAR_SCHEMA, agentType: AT.bar }
  )
  if (repaired && repaired.criteria) {
    bar = repaired
    barRepaired = true
    dead = deadCriteria(bar.criteria)
  }
}

if (dead.length) {
  const deadIds = new Set(dead.map(c => c.id))
  bar.criteria = bar.criteria.filter(c => !deadIds.has(c.id))
  log(`gate 6: dropped ${deadIds.size} criteria that still could not fire after the correction pass`)
}

if (!bar.criteria || bar.criteria.length < 2) {
  log('gate 6 leaves fewer than two criteria that can fire — there is no bar, so there is nothing for critics to review against.')
  return {
    verdict: 'NO VERDICT',
    stage: 'gate 6',
    why: 'the blind bar could not produce two criteria that fire in both directions, even after a correction pass',
    need: NEED,
    lenses: LENSES.map(l => l.key),
    note: 'Gate 6 firing here usually means the need restatement is too abstract to write criteria against. Supply args.need yourself and rerun.',
  }
}

log(`gate 3/5/6: ${bar.criteria.length} criteria, form=${bar.gate3_form}, written blind${barRepaired ? ', one correction pass' : ''}`)

// ---------------------------------------------------------------------------
// PHASE: CALIBRATE (gate 7) — TWO ARMS
//
// Arm 1, SENSITIVITY: a planted in-lane defect. Did the deployed critic catch
// it? This is the arm the skill has always had.
//
// Arm 2, SPECIFICITY: the same critic prompt over an unseeded copy carrying
// the identical isolation treatment. If it files the same claim at the same
// location with no defect present, then arm 1's catch measured a habit, not a
// detection — and a panel calibrated on a habit is calibrated on nothing. Only
// a catch that survives its own control counts.
//
// VOID != miss. A VOID means the measurement never happened and cannot consume
// the retry; a miss consumes it and the retry uses a DIFFERENT plant. A VOID
// re-runs the SAME defect kind with the cause corrected, which is why a voided
// attempt must not burn the kind it used.
// Two VOIDs -> NO VERDICT. Missed twice -> NO VERDICT.
// ---------------------------------------------------------------------------

phase('Calibrate')

const otherLensNames = LENSES.filter(l => l.key !== calLens.key).map(l => l.lens)

function extOf(p) {
  const base = p.slice(p.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot) : '.txt'
}

async function calibrationAttempt(attempt, spentKinds, priorVoid) {
  const seed = await agent(
    `You are seeding a defect to test whether a reviewer can catch one. You have NOT seen the
reviewer's prompt and must not go looking for it — knowing how the reviewer is instructed
would let you tune the defect to evade it, which measures evasion rather than capability.

1. Read the artifact at ${ARTIFACT}.
2. Write TWO complete copies into ${SCRATCH}:
     ${SCRATCH}/seeded-${attempt}${extOf(ARTIFACT)}   — with exactly ONE defect introduced
     ${SCRATCH}/control-${attempt}${extOf(ARTIFACT)}  — with NO defect
   The two must be byte-identical except for the plant. The control is the other arm of
   this measurement: a reviewer that files at the plant site on the CONTROL was never
   detecting anything, and the trial has to be able to show that.
3. The defect must land inside this lane, because that is the reviewer being measured:
     ${calLens.lens}
   A plant outside this lane VOIDS the measurement — the reviewer is instructed to stay in
   its lane, so an out-of-lane plant measures obedience, not capability.
${spentKinds.length ? `4. Previous attempts genuinely MISSED using: ${spentKinds.join('; ')}. Use a DIFFERENT kind of defect — re-running a plant the reviewer already failed fits the reviewer to the test.` : ''}
${priorVoid ? `4. The previous attempt did not measure anything: ${priorVoid}. Re-run the SAME KIND of defect with that cause corrected. Reusing the defect is safe precisely because the reviewer was never shown it.` : ''}

ISOLATION — both copies must stand alone, and identically. Strip anything that would let a
reader recover the original: cross-references to the source path, "see the original",
version headers, adjacent duplicated statements of the same fact. Whatever you strip from
one, strip from the other, or the control is not a control.

DIAGNOSE THE LEAK CHANNEL BEFORE YOU CHOOSE. If the text you remove is recoverable from
public sources or from a model's own prior knowledge, no sandbox closes that channel and a
tighter re-run only yields a FALSE PASS. Prefer ground truth that is specific to this
artifact and not recallable from anywhere else. Inverting a constraint that exists only
here is the strongest shape available: it removes a real string, so the leak stays
checkable, and its correct form cannot be recalled from any prior.

Record removed_verbatim as the EXACT strings you deleted. A grep for them in the reviewer's
output is how a leak is proven, so they must match byte for byte, and at least one of them
must be ${LEAK_MIN_CHARS} characters or longer — a shorter string recurs by chance and can
prove nothing in either direction.`,
    { label: `gate7:seeder-${attempt}`, phase: 'Calibrate', schema: SEED_SCHEMA, agentType: AT.seeder }
  )

  if (!seed || !seed.seeded_path) return { status: 'VOID', why: 'seeder produced no isolated copy' }
  if (!seed.control_path) return { status: 'VOID', why: 'seeder produced no control copy — the specificity arm cannot run, so the trial cannot distinguish a detection from a habit', seed }

  const checkable = (seed.removed_verbatim || []).filter(s => s && s.trim().length >= LEAK_MIN_CHARS)
  if (!checkable.length) {
    return {
      status: 'VOID',
      why: `no removed string reaches ${LEAK_MIN_CHARS} characters — this plant is not leak-checkable, so a pass could not be distinguished from the critic having reached the original`,
      seed,
    }
  }

  // Byte-identical to a DEPLOYED critic. It is not told it is being calibrated.
  const calCritic = await agent(
    criticPrompt(seed.seeded_path, calLens.lens, otherLensNames, bar.bar_text, LENSES.length),
    { label: `gate7:critic-${attempt}`, phase: 'Calibrate', agentType: AT.critic }
  )

  if (!calCritic) return { status: 'VOID', why: 'calibration critic returned nothing', seed }

  // LEAK CHECK — code, not judgment. A match proves it reached the original.
  const leaked = checkable.filter(s => calCritic.indexOf(s) !== -1)
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
    { label: `gate7:judge-${attempt}`, phase: 'Calibrate', schema: CAL_JUDGE_SCHEMA, effort: 'high', agentType: AT.judge }
  )

  if (!judged) return { status: 'VOID', why: 'calibration judge returned nothing', seed }
  if (!judged.in_lane) return { status: 'VOID', why: `plant landed outside the calibrated lane — ${judged.reasoning}`, seed }
  if (!judged.caught) return { status: 'MISS', seed, judged }

  // ---- ARM 2: SPECIFICITY. Only a catch needs a control; a miss is already
  // uninformative about habit. Same prompt, same lane, no defect.
  const controlCritic = await agent(
    criticPrompt(seed.control_path, calLens.lens, otherLensNames, bar.bar_text, LENSES.length),
    { label: `gate7:control-${attempt}`, phase: 'Calibrate', agentType: AT.critic }
  )

  if (!controlCritic) return { status: 'VOID', why: 'control critic returned nothing — the catch is unconfirmed, and an unconfirmed catch is not a measurement', seed, judged }

  const controlJudged = await agent(
    `Judge the CONTROL arm of a calibration trial. A reviewer was given a copy of an artifact
with NO defect in it. Separately, a defect had been planted in a different copy at the
location below, and another reviewer running the identical prompt named it.

WHERE THE DEFECT WOULD HAVE BEEN
  location: ${seed.location}
  kind: ${seed.defect_kind}
  what the plant did: removed ${JSON.stringify(seed.removed_verbatim)}, inserted ${JSON.stringify(seed.inserted_verbatim)}

THE CONTROL REVIEWER'S OUTPUT (reviewing the clean copy)
${controlCritic}

One question: filed_at_plant_site — did this reviewer file a finding at that location making
the same claim, or an equivalent one, with no defect present? Filing elsewhere does not
count. A low-severity remark that does not assert the same defect does not count. Be strict
in the other direction too: if it named that exact site as wrong when nothing was wrong,
that is exactly what this arm exists to catch, and the earlier catch measured a habit rather
than a detection.`,
    { label: `gate7:control-judge-${attempt}`, phase: 'Calibrate', schema: CONTROL_JUDGE_SCHEMA, effort: 'high', agentType: AT.judge }
  )

  if (!controlJudged) return { status: 'VOID', why: 'control judge returned nothing', seed, judged }
  if (controlJudged.filed_at_plant_site) {
    return { status: 'FALSE-POSITIVE', seed, judged, controlJudged }
  }

  return { status: 'PASS', seed, judged, controlJudged }
}

let voids = 0
let misses = 0
let calibration = null
const spentKinds = []
let lastVoidWhy = null

for (let attempt = 1; attempt <= 4; attempt++) {
  const r = await calibrationAttempt(attempt, spentKinds, lastVoidWhy)

  if (r.status === 'VOID') {
    voids++
    lastVoidWhy = r.why
    // A VOID must not burn the defect kind: the reviewer never saw it, so the
    // same kind is re-run with the cause corrected. Burning it here would make
    // a VOID consume something after all.
    log(`gate 7 attempt ${attempt}: VOID (${r.why}) — does not consume the retry [voids=${voids}]`)
    if (voids >= 2) { calibration = { verdict: 'NO VERDICT', why: 'two VOIDs — the measurement never happened twice' }; break }
    continue
  }

  lastVoidWhy = null

  if (r.status === 'MISS') {
    misses++
    if (r.seed && r.seed.defect_kind) spentKinds.push(r.seed.defect_kind)
    log(`gate 7 attempt ${attempt}: MISS — consumes the retry [misses=${misses}]`)
    if (misses >= 2) { calibration = { verdict: 'NO VERDICT', why: 'the deployed critic missed a planted in-lane defect twice' }; break }
    continue
  }

  if (r.status === 'FALSE-POSITIVE') {
    calibration = {
      verdict: 'NO VERDICT',
      why: `the control arm failed: this critic files the same claim at the same location with no defect present — ${r.controlJudged.reasoning}. The catch measured a habit, not a detection.`,
      arm: 'specificity',
    }
    log('gate 7: CONTROL FAILED — the critic filed at the plant site on a clean copy. A catch that its own control reproduces is not evidence.')
    break
  }

  calibration = {
    verdict: 'CALIBRATED',
    lens: calLens.key,
    attempt,
    sensitivity: `caught a planted in-lane ${r.seed.defect_kind} — ${r.judged.reasoning}`,
    specificity: `did not file at the plant site on a clean copy carrying the identical isolation treatment — ${r.controlJudged.reasoning}`,
  }
  log(`gate 7: CALIBRATED on lens "${calLens.key}" at attempt ${attempt} — both arms: caught the plant, clean on the control`)
  break
}

if (!calibration) calibration = { verdict: 'NO VERDICT', why: 'calibration did not resolve within 4 attempts' }

if (calibration.verdict === 'NO VERDICT') {
  log('gate 7 returned NO VERDICT — the panel does not spawn. This is the designed outcome, not a failure of the run.')
  return {
    verdict: 'NO VERDICT',
    stage: 'gate 7',
    why: calibration.why,
    arm: calibration.arm || 'sensitivity',
    voids, misses,
    bar: bar.bar_text,           // blind, survives the halt — do not re-pay gate 5
    need: NEED,
    lenses: LENSES.map(l => l.key),
    calibration_lens_fallback: calLensFallback,
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
//
// The schema is what turns the cross-check into a MARGIN. Free prose flattens
// "every critic attacked it and it held" into the same verdict as "one critic
// attacked it and it barely held". The body field keeps the reasoning intact;
// the tally exists so the operator can see disagreement without reading for it.
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
refutation of a weaker claim.

Put your full prose in the body field. The other fields are a tally over what the
prose already says — they are not permission to say less.`,
      { label: `round2:${r.key}`, phase: 'Round2', schema: ROUND2_SCHEMA, agentType: AT.critic }
    ).then(out => (out ? { key: r.key, output: out } : null))
  )
)).filter(Boolean)

log(`round 2: ${round2.length} cross-checks returned — terminal`)

// MARGIN — assembled from the tally, not asserted by any one agent.
const margin = {}
for (const r of round2) {
  for (const c of (r.output.cross_checks || [])) {
    const id = c.finding_id
    if (!margin[id]) margin[id] = { finding_id: id, held: 0, knocked_down: 0, attackers: [] }
    if (c.outcome === 'HELD') margin[id].held++
    else margin[id].knocked_down++
    margin[id].attackers.push({ lens: r.key, outcome: c.outcome, basis: c.basis })
  }
}
const contested = Object.values(margin).filter(m => m.held > 0 && m.knocked_down > 0)
const withdrawnCount = round2.reduce((n, r) => n + ((r.output.withdrawn || []).length), 0)
if (contested.length) log(`round 2: ${contested.length} finding(s) SPLIT — attacked and defended by different lenses. A split is the cheapest confidence signal here; read those first.`)
log(`round 2: ${withdrawnCount} finding(s) withdrawn under grounding`)

// ---------------------------------------------------------------------------
// PHASE: COMPARE (optional — the source method's own mechanism)
//
// A criteria bar asks the critic to invent a threshold. A reference exemplar
// does not: the critic picks the better of two things it can both inspect, and
// a forced choice has no "seems fine" exit. Where an exemplar exists this is
// stronger evidence than the frozen bar, which is why the source method uses
// nothing else.
//
// What is STRUCTURAL here and merely asked-for there: the comparing critic is
// never told which side is ours. The mapping lives in the isolator's return
// value, which the critic prompt does not contain.
// ---------------------------------------------------------------------------

let comparison = null

if (REFERENCE) {
  phase('Compare')

  const ab = await agent(
    `Prepare a blind A/B. Two artifacts are to be compared by reviewers who must not be able
to tell which is which.

  ${ARTIFACT}
  ${REFERENCE}

1. Copy BOTH into ${SCRATCH} under neutral names: left${extOf(ARTIFACT)} and right${extOf(ARTIFACT)}.
   You choose which artifact goes on which side. Record it in ours_side — that field names
   the side holding the FIRST path above. No reviewer will ever see this field.
2. Apply the SAME treatment to both copies. Strip titles, bylines, filenames, version
   headers, repository names, dates, and any self-reference that identifies either document
   or its author. Anything you strip from one you strip from the other: an asymmetric strip
   is itself a label.
3. Do not improve, reorder, summarise, or repair either one. A copy that reads better
   because you cleaned it is not the artifact.

Report what you stripped in the treatment field, so an operator can see what the
reviewers could not use.`,
    { label: 'compare:isolate', phase: 'Compare', schema: AB_ISOLATE_SCHEMA, agentType: AT.isolator }
  )

  if (!ab || !ab.left_path || !ab.right_path) {
    log('compare: isolator produced no blinded pair — the A/B lane is skipped, the criteria lane stands')
  } else {
    const votes = (await parallel(
      LENSES.map(l => () =>
        agent(
          `You are comparing two artifacts, LEFT and RIGHT. They answer the same need. One of them
is a real, working example of the kind of thing the other is trying to be — you are NOT told
which, and you must not try to work it out. Judge only what is in front of you.

  LEFT:  ${ab.left_path}
  RIGHT: ${ab.right_path}

Read both in full.

YOUR LENS — judge on this and nothing else:
${l.lens}

You must pick a winner. A tie is not available. If they seem close, find the thing that
separates them under your lens and decide on that. "Both are good" is the answer this
comparison exists to refuse.

Then name the single largest gap: the one change that would most move the loser toward the
winner, stated as a change someone could make.

Do not attempt to identify the authors, the projects, or which document is the reference.
Speculation about provenance is not a judgment about quality.`,
          { label: `compare:${l.key}`, phase: 'Compare', schema: AB_VOTE_SCHEMA, agentType: AT.critic }
        ).then(v => (v ? { lens: l.key, ...v } : null))
      )
    )).filter(Boolean)

    if (votes.length) {
      const forOurs = votes.filter(v => v.winner === ab.ours_side).length
      const forReference = votes.length - forOurs
      comparison = {
        reference: REFERENCE,
        votes_for_artifact: forOurs,
        votes_for_reference: forReference,
        verdict: forOurs > forReference ? 'ARTIFACT WINS' : forOurs === forReference ? 'SPLIT' : 'REFERENCE WINS',
        blinding: ab.treatment,
        gaps: votes.map(v => ({ lens: v.lens, picked_ours: v.winner === ab.ours_side, largest_gap: v.largest_gap, why: v.why })),
      }
      log(`compare: ${forOurs}-${forReference} ${comparison.verdict} — blind A/B against ${REFERENCE}`)
    }
  }
}

// ---------------------------------------------------------------------------
// VERDICT — assembled, not asserted
// ---------------------------------------------------------------------------

const uncalibrated = LENSES.length - 1

const verdict = {
  verdict: 'COMPLETE',
  artifact: ARTIFACT,

  calibration: {
    ...calibration,
    voids,
    misses,
    arms: 'sensitivity (planted in-lane defect caught) AND specificity (clean control not filed on)',
    caveat: uncalibrated > 0
      ? `${uncalibrated}-of-${LENSES.length} lenses uncalibrated — one calibrated critic licenses one critic, not a verdict computed from all of them`
      : null,
    calibration_lens_fallback: calLensFallback,
  },

  bar: { text: bar.bar_text, form: bar.gate3_form, criteria: bar.criteria, written_blind: true, repaired: barRepaired },
  need: NEED,
  acceptance_rule: design.acceptance_rule,

  round1: round1.map(r => ({ lens: r.key, output: r.output })),
  grounding: verifier,
  round2: round2.map(r => ({ lens: r.key, output: r.output.body, tally: { withdrawn: r.output.withdrawn, narrowed: r.output.narrowed, cross_checks: r.output.cross_checks, new_findings: r.output.new_findings } })),

  margin: {
    per_finding: Object.values(margin),
    contested: contested.map(m => m.finding_id),
    withdrawn_total: withdrawnCount,
    note: 'A finding no one attacked is not a finding that survived attack. Read `attackers` before reading `held`.',
  },

  comparison,

  // Properties this run made STRUCTURAL — a thing the run cannot lose, not a
  // property the operator adds. Each is enforced by a tool allowlist in
  // agents/*.md or by code in this script, never by asking an agent nicely.
  enforced: [
    `bar writer ran as "${AT.bar}", whose tool allowlist has no Read, Grep, Glob or Bash — it could not open the artifact even if instructed to`,
    `critics ran as "${AT.critic}", whose allowlist has no Agent, ListAgents or SendMessage — no critic could discover or address a peer`,
    'critics have no Write or Edit — none could alter the artifact the others were reading',
    `verifier ran as "${AT.verifier}" and could not delegate its own checking`,
    'seeder was never handed the critic prompt',
    'calibration critic and control critic ran the byte-identical deployed prompt and were not told it was a trial',
    'leak check is a literal string match over the critic output, not a judgment, and a plant with no string long enough to check VOIDs rather than passing quietly',
    'VOID and MISS are counted separately in code; only MISS consumes the retry, and only MISS burns a defect kind',
    'a catch is discarded unless its own control comes back clean — the specificity arm runs in code, not on request',
    'gate 6 is enforced: criteria that cannot fire in both directions are re-asked once, then dropped, and fewer than two survivors halts the run',
    'round 2 agents are fresh agent() calls, not continuations of round-1 critics',
    'cross-check outcomes are tallied into a margin by code; no agent reports its own consensus',
    REFERENCE ? 'the comparing critics were never told which side is the artifact — the mapping exists only in the isolator\'s return value, which their prompt does not contain' : null,
  ].filter(Boolean),

  // Say what you did NOT enforce. Do not claim independence you did not buy.
  not_enforced: [
    'The gate-2 designer runs unrestricted: it needs to read the artifact in full, so no allowlist is applied to it. It names the lenses and picks the calibration target, and nothing mechanically stops it from spawning agents of its own.',
    'The seeder holds Read, so nothing mechanically stopped it from opening critic-prompt.md or this script and tuning the plant to evade the critic. That restraint is prompt-deep.',
    'The bar writer cannot read files, but it retains WebSearch/WebFetch — a published artifact could in principle be reached over the network.',
    'Isolation of the seeded copy is best-effort. If the removed text is recoverable from public sources or the model\'s own prior, no sandbox closes that channel and a tighter re-run yields a false pass rather than a catch.',
    'The specificity arm is n=1, like the sensitivity arm. A clean control rules out a habit this critic has every time; it does not rule out one it has sometimes.',
    'n=1 per calibrated lens — one planted defect, one session.',
    'Critics share a model family unless the operator varied it. Judge-panel correlation is measured ACROSS families; varying only the lens does not buy independent votes, and this harness offers no second family to vary to.',
    REFERENCE ? 'Which side of the A/B is ours was chosen by the isolator, not by a code-level randomiser — this runtime has none. A comparing critic cannot see the mapping, but the choice is an agent\'s, not a coin\'s.' : null,
    REFERENCE ? 'Blinding is content-deep only. A reference exemplar famous enough to be recognised from its prose is not blinded by stripping its title.' : null,
  ].filter(Boolean),

  reporting_note: 'Zero surviving findings is not a clean sheet until the refutation bodies are read. Report as: PASS — no critic broke it under <framing>. Untested shared belief: <the premise every critic assumed>.',
}

// ---------------------------------------------------------------------------
// PHASE: REPORT
//
// The source method's answer to a long expensive run is a live page you can
// watch and stop. This runtime cannot serve one, but the failure it prevents is
// the same: a run whose only output is a value in a session that ends. One
// agent, no Read, writes down what it was handed.
// ---------------------------------------------------------------------------

if (WANT_REPORT) {
  phase('Report')
  const reportPath = `${SCRATCH}/gauntlet-report.md`
  const written = await agent(
    `Write a run report to ${reportPath}. You have no Read tool: everything you need is below,
and anything not below did not happen as far as this report is concerned.

Reproduce, do not summarise away: the verdict, the bar and which form it took, the
calibration result INCLUDING BOTH ARMS, the margin tally, every finding with its anchor and
its cross-check outcome, the comparison result if present, and both the enforced and
not_enforced lists verbatim. The not_enforced list is the part a reader is most likely to
skip and most needs; give it its own section with its own heading, not a footnote.

Head the file with a one-line status a reader can scan, then the date-free run identity
(artifact path, lens keys, calibration verdict). Do not add praise, do not add
recommendations of your own, and do not resolve a contested finding — a split is a result,
not a defect in the report.

THE RUN
${JSON.stringify(verdict, null, 2)}`,
    { label: 'report:write', phase: 'Report', agentType: AT.reporter }
  )
  if (written) {
    verdict.report_path = reportPath
    log(`report written to ${reportPath} — the run survives this session`)
  }
}

return verdict
