#!/usr/bin/env python3
"""
orchestrator.py — mechanical bookkeeping for the autonomous training-
research loop described in program.md.

This script does NOT decide what to change in the training file. That
decision belongs to the coding agent following program.md: pick a
hypothesis, edit the training file, describe the change in one line. This
script's only job is the part of the loop that must be exact every single
time and is therefore worth taking out of the agent's hands:

  1. snapshot the training file before an experiment runs, so a bad
     experiment is always revertible
  2. invoke the fixed-budget training run via run_experiment.sh
  3. compare the reported val_bpb against the running best
  4. keep the training file if it improved the best, otherwise restore
     the previous best automatically
  5. append one line to autoresearch_logs/experiments.jsonl, win or lose
  6. answer whether the loop's stopping condition has been reached

Usage, once per experiment, made by the agent right after editing the
training file:

    uv run orchestrator.py record --hypothesis "widen mlp 4x -> 6x"

Usage, once, before the very first experiment of the night:

    uv run orchestrator.py init

Usage, before starting each new experiment, to decide whether to keep going:

    uv run orchestrator.py should-continue --max-hours 8 --max-experiments 100

Usage, any time, to see where things stand:

    uv run orchestrator.py report
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

TRAIN_FILE = Path("train.py")
STATE_FILE = Path("autoresearch_logs/state.json")
LOG_FILE = Path("autoresearch_logs/experiments.jsonl")
BEST_SNAPSHOT = Path("autoresearch_logs/train.best.py")
RUN_SCRIPT = Path("run_experiment.sh")


def _load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {
        "best_val_bpb": None,
        "num_experiments": 0,
        "num_kept": 0,
        "start_time": time.time(),
    }


def _save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2))


def cmd_init(_args: argparse.Namespace) -> None:
    """Record the current training file as the baseline, before any
    agent edits happen. Refuses to run twice so a mid-run restart can't
    silently wipe out the night's progress."""
    if STATE_FILE.exists():
        print(
            "state already initialized; refusing to overwrite. "
            "Delete autoresearch_logs/state.json first if you really want "
            "to restart the loop from scratch.",
            file=sys.stderr,
        )
        sys.exit(1)
    if not TRAIN_FILE.exists():
        print(f"{TRAIN_FILE} not found in the current directory.", file=sys.stderr)
        sys.exit(1)

    state = {
        "best_val_bpb": None,
        "num_experiments": 0,
        "num_kept": 0,
        "start_time": time.time(),
    }
    _save_state(state)
    BEST_SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(TRAIN_FILE, BEST_SNAPSHOT)
    print(
        "initialized. Baseline training file snapshotted as the current "
        "best (no val_bpb recorded yet — the first recorded experiment "
        "sets it)."
    )


def cmd_record(args: argparse.Namespace) -> None:
    """Run one experiment against the training file currently on disk,
    then keep it if it improved on the best val_bpb seen so far,
    otherwise restore the best-known training file automatically."""
    if not STATE_FILE.exists():
        print(
            "no state found; run `orchestrator.py init` once before the "
            "first experiment.",
            file=sys.stderr,
        )
        sys.exit(1)
    if not RUN_SCRIPT.exists():
        print(f"{RUN_SCRIPT} not found in the current directory.", file=sys.stderr)
        sys.exit(1)

    state = _load_state()

    result = subprocess.run(
        ["bash", str(RUN_SCRIPT), args.hypothesis],
        capture_output=True,
        text=True,
    )
    stdout_lines = [line for line in result.stdout.splitlines() if line.strip()]
    if not stdout_lines:
        record = {
            "status": "crashed",
            "val_bpb": None,
            "wall_seconds": None,
            "exit_code": result.returncode,
            "raw_log": None,
            "timestamp": None,
            "label": args.hypothesis,
        }
    else:
        record = json.loads(stdout_lines[-1])

    val_bpb = record.get("val_bpb")
    improved = (
        record.get("status") == "ok"
        and val_bpb is not None
        and (state["best_val_bpb"] is None or val_bpb < state["best_val_bpb"])
    )

    if improved:
        state["best_val_bpb"] = val_bpb
        state["num_kept"] += 1
        shutil.copy(TRAIN_FILE, BEST_SNAPSHOT)
        decision = "kept"
    else:
        if BEST_SNAPSHOT.exists():
            shutil.copy(BEST_SNAPSHOT, TRAIN_FILE)
        decision = "reverted"

    state["num_experiments"] += 1
    _save_state(state)

    entry = {
        "hypothesis": args.hypothesis,
        "decision": decision,
        "best_val_bpb_after": state["best_val_bpb"],
        **record,
    }
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a") as f:
        f.write(json.dumps(entry) + "\n")

    print(json.dumps(entry, indent=2))


def cmd_should_continue(args: argparse.Namespace) -> None:
    """Exit 0 and print 'continue' while the loop's stopping condition
    has not yet been reached; exit 1 and print 'stop' once it has. The
    agent should check this before starting each new experiment rather
    than deciding on its own when the night is "probably over"."""
    if not STATE_FILE.exists():
        print("continue")  # nothing started yet
        return
    state = _load_state()
    elapsed_hours = (time.time() - state["start_time"]) / 3600.0

    if args.max_hours is not None and elapsed_hours >= args.max_hours:
        print("stop")
        sys.exit(1)
    if args.max_experiments is not None and state["num_experiments"] >= args.max_experiments:
        print("stop")
        sys.exit(1)
    print("continue")


def cmd_report(_args: argparse.Namespace) -> None:
    """Print the morning summary: how many experiments ran, how many
    were kept, and the best val_bpb reached, pointing at the log file
    that has the full per-experiment trail."""
    if not STATE_FILE.exists():
        print("no experiments have been run yet.")
        return
    state = _load_state()
    elapsed_hours = (time.time() - state["start_time"]) / 3600.0
    print(f"experiments run:  {state['num_experiments']}")
    print(f"experiments kept: {state['num_kept']}")
    print(f"best val_bpb:     {state['best_val_bpb']}")
    print(f"elapsed:          {elapsed_hours:.2f} hours")
    print(f"full trail:       {LOG_FILE}")
    print(
        "the training file on disk right now is the best-known version — "
        "every discarded experiment was reverted automatically as it happened."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("init", help="record the baseline training file").set_defaults(func=cmd_init)

    p_record = sub.add_parser("record", help="run and score one experiment")
    p_record.add_argument(
        "--hypothesis",
        required=True,
        help="one-line description of what changed in the training file this round",
    )
    p_record.set_defaults(func=cmd_record)

    p_cont = sub.add_parser("should-continue", help="check the stopping condition")
    p_cont.add_argument("--max-hours", type=float, default=None)
    p_cont.add_argument("--max-experiments", type=int, default=None)
    p_cont.set_defaults(func=cmd_should_continue)

    sub.add_parser("report", help="print the morning summary").set_defaults(func=cmd_report)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
