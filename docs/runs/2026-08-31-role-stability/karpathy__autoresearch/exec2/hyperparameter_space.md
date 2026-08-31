# Candidate knobs for the agent's hypotheses

The agent editing the training file is free to change architecture,
optimizer, or batch-size code however it likes — nothing here is a hard
boundary. This list exists only to give the hypothesis-generation step in
`program.md` a concrete starting menu, since "everything is fair game" is
too open-ended to act on efficiently inside a 5-minute-per-trial budget.
Treat it as a seed list to draw from and extend, not a fixed search grid.

Known knobs, from what the project documents about its own defaults:

| Knob | Where it lives | Default | Notes |
|---|---|---|---|
| `DEPTH` | training file | 8 | The single biggest lever on model complexity; most other size-related quantities are derived from it. Move it in both directions, not just up. |
| `WINDOW_PATTERN` | training file | `"SSSL"` (alternating banded attention) | `"L"` (plain, non-banded) is the simpler fallback and is worth a baseline comparison against the alternating pattern, since the alternating pattern's efficiency is compute-dependent. |
| `DEVICE_BATCH_SIZE` | training file | — | Interacts with sequence length: their product is tokens per forward/backward pass. Changing one without considering the other confounds the comparison. |
| `TOTAL_BATCH_SIZE` | training file | — | Keep it a power of 2 when changing it, to stay consistent with how the codebase already expresses batch sizes. |
| `vocab_size` | data-prep file (not agent-editable) | 8192 | Out of scope for the agent's per-experiment loop since the file that sets it is fixed after the one-time data-prep step; changing it means re-running data prep, which is a human decision, not an autonomous-loop edit. |
| `MAX_SEQ_LEN` | data-prep file (not agent-editable) | — | Same as above: fixed at prep time, not a per-experiment knob. |
| `EVAL_TOKENS` | data-prep file (not agent-editable) | — | Same as above. Changing it would make `val_bpb` across experiments not comparable to earlier runs, which defeats the point of the fixed-budget design. |
| Optimizer choice/config | training file | Muon + AdamW | Fair game: which parameters go to which optimizer, learning rates, schedules. |
| Architecture details | training file | full GPT model | Fair game: attention variants, normalization, activation, initialization, anything else in the model definition. |

Two of the rows above are explicitly out of reach for the autonomous loop
(they live in the file the agent is told never to modify). Listing them
here is deliberate: an agent that doesn't know they're off-limits may
otherwise "discover" them by trial and error, burn an experiment slot
finding out the edit was rejected or broke the one-time prep contract, and
worse, an edit to that file would make every later experiment's `val_bpb`
incomparable to everything logged before it.

## Hypothesis-picking heuristics for the agent

- Prefer one change per experiment. Two simultaneous changes make it
  ambiguous which one moved `val_bpb`, and the loop only has room to keep
  or discard the whole diff, not attribute credit within it.
- Prefer changes that are cheap to reason about the direction of: it is
  more informative to run "half of `DEPTH`" and "double `DEPTH`" as two
  separate experiments than to guess a single intermediate value.
- After a discard, don't immediately retry a small perturbation of the
  same discarded idea more than once — the 5-minute budget makes each
  experiment noisy at the margin, but a hypothesis that failed clearly
  should be replaced with a genuinely different one, not fine-tuned blind.
- After several kept experiments in a row from the same family of change
  (e.g. several optimizer tweaks), deliberately switch families (e.g. try
  an architecture change next) so the overnight log doesn't end up having
  only explored one corner of the space.
