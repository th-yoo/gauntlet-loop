---
name: code-simplification
description: Chesterton's Fence, Rule of 500, reduce complexity while preserving exact behavior. Use when code works but is harder to read or maintain than it should be.
---

## Overview

Simplification and behavior change are two different operations that look
identical in a diff. This skill requires establishing why existing
complexity is there before removing it, and proving behavior didn't change
after removing it — simplification that can't show both isn't
simplification, it's an unreviewed rewrite.

## When to Use

- Code works correctly but is harder to read or extend than the problem
  requires.
- A file or function has grown past a size where it can be understood in
  one pass.
- A pattern is duplicated in a way that obscures rather than clarifies.

## Process

1. **Apply Chesterton's Fence before removing anything**: find out why the
   existing complexity is there before assuming it's unnecessary. If the
   reason can't be found, that's a flag to investigate further, not license
   to remove it.
2. **Apply the Rule of 500** as a signal, not a hard cutoff: a file
   approaching roughly 500 lines is a prompt to check whether it's doing
   more than one job, not an automatic split.
3. **Simplify in slices, each preserving exact behavior.** Every
   simplification step should be a refactor in the strict sense — the
   existing test suite passes unchanged before and after each step.
4. **Reduce complexity toward the problem's actual shape**, not toward a
   preferred style — a simplification that trades one kind of complexity
   for another in the name of taste hasn't reduced anything.
5. **Re-run the full test suite after each slice**, not just at the end,
   so a behavior change introduced by a "simplification" is caught at the
   step that caused it.

## Rationalizations

| Excuse | Rebuttal |
|---|---|
| "This code is clearly overcomplicated, I don't need to understand why it's like this." | "Clearly overcomplicated" and "has no reason" are different claims — Chesterton's Fence asks for the reason to be found or its absence to be a flag, not assumed. |
| "I simplified and also fixed a small bug I noticed along the way." | That's two changes in one diff with two different risk profiles — split them so a test failure can be attributed to one or the other. |
| "The tests still pass, so behavior is preserved." | Passing tests only prove behavior is preserved for what the tests cover — a simplification touching untested paths needs that coverage added first, not assumed. |
| "The file is under 500 lines, no need to reconsider its structure." | The Rule of 500 is a prompt to check, not a threshold that clears a file automatically — a 300-line file doing three jobs is still a candidate. |

## Red Flags

- Complexity was removed with no stated understanding of why it existed.
- A "simplification" diff also changes observable behavior, however small.
- The test suite wasn't re-run between simplification slices, only at the
  end.

## Verification

- For each removed piece of complexity, a reason it existed (or its
  documented absence) is recorded.
- The full test suite passes, unchanged, before and after the
  simplification — not just at the final commit.
