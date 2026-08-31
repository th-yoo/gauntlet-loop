#!/usr/bin/env bash
# run_experiment.sh — execute exactly one training experiment for the
# autonomous research loop and report the result on stdout as a single
# JSON line, so a calling orchestrator can parse it without guessing at
# log formats.
#
# Usage:
#   run_experiment.sh <hypothesis-label>
#
# Contract with the loop this script serves:
#   - The training file must already contain the code for THIS experiment
#     (the agent edits it before invoking this script; this script does
#     not edit code, and does not decide what to try next).
#   - Training is expected to run for a fixed wall-clock budget
#     (excluding startup/compilation) and to print a validation metric
#     called "val_bpb" (bits-per-byte, lower is better) at least once in
#     its output. This script does not compute or infer that number; it
#     only scrapes it back out of the run's own stdout.
#   - This script does not install, download, or otherwise change system
#     state. It assumes one-time environment setup and one-time data
#     preparation already succeeded before the loop started.
#
# Output: one line of JSON on stdout, always, even on failure — the
# caller should not have to distinguish "script printed nothing" from
# "experiment failed"; a failed experiment is a normal, expected outcome
# of this loop and must be logged like any other.

set -uo pipefail

LABEL="${1:-unlabeled}"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
LOG_DIR="$(pwd)/autoresearch_logs"
mkdir -p "$LOG_DIR"
SAFE_LABEL="$(printf '%s' "$LABEL" | tr -c 'A-Za-z0-9_-' '_')"
RAW_LOG="$LOG_DIR/${TS//:/}_${SAFE_LABEL}.train.log"

START_EPOCH=$(date +%s)
uv run train.py > "$RAW_LOG" 2>&1
EXIT_CODE=$?
END_EPOCH=$(date +%s)
WALL_SECONDS=$((END_EPOCH - START_EPOCH))

# The exact print format of the training file's final metric line is not
# something this script controls, and it can change as the agent edits
# that file. Scrape defensively: take the LAST occurrence in the log of
# "val_bpb" followed eventually by a signed decimal number, so that an
# early debug print with the same substring earlier in the run does not
# win over the real final value.
VAL_BPB=$(grep -oE 'val_bpb[^0-9-]*(-?[0-9]+\.[0-9]+)' "$RAW_LOG" 2>/dev/null \
  | tail -n1 \
  | grep -oE '(-?[0-9]+\.[0-9]+)$')

if [ "$EXIT_CODE" -ne 0 ]; then
  STATUS="crashed"
elif [ -z "${VAL_BPB:-}" ]; then
  STATUS="no_metric_found"
else
  STATUS="ok"
fi

VAL_BPB_JSON="${VAL_BPB:-null}"

printf '{"timestamp":"%s","label":"%s","exit_code":%s,"wall_seconds":%s,"val_bpb":%s,"status":"%s","raw_log":"%s"}\n' \
  "$TS" "$SAFE_LABEL" "$EXIT_CODE" "$WALL_SECONDS" \
  "$VAL_BPB_JSON" "$STATUS" "$RAW_LOG"
