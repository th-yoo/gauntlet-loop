# gauntlet-loop

Matt Shumer's Gauntlet Loop, implemented from the primary source as an executable
`Workflow` script: **a builder, a fresh blind critic per round, one gap back each
time, and no round cap.**

The method is his — *Gauntlet Loop*, somethingbig.ai/gauntlet-loop, 2026-07-27,
the prompt behind Claude of Duty. Both of his prompts are quoted verbatim in
`skills/gauntlet-loop/references.md`, with the sentence behind every claim made
here. The name is shared with several other public repositories that implement
the same method.

## What is here

- `skills/gauntlet-loop/loop.js` — the loop. A builder plus **k** fresh blind A/B
  critics per round, judged against a required reference exemplar, one gap handed
  back each round. The candidate must get past **every** critic in a single round
  to end the run.
- `skills/gauntlet-loop/SKILL.md` — when to reach for it, how to run it, how to
  choose the line length, and what it does not do.
- `skills/gauntlet-loop/references.md` — both source prompts in full.
- `agents/` — the three restricted agent types the loop spawns. This is where
  independence stops being a promise.
- `commands/` — `/gauntlet-loop:loop` to start, `/gauntlet-loop:cancel-loop` to stop.
- `scripts/canary.mjs` — generates a provably false anchor from a true one, so a
  reviewer's specificity can be measured without a human writing the fake.
- `test/` — drift guard, the offline loop harness, and the canary tests.

## What is actually enforced

Prose asks; a tool allowlist forbids. Each of these is a property a run **cannot
lose**, rather than one the operator remembers to add — and `test/drift-guard.mjs`
asserts each agent definition still lacks the tools the verdict says it lacks,
because without that assertion adding a tool back silently turns a property into a
promise while the verdict keeps printing the old claim.

| role | denied | property bought |
|---|---|---|
| `gauntlet-ab-critic` | `Write` `Edit` | no file-editing tool call can alter either artifact |
| `gauntlet-ab-critic` | `Agent` `ListAgents` `SendMessage` | cannot reach the builder or another critic |
| `gauntlet-builder` | `Agent` `ListAgents` `SendMessage` | cannot spawn or message the judge |
| `gauntlet-breaker` | everything except `Bash` | reports whether one file exists; never sees the goal, the artifacts, or a verdict |

`Bash` is not closed on the critic, and the run says so in `not_enforced`. Critics
have used it to identify which artifact is ours by diffing against the filesystem.
The property above is real and narrow.

## What every run reports about itself

`enforced` and `not_enforced`, computed from that run rather than written once.
The blindness claim is **withheld** when the two artifact paths are not comparable,
and replaced by a disclosure that this run's A/B was not blind. Each disclosure
string is pinned by a test, so an inconvenient limitation cannot be quietly
deleted.

## What it does not do

- **No decomposition.** His width comes from splitting the goal into pieces, each
  with its own builder and critic; this judges one artifact whole.
- **No ratchet.** The builder edits in place. A bad round is permanent and the
  loop holds no prior version — a Workflow script has no filesystem, so both the
  snapshot and the restore would be spawned-agent actions it cannot verify.
- **k critics on one piece is ours, not his.** Both source texts say one critic
  per piece, singular. It is disclosed in every run rather than presented as
  fidelity.

## Testing

```
node test/run-all.mjs
```

Drift guard, the loop suite, and the canary suite. The loop suite runs `loop.js`
against a stubbed agent runtime, so it proves the control flow — the exit rule,
the escalation, the split positions, the halt paths, the verdict shape — behaves
as the file's own comments claim. It proves nothing about whether a real critic
given the real prompt produces a good verdict: every `agent()` call in the tests
is a lookup table, not a model.

Every guard here has been checked by building the input that should break it. One
of those mutations passed, and the mutation turned out to be malformed rather than
the guard blind — so "the check held" is not a result until the input is confirmed
changed.
