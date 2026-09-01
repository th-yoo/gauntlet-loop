# The wide-goal re-match — design, committed BEFORE the run

**Nothing below was written after seeing a result.** This file is committed before the
Workflow is launched, because the prediction it makes is the whole point and a prediction
recorded afterwards is not one.

## The question

The operator's standing objection was "our k is too small". Decision 0007 established
where the source's count actually lives: `exit_bar.wowed_required`, one item sub-agent per
PIECE, each judging whole against whole, all of them wowed. It is not a setting — no
argument moves it, and `critics` does not.

**And the 2026-09-01 run came back with `wowed_required` = 1.** The lead split the
four-sentence goal into a single piece, `core-gameplay-mechanics`. So after all of 0007,
the source's count was still 1 in practice — not because the code sets it, but because the
goal did not give the lead anything to fan out over.

That is the hypothesis this run tests, and it is the operator's original reading of the
source: **the source's width comes from the GOAL's demand, not from a parameter.** Shumer's
prompt asks for "every single thing done at AAA quality—from textures to physics to
anything you could think of", and his eleven critics were an outcome of that sentence, not
a configuration.

## The goal, at demand width

    A browser game of Tetris that is utterly polished — every single thing at the level of
    a game someone shipped and kept working on, from how it feels under the hand to how it
    looks to what it tells the player, and anything else you could think of. Nothing in it
    should read as a prototype and nothing should need forgiving. It runs by opening one
    HTML file and is played from the keyboard.

**Deliberately NOT an enumeration of the dimensions I know separate these two artifacts.**
I have now read both closely — I know the reference is responsive and the candidate is not,
I know the reference drops HUD counters at 520px, I know the candidate lacked a 7-bag. A
goal listing those clauses would be an answer key wearing a goal's clothes, and it is the
exact failure `goal_coupling` exists to detect. So the goal keeps the source's SHAPE —
three example dimensions and "anything else you could think of" — and leaves the
enumerating to the lead, which is the thing under test.

`goal_authored: after-reading-candidate`, and that is the honest value. I wrote this having
inspected the candidate for hours. Claiming `independently` would be false, and the verdict
records the difference.

## The prediction, and what would falsify it

**PREDICTED: the lead produces MORE THAN THREE pieces, and `exit_bar.wowed_required`
equals that count.**

Priors it is stated against: the same reference and the same seed under the narrow
four-sentence goal produced **1** piece on 2026-09-01 and **4–5** pieces on the two
2026-08-29/30 runs. So >3 is a real prediction rather than a safe one — the narrow goal has
already produced 4 once.

**FALSIFIED IF the lead produces three or fewer pieces.** That result would say goal width
is NOT what drives fan-out, and the operator's "k is too small" has a cause that neither
0007 nor a wider goal reaches. That is a finding worth more than a confirmation, and if it
happens this file is the record that it was predicted otherwise.

**Also recorded as a possible outcome, and not treated as success:** the lead may fan wide
and the pieces may be *bad* — overlapping, unobservable, or named for things no critic can
judge alone. `decomposition.pieces[].observable` and the code that drops pieces without one
are what would show it. Wide and useless is not the same as wide.

## Setup

- Reference: `MehmetMHY/tetris` at `d3319c9025f556c21ae4baa7c9e562baaad343f9`, 89,340 B,
  with `assets/`, `sw.js`, `site.webmanifest`, staged as `doc-2.html`.
- Candidate: the **original 2026-08-29 seed** (8,033 B), not the 27,329 B artifact the last
  run produced. Starting from the same seed as the 2026-09-01 run is what makes the piece
  counts comparable — a different candidate would confound the one variable being changed.
- The candidate is byte-MUTATED so it is not identical to the committed copy, silently:
  no comment, no marker, nothing a blindness probe can read as a tell. The 2026-09-01 run
  had to be relaunched because my first mutation added `<!-- staged copy -->` and the
  blindness probe immediately grepped the disk for that string.
- `critics: 1`, unchanged. The number under test is the PIECE count, and moving `critics`
  in the same run would confound the two.
- The wow-bar question is settled: decision 0007, margin gates the exit. The earlier plan
  for this run said to decide it beforehand; it is decided, and this run inherits it.

## What this run cannot establish

That more pieces produce a better artifact. It tests whether goal width moves the count the
source specifies. Whether a higher count buys coverage or only variance is decision 0007's
own open question, and one run cannot answer it — the whole-artifact judgements would have
to disagree with each other against some outside measure, and Tetris has no outside oracle.
