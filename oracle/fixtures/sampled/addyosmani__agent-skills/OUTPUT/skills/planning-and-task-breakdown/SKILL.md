---
name: planning-and-task-breakdown
description: Decompose specs into small, verifiable tasks with acceptance criteria and dependency ordering. Use when a spec exists and needs implementable units.
---

## Overview

A spec describes an end state; a plan describes the sequence of small,
checkable moves that gets there. Skipping straight from spec to code means
the first time anyone finds out a task was bigger than it looked is
mid-implementation, with partial work on the stack.

## When to Use

- A confirmed spec exists (see `spec-driven-development`) and needs to
  become a sequence of tasks.
- An existing plan's tasks are too large to review or test as a unit.
- Dependencies between tasks haven't been made explicit and work is
  starting in an arbitrary order.

## Process

1. **Decompose against the spec's sections**, not against a guess at file
   structure — each task should trace to a specific objective or boundary
   in the spec.
2. **Size each task to be independently testable and revertible.** If a
   task can't be described with a concrete acceptance criterion in one or
   two sentences, split it further.
3. **Write an acceptance criterion per task** that states the observable
   evidence of done (a test passing, a command's output, a behavior change)
   — not "implement X."
4. **Order by dependency, not by convenience.** A task that another task's
   acceptance criterion depends on comes first, even if it's less
   interesting to build.
5. **Flag tasks with unresolved unknowns** rather than sequencing around
   them silently — an unknown hiding inside task 4 becomes everyone's
   problem when task 4 starts.
6. **Hand the ordered list to `incremental-implementation`** one task at a
   time; the plan is the contract each slice is checked against.

## Rationalizations

| Excuse | Rebuttal |
|---|---|
| "This task is obviously small, no need to write an acceptance criterion." | "Obviously small" tasks are exactly the ones that grow silently mid-implementation with nothing written down to notice against. |
| "I'll figure out the order as I go." | Discovering a dependency after starting the dependent task means redoing it; ordering up front costs one pass over a list. |
| "Combining these two tasks saves overhead." | Combined tasks share one acceptance criterion for two behaviors — a failure in either looks the same, and neither is independently revertible. |

## Red Flags

- A task's acceptance criterion is a restatement of its title.
- Two unrelated pieces of work are bundled into one task because they
  touch the same file.
- Implementation started on a task whose dependencies aren't yet done.

## Verification

- Every task has a written acceptance criterion distinct from its
  description, and traces to a specific spec section.
- The task list is ordered such that no task's acceptance criterion depends
  on a task listed after it.
