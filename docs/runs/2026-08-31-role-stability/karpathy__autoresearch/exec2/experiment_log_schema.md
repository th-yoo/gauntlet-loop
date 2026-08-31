# `autoresearch_logs/experiments.jsonl` — one line per experiment

`orchestrator.py record` appends exactly one JSON object per line to this
file, never rewrites a previous line, and never reorders lines. That makes
the file safe to tail during the night and safe to reconstruct the whole
run's history from after the fact, even if the run is interrupted mid-way.

## Fields

| Field | Type | Meaning |
|---|---|---|
| `hypothesis` | string | The one-line description the agent supplied for this round's change, e.g. `"widen mlp 4x -> 6x"`. This is the only field that comes from the agent rather than from measurement — everything else is either produced by the training run or computed from it. |
| `timestamp` | string (UTC, ISO 8601) | When the experiment's training run started. |
| `label` | string | Same as `hypothesis`, passed through the training-run wrapper; kept for traceability into the matching raw log file. |
| `exit_code` | integer or null | The training process's exit code. Non-zero means the run itself failed — `val_bpb` should not be trusted or compared in that case, and it will be `null`. |
| `wall_seconds` | integer or null | Measured wall-clock duration of the training run. Should sit close to the fixed 5-minute budget; a value far below that, on a run that otherwise exited 0, is a sign the run exited early rather than actually training. |
| `val_bpb` | number or null | Validation bits-per-byte reported by the training run for this experiment. Lower is better. `null` when the run crashed or when the metric could not be found in its output. |
| `status` | string | One of `"ok"`, `"crashed"`, `"no_metric_found"`. Only `"ok"` rows have a trustworthy `val_bpb`. |
| `raw_log` | string or null | Path to the full captured stdout/stderr of that training run, for when a human wants to see more than the one scraped number. |
| `decision` | string | `"kept"` if this experiment's `val_bpb` improved on the best seen so far and the resulting training file was kept as the new best; `"reverted"` otherwise, meaning the training file was restored to the previous best before the next experiment began. |
| `best_val_bpb_after` | number or null | The running best `val_bpb` immediately after this experiment's decision was applied. Monotonically non-increasing across the whole file, by construction — the loop cannot decide `"kept"` unless this round's `val_bpb` was strictly better than the previous value of this field. |

## What the log is for

- **The morning report** (`orchestrator.py report`) is a summary of this
  file plus the small state file it's derived from; nothing in the report
  is information the log itself doesn't already contain in more detail.
- **Auditing a decision.** Because `decision` and `best_val_bpb_after` are
  written by the same mechanical step that made the decision — not
  reconstructed afterward from the training file's current contents — a
  human can check any single line's `decision` against its own `val_bpb`
  and the previous line's `best_val_bpb_after` and confirm the loop
  behaved correctly, without needing to trust it.
- **Resuming a run.** If the loop is interrupted, the small state file
  (`autoresearch_logs/state.json`) — not this log — is what `orchestrator.py`
  reads to know the current best and how many experiments have already
  run; this log is the human-facing trail, kept append-only on purpose so
  it can never be the source of a silent state discrepancy.
