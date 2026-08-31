# Role stability — is the disputed label a property of the artifact, or of one execution?

Written BEFORE any trial ran, and committed with the trials, so the predictions below
cannot be adjusted to fit them.

## The disagreement this discriminates

Probe draws over the sampled frame left five artifacts whose agentic ground truth
(produces-an-instruction) the per-side probe contradicts on every draw — agent-reach,
neovim, home-assistant, autoresearch, gstack — and one contradicted in the other
direction (gitignore: arm says does-the-work, probe says produces-an-instruction).
Zero flips across 58 probe observations, so the probe's answer is stable. What was
never measured is whether the ARM's answer is: its label comes from classifying what
ONE executor happened to build, and the first batch already showed the same artifact
shape yielding opposite labels by executor choice (uptime-kuma's executor built the
whole tool; neovim's built a scaffold).

## The quantity

Execution-label stability: re-execute each artifact twice more with a FRESH builder
under the IDENTICAL prompt used for grounding (batch-2 wording, fixture-path ban,
only the output directory differing), classify each new emission with one fresh blind
reader over a path-neutral copy (single reader, disclosed: two-reader agreement was
measured at 38/38 across the corpus, so reader noise is a bounded confound), and
count, per artifact, how many of its three labels (one original + two new) agree.

This quantity is upstream of both instruments: the probe never sees an emission, and
the arm never sees more than one. Neither can produce it, so neither is auditing itself.

## Sets

- DISPUTED (6): agent-reach, neovim, home-assistant, autoresearch, gstack, gitignore.
- CONTROL (4): uptime-kuma, llama.cpp, claude-mem, HowToCook — rows where probe and
  arm AGREE on does-the-work, spanning built-a-program and wrote-documents emissions.
- BOUND, stated: no agreed instruction-writer exists in the corpus to control the other
  column — every instruction-labelled row is disputed. The control arm is one-sided.

## Predictions, pre-stated

- P-contingent: flips concentrate in the DISPUTED set and controls hold at
  completed-answer. Then the arm cannot ground artifacts of this shape — its label is
  one draw from a process the artifact does not determine — and the 5/5 probe "miss
  rate" is a statement about the arm's question, not the probe's answer.
- P-probe-wrong: all six disputed artifacts reproduce their original labels 3/3 while
  controls hold. Then the label is a stable artifact property and the probe is wrong
  about six stable facts.
- Mixed outcomes are verdicts per artifact, not a failure of the design.

## What this cannot establish

Which label is TRUE. Stability is agreement of an instrument with itself; a process
that stably answers the wrong question stays wrong. What it decides is narrower and
sufficient: whether the agentic arm's output is the kind of fact a corpus row may
carry as ground truth for artifacts of this shape.
