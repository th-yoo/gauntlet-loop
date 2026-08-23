# gauntlet-loop

Gates that decide whether a multi-agent review should run **at all**, and an
executable panel for when it should.

Split along the line that matters: **judgment stays prose, mechanism became code.**

- `skills/gauntlet-loop/SKILL.md` — gates 0–7. Gates **0, 1 and 4 are operator-run
  and stay prose**, because only the operator knows what being wrong costs. A
  workflow that picks its own cost ceiling is the improvised-panel failure with
  extra steps.
- `skills/gauntlet-loop/gauntlet.js` — everything from gate 2 on, as a `Workflow`
  script: blind bar, two-armed calibration, lens critics, grounding verifier,
  terminal cross-check with a tallied margin, an optional blind A/B against a
  reference exemplar, and a durable run report.
- `skills/gauntlet-loop/critic-prompt.md` — the prompt authority. `gauntlet.js`
  carries the contract inline because Workflow scripts cannot read files, so
  `test/drift-guard.mjs` pins the two together.
- `agents/*.md` — restricted agent types. This is where independence stops being a
  promise.
- `commands/gauntlet.md` — `/gauntlet <artifact>`.

## What is actually enforced

Prose asks; a tool allowlist forbids. Each of these is a property the run **cannot
lose**, rather than one the operator remembers to add:

| role | denied tools | property bought |
|---|---|---|
| `gauntlet-bar-writer` | `Read` `Grep` `Glob` `Bash` | cannot open the artifact — gate 5 |
| `gauntlet-critic` | `Agent` `ListAgents` `SendMessage` | cannot discover or address a peer critic |
| `gauntlet-critic` | `Write` `Edit` | no file-editing tool call can alter the artifact (Bash is not closed — see below) |
| `gauntlet-verifier` | `Agent` `ListAgents` `SendMessage` | cannot delegate its own checking |
| `gauntlet-judge` | `Read` `Grep` `Glob` `Bash` `Agent` | cannot form its own opinion of the artifact and grade the critic against that |
| `gauntlet-isolator` | `Agent` `SendMessage` `WebSearch` `WebFetch` | cannot tell a comparing critic which side is ours |
| `gauntlet-reporter` | `Read` `Grep` `Glob` `Bash` `Agent` | can only write down what the run handed it |

Plus, in code rather than judgment:

- the gate-7 leak check is a literal string match over the critic's output, and a
  plant that leaves no string long enough to grep **VOIDs** rather than passing
  quietly — a hole becomes a halt;
- VOID and MISS are counted separately, so only a MISS consumes the retry **and
  only a MISS burns a defect kind**;
- **gate 7 has two arms.** The planted defect measures sensitivity. A control
  critic then runs the identical prompt over a clean copy carrying the identical
  isolation treatment; if it files the same claim at the same site with nothing
  wrong there, the catch measured a habit and is discarded. A catch that its own
  control reproduces is not evidence;
- **gate 6 is enforced.** Criteria that cannot fire in both directions are re-asked
  once, then dropped, and fewer than two survivors halts the run. A bar written
  blind is the likeliest place to find a criterion nothing can meet;
- cross-check outcomes are **tallied into a margin** by code, so a finding two
  lenses attacked and one defended does not read the same as one nobody touched;
- round 2 is a fresh `agent()` call, never a continuation.

**Where a reference exemplar exists, pass `args.reference`.** That opens the
compare lane: an isolator writes neutrally-named copies with identical treatment,
one critic per lens picks a winner blind with no tie available, and the votes are
tallied. This is the source method's own mechanism, and it is better evidence than
a criteria bar — the critic never has to invent a threshold. The gates exist for
artifacts that have no exemplar, not as a substitute for one that does.

## What is NOT enforced

Reported verbatim in every verdict under `not_enforced`. The seeder holds `Read` and
could go find the critic prompt. Seeded-copy isolation is best-effort — if the
removed text is recallable from a model's prior, no sandbox closes that channel and
a tighter re-run yields a *false pass*. `n=1` per calibrated lens. Critics share a
model family unless you vary it, and judge-panel correlation is measured **across**
families — varying only the lens does not buy independent votes.

Critics hold `Bash`, which is a general shell and can write files. "Critics cannot
alter the artifact" is therefore false as stated — the `Write`/`Edit` denial closes
the tool-call channel, not the shell. `Bash` stays: the `HARNESS` anchor type in
`critic-prompt.md` requires running commands, and it is load-bearing for the run's
best findings. Round-1 critics are all pointed at the same live artifact path
concurrently, so this is a disclosed exposure, not a theoretical one.

## Install

```
/plugin marketplace add th-yoo/gauntlet-loop
/plugin install gauntlet-loop@gauntlet-loop-local
```

Or from a local clone:

```
git clone https://github.com/th-yoo/gauntlet-loop
/plugin marketplace add ./gauntlet-loop
/plugin install gauntlet-loop@gauntlet-loop-local
```

If you previously symlinked this into `~/.claude/skills/`, **remove that symlink
after installing** or the skill registers twice.

## Test

```
node test/drift-guard.mjs
```

Pins the critic contract between `critic-prompt.md` and `gauntlet.js`, pins gate
semantics between `SKILL.md` and `gauntlet.js`, **asserts every agent allowlist
still denies what the verdict claims it denies**, and asserts gates 0/1/4 have not
leaked into the script. The allowlist assertions are what make the table above
testable rather than aspirational: grant `Read` back to the bar writer and the
suite fails by name. Verified falsifiable against six built mutations.

```
node test/smoke.mjs
```

Actually **executes** `gauntlet.js` — drift-guard never does. It loads the script
as text, wraps its body in an async function taking `(args, agent, parallel,
phase, log)` (the same shape the Workflow runtime injects), and drives it with a
stub `agent()` that returns a canned value keyed on `opts.label`. Three
scenarios: a happy path that reaches `COMPLETE`, a gate 6 halt (bar criteria that
never fire in both directions, even after the repair pass), and a gate 7 double
VOID (the seeder never produces a control copy) that must leave `misses === 0`
because a VOID must not consume the retry. This proves the script's control
flow — gate enforcement, the VOID-vs-MISS split, the margin tally, the verdict
shape — behaves as its own comments claim. It proves nothing about whether a
real agent, given the real prompts, produces well-formed output or catches a
real defect: every `agent()` call in this test is a lookup table, not a model.

## Provenance

The name is **Matt Shumer's** — *Gauntlet Loop*, somethingbig.ai/gauntlet-loop,
2026-07-27. That method is **split, build, judge, repeat**: a lead agent decomposes
a goal, each piece gets a BUILDER, and a fresh-context critic runs a **blind A/B
against a concrete reference exemplar**, looping until the candidate wins.

**This is a different instrument and inherits none of that method's evidence:**

| Shumer | here |
|---|---|
| builder + critic per piece | critics only, no builder |
| blind A/B vs a reference exemplar | frozen criteria + a gate-3 prior |
| loop until it wins; a fixed round count is named a failure mode | ≤2 rounds, terminal |
| no gate sequence | gates 0–7 in front |

The ≤2-round cap contradicts the source head-on. Take it as a cost decision, not as
the method. Where a reference exemplar exists, prefer the build lane — it is the
mode with a measured record, though that record is improvement under a bar it never
cleared: in Claude of Duty's own blind A/B, every critic in every round picked the
real reference. Note also that the name is contested: several public repos ship
`gauntlet-loop` as Shumer's build loop.

Both source prompts are quoted in full in `skills/gauntlet-loop/references.md`,
with the sentence behind every claim in the table above. Nothing here paraphrases
the source without one.
