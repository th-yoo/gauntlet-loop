# Preflight checklist — run once, by a human, before the loop starts

The autonomous loop (see `program.md`) assumes all of the following are
already true. None of these steps are things the agent should redo on its
own each night; they are one-time environment setup, and skipping this
checklist is the most common reason an "autonomous overnight run" turns
out to be a night of crash logs instead of experiments.

- [ ] A single NVIDIA GPU is available on the machine the agent will run on.
      This project's training loop is written for exactly one GPU; it does
      not do distributed training and should not be pointed at a multi-GPU
      box expecting it to use the extra cards.
- [ ] Python 3.10+ is installed.
- [ ] The `uv` project manager is installed.
- [ ] Project dependencies are installed (the one-time dependency sync).
- [ ] The one-time data preparation step has been run successfully: raw
      training data has been downloaded and a BPE tokenizer has been
      trained. This step is not part of the per-experiment loop — it runs
      once, before the first experiment, and `prepare.py` is never touched
      by the agent afterward.
- [ ] A single manual training run has been done and completed cleanly, to
      confirm the whole pipeline works end to end before handing control to
      the autonomous loop. If this manual run fails, the loop will fail
      identically on every subsequent attempt — fix it here, not after
      100 automated crash logs.
- [ ] The manual run's output has been inspected closely enough to know
      what the validation metric line actually looks like when it prints.
      `run_experiment.sh` scrapes stdout for a `val_bpb` number; if the
      real output format doesn't match, fix the scrape pattern in
      `run_experiment.sh` before starting the loop, not after.
- [ ] `run_experiment.sh` is executable (`chmod +x run_experiment.sh`) and
      sits in the same working directory as `train.py`.
- [ ] `orchestrator.py` sits in the same working directory as `train.py`
      and `run_experiment.sh`.
- [ ] A time or experiment-count budget for the overnight run has been
      decided (see "Stopping conditions" in `program.md`) — e.g. an
      8-hour budget, or a fixed count such as 100 experiments — so the
      loop has an explicit place to stop rather than running indefinitely
      or stopping only when the agent's own session ends.

Only once every box above is checked should the agent be told to begin
the loop described in `program.md`.
