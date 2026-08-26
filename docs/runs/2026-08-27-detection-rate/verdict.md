# The critic's defect-detection rate, measured

**Issue:** #29. **Date:** 2026-08-27. **Instrument:** `gauntlet-ab-critic` as
deployed by `loop.js`, prompt captured from the live script, one template hash
across all trials.

## The result

| | |
|---|---|
| detection | **2 / 12 readable degraded trials = 17%** |
| interval | Wilson 95% CI **5% – 45%** |
| against chance | P(≤2 of 12 \| coin) = **0.019** |
| named the defect | **13 / 15** degraded trials quoted text only one side carried — including 8 of the 10 misses |
| false alarms | **0 / 5** controls |

By defect class:

| class | detected |
|---|---|
| section-removal | **0 / 4** |
| inverted-constraint | 1 / 3 |
| factual-substitution | 1 / 5 |

## What this overturns

#29 rested on one observation: `wf_a4a68ddd-317`, a 22-line section removed from
a SKILL.md, which the critic found and confirmed by running grep rather than
inferring. That anecdote is about **section-removal**, and four blinded trials of
that class produced **zero** detections.

The anecdote is not thereby wrong. It is one draw, and a 17% detector produces a
detection roughly one time in six. What it is not is evidence of a capability,
which is precisely what the issue said and why it asked for a set.

## What the critic actually does

It is **not** a difference-seeker. Every one of the five undegraded control pairs
was correctly called identical — zero false alarms — under a prompt that tells it
in as many words that *"a tie is a critic declining to look closely enough"*. Two
controls answered `neither` outright; the rest picked a side while stating the
pick carried no signal. It pushed back against a forced choice rather than
inventing a difference.

So the failure is specific: it reliably reports **no difference when there is
none**, and reliably fails to pick the better artifact **when there is one**.

## And it is not blind to the defect — it quotes it

`named_defect` records whether the response contains text that **only one side
carries**: the span where the two lines diverge, widened to at least twelve
characters, or the removed section's heading.

| | named the defect |
|---|---|
| the 2 detections | 2 / 2 |
| the 10 misses | **8 / 10** |
| the 3 unread | 3 / 3 |
| all degraded trials | **13 / 15** |

Read that against the 17% detection rate. On eight of the ten trials it got
wrong, the critic had the planted text in front of it and reproduced it, then
picked the degraded side anyway. The gap is not perception. It is between
noticing a difference and converting that into a verdict about which artifact is
better — and it is the second half that the loop's exit condition depends on.

This makes the section-removal result stranger rather than clearer: 4 of 5
section-removal trials named the missing section's heading, and **0 of 4**
readable ones picked the side that still had it.

## Confounds ruled out, empirically rather than by argument

- **Position.** Degraded side crossed 7 A / 5 B; picks were 7 B / 5 A. No side
  preference explains a 17% rate.
- **Length.** The critic picked the shorter file in 5 of the 9 trials where sizes
  differ. A preference for brevity does not explain section-removal's 0/4, which
  was the obvious alternative reading.
- **Quoting volume**, which is the confound for "named the defect" specifically.
  A critic that reproduces slabs of both artifacts contains the planted text
  whether or not it noticed anything, and 13/15 is close enough to ceiling that
  this is the obvious reading. So the needle was crossed against a **placebo of
  the same length, from the same source file, taken from a line the transform
  never touched** — text present in both copies, which a critic that located the
  damage has no reason to quote and a liberal quoter has every reason to.

  | | rate |
  |---|---|
  | needle (text one side carries) | **13 / 15 = 87%** |
  | placebo (untouched text, same length) | **10 / 258 = 4%** |

  The floor of twelve characters was chosen by that crossing rather than picked:
  at a floor of 4 the needles came out `"nnot"`, `"1. b"`, `"0001"` and the
  placebo ran at 22%. `test/detection-parse.test.mjs` re-runs the crossing and
  fails if the placebo climbs back above 15% or the needle stops beating it.

## Method

Twenty trials. Fifteen degraded across three classes, five undegraded controls.
Planting is mechanical — deterministic transforms over real repository documents,
with each sealed note recording the exact before/after strings, so no author chose
what to damage. The prompt is captured by driving `loop.js` through
`test/harness.mjs`, never retyped.

Blinding, after two invalid batches taught what it costs to get wrong:

- both sides are `subject.md` under `a/` and `b/` — identical basename
- trial directories are opaque hashes, so no path names the defect class
- sealed notes live outside the trial tree, which a critic holding Bash can list
- trials are staged outside this repository, and each spawn runs with `cwd` at
  its own trial directory, so the pristine original is not two levels up

## What this does NOT establish

- **Whether these defects resemble the ones a real run meets.** They are planted,
  and a planted defect is one somebody chose. The rate is about detecting *this*
  set and generalises only as far as the set does.
- **Twelve is small.** The interval is 40 points wide. What it excludes is 50%,
  not much else.
- **Three degraded trials are unread** — the parser could not read a winner from
  them. They are recorded, excluded from the rate rather than counted as misses,
  and the responses are on disk.
- **The builder arm.** #25 is the same question about the other agent and has no
  positive observation at all.
- **One model, one day.** No claim about other models or about drift.
- **"Named the defect" still understates, and its placebo is not zero.** A critic
  that describes the damage in its own words without quoting scores false, so
  13/15 is a floor on how often the text was located. In the other direction the
  placebo runs at 4% rather than 0%, so roughly one of the thirteen is the rate
  at which any fragment that length turns up. Neither margin is large enough to
  move the 8-of-10 figure, and both are why nothing gates on the field.

## What it licenses

**#18's automatic revert stays closed, and now for a measured reason rather than
a missing one.** That gate exists because rollback authority handed to an
evaluator whose detection rate is unknown is a trade nobody can price. At 17%
the trade prices out: a revert arm would discard work on this evaluator's say-so
more often than it would save any.

**Verdicts already in the record are not thereby void, but they are weaker than
they read.** A loop that exits when this critic picks the candidate is exiting on
a judgement that, on planted defects, lands below chance. #18's confirmation
requirement — two consecutive wins from two fresh critics on opposite sides —
was landed before this was measured and is more load-bearing than it looked.

## Reproducing

    node scripts/detection-draw.mjs --stage
    node scripts/detection-draw.mjs --draw --limit 20
    node scripts/detection-draw.mjs --reparse
    node test/detection-rate.test.mjs
    node test/detection-parse.test.mjs

The ledger is `runs/detection.jsonl`, responses are `runs/detection-raw/`, sealed
notes are `runs/detection-sealed/`. Re-parsing never needs re-spawning: every
response is written to disk before it is read.

## One correction to this document

The first version of it reported "1 of the 2 detections quoted the planted text".
That was produced by a needle built from the **first 60 characters of the changed
line** — so a substitution deeper than character 60 left the needle identical on
both sides, and a critic that quoted the sentence while noticing nothing scored
the same as one that found the number. Three of the fifteen degraded trials have
that shape. It is the defect this repository names most often, in the direction
that gets quoted rather than the declared-safe one.

The parse now lives in `scripts/detection-parse.mjs`, apart from the spawner,
because `test/containment.test.mjs` forbids anything the suite runs from naming
a spawner — which is why the parse had no test and all four of its defects were
found by reading it. The ledger was rebuilt from the responses already on disk;
no trial was re-run, and **`picked` and `detected` did not move**, so the 17%
rate above is the same number it was. Only `named_defect` changed.
