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
| named the defect | 1 of the 2 detections quoted the planted text |
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

## Confounds ruled out, empirically rather than by argument

- **Position.** Degraded side crossed 7 A / 5 B; picks were 7 B / 5 A. No side
  preference explains a 17% rate.
- **Length.** The critic picked the shorter file in 5 of the 9 trials where sizes
  differ. A preference for brevity does not explain section-removal's 0/4, which
  was the obvious alternative reading.

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

The ledger is `runs/detection.jsonl`, responses are `runs/detection-raw/`, sealed
notes are `runs/detection-sealed/`. Re-parsing never needs re-spawning: every
response is written to disk before it is read.
