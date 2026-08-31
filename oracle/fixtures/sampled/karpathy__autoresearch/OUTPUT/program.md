# Autonomous research program

You are an autonomous research agent working on a small, single-GPU LLM training
setup. Your job is to run experiments overnight, without a human in the loop,
and leave behind a log of what you tried and a model that is better than when
you started.

## The rules of the sandbox

- There are exactly three files that matter: a fixed data-prep/utilities file
  you must never touch, a training file that is the *only* file you are allowed
  to edit, and this instructions file (which the human edits, not you).
- Every training run is capped at a **fixed 5-minute wall-clock budget**
  (excluding startup/compilation). You cannot make an experiment "better" by
  giving it more time — a change either helps within 5 minutes or it doesn't.
- The single metric is **validation bits-per-byte (val_bpb)**. Lower is
  better. Because it is vocab-size independent, you may freely change
  vocabulary size, architecture, optimizer, batch size, or anything else in
  the training file and the metric stays comparable.
- Everything else about the loop is your call: how you branch, how many
  experiments you attempt, how aggressive your edits are.

## The loop

Repeat the following until you run out of time or run out of ideas:

1. **Form a hypothesis.** Pick one change to the training file you believe will
   lower val_bpb — an architecture tweak, an optimizer setting, a batch-size or
   learning-rate change, a sequence-length change, etc. Prefer one change at a
   time so you can attribute the effect.
2. **Checkpoint before you edit.** Save a copy of the current training file and
   record the current best val_bpb before touching anything, so the change is
   reversible.
3. **Edit.** Make the change in the training file only.
4. **Run.** Execute the fixed one-time setup once per session if it has not
   already been done (installing dependencies, downloading data, training the
   tokenizer), then run a single training experiment. It runs for the fixed
   5-minute budget and reports val_bpb at the end.
5. **Judge.** Compare the new val_bpb to the best val_bpb seen so far.
   - If it improved: keep the edit, update the recorded best val_bpb, and
     write one line to the experiment log describing the change and the new
     number.
   - If it did not improve (or the run crashed): discard the edit by
     restoring the checkpointed training file, and write one line to the
     experiment log describing what was tried and why it was rejected (worse
     val_bpb, crash, out-of-memory, etc.). A rejected idea is still a result —
     log it so it is not retried blindly.
6. **Go back to step 1.** Pick the next hypothesis. Early in the night, prefer
   cheap, high-signal changes (learning rate, batch size, depth/width ratio)
   before expensive structural rewrites, since each experiment costs a fixed
   5 minutes regardless of how large the change is.

## What "done" looks like in the morning

- The training file reflects the best configuration you found, and it is the
  one that produced the best logged val_bpb, not the last one you tried.
- The experiment log is a flat, readable list of every attempt: what changed,
  what val_bpb resulted (or why it failed), and whether it was kept.
- No experiment silently disappears. If you tried something and it made
  things worse, that negative result is on the record exactly like a positive
  one — future runs (including future nights) should not have to rediscover
  it.

## Guardrails

- Never edit the fixed data-prep/utilities file. If you think you need to,
  that is a sign the idea belongs in a future scope, not tonight's loop — log
  it as a note instead.
- Never let a run exceed its time budget in search of a better number; the
  budget is the point of the experiment design, not an obstacle to route
  around.
- If a run crashes or hangs, treat it as a rejected hypothesis: restore the
  checkpoint, log the failure, move on. Do not spend the whole night debugging
  a single crash if a simpler hypothesis is waiting.
- If you are ever unsure whether an edit keeps the metric comparable (for
  example a change that also alters what is being measured, not just how well
  it is predicted), prefer the reading that keeps val_bpb an apples-to-apples
  comparison across all your experiments in the log.
