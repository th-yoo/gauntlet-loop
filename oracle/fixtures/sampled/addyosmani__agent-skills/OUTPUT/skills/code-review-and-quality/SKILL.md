---
name: code-review-and-quality
description: Five-axis review, change sizing (~100 lines), severity labels (Nit/Optional/FYI), review speed norms, splitting strategies. Use before merging any change.
---

## Overview

A review that reads a diff top to bottom looking for "anything wrong"
catches whatever happens to stand out and misses whatever doesn't. This
skill structures review around five fixed axes so coverage doesn't depend on
what the reviewer happened to notice, and labels findings by severity so a
Nit doesn't block a merge the way a correctness issue should.

## When to Use

- Before merging any change, regardless of size.
- A change is unusually large and needs a splitting decision before review
  is even practical.

## Process

1. **Size the change before reviewing it.** Target roughly 100 lines of
   diff for reviewable review; a larger change should be split (see step 5)
   before review starts, not reviewed exhaustively in one pass.
2. **Review against five fixed axes**: correctness, does it do what the
   spec says; design, does it fit existing architecture; complexity, is it
   as simple as the problem allows; tests, do they prove the behavior; and
   naming/readability, would a new reader understand it unaided.
3. **Label every finding by severity**: *Nit* (stylistic, non-blocking),
   *Optional* (suggestion, author's call), *FYI* (informational, no action
   needed), or unlabeled for anything that must be fixed before merge. A
   finding with no severity label defaults to blocking, so mislabeling
   toward leniency is the failure mode to watch for, not the reverse.
4. **Match review speed to change risk**: a small, low-risk change gets a
   same-day turnaround; a large or high-risk one gets the time the five
   axes actually require. Speed norms exist to stop review from becoming
   the bottleneck on low-risk work, not to compress review on high-risk
   work.
5. **Split a change that's too large to review well** into independently
   mergeable pieces (by layer, by feature slice, or by refactor-vs-behavior)
   rather than approving it unreviewed because splitting it after the fact
   is inconvenient.

## Rationalizations

| Excuse | Rebuttal |
|---|---|
| "This diff is large but it's all one logical change, I'll review it as one." | "One logical change" and "one reviewable unit" are different claims — split by layer or slice so each piece can actually be checked against the five axes. |
| "The tests pass, so correctness is covered." | Passing tests only cover what the tests check for — the axes cover design, complexity, and readability that passing tests say nothing about. |
| "It's a small nit, I'll just let it through unlabeled." | Unlabeled means blocking by default — either label it Nit explicitly or fix it; leaving it unlabeled either blocks unnecessarily or slips through by accident. |

## Red Flags

- A diff well over the sizing target was approved in one pass with no
  split considered.
- Findings are present in review comments with no severity label at all.
- Review turnaround on a high-risk change matched the norm for a low-risk
  one.

## Verification

- Each of the five axes was addressed explicitly in the review, not just
  the axis the reviewer happened to focus on.
- Every finding carries an explicit severity label, and nothing labeled
  blocking merged without being resolved.
