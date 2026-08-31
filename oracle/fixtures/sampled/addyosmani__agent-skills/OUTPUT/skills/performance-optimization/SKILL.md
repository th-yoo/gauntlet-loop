---
name: performance-optimization
description: Measure-first approach - Core Web Vitals targets, profiling workflows, bundle analysis, anti-pattern detection. Use when performance requirements exist or you suspect regressions.
---

## Overview

Optimization aimed at a guessed bottleneck usually improves something that
wasn't the bottleneck, at the cost of complexity that stays even after it
turns out not to have helped. This skill requires a measurement identifying
the actual bottleneck before any optimization, and a second measurement
after, proving the fix moved the number that mattered.

## When to Use

- A stated performance requirement (a budget, a target metric) exists.
- A regression is suspected but not yet measured.
- A change is being proposed specifically to improve performance.

## Process

1. **Measure before touching anything.** Profile, trace, or benchmark the
   current behavior against the relevant targets (see
   `references/performance-checklist.md` for Core Web Vitals and other
   concrete numbers) — never optimize against a guess at where time is
   going.
2. **Identify the actual bottleneck from the measurement**, not from
   intuition about what "usually" is slow. If the profile doesn't point
   clearly at one thing, that's a signal to profile more precisely, not to
   pick the most plausible-looking candidate.
3. **Make the smallest change that addresses the measured bottleneck.**
   Resist optimizing adjacent code that wasn't shown to be a problem.
4. **Re-measure the same way, after.** The same profiling method, the same
   target metric — a claimed improvement with no comparable before/after
   measurement isn't verified.
5. **Check for the known anti-patterns** relevant to the layer (unnecessary
   re-renders, N+1 queries, unbounded bundle growth, blocking synchronous
   work on a hot path) as part of both the initial audit and the review of
   the fix.
6. **Analyze bundle impact** for any front-end change that adds a
   dependency or a new code path — a fix for one metric that regresses
   bundle size is not a net improvement until that tradeoff is stated.

## Rationalizations

| Excuse | Rebuttal |
|---|---|
| "This function is obviously the slow one, I don't need to profile." | "Obviously" is exactly the intuition this skill exists to check against a real profile — it costs one measurement to confirm or correct. |
| "The change is small, it's fine without a before/after measurement." | Small changes are exactly where regressions hide, because they're the ones assumed safe enough to skip measuring. |
| "It feels faster." | Feeling faster and being faster are different claims; only one of them is falsifiable, and this skill requires the falsifiable one. |

## Red Flags

- A performance fix shipped with no baseline measurement to compare
  against.
- The named bottleneck in the fix's justification doesn't match what the
  profile actually shows.
- A performance improvement is reported for one metric with no mention of
  its bundle-size or complexity cost.

## Verification

- A before measurement and an after measurement exist, taken the same way,
  against the same target metric named in
  `references/performance-checklist.md`.
- The specific bottleneck addressed is named and traced back to the
  profile that identified it.
