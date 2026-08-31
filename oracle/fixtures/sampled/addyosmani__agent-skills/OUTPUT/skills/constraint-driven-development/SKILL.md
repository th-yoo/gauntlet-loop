---
name: constraint-driven-development
description: Interviews for a quality bar with sane default thresholds, writes CONSTRAINTS.md, places each check by cost, and catches agents silencing checks or skipping tests to get green. Use when no standards are written down, or an agent is producing more than anyone reads.
---

## Overview

An unwritten quality bar gets renegotiated every time it's inconvenient,
because there's nothing to point at. This skill writes the bar down once, as
`CONSTRAINTS.md`, with concrete thresholds and where each check runs — then
treats every later attempt to loosen or bypass a check as a violation to be
caught, not a judgment call to be re-litigated.

## When to Use

- No CONSTRAINTS.md or equivalent exists and standards are being decided ad
  hoc per change.
- An agent's output volume has grown past what anyone actually reviews.
- A check was silenced, skipped, or its threshold quietly loosened to get a
  build green.

## Process

1. **Interview for the actual bar**, not an aspirational one: coverage
   floor, lint strictness, performance budgets, security gates. Default to
   sane, named thresholds (e.g., "80% line coverage on changed files") when
   the user has no opinion yet, and say explicitly that the default was
   used.
2. **Write `CONSTRAINTS.md`** with one row per check: what it verifies, the
   threshold, and where it runs (pre-commit, CI, pre-merge). A constraint
   with no stated enforcement point is a suggestion, not a constraint.
3. **Place each check by cost.** Fast, cheap checks (lint, type-check) run
   pre-commit; slower ones (full test suite, security scan) run in CI;
   expensive ones (load test, manual review) run pre-merge. Placing an
   expensive check where a cheap one belongs is itself a violation of this
   skill.
4. **Detect the two failure modes explicitly**:
   - *Silencing*: a check is disabled, a lint rule suppressed, or a test
     deleted rather than fixed, to reach green.
   - *Skipping*: a task is marked done without the check that
     `CONSTRAINTS.md` requires for it having been run at all.
   Either one, caught anywhere in the pipeline, is reported as a violation
   of the written bar, not absorbed silently.
5. **Revisit thresholds deliberately, not accidentally.** A threshold change
   is itself a change to `CONSTRAINTS.md`, reviewed the same way any other
   spec change is.

## Rationalizations

| Excuse | Rebuttal |
|---|---|
| "This one test is flaky, I'll just skip it for now." | "For now" is how a skipped check becomes a permanently skipped check; fix the flake or file it as a tracked exception, don't silently drop it. |
| "The coverage threshold is arbitrary, I'll lower it to match what we have." | Lowering the bar to match current output isn't meeting the bar, it's redefining it after failing to meet it — that's a constraint change, make it as one, explicitly. |
| "Nobody reads CONSTRAINTS.md anyway." | If nobody reads it, that's the reason to make it the thing every check points at, not the reason to skip writing it. |

## Red Flags

- A CI config disables or downgrades a check with no corresponding update to
  `CONSTRAINTS.md`.
- A merged change has a task marked complete with no evidence the
  constraint tied to it ran.
- Thresholds differ between what's documented and what's actually enforced.

## Verification

- `CONSTRAINTS.md` exists, every row names a threshold and an enforcement
  point, and the enforcement point actually runs that check (not a stub).
- Any check silenced or skipped since the last review is listed explicitly,
  with a reason and an owner — not absent from the record.
