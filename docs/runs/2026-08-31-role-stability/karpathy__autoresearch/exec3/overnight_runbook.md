# Overnight autonomous-research runbook

This is the human-facing checklist for kicking off, supervising the boundary
of, and reviewing an unattended overnight training-research session. It
assumes the agent-facing operating instructions (the loop, the seed
hypotheses, the log format, the stopping conditions) live in a separate
file the agent has already been pointed at. This runbook covers everything
around that loop: making sure the environment is actually ready before
handing off, and what to check when you come back.

## Before you hand off (preflight)

Confirm all of the following are true before starting an unattended session.
Anything here that fails will fail every experiment in the loop identically,
so it is much cheaper to catch here than to discover it 40 experiments in:

1. **Hardware**: exactly one NVIDIA GPU is visible and idle. This setup
   targets a single-GPU machine by design — it does not do distributed
   training, and pointing it at a multi-GPU box will not make it use the
   extra GPUs.
2. **One-time data preparation has already completed successfully** — the
   training-data download and tokenizer training are a one-time step
   (on the order of a couple of minutes) that must finish before the first
   training run, and it is separate from, and a prerequisite to, every
   training run in the overnight loop. Do not let the agent attempt to
   redo this step per-experiment; it is fixed infrastructure, not part of
   what gets iterated on.
3. **A single manual training run completes successfully** on the
   unmodified baseline before you hand control to the agent. If a single
   manual run doesn't complete, an unattended loop of ~100 automated
   attempts at the same broken thing produces ~100 identical failures and
   no research signal — it is not a substitute for this check.
4. **Permissions**: the agent has write access to the training script and
   to its own log file, and does not have — and should not need — access
   to anything outside this project's files. It does not need network
   access once data preparation has completed.
5. **A time boundary is set** for the overall session (e.g., "stop
   accepting new experiment starts after N hours"), separate from the
   per-experiment 5-minute training budget. The per-experiment budget keeps
   individual runs comparable to each other; the session boundary is what
   actually gets you a finished log by morning instead of a loop still
   running.

## Handoff

Hand the agent its operating instructions and let it run. Do not
babysit individual experiments — the entire point of the fixed per-run time
budget and the append-only log is that the loop is self-documenting and
self-limiting without a human watching each run. Check in only at the
session boundary, or if you have an out-of-band reason to believe something
is stuck (see "signs something is wrong," below).

## Signs something is wrong (worth an early interruption)

- The log has not gained a new experiment block in noticeably longer than
  one run's time budget plus a reasonable margin for startup/compilation —
  this usually means a run is hung rather than training, since a crash
  should still produce a logged block.
- The same crash or degenerate-result note is repeating across consecutive
  experiments — this means the agent kept a broken baseline instead of
  reverting to the last good one, and every subsequent experiment is
  inheriting the break. Roll back to the last experiment marked "keep" with
  a clean completion, and resume from there.
- val_bpb entries are trending worse over many consecutive kept updates —
  since "keep" should only fire on improvement, this can only mean the
  keep/discard rule itself is not being applied; treat it as a process bug,
  not a modeling result.

## Morning review

1. Read the final summary block first, not the raw log — it should already
   state the totals, the best result, the full chain of kept diffs, and any
   recurring failure mode. If it doesn't state all of those, the session
   ended without producing the summary it owed; read the raw log to
   reconstruct them before doing anything else.
2. Confirm the claimed best val_bpb against its own logged experiment
   block (hypothesis, diff, outcome) rather than trusting the summary
   number in isolation — the summary is a derived artifact and the
   per-experiment blocks are the primary record.
3. Decide what carries forward: the kept chain of diffs is a candidate new
   baseline for the next session, but it is only as trustworthy as the
   process that produced it — if the "signs something is wrong" checks
   above turned anything up mid-session, treat the final result as
   provisional until a clean rerun confirms it, rather than adopting it
   outright.
4. Recycle the unreached and newly-derived hypotheses from the summary into
   the seed list for the next session, so each overnight run compounds on
   the last one instead of restarting the backlog from the same five ideas
   every time.
