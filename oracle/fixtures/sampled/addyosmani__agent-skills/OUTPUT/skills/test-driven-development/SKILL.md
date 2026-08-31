---
name: test-driven-development
description: Red-Green-Refactor, test pyramid (80/15/5), test sizes, DAMP over DRY, the Beyonce Rule, browser testing. Use when implementing logic, fixing a bug, or changing behavior.
---

## Overview

A test written after the code it tests tends to confirm what the code
already does, including its bugs. Red-Green-Refactor forces the test to
exist as an independent claim about behavior before the implementation can
agree with it — so passing the test means something.

## When to Use

- Implementing new logic.
- Fixing a bug — a regression test that reproduces it comes before the fix.
- Changing existing behavior in a way that could silently break a caller.

## Process

1. **Red**: write a test that states the desired behavior and fails, for
   the right reason (it exercises the missing behavior, not a typo or a
   missing import). Run it and read the failure before writing any fix.
2. **Green**: write the minimum code that makes the test pass. Resist
   generalizing beyond what the test demands — that's the next step's job.
3. **Refactor**: clean up implementation and test alike, with the test
   still green after every change. Refactoring with a red test is just
   rewriting; the green test is what makes it refactoring.
4. **Size the test to what it verifies.** Unit tests for logic, integration
   tests for component boundaries, end-to-end tests for user-facing flows.
   Follow the roughly 80/15/5 pyramid — most coverage from fast unit tests,
   a smaller layer of integration tests, a thin layer of end-to-end tests —
   as a check against an unbalanced suite, not a quota to hit exactly.
5. **Prefer DAMP over DRY in test code.** A test that's been deduplicated
   into a shared helper can hide which exact input caused a failure; a
   little repetition that keeps each test readable in isolation is worth
   it.
6. **Apply the Beyonce Rule**: "if you liked it, you shoulda put a test on
   it." Behavior anyone relies on staying true gets a test, not a comment
   promising it will.
7. **For anything running in a browser**, verify with real runtime data
   (see `browser-testing-with-devtools`) in addition to unit coverage — a
   passing unit suite doesn't prove the DOM renders correctly.

## Rationalizations

| Excuse | Rebuttal |
|---|---|
| "I'll write the test after, it's faster." | A test written after tends to confirm the code as written, bugs included — it verifies nothing the developer didn't already believe. |
| "This bug is obvious, I don't need a regression test." | The bug being obvious now doesn't stop it recurring later; the regression test is what makes it stay fixed. |
| "Deduplicating these ten similar tests into a loop is cleaner." | A failure inside a loop over ten cases tells you which iteration, not which input meant something — DAMP keeps each case legible on its own. |

## Red Flags

- A test was added after the implementation and passes on the first run
  with no red phase observed.
- The test suite is almost entirely end-to-end, or almost entirely mocked
  unit tests with no integration layer.
- A shared test helper has grown branches to handle multiple unrelated
  cases.

## Verification

- The red-green sequence is demonstrable: the failing run and the passing
  run both exist (in history or output), not just the final green state.
- Coverage roughly follows the pyramid shape for the change's layer, and any
  deviation is stated, not silent.
