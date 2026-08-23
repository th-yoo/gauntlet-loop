// Smoke test: actually EXECUTES gauntlet.js, unlike drift-guard.mjs which only
// substring-matches. gauntlet.js is a Workflow script — a plain JS body run by
// a runtime that injects five globals (args, agent, parallel, phase, log) and
// permits a top-level `return`. It has never run before this test existed.
//
// This loads the script as text, strips the leading `export ` from
// `export const meta` (the one thing that makes the file illegal as a
// function body), wraps the body in an async function taking
// (args, agent, parallel, phase, log), and drives it three times with
// stubbed agents. The stub agent(prompt, opts) returns a canned value keyed
// on opts.label — the script never keys behavior on prompt text, so this is
// the actual dispatch surface.
//
//   node test/smoke.mjs
//
// Exit 0 = all scenarios assert clean. Exit 1 = a scenario failed.
// No dependencies, no network, no agent calls.
//
// What this DOES prove: gauntlet.js's control flow — gate 6 enforcement,
// VOID-vs-MISS accounting in gate 7, the margin tally, the final verdict
// shape — behaves as the script's own comments claim, under inputs that are
// well-formed or malformed in the specific ways exercised below.
//
// What this does NOT prove: that a real agent, given the real prompts,
// produces well-formed output, catches a real planted defect, or writes a
// finding with a real anchor. Every agent() call here is a lookup table, not
// a model. This is a test of the harness the agents run inside, not of the
// agents.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT_PATH = join(ROOT, 'skills', 'gauntlet-loop', 'gauntlet.js')

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }

// ---------------------------------------------------------------------------
// LOAD + WRAP — turn the Workflow body into a callable async function.
// ---------------------------------------------------------------------------

const raw = readFileSync(SCRIPT_PATH, 'utf8')
const EXPORT_PREFIX = 'export const meta'
if (!raw.startsWith(EXPORT_PREFIX)) {
  console.error(`smoke: gauntlet.js no longer starts with "${EXPORT_PREFIX}" — the strip step in this test needs updating`)
  process.exit(1)
}
// Strip only the leading `export ` — the file's own text is not modified,
// only this in-memory copy of it.
const body = 'const meta' + raw.slice(EXPORT_PREFIX.length)

// AsyncFunction isn't a global — recover its constructor the standard way.
// new Function/AsyncFunction gives a readable stack trace on failure once
// labeled with a sourceURL comment: without it, a thrown error inside the
// wrapped body shows up as "evalmachine.<anonymous>", which is useless for
// finding which gate threw. With it, Node's stack trace names the frame
// gauntlet.js-wrapped-for-smoke, and the line number is stable relative to
// this file's wrapping (body starts at wrapper line 3: the AsyncFunction
// constructor prepends two lines for the parameter list).
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const runGauntlet = new AsyncFunction(
  'args', 'agent', 'parallel', 'phase', 'log',
  `${body}\n//# sourceURL=gauntlet.js-wrapped-for-smoke`
)

// ---------------------------------------------------------------------------
// STUBS
// ---------------------------------------------------------------------------

const BASE_ARGS = { artifact: '/fake/artifact.md', scratch: '/fake/scratch' }
// args.reference is left unset in every scenario so the Compare phase never
// runs — its stubs would just be more of the same pattern already covered
// by critic:<lenskey> / compare:<lenskey>, and the brief scopes it out.

function makeStubs(scenarioMap) {
  // phase()/log() record into arrays, matching what the real Workflow
  // runtime's globals do — the script calls them fire-and-forget, so nothing
  // outside this closure needs to read the arrays back.
  const phases = []
  const logs = []
  const agent = async (prompt, opts = {}) => {
    const label = opts && opts.label
    if (!label || !Object.prototype.hasOwnProperty.call(scenarioMap, label)) {
      throw new Error(`smoke stub: no canned response for agent label "${label}" (prompt started: ${String(prompt).slice(0, 60)}...)`)
    }
    return scenarioMap[label]
  }
  const parallel = async thunks => Promise.all(thunks.map(t => t()))
  const phase = title => { phases.push(title) }
  const log = msg => { logs.push(msg) }
  return { agent, parallel, phase, log }
}

async function runScenario(name, argsObj, scenarioMap, assertFn) {
  console.log(`smoke: scenario "${name}"`)
  const { agent, parallel, phase, log } = makeStubs(scenarioMap)
  let result
  try {
    result = await runGauntlet(argsObj, agent, parallel, phase, log)
  } catch (e) {
    fail(`${name}: gauntlet.js threw instead of returning a verdict — ${e && e.stack ? e.stack : e}`)
    return
  }
  assertFn(result)
}

// ---------------------------------------------------------------------------
// SHARED FIXTURES
// ---------------------------------------------------------------------------

const LENS_A = { key: 'accuracy', lens: 'Check every factual or numeric claim against something outside the artifact.' }
const LENS_B = { key: 'completeness', lens: 'Check the artifact covers every case the restated need requires.' }
const LENS_C = { key: 'risk', lens: 'Check for a silent failure at a point where being wrong is expensive.' }

const DESIGN_HAPPY = {
  need_restatement: 'The team needs a trustworthy way to review a generated artifact before it ships.',
  lenses: [LENS_A, LENS_B, LENS_C],
  calibration_lens: 'accuracy',
  calibration_reason: 'A missed accuracy defect ships silently and is the most expensive to unwind after the fact.',
  acceptance_rule: 'A finding counts only if it carries a valid anchor; the run is terminal after round 2.',
  findings_for_operator: 'none',
}

const BAR_HAPPY = {
  criteria: [
    {
      id: 'c1',
      criterion: 'The artifact states exact, reproducible steps.',
      passes_when: 'A reader can run the given command and reach the stated result.',
      fails_when: 'No command is given, or running it does not reach the stated result.',
    },
    {
      id: 'c2',
      criterion: 'The artifact documents its output shape.',
      passes_when: 'The output fields and their types are written down.',
      fails_when: 'The output shape is undocumented and a caller must guess it.',
    },
  ],
  gate3_form: 'structural-prior',
  bar_text: 'CRITERIA:\n1. Reproducible steps.\n2. Documented output shape.',
}

// removed_verbatim must be >=24 chars (LEAK_MIN_CHARS) or the trial VOIDs.
const REMOVED_STRING = 'the retry counter resets to zero after every successful attempt'
const SEED_1 = {
  seeded_path: '/fake/scratch/seeded-1.md',
  control_path: '/fake/scratch/control-1.md',
  removed_verbatim: [REMOVED_STRING],
  inserted_verbatim: ['the retry counter never resets after a successful attempt'],
  location: 'section 3, paragraph 2',
  defect_kind: 'inverted-invariant',
  why_in_lane: 'the calibrated lens covers accuracy of stated invariants, and this inverts one.',
}

// Must NOT contain REMOVED_STRING verbatim, or the leak check VOIDs the trial.
const CAL_CRITIC_1 = `FINDING cal-1
severity: high
claim: The retry counter behavior described is inverted from the correct one.
location: section 3, paragraph 2
falsifier: Run the retry loop twice and observe whether the counter resets on success.
anchor: TRACE re-walked the retry loop as written
anchor-says: the counter does not reset after a successful attempt, the opposite of the intended behavior
edit: restore the reset-on-success behavior
behavior-delta: implementers stop assuming retries accumulate across successful attempts

GETS-RIGHT: the surrounding steps are otherwise sequenced correctly
FAILED-ATTACK: tried to argue the omission was intentional shorthand; no anchor supported that
SPILLOVER: none`

const JUDGE_1 = { caught: true, in_lane: true, reasoning: 'named the inverted retry-counter behavior at the stated location.' }

const CONTROL_CRITIC_1 = `FINDING ctrl-1
severity: low
claim: minor wording could be tightened in an unrelated section.
location: section 1
falsifier: n/a
anchor: TRACE walked the introduction
anchor-says: the introduction is consistent with the rest of the document
edit: none needed
behavior-delta: none

GETS-RIGHT: the retry counter description in section 3 is correct and consistent
FAILED-ATTACK: looked for an inverted invariant at section 3; the counter resets correctly there
SPILLOVER: none`

const CONTROL_JUDGE_1 = { filed_at_plant_site: false, reasoning: 'control critic found the counter behavior correct at section 3; no matching claim was filed there.' }

const VERIFIER_HAPPY = `FINDING accuracy-1: GROUNDED — TRACE re-walked, reaches the claimed stuck state.
FINDING completeness-1: GROUNDED-WEAK — the gap is real but narrower than claimed.
FINDING risk-1: GROUNDED — REPO anchor quoted verbatim, matches the file.`

function round2For(key, crossChecks) {
  return {
    body: `Round 2 for lens ${key}. Reviewed the pooled findings and the verifier report against my lens.`,
    withdrawn: [],
    narrowed: [],
    cross_checks: crossChecks,
    new_findings: [],
    adjacent: [],
  }
}

const HAPPY_SCENARIO = {
  'gate2:design': DESIGN_HAPPY,
  'gate5:blind-bar': BAR_HAPPY,
  'gate7:seeder-1': SEED_1,
  'gate7:critic-1': CAL_CRITIC_1,
  'gate7:judge-1': JUDGE_1,
  'gate7:control-1': CONTROL_CRITIC_1,
  'gate7:control-judge-1': CONTROL_JUDGE_1,
  'critic:accuracy': 'FINDING accuracy-1\nseverity: high\nclaim: a number in the spec disagrees with its source.\n\nGETS-RIGHT: the rest of the math is consistent\nFAILED-ATTACK: tried to find a second disagreement; found none',
  'critic:completeness': 'FINDING completeness-1\nseverity: med\nclaim: an edge case is not covered.\n\nGETS-RIGHT: the common case is covered well\nFAILED-ATTACK: tried to show the gap is unreachable; it is not',
  'critic:risk': 'FINDING risk-1\nseverity: high\nclaim: a silent failure is possible at an expensive decision point.\n\nGETS-RIGHT: cheap failures are handled\nFAILED-ATTACK: tried to show the path is unreachable; it is reachable',
  'verifier:grounding': VERIFIER_HAPPY,
  'round2:accuracy': round2For('accuracy', [{ finding_id: 'completeness-1', outcome: 'HELD', basis: 'REPO path:line quote supports the claim' }]),
  'round2:completeness': round2For('completeness', [{ finding_id: 'risk-1', outcome: 'KNOCKED-DOWN', basis: 'TRACE walked to a different state than the finding claimed' }]),
  'round2:risk': round2For('risk', [{ finding_id: 'accuracy-1', outcome: 'HELD', basis: 'HARNESS ran the described command and reproduced the effect' }]),
  'report:write': 'wrote the run report to disk',
}

// Two criteria that both lack fails_when — gate 6 dead on arrival, and the
// repair pass returns the same shape, so nothing survives the drop.
const BAR_DEAD = {
  criteria: [
    { id: 'd1', criterion: 'The solution is well documented.', passes_when: 'Documentation exists and is current.' },
    { id: 'd2', criterion: 'The solution is maintainable.', passes_when: 'The code is readable by a new contributor.' },
  ],
  gate3_form: 'structural-prior',
  bar_text: 'CRITERIA:\n1. Well documented.\n2. Maintainable.',
}

const GATE6_SCENARIO = {
  'gate2:design': DESIGN_HAPPY,
  'gate5:blind-bar': BAR_DEAD,
  'gate6:bar-repair': BAR_DEAD,
  'report:write': 'wrote the gate-6 halt report to disk',
}

// Seeder returns a seeded_path but no control_path, on both attempts. This
// must VOID (not MISS) both times — a VOID must not consume the retry.
function seedNoControl(attempt) {
  return {
    seeded_path: `/fake/scratch/seeded-${attempt}.md`,
    // control_path intentionally absent.
    removed_verbatim: ['a placeholder string of at least twenty-four characters'],
    inserted_verbatim: ['a different placeholder string'],
    location: 'section 2',
    defect_kind: 'omitted-control',
    why_in_lane: 'lands inside the calibrated lens',
  }
}

const GATE7_SCENARIO = {
  'gate2:design': DESIGN_HAPPY,
  'gate5:blind-bar': BAR_HAPPY,
  'gate7:seeder-1': seedNoControl(1),
  'gate7:seeder-2': seedNoControl(2),
  'report:write': 'wrote the gate-7 halt report to disk',
}

// ---------------------------------------------------------------------------
// ASSERTIONS
// ---------------------------------------------------------------------------

// Both `gate7-void-twice` and `gate6-halt` run against BASE_ARGS, so a
// report they carry lands at this path — SCRATCH + the fixed filename.
const EXPECT_REPORT_PATH = `${BASE_ARGS.scratch}/gauntlet-report.md`

function assertHappy(result) {
  if (!result) { fail('happy: gauntlet.js returned nothing'); return }
  if (result.verdict !== 'COMPLETE') fail(`happy: verdict = ${JSON.stringify(result.verdict)}, want 'COMPLETE'`)
  const calVerdict = result.calibration && result.calibration.verdict
  if (calVerdict !== 'CALIBRATED') fail(`happy: calibration.verdict = ${JSON.stringify(calVerdict)}, want 'CALIBRATED'`)
  const perFinding = result.margin && result.margin.per_finding
  if (!Array.isArray(perFinding) || perFinding.length === 0) fail(`happy: margin.per_finding = ${JSON.stringify(perFinding)}, want a non-empty array`)
  if (!Array.isArray(result.enforced) || result.enforced.length === 0) fail(`happy: enforced = ${JSON.stringify(result.enforced)}, want a non-empty array`)
  if (result.report_path !== EXPECT_REPORT_PATH) fail(`happy: report_path = ${JSON.stringify(result.report_path)}, want ${JSON.stringify(EXPECT_REPORT_PATH)}`)
}

function assertGate6Halt(result) {
  if (!result) { fail('gate6-halt: gauntlet.js returned nothing'); return }
  if (result.verdict !== 'NO VERDICT') fail(`gate6-halt: verdict = ${JSON.stringify(result.verdict)}, want 'NO VERDICT'`)
  if (result.stage !== 'gate 6') fail(`gate6-halt: stage = ${JSON.stringify(result.stage)}, want 'gate 6'`)
  // A halted run must still write its report — the blind artifacts (need,
  // lenses) it carries have to survive into a rerun, not vanish with the
  // session. This is the behavior this task added: before it, a halt wrote
  // nothing and report_path was never set.
  if (result.report_path !== EXPECT_REPORT_PATH) fail(`gate6-halt: report_path = ${JSON.stringify(result.report_path)}, want ${JSON.stringify(EXPECT_REPORT_PATH)} — a halt must still dispatch the reporter`)
}

function assertGate7VoidTwice(result) {
  if (!result) { fail('gate7-void-twice: gauntlet.js returned nothing'); return }
  if (result.verdict !== 'NO VERDICT') fail(`gate7-void-twice: verdict = ${JSON.stringify(result.verdict)}, want 'NO VERDICT'`)
  if (result.stage !== 'gate 7') fail(`gate7-void-twice: stage = ${JSON.stringify(result.stage)}, want 'gate 7'`)
  if (result.voids !== 2) fail(`gate7-void-twice: voids = ${JSON.stringify(result.voids)}, want 2`)
  // Critical: a VOID must not consume the retry, so two VOIDs must leave
  // misses at 0 — if this is nonzero, VOID and MISS accounting have merged.
  if (result.misses !== 0) fail(`gate7-void-twice: misses = ${JSON.stringify(result.misses)}, want 0 (a VOID must not consume the retry)`)
  // Same rationale as gate6-halt: this halt carries `bar` and `need` — the
  // report is what lets a rerun pick them up instead of re-paying gate 5.
  if (result.report_path !== EXPECT_REPORT_PATH) fail(`gate7-void-twice: report_path = ${JSON.stringify(result.report_path)}, want ${JSON.stringify(EXPECT_REPORT_PATH)} — a halt must still dispatch the reporter`)
}

// ---------------------------------------------------------------------------
// RUN
// ---------------------------------------------------------------------------

console.log('smoke: loading gauntlet.js as a Workflow body and driving it with stubbed agents')

await runScenario('happy', BASE_ARGS, HAPPY_SCENARIO, assertHappy)
await runScenario('gate6-halt', BASE_ARGS, GATE6_SCENARIO, assertGate6Halt)
await runScenario('gate7-void-twice', BASE_ARGS, GATE7_SCENARIO, assertGate7VoidTwice)

if (failures) {
  console.error(`\nsmoke: ${failures} failure(s) — gauntlet.js's control flow did not behave as the script's own comments claim.`)
  process.exit(1)
}
console.log('\nsmoke: OK — 3 scenarios')
