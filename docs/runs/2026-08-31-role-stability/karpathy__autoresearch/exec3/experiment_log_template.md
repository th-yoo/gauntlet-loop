# Experiment log

Append-only. One block per experiment, in the order the runs actually
happened. Do not reorder, and do not edit a block once the run it describes
has finished — if a later run shows an earlier note was wrong, add a new
block that says so instead of rewriting history.

Each run is scored on validation bits-per-byte (lower is better) after a
fixed 5-minute wall-clock training budget, measured after startup and
compilation. Because the budget and metric are fixed, val_bpb numbers across
different blocks in this log are directly comparable to each other, even
across architectural changes — that comparability is the entire point of
keeping this log in this format rather than free-form notes.

---

### Experiment 0 (baseline)
- Hypothesis: n/a — this is the unmodified starting point.
- Diff summary: none; default training script as shipped.
- Baseline compared against: n/a.
- Outcome: <val_bpb once the first run completes>
- Decision: keep (by definition — this is the reference point for Experiment 1)
- Note for backlog:

### Experiment 1
- Hypothesis:
- Diff summary:
- Baseline compared against: Experiment 0
- Outcome:
- Decision: keep | discard
- Note for backlog:

### Experiment 2
- Hypothesis:
- Diff summary:
- Baseline compared against:
- Outcome:
- Decision: keep | discard
- Note for backlog:

<!--
Copy the block above for each subsequent experiment. Increment the number,
fill "Baseline compared against" with the experiment number of whichever
script version is the current kept baseline (not necessarily N-1 — if
experiment 4 discarded, experiment 5 still compares against experiment 3's
version), and never delete a block, including discarded and crashed ones.
Discarded and crashed blocks are what let the final summary state a real
discard rate and a real crash rate instead of only telling the story of the
runs that worked.
-->

---

## Running tally (update after every block, do not recompute from scratch each time)

- Experiments run so far:
- Kept:
- Discarded (completed, no improvement):
- Crashed / degenerate:
- Current best val_bpb:
- Current best experiment number:
- Consecutive sub-0.5%-relative-improvement kept updates (plateau counter):
