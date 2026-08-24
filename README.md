# gauntlet-loop

**Two instruments. Read this table before reading anything else — reviewers have
described one of them and drawn conclusions about the other.**

| | `loop.js` — the loop | `gauntlet.js` — the panel |
|---|---|---|
| what it is | Matt Shumer's Gauntlet Loop, built from the primary source | a review panel; **not** the source method |
| builder | **yes** — it edits the artifact every round | **none**. It judges; it never builds |
| reference exemplar | **required** — it throws without one | optional; the judge lane exists for artifacts that have none |
| iterates | **yes, uncapped** — until the candidate wins, you cancel, or the budget runs out | **no**. One pass, ≤2 rounds, terminal |
| judges | k fresh blind A/B critics per round (`args.critics`, default 1) | 2–4 lens critics plus a grounding verifier |
| reach for it when | you have a concrete better thing and want to close the gap to it | you have something to review and nothing to compare it against |

`loop.js` is the instrument the plugin is named after and the one with a track
record outside this repo — the method has been widely adopted since July 2026.
`gauntlet.js` is this repository's own addition and carries none of that
evidence. Do not read a claim about one as a claim about the other.

Split along the line that matters: **judgment stays prose, mechanism became code.**

- `skills/gauntlet-loop/loop.js` — the loop. A builder plus **k** fresh blind A/B
  critics per round, judged against a concrete reference exemplar, one gap handed
  back each round. The candidate must get past **every** critic in a single round
  to exit; `args.critics` sets how many, default 1. **No round cap** — it runs
  until the candidate wins, the operator removes the run token, or a pre-committed
  budget runs out. Commands: `/gauntlet-loop:loop` to start,
  `/gauntlet-loop:cancel-loop` to stop.
- `skills/gauntlet-loop/SKILL.md` — gates 0–7, for the panel. Gates **0, 1 and 4
  are operator-run and stay prose**, because only the operator knows what being
  wrong costs. A workflow that picks its own cost ceiling is the improvised-panel
  failure with extra steps.
- `skills/gauntlet-loop/gauntlet.js` — the panel: everything from gate 2 on, as a
  `Workflow` script — blind bar, two-armed calibration, lens critics, grounding
  verifier, terminal cross-check with a tallied margin, an optional blind A/B
  against a reference exemplar, and a durable run report.
- `skills/gauntlet-loop/references.md` — both of Shumer's prompts, verbatim, and
  the sentence behind every claim this repo makes about his method.
- `skills/gauntlet-loop/critic-prompt.md` — the prompt authority. `gauntlet.js`
  carries the contract inline because Workflow scripts cannot read files, so
  `test/drift-guard.mjs` pins the two together.
- `agents/*.md` — restricted agent types. This is where independence stops being a
  promise. Includes `gauntlet-ab-critic` and `gauntlet-builder`, used by `loop.js`.
- `commands/` — `/gauntlet <artifact>` for the panel; `/gauntlet-loop:loop` and
  `/gauntlet-loop:cancel-loop` for the loop.

## What is actually enforced

Prose asks; a tool allowlist forbids. Each of these is a property the run **cannot
lose**, rather than one the operator remembers to add:

| role | denied tools | property bought |
|---|---|---|
| `gauntlet-bar-writer` | `Read` `Grep` `Glob` `Bash` | cannot open the artifact — gate 5 |
| `gauntlet-critic` | `Agent` `ListAgents` `SendMessage` | cannot spawn, enumerate or message a peer critic (Bash is not closed — see below) |
| `gauntlet-critic` | `Write` `Edit` | no file-editing tool call can alter the artifact (Bash is not closed — see below) |
| `gauntlet-verifier` | `Agent` `ListAgents` `SendMessage` | cannot delegate its own checking |
| `gauntlet-seeder` | `WebSearch` `WebFetch` `Agent` `ListAgents` `SendMessage` | cannot look the artifact up over the network to plant a defect the critic recalls rather than detects |
| `gauntlet-judge` | `Read` `Grep` `Glob` `Bash` `Agent` | cannot form its own opinion of the artifact and grade the critic against that |
| `gauntlet-isolator` | `Agent` `SendMessage` `WebSearch` `WebFetch` | cannot tell a comparing critic which side is ours |
| `gauntlet-reporter` | `Read` `Grep` `Glob` `Bash` `Agent` | can only write down what the run handed it |
| `gauntlet-ab-critic` (loop.js) | `Agent` `ListAgents` `SendMessage` `Write` `Edit` | cannot reach the builder or a peer, and no file-editing tool call can alter either artifact (Bash is not closed — see below) |
| `gauntlet-builder` (loop.js) | `Agent` `ListAgents` `SendMessage` | cannot spawn or reach a critic |
| `gauntlet-breaker` (loop.js) | everything except `Bash` | the run's stop signal is read by a party that never sees the goal, either artifact, or any verdict |

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

That same shell is a peer channel and a discovery channel. Round-1 critics run
concurrently on one machine: the filesystem is readable and writable between them,
and `ps` lists them. "Cannot reach a peer critic" is bought against the
agent-messaging channel only. Lens independence past that point is asked of the
critic in `agents/gauntlet-critic.md`, not enforced against it.

The seeded copy, its control, and the blind A/B pair are separated by **path, not
permission**. Each lives outside the others' tree — by default in siblings of
`args.scratch` — so nothing a critic is pointed at lists the copy it must not see.
A critic that walks a level higher still reaches it.

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

Six families of check. It pins the critic contract between `critic-prompt.md` and
`gauntlet.js`; pins gate semantics between `SKILL.md` and `gauntlet.js`; **asserts
all seven agent allowlists still deny what the verdict claims they deny**; asserts
the `not_enforced` disclosures still appear verbatim in the script, because a
disclosure that can be deleted without failing a test is not a disclosure; asserts
every `AT` map value is still namespaced `gauntlet-loop:`, since a bare name would
fail to resolve and silently turn a restricted spawn into one that never runs; and
asserts gates 0/1/4 have not leaked into the script. The allowlist assertions are
what make the table above testable rather than aspirational: grant `Read` back to
the bar writer and the suite fails by name.

Verified falsifiable against **twelve built mutations** — one per allowlist row,
plus one per remaining family (a reworded disclosure, a de-namespaced `AT` value, a
renamed contract element, a gate terminator no longer literal in the script, and a
`costCeiling` planted in it). All twelve go red; the count is the number actually
run, not the number of things that could be mutated.

```
node test/smoke.mjs
```

Actually **executes** `gauntlet.js` — drift-guard never does. It loads the script
as text, wraps its body in an async function taking `(args, agent, parallel,
phase, log)` (the same shape the Workflow runtime injects), and drives it with a
stub `agent()` that returns a canned value keyed on `opts.label`. Five scenarios:
a happy path that reaches `COMPLETE`; a gate 6 halt (bar criteria that never fire
in both directions, even after the repair pass); a gate 7 double VOID (the seeder
never produces a control copy) that must leave `misses === 0` because a VOID must
not consume the retry; a gate 7 double MISS — the mirror image — that must reach
`NO VERDICT` with `misses === 2` and `voids === 0`, and whose retry prompt must
name the spent defect kind; and a round-1 halt where every critic returns empty,
which must still write its report. The stub also asserts that **every dispatched
call carries a restricted `agentType`** from the script's own `AT` map, with the
gate-2 designer as the one documented exception — without that assertion, deleting
the restriction from a spawn leaves both suites green.

This proves the script's control flow — gate enforcement, the VOID-vs-MISS split,
the margin tally, the halt paths, the verdict shape — behaves as its own comments
claim. It proves nothing about whether a real agent, given the real prompts,
produces well-formed output or catches a real defect: every `agent()` call in this
test is a lookup table, not a model.

## Provenance

The name is **Matt Shumer's** — *Gauntlet Loop*, somethingbig.ai/gauntlet-loop,
2026-07-27. That method is **split, build, judge, repeat**: a lead agent decomposes
a goal, each piece gets a BUILDER, and a fresh-context critic runs a **blind A/B
against a concrete reference exemplar**, looping until the candidate wins.

**Which of the two instruments you are comparing decides the answer, and this
table used to say "here" as though there were one.** It was written before
`loop.js` existed and is scoped now.

| Shumer's method | `loop.js` | `gauntlet.js` |
|---|---|---|
| builder + critic per piece | builder + critic per round | **critics only, no builder** |
| blind A/B vs a reference exemplar | blind A/B vs a required reference exemplar | frozen criteria + a gate-3 prior; A/B only if an exemplar exists |
| loop until it wins; a fixed round count is named a failure mode | loops until it wins, you cancel, or the budget runs out — no cap, enforced by a test | **≤2 rounds, terminal** |
| one critic per piece; width comes from decomposing the goal | k critics per round, unanimous exit — **an addition**, see below | 2–4 lens critics, findings unioned |
| no gate sequence | no gate sequence | gates 0–7 in front |

`gauntlet.js` inherits none of that method's evidence, and never claimed to.
`loop.js` implements the method's mechanism and departs from it in two places
that are stated rather than hidden:

- **No decomposition.** Shumer's width comes from splitting the goal — eleven
  subsystems, eleven critics. `loop.js` judges one artifact whole. Open as #17.
- **k critics on one piece.** Both of his texts say "a separate sub-agent" and "a
  separate critic", singular, per piece. Stacking judges on one piece is ours,
  adopted because our artifacts do not decompose the way a game does, and
  disclosed in every run's `not_enforced` rather than presented as fidelity.

The ≤2-round cap contradicts the source head-on. Take it as a cost decision, not as
the method. Where a reference exemplar exists, prefer the build lane —
`skills/gauntlet-loop/loop.js` in this repo — it is the mode with a measured record,
though that record is improvement under a bar it never cleared: in Claude of Duty's
own blind A/B, every critic in every round picked the real reference. Note also that
the name is contested: several public repos ship `gauntlet-loop` as Shumer's build
loop.

Both source prompts are quoted in full in `skills/gauntlet-loop/references.md`,
with the sentence behind every claim in the table above. Nothing here paraphrases
the source without one.
