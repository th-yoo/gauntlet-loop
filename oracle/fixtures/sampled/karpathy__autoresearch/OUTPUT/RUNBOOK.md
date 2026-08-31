# Running unattended overnight research

This is the operating guide for turning the single-GPU training setup into a
loop that a coding agent can drive without a human watching it.

## What each piece is for

- **The training file** is the only thing that changes between experiments.
  It holds the model, optimizer, and training loop, and it is edited freely.
- **The fixed data-prep file** downloads the dataset and trains the tokenizer
  once. It is never touched again after the one-time setup.
- **The instructions file** (see the accompanying agent-instructions document)
  is what you hand to the coding agent so it knows the loop: form a
  hypothesis, edit, run, judge, keep-or-discard, repeat.
- **The experiment runner script** is the mechanical half of that loop: it
  runs the one-time setup exactly once, executes a single training attempt,
  reads off the reported metric, compares it against the best result seen so
  far, keeps the edit or rolls it back, and appends one line to a plain
  experiment log. Handing this bookkeeping to a script means the agent's
  judgment is only ever needed for *what to try next*, never for *whether the
  last attempt worked* — that second question has one correct, checkable
  answer and shouldn't depend on the agent remembering to check it.

## First-time setup (once per machine)

1. Confirm you have a single NVIDIA GPU and a working Python 3.10+ toolchain
   with the `uv` project manager available.
2. Install project dependencies and confirm a single manual training run
   completes and reports a metric before turning on the autonomous loop. If a
   manual run doesn't work, an unattended overnight loop won't either — it
   will just fail 100 times instead of once.

## Turning on the loop

1. Point your coding agent at the instructions file and prompt it to read it
   and start.
2. Each time the agent has a hypothesis, it should:
   - make the edit to the training file,
   - invoke the experiment runner with a short description of the change,
   - read the runner's own verdict (kept or discarded) and the log line it
     wrote before deciding what to try next.
3. Let it repeat this for as many cycles as your time budget allows. Because
   each run is capped at a fixed wall-clock budget, the number of experiments
   per hour is predictable, which makes it easy to estimate how many attempts
   an overnight run will fit in and to sanity-check in the morning that the
   loop actually kept iterating rather than stalling on one experiment.

## Reading the results in the morning

- The training file on disk is guaranteed to be the best-performing version
  the loop found, never just the last thing that was tried — the runner
  restores the prior best on every discarded attempt, so an overnight crash
  or a bad idea near the end of the run cannot leave you worse off than
  where you started.
- The experiment log is a flat record of every attempt, kept and discarded
  alike, each with its timestamp, its verdict, the metric it produced (or the
  reason it failed), and the one-line description of what was tried. Read it
  top to bottom to see the shape of the search: what kinds of edits tended to
  help, which ones were tried more than once, and where the metric plateaued.
- A long run of consecutive discards is itself informative — it usually means
  the agent has exhausted the cheap, obvious changes and needs a nudge toward
  a more structural idea (or that the current configuration is close to a
  local optimum for the fixed time budget) rather than a sign that anything
  is broken.

## Adapting the loop to smaller compute

The default setup targets a single high-end GPU. If you are running this on
much smaller hardware, the shape of the loop above does not change — only the
constants inside the training and data-prep files should shrink, roughly in
this order of impact:

1. Prefer a narrower, lower-entropy training dataset so smaller models still
   produce legible results.
2. Shrink the tokenizer's vocabulary size.
3. Shrink the maximum sequence length, and compensate by raising the
   per-device batch size somewhat, since it's their product that determines
   tokens processed per step.
4. Evaluate on less validation data so evaluation doesn't eat into the fixed
   time budget.
5. Reduce model depth — most other size parameters scale off of it.
6. Use a plain (non-alternating) attention window pattern rather than a
   banded/alternating one, which tends to be inefficient at small scale.
7. Reduce the total batch size, keeping it a power of two.

None of this changes the loop mechanics: the runner script still runs one
fixed-time-budget attempt, reads the same metric, and keeps or discards the
same way. Only the numbers being searched over get smaller.

## Guardrails worth keeping in mind

- The fixed time budget is a feature, not a limitation to negotiate around —
  it's what makes every experiment directly comparable to every other one,
  regardless of what the agent changed.
- The metric is chosen specifically to stay comparable even across changes
  that would otherwise make two runs hard to compare (e.g. vocabulary size
  changes) — resist any edit that would make the reported metric mean
  something different than it did in earlier experiments in the same log.
- Because dependencies beyond the core training stack are intentionally kept
  minimal, an experiment that requires installing something new mid-run is a
  sign the idea has grown past the "one file, one metric" scope of this loop
  and belongs in a separate, larger project instead.
