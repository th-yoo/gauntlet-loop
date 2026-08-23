# gauntlet-loop

Gates that decide whether a multi-agent review should run **at all**, and an
executable panel for when it should.

Split along the line that matters: **judgment stays prose, mechanism became code.**

- `skills/gauntlet-loop/SKILL.md` — gates 0–7. Gates **0, 1 and 4 are operator-run
  and stay prose**, because only the operator knows what being wrong costs. A
  workflow that picks its own cost ceiling is the improvised-panel failure with
  extra steps.
- `skills/gauntlet-loop/gauntlet.js` — everything from gate 2 on, as a `Workflow`
  script: blind bar, seeded-defect calibration, lens critics, grounding verifier,
  terminal cross-check.
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
| `gauntlet-critic` | `Write` `Edit` | cannot alter what the others are reading |
| `gauntlet-verifier` | `Agent` `ListAgents` `SendMessage` | cannot delegate its own checking |

Plus, in code rather than judgment: the gate-7 leak check is a literal string match
over the critic's output; VOID and MISS are counted separately so only a MISS
consumes the retry; round 2 is a fresh `agent()` call, never a continuation.

## What is NOT enforced

Reported verbatim in every verdict under `not_enforced`. The seeder holds `Read` and
could go find the critic prompt. Seeded-copy isolation is best-effort — if the
removed text is recallable from a model's prior, no sandbox closes that channel and
a tighter re-run yields a *false pass*. `n=1` per calibrated lens. Critics share a
model family unless you vary it, and judge-panel correlation is measured **across**
families — varying only the lens does not buy independent votes.

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
semantics between `SKILL.md` and `gauntlet.js`, and asserts gates 0/1/4 have not
leaked into the script. Verified falsifiable against four built mutations.

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
mode with the track record. Note also that the name is contested: several public
repos ship `gauntlet-loop` as Shumer's build loop.

`docs/2026-08-01-gauntlet-adoption-loop.md` is the adaptation this skill grew out of
and the authority `SKILL.md` cites for four properties: frozen bars, ≤2 rounds
terminal, fresh-context critics per round, builder never grades itself.

That program self-applied the method to four mechanism transplants and produced
**0 merges, 2 drops, 1 open, 2 deferred**. The primitives survived as process —
fresh critics caught real defects in both loops — and every mechanism they judged
was rejected by its own pre-registered bar. Read that as the honest prior: this
tooling is good at killing proposals, and has not yet been shown to be good at
promoting them.
