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
  and the suite stayed green at a lower count — this is what sees that. **226 properties,
  0 unpinned.** Slow, so it is not part of `run-all`: run it after touching tests, on a
  tree you are not editing.
- `scripts/sweep-status.mjs` — prints the last sweep's conclusion at session start,
  wired as a `SessionStart` hook in `.claude/settings.json`. The sweep's findings
  otherwise stop at a run page nothing points at; of the three that have ever
  reached a person here, all three arrived inside a working session. It transports
  one bit — the run's conclusion is the only part of a sweep result fetchable from
  outside — and says so on every branch, including when it cannot reach the API at
  all. Remove the hook from `.claude/settings.json` to turn it off.
- `scripts/seed-loop-trial.mjs` — sets up a seeded-defect trial of the loop, and
  **refuses** to set one up whose answer is still readable from somewhere the
  builder can reach.
- `scripts/refusal-log.mjs`, `scripts/refusal-tally.mjs`, `runs/` — **historical.**
  They write and score a ledger keyed on the gate sequence (`gate0`, `gate1`,
  `gate4_number`), and the gates were deleted on this branch. Nothing in the loop
  calls them. Kept for the recorded data and for the argument in `runs/README.md`,
  which is about a gap the loop still has.
- `scripts/oracle-extract.mjs`, `scripts/oracle-add.mjs`, `scripts/oracle-record.mjs`,
  `scripts/oracle-pair.mjs`, `scripts/oracle-report.mjs`, `oracle/` — ground truth for
  the pairing check, from something other than an opinion. The pairing check can REFUSE a run, and it acquired
  that authority on two observations scored against predictions its own author wrote.
  A corpus row is only written when a shell command establishes it mechanically; every
  observation is pinned to a hash of the live prompt, so the change that silently
  invalidated five of seven earlier observations is refused at the door next time. The
  report says "cannot be posed" rather than printing a rate the sample cannot support.
  A **pairing** — two grounded artifacts under one goal — is the only thing that can
  observe the verdict that actually refuses a run, so the false-refusal rate is measured
  from drawn pairings rather than derived from the per-side rate under an independence
  assumption nothing measured.
- **The measurement instruments**, each with a gate `run-all` already runs and a
  mutation battery rather than a reading:
  - `scripts/detection-draw.mjs` / `detection-parse.mjs` — does the critic pick the
    undegraded artifact? **12/15 = 80%**, Wilson 95% CI 55–93%, **0/5** false alarms over
    twenty blinded trials. Published first as its exact complement, 17%, because the
    critic's `ARTIFACT` letter was compared against the directory the degraded bytes were
    staged under. Ledger `runs/detection.jsonl`, verdict in `docs/runs/`.
  - `scripts/builder-draw.mjs` / `builder-parse.mjs` — can the builder repair a defect
    whose answer is not reachable from the trial directory? On the **derivable** arm —
    where the original is reconstructible from the artifact's own contents — **8/12
    restored exactly, 9/12 located**. The other 18 trials are the leak detector: there the
    original is *not* reconstructible, so a repair is either a leak or a reconstruction
    the recoverability check missed, and every hit carries a recorded reading of which.
  - `scripts/defect-transforms.mjs` — the three plants both instruments use, in one copy,
    plus what is derivable from a plant: its size, its class, and whether a sealed note is
    something the transforms can still **produce** from its source. All 105 undrifted
    notes on file reproduce exactly; a note edited to agree with a ledger row does not.
  - `scripts/guard-sweep.mjs` — does each of drift-guard's 41 hand-written facts still
    bite? **41/41**, 0 redundant, recomputed every run rather than stored.
  - `scripts/plugin-version-check.mjs` — does `agents/` still match what the version in
    `plugin.json` shipped? The record is git, not a list: the tree at the commit that set
    the current version, diffed to the working tree. The plugin cache is version-pinned,
    so an agent swap without a bump reaches no install — 2548f55 did exactly that and every
    installed copy died at the first spawn for six commits (#68).
  - `scripts/side-by-side.mjs` — renders two artifacts through that same probe, at the same
    window and with the same key sequence, into ONE image. It exists for decision 0008's
    crossing and is NOT wired into the loop: the loop fixes the viewport and leaves keys,
    strategies and inspection depth to each critic, and this is the apparatus for asking
    whether holding those constant moves a verdict. Running it is not evidence that it does.
  - `scripts/play.mjs` — the headless probe a critic uses to look at a RUNNING page rather
    than its source: serves the artifact over http, presses a warm-up and then the keys,
    and reports the screenshot, the page's title, whether the warm-up changed the screen,
    and every page error — observations, never a verdict. Each of its four live-run
    defects (#66) is a fixture page in `test/play.test.mjs` that requires the right report.
  - `scripts/capacity-check.mjs` — could the design have produced another answer? It asks
    the ledgers, not the prose, whether a field ever took a second value.
  - `scripts/disclosure-audit.mjs` — is each pinned disclosure **driven** by a behavioural
    test, or recorded as undrivable with the reason? **12 exercised, 7 adjudicated, 0
    unaccounted.**
  - `scripts/constructed-verify.mjs` — a pairing set whose answers nobody wrote: the role
    is derived by running the artifact, not by judging it.
  - `scripts/adjudications.mjs` — the three files above excuse what they cannot settle by
    recording a human reading with a reason. This makes the **lookup** mark a row spent,
    so an adjudication naming something that no longer exists is reported instead of
    counted. All three accepted such a row until it was built.
- **Both ledgers are re-derived from the evidence they came from**, not read back:
  every scored field in `runs/detection.jsonl` and `runs/builder.jsonl` is recomputed from
  the raw response, the artifact the builder left, and the sealed note, and a disagreement
  is a failure. Before that, flipping one `repaired` field moved a published figure from
  8/12 to 9/12 with the whole suite green.
- `test/` — drift guard, the offline loop harness, and the trial tests.
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
- **Regressions are measured, not reverted.** The builder copies the artifact before
  editing and one fresh critic says which version is closer to the goal, so a round that
  made things worse is named in the record (`regressed`) with the path of what it lost to.
  Nothing rolls back, and the reason has changed: it used to be that the critic's
  detection rate was a single observation. It is now measured at **12/15 = 80%**, and that
  argument is gone — but the interval runs 55% to 93%, the trials differ by one mechanical
  transform, and a wrong revert is quieter than a wrong refusal, which at least stops the
  run. Decided and recorded in `docs/decisions/0003-no-automatic-revert.md`: revert stays
  off, because the script cannot verify a revert and the verdict is one judge. The only
  run since the check shipped regressed 0/3; the first regressed round in a real run is
  what reopens it.
- **Code has been run once.** The routing description says "a document, a page, a
  design, a program"; seven runs on record were Markdown before the Tetris run
  (`docs/runs/2026-08-29-tetris/`), which is the one code candidate — three rounds, not
  converged, stopped by the operator. It answered two of issue 30's three questions: the
  lead splits code (on the goal's observable capabilities, not module boundaries) and the
  critic drives the running page rather than grading a summary. The third — what `wc -c`
  means on source — is answered by construction: the growth note reads the regression
  verdicts of the rounds that grew, and only calls growth bloat when a critic judged a
  round worse than the version it replaced. One run is one run; nothing here says the loop
  converges on code.
- **No options mode.** Issue 8 asked for a run output that presents options with their
  trade-offs and each one's falsifier when the evidence does not settle a decision. The
  configuration that would produce it went with the judge lane; the shape is this
  repository's decision-record convention instead (`docs/decisions/`, four records), and
  `test/decisions.test.mjs` fails any record that lacks its question, its decision, its
  declined alternatives, or what would reopen it. Decision 0004 says why.
- **k critics on one piece is ours, not his.** Both source texts say one critic
  per piece, singular. It is disclosed in every run rather than presented as
  fidelity.

## Testing

```
node test/run-all.mjs
```

That globs every `test/*.test.mjs` — 39 suites, and it is what CI runs. It covers the
drift guard, the offline loop harness, and every measurement instrument above.

The loop suite runs `loop.js` against a stubbed agent runtime, so it proves the control
flow — the exit rule, the escalation, the split positions, the halt paths, the verdict
shape — behaves as the file's own comments claim. It proves nothing about whether a real
critic given the real prompt produces a good verdict: every `agent()` call in the tests
is a lookup table, not a model.

`node scripts/coverage-sweep.mjs` is separate and slow: **226 properties**, and it runs
the whole suite once per property — 68 and 70 minutes on the runner for the last two
completed sweeps. Do not run it against a tree you are still editing: it applies each
mutation in place, so an edit made while it runs is either lost or committed by mistake.

Every guard here has been checked by building the input that should break it. One
of those mutations passed, and the mutation turned out to be malformed rather than
the guard blind — so "the check held" is not a result until the input is confirmed
changed.
