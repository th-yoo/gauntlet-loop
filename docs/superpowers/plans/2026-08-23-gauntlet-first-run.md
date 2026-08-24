# Gauntlet First Run Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `gauntlet.js` from a script that parses into a panel that demonstrably runs, by resolving the agent-type namespace, testing the orchestration without paying for spawns, and then running it once against an artifact whose defects are already known independently.

**Architecture:** Three cheap gates before one expensive one. Task 1 resolves the only unknown that blocks everything (do plugin agent types need a namespace prefix). Task 2 widens the input contract so the acceptance run is controlled rather than gate-2-improvised. Task 3 exercises every branch of the orchestration — VOID/MISS accounting, leak detection, blind-bar isolation — against stubbed agents, so logic bugs are found for free. Only Task 4 spawns real agents, and it spawns them at an artifact where a wrong answer is recognisable. Task 5 removes the prose the script now owns.

**Tech Stack:** Node 22 (`node --test` is not used; plain assert scripts, no dependencies), Claude Code plugin loader, the `Workflow` tool.

**Spec:** `skills/gauntlet-loop/SKILL.md` in this repo (gate semantics), plus `/home/th-yoo/z2/meta-harness/docs/superpowers/plans/2026-08-23-gauntlet-loop-executable.md` (the source plan; this plan implements its T5 and T6 and reconciles the interface drift introduced when T3 was built here).

## Global Constraints

- **Workflow scripts are self-contained plain JavaScript.** No `import`, no filesystem, no Node APIs. `Date.now()`, `Math.random()`, argless `new Date()` **throw**. Prompts are inline string constants. The file is `gauntlet.js`, not `.ts` — it contains no TypeScript and must not gain any.
- **Gates 0, 1 and 4 stay operator-run and stay in prose.** `test/drift-guard.mjs` fails the build if `cost_ceiling`, `costCeiling`, `gate0`, `gate1:` or `gate4` appears in the script.
- **`test/drift-guard.mjs` must exit 0 after every task.** It pins 22 contract elements between `critic-prompt.md` and `gauntlet.js`, 6 gate semantics between `SKILL.md` and `gauntlet.js`.
- **`skills/gauntlet-loop/` is symlinked from `~/.claude/skills/gauntlet-loop`.** Remove that symlink once the plugin is installed (Task 1) or the skill registers twice.
- **Baseline:** `node test/drift-guard.mjs` = OK, 22 + 6 pinned. Syntax check passes in the async-fn harness.
- **One change per commit.** Repo is public at `github.com/th-yoo/gauntlet-loop`; push is allowed, it is already published.
- **Do not claim a property the run did not buy.** Every verdict carries `not_enforced` verbatim.

---

## File Structure

| file | responsibility | task |
|---|---|---|
| `skills/gauntlet-loop/gauntlet.js` | the orchestration. Gains an explicit-lens input path. | 1, 2 |
| `test/harness.mjs` | loads `gauntlet.js` into a stubbed agent runtime and returns the captured prompts + result. One responsibility: make the script runnable offline. | 3 |
| `test/orchestration.test.mjs` | asserts the branches that cost money to discover: VOID/MISS accounting, leak detection, blind-bar isolation, lens resolution. | 3 |
| `test/run-all.mjs` | one entry point so a reviewer runs one command. | 3 |
| `docs/runs/2026-08-23-ralph-stop-hook/verdict.md` | the run record. Not code; the acceptance evidence. | 4 |
| `skills/gauntlet-loop/SKILL.md` | loses the roster prose the script now owns. | 5 |

---

## Task 1: Resolve the agent-type namespace

`gauntlet.js:42` guesses that plugin agent types are addressed bare (`gauntlet-critic`). `feature-dev`'s agents surface as `feature-dev:code-architect`, so the guess is probably wrong. Every `agent()` call in the script fails if it is. Nothing else in this plan can be trusted until this is settled by observation.

**Files:**
- Modify: `skills/gauntlet-loop/gauntlet.js:42-47`

**Interfaces:**
- Consumes: nothing.
- Produces: the `AT` constant with verified-correct agent type strings. Tasks 3 and 4 depend on these resolving.

- [ ] **Step 1: Install the plugin**

These are interactive slash commands — run them in the Claude Code prompt, not via Bash:

```
/plugin marketplace add th-yoo/gauntlet-loop
/plugin install gauntlet-loop@gauntlet-loop-local
```

- [ ] **Step 2: Remove the interim symlink**

It was pointing `~/.claude/skills/gauntlet-loop` at the repo so the skill kept working before the plugin existed. With the plugin installed it double-registers.

```bash
ls -l /home/th-yoo/.agents/skills/gauntlet-loop
rm /home/th-yoo/.agents/skills/gauntlet-loop
ls /home/th-yoo/.claude/skills/
```

Expected: the symlink existed, is gone, and `ccc find-skills oneshot` remain.

- [ ] **Step 3: Observe the actual agent type names**

Call the `ListAgents` tool. Read the rows for the four agents this plugin ships.

Record which form appears:
- bare — `gauntlet-bar-writer`, `gauntlet-critic`, `gauntlet-seeder`, `gauntlet-verifier`
- namespaced — `gauntlet-loop:gauntlet-bar-writer`, etc.

If neither appears, the plugin did not install; stop and fix that before continuing. Do not guess the prefix — the whole point of this task is that it was guessed once already.

- [ ] **Step 4: Correct the constant if needed**

If and only if Step 3 showed the namespaced form, apply this edit to `skills/gauntlet-loop/gauntlet.js`:

```javascript
const AT = {
  bar: 'gauntlet-loop:gauntlet-bar-writer',
  seeder: 'gauntlet-loop:gauntlet-seeder',
  critic: 'gauntlet-loop:gauntlet-critic',
  verifier: 'gauntlet-loop:gauntlet-verifier',
}
```

If Step 3 showed the bare form, change nothing and say so.

- [ ] **Step 5: Verify the tool allowlists survived packaging**

The enforcement this plugin claims is the `tools:` frontmatter. Confirm the loader kept it — read the `ListAgents` row for `gauntlet-bar-writer` and check its tool list contains **no** `Read`, `Grep`, `Glob`, `Bash`, or `LS`, and the `gauntlet-critic` row contains **no** `Agent`, `ListAgents`, or `SendMessage`.

If the loader ignored `tools:` and granted everything, the `enforced` list in `gauntlet.js` is false advertising. In that case stop, and move those two bullets from `enforced` to `not_enforced` before doing anything else. A wrong claim about what is enforced is worse than the missing enforcement.

- [ ] **Step 6: Drift guard**

```bash
cd /home/th-yoo/z2/gauntlet-loop && node test/drift-guard.mjs
```

Expected: `drift-guard: OK — 22 contract elements + 6 gate semantics pinned, gates 0/1/4 absent from script.`

- [ ] **Step 7: Commit**

```bash
cd /home/th-yoo/z2/gauntlet-loop
git add skills/gauntlet-loop/gauntlet.js
git commit -m "fix(gauntlet): pin agent type names to what the loader actually exposes

The AT block was written from the feature-dev naming pattern without an
installed plugin to check against. Verified against ListAgents.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push
```

If Step 4 changed nothing, skip the commit and record "bare form confirmed, no edit" instead.

---

## Task 2: Accept an explicit lens set

The source plan's T6 passes `lenses` as an array of `{key, lane}` plus a `calibratedLens` override. This implementation takes `lenses` as an integer and lets gate 2 derive them. Gate 2 deriving lenses matches `SKILL.md` ("Gate 2 picks *which* lens gets calibrated, and says why"), so it stays the default — but the acceptance run in Task 4 needs the lens set fixed in advance, or the run is not reproducible and a miss cannot be attributed.

Support both. An array means the operator chose; an integer means gate 2 chooses.

**Files:**
- Modify: `skills/gauntlet-loop/gauntlet.js` (input block ~line 49, and the lens-resolution block after the Design phase)

**Interfaces:**
- Consumes: `AT` from Task 1.
- Produces: the input contract Tasks 3 and 4 both use —
  - `args.artifact: string` (required, absolute path)
  - `args.scratch: string` (required, absolute path to an empty dir)
  - `args.lenses: number | Array<{key: string, lens?: string, lane?: string}>` (optional, default 3)
  - `args.calibratedLens: string` (optional, a `key` from `args.lenses`)
  - `args.need: string` (optional)

- [ ] **Step 1: Write the failing test**

Task 3 builds the harness this test needs, but this test is written first and will not run until then. Create `test/orchestration.test.mjs` with only this case for now:

```javascript
import { runGauntlet, ok, eq } from './harness.mjs'

// An explicit lens set must be honored verbatim, and calibratedLens must
// override whatever gate 2 nominated.
const r = await runGauntlet({
  args: {
    artifact: '/tmp/x/artifact.md',
    scratch: '/tmp/x/scratch',
    lenses: [
      { key: 'alpha', lane: 'lane A' },
      { key: 'beta', lane: 'lane B' },
    ],
    calibratedLens: 'beta',
  },
  // gate 2 nominates 'alpha' and offers three lenses of its own; both must lose
  design: {
    need_restatement: 'the need',
    lenses: [
      { key: 'gate2one', lens: 'g1' },
      { key: 'gate2two', lens: 'g2' },
      { key: 'gate2three', lens: 'g3' },
    ],
    calibration_lens: 'gate2one',
    calibration_reason: 'because',
    acceptance_rule: 'rule',
    findings_for_operator: 'none',
  },
})

eq(r.result.round1.map(x => x.lens).sort(), ['alpha', 'beta'], 'operator lens set honored')
eq(r.result.calibration.lens, 'beta', 'calibratedLens override honored')
ok(!r.result.round1.some(x => x.lens.startsWith('gate2')), 'gate 2 lenses discarded when operator supplied a set')

console.log('orchestration: lens resolution OK')
```

- [ ] **Step 2: Apply the input-block edit**

In `skills/gauntlet-loop/gauntlet.js`, replace the four `const` lines beginning `const ARTIFACT = args && args.artifact` with:

```javascript
const ARTIFACT = args && args.artifact
const SCRATCH = args && args.scratch
const OPERATOR_NEED = (args && args.need) || null

// args.lenses is either a count (gate 2 names them — the SKILL.md default) or
// an explicit array (the operator named them, so the run is reproducible).
const RAW_LENSES = args && args.lenses
const EXPLICIT_LENSES = Array.isArray(RAW_LENSES)
  ? RAW_LENSES.slice(0, 4).map(l => ({ key: l.key, lens: l.lens || l.lane }))
  : null
const WANT_LENSES = EXPLICIT_LENSES
  ? Math.max(2, EXPLICIT_LENSES.length)
  : Math.max(2, Math.min(4, RAW_LENSES || 3))
const CALIBRATED_OVERRIDE = (args && args.calibratedLens) || null
```

- [ ] **Step 3: Apply the lens-resolution edit**

Immediately after the `if (!design) throw ...` line, replace the two `const LENSES` / `const calLens` lines with:

```javascript
const LENSES = EXPLICIT_LENSES || design.lenses.slice(0, WANT_LENSES)
const wantCal = CALIBRATED_OVERRIDE || design.calibration_lens
const calLens = LENSES.find(l => l.key === wantCal) || LENSES[0]
if (CALIBRATED_OVERRIDE && calLens.key !== CALIBRATED_OVERRIDE) {
  log(`WARNING: args.calibratedLens "${CALIBRATED_OVERRIDE}" is not a key in the lens set — falling back to "${calLens.key}"`)
}
if (EXPLICIT_LENSES) log('gate 2: operator supplied the lens set; gate 2\'s own lenses discarded')
```

- [ ] **Step 4: Document the new inputs**

In the `// INPUT` comment block at the top of `gauntlet.js`, replace the `args.lenses` line with:

```javascript
//   args.lenses     (optional) EITHER an integer 2-4 (gate 2 names the lenses,
//                   the SKILL.md default) OR an array of {key, lane} the
//                   operator fixed in advance, which makes a run reproducible
//                   and lets a miss be attributed to a named lens.
//   args.calibratedLens (optional) a key from args.lenses. Overrides gate 2's
//                   nomination. Use it when you already know which lens's miss
//                   is most expensive.
```

- [ ] **Step 5: Syntax check**

```bash
cd /home/th-yoo/z2/gauntlet-loop
python3 -c "
s=open('skills/gauntlet-loop/gauntlet.js',encoding='utf-8').read().replace('export const meta','const meta',1)
open('/tmp/wrapped.mjs','w',encoding='utf-8').write('const agent=async()=>{},parallel=async()=>[],pipeline=async()=>[],log=()=>{},phase=()=>{},args={},budget={};\nasync function __b(){\n'+s+'\n}\nvoid __b;\n')"
node --check /tmp/wrapped.mjs && echo "PARSE OK"
```

Expected: `PARSE OK`. A bare `node --check` on the file itself fails with `Illegal return statement` — that is the checker being wrong, not the script.

- [ ] **Step 6: Drift guard**

```bash
node test/drift-guard.mjs
```

Expected: OK, 22 + 6.

- [ ] **Step 7: Commit**

```bash
git add skills/gauntlet-loop/gauntlet.js
git commit -m "feat(gauntlet): accept an operator-supplied lens set

Gate 2 naming the lenses stays the default, per SKILL.md. But an acceptance
run needs the lens set fixed in advance or a miss cannot be attributed to a
named lens. args.lenses now takes an array as well as a count, and
args.calibratedLens overrides gate 2's nomination.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push
```

---

## Task 3: Test the orchestration without spawning anything

Every branch worth knowing about — a VOID not consuming the retry, two misses terminating, the leak grep firing, the bar writer never seeing the artifact path — costs real spawns to discover in production and zero to discover against stubs. This task makes those branches falsifiable for free.

**Files:**
- Create: `test/harness.mjs`
- Create: `test/orchestration.test.mjs` (extends the file started in Task 2)
- Create: `test/run-all.mjs`

**Interfaces:**
- Consumes: the input contract from Task 2.
- Produces:
  - `runGauntlet({args, design, bar, seeds, criticOut, judges}) -> {result, prompts, labels}` — `prompts` is an array of `{label, prompt, agentType}` for every `agent()` call the run made; `result` is the script's return value.
  - `ok(cond, msg)`, `eq(actual, expected, msg)` — assertion helpers that throw on failure.

- [ ] **Step 1: Write the harness**

Create `test/harness.mjs`:

```javascript
// Loads gauntlet.js into a stubbed agent runtime so the orchestration can be
// exercised offline. The script is plain JS meant to run inside an async
// function with injected globals, which is exactly what AsyncFunction gives us.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'skills', 'gauntlet-loop', 'gauntlet.js')

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

export function ok(cond, msg) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

export function eq(actual, expected, msg) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`ASSERT FAILED: ${msg}\n  expected: ${e}\n  actual:   ${a}`)
}

// opts.design    - object returned for the gate2:design call
// opts.bar       - object returned for the gate5:blind-bar call
// opts.seeds     - array of SEED_SCHEMA objects, one per seeder attempt
// opts.judges    - array of CAL_JUDGE_SCHEMA objects, one per judge call
// opts.criticOut - function(label) -> string, the text a critic returns
export async function runGauntlet(opts) {
  const prompts = []
  let seedIdx = 0
  let judgeIdx = 0

  const defaultDesign = {
    need_restatement: 'a restated need',
    lenses: [
      { key: 'l1', lens: 'lens one' },
      { key: 'l2', lens: 'lens two' },
    ],
    calibration_lens: 'l1',
    calibration_reason: 'a miss here is most expensive',
    acceptance_rule: 'anchored findings only',
    findings_for_operator: 'none',
  }

  const defaultBar = {
    criteria: [
      { id: 'c1', criterion: 'must X', passes_when: 'X holds', fails_when: 'X absent' },
      { id: 'c2', criterion: 'must Y', passes_when: 'Y holds', fails_when: 'Y absent' },
    ],
    gate3_form: 'structural-prior',
    bar_text: 'FROZEN BAR: must X. must Y.',
  }

  const defaultSeed = {
    seeded_path: '/tmp/x/scratch/seeded-1.md',
    removed_verbatim: ['the removed sentence that is definitely long enough'],
    inserted_verbatim: ['a wrong sentence'],
    location: 'line 10',
    defect_kind: 'inverted-condition',
    why_in_lane: 'it is an acceptance criterion',
  }

  async function agent(prompt, o) {
    const label = (o && o.label) || '(unlabeled)'
    prompts.push({ label, prompt, agentType: o && o.agentType, phase: o && o.phase })

    if (label === 'gate2:design') return opts.design === undefined ? defaultDesign : opts.design
    if (label === 'gate5:blind-bar') return opts.bar === undefined ? defaultBar : opts.bar
    if (label.startsWith('gate7:seeder')) {
      const s = opts.seeds ? opts.seeds[seedIdx] : defaultSeed
      seedIdx++
      return s === undefined ? null : s
    }
    if (label.startsWith('gate7:judge')) {
      const j = opts.judges ? opts.judges[judgeIdx] : { caught: true, in_lane: true, reasoning: 'named it' }
      judgeIdx++
      return j === undefined ? null : j
    }
    // every remaining call returns critic-shaped text
    return opts.criticOut ? opts.criticOut(label, prompt) : `FINDING ${label}-1\nGETS-RIGHT: x\nFAILED-ATTACK: y`
  }

  const parallel = async thunks => Promise.all(thunks.map(t => t()))
  const pipeline = async () => []
  const log = () => {}
  const phase = () => {}
  const budget = { total: null, spent: () => 0, remaining: () => Infinity }

  const src = readFileSync(SRC, 'utf8').replace('export const meta', 'const meta')
  const fn = new AsyncFunction('agent', 'parallel', 'pipeline', 'log', 'phase', 'args', 'budget', src)
  const result = await fn(agent, parallel, pipeline, log, phase, opts.args, budget)

  return { result, prompts, labels: prompts.map(p => p.label) }
}
```

- [ ] **Step 2: Run the Task 2 test against it**

```bash
cd /home/th-yoo/z2/gauntlet-loop && node test/orchestration.test.mjs
```

Expected: `orchestration: lens resolution OK`. If it throws, the Task 2 edit is wrong — fix `gauntlet.js`, not the test.

- [ ] **Step 3: Add the gate-7 accounting tests**

Append to `test/orchestration.test.mjs`:

```javascript
const BASE = {
  artifact: '/tmp/x/artifact.md',
  scratch: '/tmp/x/scratch',
  lenses: [
    { key: 'alpha', lane: 'lane A' },
    { key: 'beta', lane: 'lane B' },
  ],
  calibratedLens: 'alpha',
}

const seed = n => ({
  seeded_path: `/tmp/x/scratch/seeded-${n}.md`,
  removed_verbatim: [`removed string number ${n} long enough to count`],
  inserted_verbatim: ['wrong'],
  location: 'line 10',
  defect_kind: `kind-${n}`,
  why_in_lane: 'in lane',
})

// A VOID must NOT consume the retry: void once, then pass, and the run
// proceeds to a full panel.
{
  const r = await runGauntlet({
    args: BASE,
    seeds: [seed(1), seed(2)],
    judges: [
      { caught: false, in_lane: false, reasoning: 'landed in the other lane' }, // VOID
      { caught: true, in_lane: true, reasoning: 'named it' },                   // PASS
    ],
  })
  eq(r.result.verdict, 'COMPLETE', 'a VOID then a PASS still reaches a panel')
  eq(r.result.calibration.voids, 1, 'the VOID was counted')
  eq(r.result.calibration.misses, 0, 'the VOID was not counted as a miss')
  ok(r.result.round1.length === 2, 'panel spawned after calibration passed')
  console.log('orchestration: VOID does not consume the retry OK')
}

// Two VOIDs terminate with NO VERDICT and never spawn the panel.
{
  const r = await runGauntlet({
    args: BASE,
    seeds: [seed(1), seed(2)],
    judges: [
      { caught: false, in_lane: false, reasoning: 'out of lane' },
      { caught: false, in_lane: false, reasoning: 'out of lane again' },
    ],
  })
  eq(r.result.verdict, 'NO VERDICT', 'two VOIDs terminate')
  eq(r.result.stage, 'gate 7', 'terminated at gate 7')
  ok(!r.labels.some(l => l.startsWith('critic:')), 'panel never spawned')
  ok(typeof r.result.bar === 'string' && r.result.bar.length > 0, 'the blind bar survives the halt')
  console.log('orchestration: two VOIDs -> NO VERDICT, bar survives OK')
}

// Two genuine misses terminate, and the retry used a different plant.
{
  const r = await runGauntlet({
    args: BASE,
    seeds: [seed(1), seed(2)],
    judges: [
      { caught: false, in_lane: true, reasoning: 'missed it' },
      { caught: false, in_lane: true, reasoning: 'missed it again' },
    ],
  })
  eq(r.result.verdict, 'NO VERDICT', 'two misses terminate')
  eq(r.result.misses, 2, 'both counted as misses')
  const seeders = r.prompts.filter(p => p.label.startsWith('gate7:seeder'))
  eq(seeders.length, 2, 'two seeder attempts')
  ok(seeders[1].prompt.includes('kind-1'), 'the retry seeder was told which defect kind was already used')
  ok(seeders[1].prompt.includes('DIFFERENT'), 'the retry seeder was ordered to use a different plant')
  console.log('orchestration: two misses -> NO VERDICT, retry differs OK')
}

// The leak check must fire on a verbatim removed string, and a leak is a VOID
// rather than a pass — even though the judge would have said "caught".
//
// Only ONE seed is supplied: attempt 1 leaks (VOID), attempt 2 gets no seed
// (VOID), so the run terminates at two VOIDs and the judge is never reached.
// Supplying a second seed here would let attempt 2 pass and the judge WOULD be
// called, which is correct behaviour but tests nothing about the leak.
{
  const s = seed(1)
  const r = await runGauntlet({
    args: BASE,
    seeds: [s],
    judges: [{ caught: true, in_lane: true, reasoning: 'would have passed' }],
    criticOut: label =>
      label.startsWith('gate7:critic')
        ? `I compared against the original which said "${s.removed_verbatim[0]}" so the text is wrong.`
        : 'FINDING x-1\nGETS-RIGHT: a\nFAILED-ATTACK: b',
  })
  eq(r.result.verdict, 'NO VERDICT', 'a leaked trial cannot reach a panel')
  eq(r.result.voids, 2, 'the leak counted as a VOID, not as a pass')
  eq(r.result.misses, 0, 'a leak is never a miss')
  const judgeCalls = r.labels.filter(l => l.startsWith('gate7:judge')).length
  eq(judgeCalls, 0, 'a leaked trial short-circuits before the judge is even asked')
  console.log('orchestration: leak grep fires and voids the trial OK')
}
```

- [ ] **Step 4: Run them**

```bash
node test/orchestration.test.mjs
```

Expected: four `orchestration: ... OK` lines. Any throw is a real orchestration bug — fix `gauntlet.js`.

- [ ] **Step 5: Add the isolation tests — the properties the README claims**

Append to `test/orchestration.test.mjs`:

```javascript
// The blind bar's prompt must not contain the artifact path. This is the
// claim gate 5 rests on, and it is checkable directly.
{
  const r = await runGauntlet({ args: BASE })
  const barCall = r.prompts.find(p => p.label === 'gate5:blind-bar')
  ok(barCall, 'the bar writer ran')
  ok(!barCall.prompt.includes(BASE.artifact), 'bar prompt does not contain the artifact path')
  ok(barCall.agentType && barCall.agentType.includes('bar-writer'), 'bar writer ran as the restricted type')
  console.log('orchestration: bar writer never receives the artifact path OK')
}

// The seeder must not receive the critic prompt. The distinguishing string is
// the anchor rule, which every critic carries and the seeder must not.
{
  const r = await runGauntlet({ args: BASE })
  const seeder = r.prompts.find(p => p.label.startsWith('gate7:seeder'))
  ok(!seeder.prompt.includes('THE ANCHOR RULE'), 'seeder prompt does not carry the critic contract')
  ok(seeder.agentType && seeder.agentType.includes('seeder'), 'seeder ran as the restricted type')
  console.log('orchestration: seeder never receives the critic prompt OK')
}

// The calibration critic must be byte-identical to a deployed critic apart
// from the artifact path it is pointed at. A stand-in measures nobody.
{
  const r = await runGauntlet({ args: BASE })
  const cal = r.prompts.find(p => p.label.startsWith('gate7:critic'))
  const deployed = r.prompts.find(p => p.label === 'critic:alpha')
  ok(cal && deployed, 'both the calibration critic and the deployed critic ran')
  const normalise = s => s.replace(/\/tmp\/x\/scratch\/seeded-\d+\.md/g, 'PATH').replace(BASE.artifact, 'PATH')
  eq(normalise(cal.prompt), normalise(deployed.prompt), 'calibration critic prompt is byte-identical to the deployed one')
  ok(!cal.prompt.toLowerCase().includes('calibrat'), 'the calibration critic is not told it is being calibrated')
  console.log('orchestration: calibration critic is the deployed critic OK')
}

// Round 2 must be fresh spawns, one per lens, and must carry the pooled
// findings rather than continuing a round-1 agent.
{
  const r = await runGauntlet({ args: BASE })
  const r2 = r.prompts.filter(p => p.label.startsWith('round2:'))
  eq(r2.length, 2, 'one round-2 spawn per lens')
  ok(r2.every(p => p.prompt.includes('CROSS-CHECK')), 'round 2 orders a cross-check')
  ok(r2.every(p => p.prompt.includes('Last scheduled round')), 'round 2 is declared terminal to the worker')
  eq(r.result.calibration.caveat === null, false, 'a 2-lens run with 1 calibrated lens carries the uncalibrated caveat')
  console.log('orchestration: round 2 spawns fresh and terminal OK')
}
```

- [ ] **Step 6: Run them**

```bash
node test/orchestration.test.mjs
```

Expected: eight `OK` lines total.

- [ ] **Step 7: Prove the tests can fail**

A passing test proves nothing until you have built the input that breaks it. Do all four, restoring after each:

```bash
cd /home/th-yoo/z2/gauntlet-loop
cp skills/gauntlet-loop/gauntlet.js /tmp/g.bak

# M1: let a VOID consume the retry
sed -i 's/^    voids++$/    voids++; misses++/' skills/gauntlet-loop/gauntlet.js
node test/orchestration.test.mjs; echo "M1 exit=$?  (expect nonzero)"
cp /tmp/g.bak skills/gauntlet-loop/gauntlet.js

# M2: hand the artifact path to the bar writer
sed -i 's/^THE NEED$/THE NEED (artifact at ${ARTIFACT})/' skills/gauntlet-loop/gauntlet.js
node test/orchestration.test.mjs; echo "M2 exit=$?  (expect nonzero)"
cp /tmp/g.bak skills/gauntlet-loop/gauntlet.js

# M3: disable the leak grep
sed -i 's/s.length > 12 \&\& calCritic.indexOf(s) !== -1/false/' skills/gauntlet-loop/gauntlet.js
node test/orchestration.test.mjs; echo "M3 exit=$?  (expect nonzero)"
cp /tmp/g.bak skills/gauntlet-loop/gauntlet.js

# M4: make the calibration critic a stand-in instead of the deployed critic.
# Targets line 345 only (`criticPrompt(seed.seeded_path, ...`), never line 446
# (`criticPrompt(ARTIFACT, ...`), so the two prompts stop being byte-identical.
# Note: match on `seed.seeded_path`, not on the `${n}` in the prompt text —
# GNU grep/sed read `{n}` as an interval and the pattern silently misses.
sed -i "s|criticPrompt(seed.seeded_path, calLens.lens, otherLensNames, bar.bar_text, LENSES.length)|'Reviewer: find problems in ' + seed.seeded_path|" skills/gauntlet-loop/gauntlet.js
grep -qF "'Reviewer: find problems in '" skills/gauntlet-loop/gauntlet.js || echo "  !! M4 pattern did not apply — mutation not testing anything"
node test/orchestration.test.mjs; echo "M4 exit=$?  (expect nonzero)"
cp /tmp/g.bak skills/gauntlet-loop/gauntlet.js

node test/orchestration.test.mjs; echo "restored exit=$?  (expect 0)"
```

Expected: M1–M4 all nonzero with a named assertion, restored exit 0. If any mutation passes, that test is decorative — strengthen it before continuing.

- [ ] **Step 8: Add the single entry point**

Create `test/run-all.mjs`:

```javascript
// One command a reviewer runs. Exits nonzero if anything fails.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const suites = ['drift-guard.mjs', 'orchestration.test.mjs']

let failed = 0
for (const s of suites) {
  const r = spawnSync(process.execPath, [join(HERE, s)], { stdio: 'inherit' })
  if (r.status !== 0) { console.error(`FAILED: ${s}`); failed++ }
}
process.exit(failed ? 1 : 0)
```

- [ ] **Step 9: Run everything**

```bash
node test/run-all.mjs; echo "exit=$?"
```

Expected: drift-guard OK, eight orchestration OK lines, `exit=0`.

- [ ] **Step 10: Commit**

```bash
git add test/harness.mjs test/orchestration.test.mjs test/run-all.mjs
git commit -m "test(gauntlet): exercise the orchestration against stubbed agents

Loads gauntlet.js through AsyncFunction with injected globals, so every
branch that costs real spawns to discover is checkable offline: a VOID not
consuming the retry, two misses terminating, the leak grep short-circuiting
before the judge, the bar prompt never containing the artifact path, the
calibration critic being byte-identical to a deployed one and not told it is
a trial, round 2 spawning fresh.

Verified falsifiable against four built mutations rather than by reading it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push
```

---

## Task 4: First real run, against an artifact with a known answer

The workflow is untested until it runs against real agents. Use `ralph-loop`'s Stop hook: this session established four defects in it **by executing the hook**, not by reading it, so a correct panel has something specific it ought to recover — and a miss is a real datum about sensitivity rather than an argument.

The artifact is 191 lines, so the run is cheap by panel standards.

**Files:**
- Create: `docs/runs/2026-08-23-ralph-stop-hook/verdict.md`

**Interfaces:**
- Consumes: everything above.
- Produces: the run record. No code depends on it.

- [ ] **Step 1: Make the scratch directory**

```bash
rm -rf /tmp/gauntlet-scratch && mkdir -p /tmp/gauntlet-scratch && ls -la /tmp/gauntlet-scratch
```

Expected: an empty directory. It must not be inside the artifact's tree or gate 7's isolation leaks through a sibling.

- [ ] **Step 2: Answer gates 0, 1 and 4 out loud**

These are not automated and the script will not do them. Record the answers in the verdict file later.

- Gate 0: a few tool calls already settled *some* of this artifact — that is exactly why it is the right target. The panel is not being asked to find the known defects; it is being measured on whether it does.
- Gate 1, in the required form: *one agent would miss X, because one agent Y.* If you cannot complete that sentence, the honest move is a width-1 run (`lenses: 2`, treat the second as uncalibrated).
- Gate 4: a number. This is a harness acceptance test on a 191-line file; anything above ~300k means stop and investigate rather than pay.

- [ ] **Step 3: Invoke the workflow**

Call the `Workflow` tool:

```
scriptPath: /home/th-yoo/z2/gauntlet-loop/skills/gauntlet-loop/gauntlet.js
args: {
  "artifact": "/home/th-yoo/.claude/plugins/marketplaces/claude-plugins-official/plugins/ralph-loop/hooks/stop-hook.sh",
  "scratch": "/tmp/gauntlet-scratch",
  "need": "A session hook that continues an agent loop until the task is genuinely complete, and stops when it is, without ending the loop for reasons that merely look like completion.",
  "lenses": [
    { "key": "termination", "lane": "what ends the loop, and whether every ending means what a reader would take it to mean" },
    { "key": "parsing", "lane": "the text extraction and comparison: what inputs reach the comparison, and what they reduce to" },
    { "key": "state", "lane": "the state file as an authority: who can write it, what happens on malformed input, what survives a crash" },
    { "key": "docs", "lane": "whether the operator-facing text matches what the code does" }
  ],
  "calibratedLens": "parsing"
}
```

`need` is supplied by the operator on purpose — gate 2 has read the artifact, and anything it writes risks carrying the artifact's framing into a bar meant to be independent of it.

`parsing` is the calibrated lens because that is where a miss is most expensive: the promise extraction is the only thing standing between "the model said it is done" and "the loop ended".

- [ ] **Step 4: Check the run against the known answer**

The known defects, each established by executing the hook:

| # | defect | evidence |
|---|---|---|
| 1 | the perl at `:133` discards context around the first `<promise>` tag, and no-match leaves the whole block as the comparand — so a prose mention, a bare utterance, or an explicit refusal all terminate the loop | reproduced end-to-end, three inputs |
| 2 | zero-flag form has no designed stop: `MAX_ITERATIONS=0` skips the cap via its own `-gt 0` at `:61`, `COMPLETION_PROMISE="null"` skips the promise block at `:129` | a correctly tagged promise was ignored |
| 3 | `rm "$RALPH_STATE_FILE"` at 9 of 12 exits; only `:139` is completion, so absence of the file means the loop ended, not that the task finished | enumerated |
| 4 | `setup-ralph-loop.sh:167` says the loop "cannot be stopped manually"; `cancel-ralph.md:3` ships exactly that stop | both quoted |

Defect 1 is in the calibrated `parsing` lane and is the one this run is really testing. **A run that does not surface defect 1 has a real miss.** Record it either way — a miss here is the first measurement of this workflow's sensitivity and is more informative than a pass.

Note honestly: defects 3 and 4 are *internal contradictions*, which the anchor rule admits only via TRACE. If critics file them with a HARNESS anchor they are correct; if they file them by reading the file back at itself the verifier should mark them NOT-GROUNDED. Either outcome is informative about the anchor rule, not about ralph.

- [ ] **Step 5: Check the properties prose could not enforce**

Against the returned object:

- `result.bar.text` contains no substring of `args.artifact`
- `result.calibration.caveat` states `3-of-4 lenses uncalibrated`
- `result.enforced` and `result.not_enforced` are both present and non-empty
- the run spawned agents of the restricted types, not `general-purpose`

- [ ] **Step 6: Write the run record**

Create `docs/runs/2026-08-23-ralph-stop-hook/verdict.md` containing: the verbatim invocation, the gate 0/1/4 answers from Step 2, spawn count, token cost, the calibration outcome (`CALIBRATED` / `NO VERDICT` and the void/miss counts), whether defect 1 was recovered, which of Step 5's properties held, and every finding the panel filed with its grounding verdict.

If the run reached `NO VERDICT`, that is a result, not a failure — record the bar and need it returned so the rerun does not re-pay gate 5.

- [ ] **Step 7: Commit**

```bash
git add docs/runs/2026-08-23-ralph-stop-hook/verdict.md
git commit -m "docs(runs): first real gauntlet run — ralph-loop stop-hook.sh

First end-to-end execution of the panel. Target chosen because four of its
defects were established by executing it, so the panel had a known answer to
be measured against rather than an argument to have.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push
```

---

## Task 5: Hand the roster to the script

`SKILL.md` is 2232 words and still carries the agent roster as a markdown table. The script owns the roster now, and a roster in two places drifts. This is the source plan's T5, deferred until the script was proven because trimming prose whose replacement does not work is how a capability gets lost.

**Files:**
- Modify: `skills/gauntlet-loop/SKILL.md` (the `Roster` table and the paragraph beginning `Full run ≈ 9–13 spawns`)

**Interfaces:**
- Consumes: Task 4 must have produced a run record showing the script works. Do not run this task before that.
- Produces: nothing.

- [ ] **Step 1: Record the starting count**

```bash
cd /home/th-yoo/z2/gauntlet-loop && wc -w skills/gauntlet-loop/SKILL.md
```

Expected: `2232`. Write the number down for the commit message.

- [ ] **Step 2: Replace the roster table with a pointer**

Delete the markdown table listing agents 1–13 and the paragraph beginning `Full run ≈ 9–13 spawns`, and put in their place:

```markdown
**Roster and mechanics: `gauntlet.js`, run it with the `Workflow` tool.** It owns
the phase order, the prompts and the schemas, so the parts prose cannot enforce
are enforced: the bar writer runs as an agent type with no file tools and so
cannot open the artifact (gate 5), the seeder never receives the critic prompt
(gate 7), critics carry no `Agent`/`ListAgents`/`SendMessage` and so cannot reach
each other, and the gate-7 leak check is a literal string match rather than
someone remembering to look.

Two counts worth carrying in your head anyway: a full run is ~9–13 spawns — that
is what 1.1M buys — and **gate 1's width-1 refusal is ~3 spawns, not zero. Only
gate 0 refuses to zero agents.**
```

- [ ] **Step 3: Confirm it got shorter**

```bash
wc -w skills/gauntlet-loop/SKILL.md
```

Expected: below 2232. This does not reach the <500 guideline and is not claimed to — the gates are the remaining bulk, and cutting those is a decision about which rules to drop, not an edit.

- [ ] **Step 4: Drift guard**

```bash
node test/run-all.mjs
```

Expected: exit 0. If the gate-semantics pins fail, a sentence the guard depends on was inside the deleted block — restore that sentence rather than weakening the guard.

- [ ] **Step 5: Commit**

```bash
git add skills/gauntlet-loop/SKILL.md
git commit -m "docs(skills): gauntlet-loop hands the roster to the workflow

The roster went into prose when the file had no executable half. It has one
now, and a roster in two places drifts. The prose keeps the two counts an
operator needs while deciding (full run ~9-13 spawns; width-1 is ~3, not
zero) and hands the rest to gauntlet.js.

Word delta: 2232 -> NNN (fill in from Step 3).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push
```

---

## Self-Review

**Spec coverage.** The outstanding items at the end of the build were: (a) agent-type namespace unverified → Task 1; (b) tool allowlists unverified after packaging → Task 1 Step 5; (c) interface drift from the source plan's T6 → Task 2; (d) orchestration never executed → Task 3; (e) panel never run end to end → Task 4; (f) source plan T5 unapplied → Task 5. Source plan T1–T4 landed before publication (`SKILL.md` authority rules, drift note in README, `gauntlet.js`, `drift-guard.mjs`). Source plan T6's exact invocation is deliberately **not** reused: it names `/Users/yoo/...` paths that do not exist on this host, and its `symptom`/`ruledOut` args are not in this implementation's contract.

**Placeholder scan.** Two deliberate blanks, both filled from a measurement taken in the same task: Task 5's commit message `NNN` from its own Step 3, and Task 1 Step 4 which is conditional on Step 3's observation. Every other step carries literal content. No "add error handling", no "similar to Task N".

**Commands checked against the source, not assumed.** Every `sed` target and asserted label in Task 3 was grepped against `gauntlet.js` before this plan was saved. Two defects were found and fixed rather than shipped:

1. The leak test originally supplied two seeds, which let attempt 2 pass and the judge be called — so its `judgeCalls === 0` assertion would have failed against correct code. Now one seed, terminating at two VOIDs.
2. M4's mutation matched on `${n}` in the prompt text; GNU grep and sed read `{n}` as an interval quantifier and the pattern silently misses, so the mutation would have "passed" by never applying. It now targets `seed.seeded_path` (line 345 only, never the deployed call at line 446) and greps to confirm it applied.

Each of the four mutations was traced to the specific assertion it breaks: M1 → `calibration.misses === 0`; M2 → `!barCall.prompt.includes(artifact)`; M3 → `verdict === 'NO VERDICT'` in the leak test; M4 → the byte-identity `eq`.

**Type consistency.** `args.lenses` accepts `{key, lens?, lane?}` in Task 2's edit; Task 3's tests and Task 4's invocation both pass `{key, lane}`, which the edit maps via `l.lens || l.lane`. Labels asserted in Task 3 (`gate2:design`, `gate5:blind-bar`, `gate7:seeder-N`, `gate7:judge-N`, `gate7:critic-N`, `critic:<key>`, `round2:<key>`) are the exact strings `gauntlet.js` passes as `opts.label`. `runGauntlet` returns `{result, prompts, labels}` in Task 3 Step 1 and is destructured that way in every test. `result.calibration.{lens,voids,misses,caveat}` and `result.round1[].lens` match the verdict object the script returns.

**Known gap this plan does not close.** Task 3 tests the orchestration against stubs, so it cannot catch a prompt that is well-formed but produces bad reviews. Only Task 4 touches that, at n=1. The sensitivity of this panel remains unmeasured after this plan; Task 4 produces the first datum, not a rate.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-23-gauntlet-first-run.md`. Two execution options:

**1. Subagent-Driven (recommended)** — a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Note: Task 1 Steps 1–3 need the interactive `/plugin` commands and `ListAgents` from a session, so that task cannot be fully delegated to a subagent regardless of choice.
