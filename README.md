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
  to end the run — and where a lead split the goal into pieces, every piece must
  win *and* the whole artifact must then beat the whole reference in one further
  blind A/B. A split whose parts all won while the whole loses is reported
  `SPLIT_UNSOUND`, not `WON`: the seam hid a gap no piece could see.
- `skills/gauntlet-loop/SKILL.md` — when to reach for it, how to run it, how to
  choose the line length, and what it does not do.
- `skills/gauntlet-loop/references.md` — both source prompts in full.
- `agents/` — the five restricted agent types the loop spawns. This is where
  independence stops being a promise.
- `commands/` — `/gauntlet-loop:loop` to start, `/gauntlet-loop:cancel-loop` to stop.
- `scripts/canary.mjs` — generates a provably false anchor from a true one, so a
  reviewer's specificity can be measured without a human writing the fake.
- `scripts/mutate.mjs` — applies one mutation, runs the suite, and reports whether
  anything noticed. Deciding whether a check *can fail* is how this repo decides
  whether it is a check at all, and doing that by hand went wrong repeatedly: a
  find string that never matched, a mutant that failed for a syntax error instead
  of the reason under test, and a grep for one failure message reported as a pass.
  The script refuses the first two and answers on the exit code.
- `scripts/coverage-sweep.mjs` — breaks each property a test is supposed to pin
  and reports anything nothing notices. A passing suite says the code is right; it
  does not say the tests would catch it going wrong, and those are different
  claims. A structural edit once removed four cases beyond the one being rewritten
  and the suite stayed green at a lower count — this is what sees that. Slow, so
  it is not part of `run-all`: run it after touching tests.
- `scripts/seed-loop-trial.mjs` — sets up a seeded-defect trial of the loop, and
  **refuses** to set one up whose answer is still readable from somewhere the
  builder can reach.
- `scripts/refusal-log.mjs`, `scripts/refusal-tally.mjs`, `runs/` — **historical.**
  They write and score a ledger keyed on the gate sequence (`gate0`, `gate1`,
  `gate4_number`), and the gates were deleted on this branch. Nothing in the loop
  calls them. Kept for the recorded data and for the argument in `runs/README.md`,
  which is about a gap the loop still has.
- `scripts/oracle-extract.mjs`, `scripts/oracle-add.mjs`, `scripts/oracle-record.mjs`,
  `scripts/oracle-report.mjs`, `oracle/` — ground truth for the pairing check, from
  something other than an opinion. The pairing check can REFUSE a run, and it acquired
  that authority on two observations scored against predictions its own author wrote.
  A corpus row is only written when a shell command establishes it mechanically; every
  observation is pinned to a hash of the live prompt, so the change that silently
  invalidated five of seven earlier observations is refused at the door next time. The
  report says "cannot be posed" rather than printing a rate the sample cannot support.
- `test/` — drift guard, the offline loop harness, and the canary and trial tests.
- `docs/runs/` — a record per live run: what was compared, what the verdict was,
  and what it does **not** establish. This is the only evidence here about whether
  the method works, and it is written to be read against the claims above rather
  than in place of them — including the runs that invalidated things this repo
  had previously asserted.

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

Closing `Bash` is not the answer — it is the same capability that makes these
critics run test suites and resolve citations instead of skimming. So the leak is
measured rather than prevented: a blindness probe (a `gauntlet-goal-check` spawn)
reads both artifacts before any critic spawns and reports whether either one says where it came from. When it does,
the run **withholds** its blindness claim rather than asserting a property it does
not have — the same thing already done when the two `ARTIFACT` lines render in
different shapes. A clean probe result can withdraw that claim, never strengthen it.

## What every run reports about itself

`enforced` and `not_enforced`, computed from that run rather than written once.
The blindness claim is **withheld** when the two artifact paths are not comparable,
and replaced by a disclosure that this run's A/B was not blind. Each disclosure
string is pinned by a test, so an inconvenient limitation cannot be quietly
deleted.

## What it does not do

- **No live progress page.** His meta-prompt asks the lead to maintain one as the
  work evolves; this reports once, at the end, in the verdict.
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
