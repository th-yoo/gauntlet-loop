# Overnight autonomous research loop

You are the agent running this project's autonomous research loop. This
file is your standing instructions. Read it fully before doing anything,
and re-read the "Non-negotiable constraints" section before every single
experiment — it is short, and violating any line in it invalidates the
whole night's comparisons, not just one experiment.

## Objective

Minimize `val_bpb` (validation bits-per-byte; lower is better) on a fixed
single-GPU training setup, within a fixed 5-minute wall-clock training
budget per experiment, by iteratively editing one file and measuring the
result.

## Non-negotiable constraints

- **Only edit the training file (`train.py`).** The data-preparation file
  (`prepare.py`) is fixed and one-time; it defines the tokenizer,
  vocabulary size, sequence length, and evaluation set size that every
  experiment tonight is being compared against. Editing it — even by
  accident — makes tonight's `val_bpb` numbers incomparable to each other
  and to the baseline, which defeats the entire point of the loop.
- **The training budget is fixed at 5 minutes of wall clock, excluding
  startup/compilation.** Do not shorten it to iterate faster and do not
  lengthen it to "give an idea more of a chance" — every experiment must
  be run under the same budget or comparisons across experiments are
  meaningless. `run_experiment.sh` already runs the training file exactly
  as it stands; it does not add or remove time on your behalf.
- **`val_bpb` is the only metric that decides keep vs. discard.** It is
  lower-is-better and vocab-size-independent, which is what makes it valid
  to compare across experiments that change the model's architecture. Do
  not substitute training loss, throughput, or any other number as the
  decision criterion, even if it looks more favorable for a change you
  want to keep.
- **One change per experiment.** Bundling multiple edits into one
  training-file diff makes it impossible to tell which part of the change
  drove the result, and the loop can only keep or discard the diff as a
  whole.
- **Never hand-edit the log or the state file.** `autoresearch_logs/experiments.jsonl`
  and `autoresearch_logs/state.json` are written exclusively by
  `orchestrator.py`. If either looks wrong, that is a signal to
  investigate, not to patch by hand — a hand-patched log is no longer
  something anyone (including you, tomorrow) can trust.

## One-time setup, before the loop starts

Confirm every item in `PREFLIGHT_CHECKLIST.md` is checked. If it is not,
stop and do that first — do not attempt to "fix setup issues" inside the
loop itself, since a broken environment will fail every experiment
identically and burn the whole night on repeats of the same crash.

Then, exactly once:

```
uv run orchestrator.py init
```

This snapshots the current training file as the starting baseline. It
will refuse to run a second time on purpose, so accidentally running it
mid-loop cannot wipe out progress.

## The experiment cycle

Repeat this cycle until the stopping condition (below) says to stop:

1. **Check whether to continue** before starting new work:
   ```
   uv run orchestrator.py should-continue --max-hours <H> --max-experiments <N>
   ```
   If it prints `stop`, go to "End of run" below instead of starting
   another experiment.

2. **Pick one hypothesis.** Use `hyperparameter_space.md` as a starting
   menu, but you are not limited to it — anything in the training file is
   fair game (model architecture, optimizer, batch size, etc.), except
   the two knobs called out there as living in the fixed data-preparation
   file, which are out of reach for this loop.

3. **Edit the training file** to implement exactly that one hypothesis.
   Do not also make unrelated cleanups, refactors, or "while I'm here"
   changes in the same round — save those for a round where they are the
   hypothesis being tested, or don't make them at all if they don't
   change behavior.

4. **Run and score the experiment:**
   ```
   uv run orchestrator.py record --hypothesis "<one-line description of what you just changed>"
   ```
   This runs the fixed 5-minute training budget, scrapes `val_bpb` from
   its output, compares it to the current best, keeps the training file
   if it improved and reverts it to the previous best automatically if it
   did not, and appends the full record to the log. You do not need to
   (and should not) implement any of that bookkeeping yourself — it is
   handled mechanically so it is exact every time, not "usually right."

5. **Read the printed result.** If `status` is not `"ok"`, the run
   crashed or its output didn't contain a recognizable `val_bpb` — do not
   count this as a real negative result for the hypothesis being tested;
   diagnose the failure (using `raw_log`) before spending another
   experiment slot on a variant of the same idea. A crash tells you
   nothing about whether the idea was good.

6. Go back to step 1.

## Stopping conditions

Before the loop starts, a time budget and/or an experiment-count budget
should be decided (this belongs in the preflight step, not chosen ad hoc
mid-run). At roughly 12 experiments/hour under the fixed 5-minute budget,
an 8-hour overnight window is on the order of 100 experiments — use that
as a planning number, not a target to force by cutting the per-experiment
budget short.

`should-continue` is the single source of truth for whether to keep
going. If it says `stop`, stop — do not keep running "just one more" on
your own judgment, since that is exactly the kind of silent scope
expansion that makes a night's results non-reproducible.

## End of run

When `should-continue` says `stop`:

```
uv run orchestrator.py report
```

Report its output as-is: number of experiments run, number kept, best
`val_bpb` reached, and the log file location. The training file left on
disk is, by construction, the best-known version — every discarded
experiment was already reverted the moment it was scored, so there is no
separate "pick the winner" step at the end of the night.

## What "done" looks like in the morning

A completed run leaves behind:

- the training file, containing whichever kept changes actually improved
  `val_bpb` over the course of the night, in their final composed form;
- `autoresearch_logs/experiments.jsonl`, a complete line-by-line trail of
  every hypothesis tried, whether it was kept or reverted, and the metric
  that decided it (see `experiment_log_schema.md` for the exact fields);
- `autoresearch_logs/state.json`, the small running summary the loop uses
  to know the current best and how far along it is;
- one raw training log per experiment, for anyone who wants to look past
  the single scraped number at what the run actually printed.

Nothing about this design assumes the night's result is good — only that
it is legible: any single kept-or-reverted decision in the log can be
checked against the `val_bpb` number in that same line and the previous
line's running best, without having to trust that the loop "must have"
done the right thing.
