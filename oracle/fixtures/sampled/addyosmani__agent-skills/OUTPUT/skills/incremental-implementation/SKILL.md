---
name: incremental-implementation
description: Thin vertical slices - implement, test, verify, commit. Feature flags, safe defaults, rollback-friendly changes. Use when any change touches more than one file.
---

## Overview

A large change built in one pass and tested at the end fails in a way that's
expensive to localize — the failure could be anywhere in the diff. A thin
vertical slice, tested and committed before the next one starts, fails in a
way that's cheap to localize: it's in the slice just written.

## When to Use

- A task from `planning-and-task-breakdown` is about to be implemented.
- Any change touches more than one file.
- A change is risky enough that a rollback path matters.

## Process

1. **Take one task at a time.** Do not start the next task's code before
   the current one's slice is committed.
2. **Implement the smallest vertical slice** that makes the task's
   acceptance criterion checkable — through the real path (not a stub) even
   if narrow in scope.
3. **Test the slice** per `test-driven-development` before moving on.
4. **Default to safe and reversible.** New behavior behind a feature flag or
   a safe default where the blast radius of being wrong matters; a change
   that can't be flagged should at minimum be easy to revert in one commit.
5. **Verify the slice against its acceptance criterion**, not against "it
   compiles."
6. **Commit the slice** per `git-workflow-and-versioning` before starting
   the next task. A commit boundary at every slice is what makes rollback
   cheap later.

## Rationalizations

| Excuse | Rebuttal |
|---|---|
| "I'll implement the whole feature then test it all together." | Testing at the end means a failure could be in any of several slices; testing per slice means it's in the one just written. |
| "This slice is too small to be worth its own commit." | A small commit costs nothing extra to make and everything to reconstruct later if the slice needs reverting alone. |
| "A feature flag is overkill for this change." | The flag isn't for this change succeeding, it's for the five minutes after deploy when it hasn't yet — cheap insurance, expensive to add retroactively. |

## Red Flags

- A diff spans multiple tasks from the plan with one commit at the end.
- A slice was marked done without running its own test.
- New behavior went live with no flag and no easy single-commit revert.

## Verification

- Each task from the plan has its own commit, and that commit's tests pass
  on their own, not only as part of the full suite.
- The acceptance criterion from the plan is demonstrably met by the slice
  that closes it — quote the passing test or command output, not a
  description of expected behavior.
