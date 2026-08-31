# Start here

This bundle turns "let an agent experiment overnight on a single-GPU
training setup" into a loop with a mechanical, checkable core, rather than
something that relies on an agent re-deriving the bookkeeping correctly
from scratch every session.

Read these in this order:

1. **`PREFLIGHT_CHECKLIST.md`** — one-time, human-run setup that must be
   confirmed before any autonomous loop starts. Skipping this turns an
   overnight run into an overnight crash log.
2. **`program.md`** — the standing instructions for the agent running the
   loop: constraints, the per-experiment cycle, stopping conditions, and
   what a finished run should leave behind. This is the file the agent
   should treat as its operating procedure.
3. **`hyperparameter_space.md`** — a seed menu of concrete things to try,
   so hypothesis generation doesn't start from a blank page each round,
   plus a note on which knobs are explicitly off-limits to the per-
   experiment loop and why.
4. **`experiment_log_schema.md`** — the exact meaning of every field in
   the append-only experiment log, and why the log's structure lets a
   human audit any single decision without trusting the loop blindly.

Two scripts do the actual mechanical work described in `program.md`:

- **`run_experiment.sh`** — runs one training experiment under the fixed
  time budget and reports the outcome as a single line of JSON.
- **`orchestrator.py`** — the loop's bookkeeping: snapshot/revert of the
  training file, keep-vs-discard decisions, the append-only log, the
  stopping-condition check, and the end-of-run summary. It is invoked by
  the agent, not by a human, once the loop is underway.

Nothing in this bundle downloads data, installs dependencies, or launches
a training run on its own — it is the scaffolding the agent uses once an
already-working single-GPU setup exists, per the preflight checklist.
