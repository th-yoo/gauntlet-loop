#!/usr/bin/env bash
# run_experiment.sh — mechanical bookkeeping for one autonomous research
# iteration on a single-GPU nanochat-style training setup.
#
# Intent: the agent edits the training file with its next hypothesis, then
# calls this script once. The script does the part that needs no judgment —
# run the fixed-time-budget training command, read off the reported metric,
# compare it to the best result seen so far, keep the edit or roll it back,
# and append one line to a plain-text experiment log. The agent stays
# responsible for choosing what to try next; this script stays responsible
# for making sure a worse idea never survives past its own experiment and a
# better idea is never silently lost.
#
# Usage:
#   ./run_experiment.sh "one-line description of the hypothesis being tested"
#
# Environment overrides (all optional, defaults match the project layout):
#   TRAIN_FILE     path to the single file the agent is allowed to edit
#                  (default: train.py)
#   PREPARE_FILE   the one-time data-prep / tokenizer script
#                  (default: prepare.py)
#   STATE_DIR      where checkpoints and the log live (default: .autoresearch)
#   METRIC_PATTERN regex used to pull the metric out of the training output
#                  (default matches "val_bpb" followed by a number)
#
# Exit status: 0 whether the experiment was kept or discarded — a rejected
# hypothesis is a normal, successful iteration of the loop, not a script
# failure. Non-zero only means the bookkeeping itself could not run (e.g. no
# training file present).

set -u

TRAIN_FILE="${TRAIN_FILE:-train.py}"
PREPARE_FILE="${PREPARE_FILE:-prepare.py}"
STATE_DIR="${STATE_DIR:-.autoresearch}"
METRIC_PATTERN="${METRIC_PATTERN:-val_bpb[^0-9-]*(-?[0-9]*\.?[0-9]+)}"

DESCRIPTION="${1:-(no description given)}"

if [ ! -f "$TRAIN_FILE" ]; then
  echo "run_experiment.sh: no training file at '$TRAIN_FILE' — nothing to run." >&2
  exit 1
fi

mkdir -p "$STATE_DIR"
BEST_COPY="$STATE_DIR/best_train.py"
BEST_METRIC_FILE="$STATE_DIR/best_val_bpb.txt"
SETUP_MARKER="$STATE_DIR/setup_done"
LOG_FILE="$STATE_DIR/experiment_log.tsv"
RUN_OUTPUT="$STATE_DIR/last_run_output.txt"

timestamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

if [ ! -f "$LOG_FILE" ]; then
  printf 'timestamp\taction\tval_bpb\tbest_val_bpb\tdescription\n' > "$LOG_FILE"
fi

# One-time setup: only ever runs once per STATE_DIR. This mirrors the
# "download data, train tokenizer" step that only needs to happen once, not
# once per experiment.
if [ ! -f "$SETUP_MARKER" ]; then
  echo "First run for this state directory — performing one-time setup..."
  if command -v uv >/dev/null 2>&1 && [ -f "$PREPARE_FILE" ]; then
    uv run "$PREPARE_FILE"
    setup_status=$?
  else
    echo "run_experiment.sh: skipping one-time setup (uv or '$PREPARE_FILE' not found)." >&2
    setup_status=0
  fi
  if [ "$setup_status" -eq 0 ]; then
    touch "$SETUP_MARKER"
  else
    echo "run_experiment.sh: one-time setup failed, aborting before any experiment is run." >&2
    exit 1
  fi
fi

# Establish a baseline the very first time an experiment is attempted: the
# file on disk right now is treated as "best so far" with an infinite metric,
# so the first completed run always gets recorded as an improvement.
if [ ! -f "$BEST_COPY" ]; then
  cp "$TRAIN_FILE" "$BEST_COPY"
  echo "inf" > "$BEST_METRIC_FILE"
fi
BEST_METRIC=$(cat "$BEST_METRIC_FILE")

echo "Running experiment: $DESCRIPTION"
if command -v uv >/dev/null 2>&1; then
  uv run "$TRAIN_FILE" > "$RUN_OUTPUT" 2>&1
  run_status=$?
else
  python3 "$TRAIN_FILE" > "$RUN_OUTPUT" 2>&1
  run_status=$?
fi

NEW_METRIC=""
if [ "$run_status" -eq 0 ]; then
  NEW_METRIC=$(grep -oE "$METRIC_PATTERN" "$RUN_OUTPUT" | tail -n1 | grep -oE '[0-9.]+$')
fi

is_improvement() {
  # $1 = new metric, $2 = best metric so far ("inf" means anything beats it)
  if [ "$2" = "inf" ]; then
    return 0
  fi
  awk -v new="$1" -v best="$2" 'BEGIN { exit !(new < best) }'
}

if [ "$run_status" -ne 0 ] || [ -z "$NEW_METRIC" ]; then
  # Crash, hang, or a metric we could not find in the output — treat exactly
  # like a rejected hypothesis: restore the last known-good file and log why.
  cp "$BEST_COPY" "$TRAIN_FILE"
  reason="run failed or metric not found (exit status $run_status)"
  printf '%s\tDISCARD\t%s\t%s\t%s (%s)\n' "$(timestamp)" "n/a" "$BEST_METRIC" "$DESCRIPTION" "$reason" >> "$LOG_FILE"
  echo "Discarded: $reason. Training file restored to best known version."
  exit 0
fi

if is_improvement "$NEW_METRIC" "$BEST_METRIC"; then
  cp "$TRAIN_FILE" "$BEST_COPY"
  echo "$NEW_METRIC" > "$BEST_METRIC_FILE"
  printf '%s\tKEEP\t%s\t%s\t%s\n' "$(timestamp)" "$NEW_METRIC" "$NEW_METRIC" "$DESCRIPTION" >> "$LOG_FILE"
  echo "Kept: val_bpb improved to $NEW_METRIC (was $BEST_METRIC)."
else
  cp "$BEST_COPY" "$TRAIN_FILE"
  printf '%s\tDISCARD\t%s\t%s\t%s\n' "$(timestamp)" "$NEW_METRIC" "$BEST_METRIC" "$DESCRIPTION" >> "$LOG_FILE"
  echo "Discarded: val_bpb $NEW_METRIC did not beat best $BEST_METRIC. Training file restored."
fi

exit 0
