---
name: spec-driven-development
description: Write a PRD covering objectives, commands, structure, code style, testing, and boundaries before any code. Use when starting a new project, feature, or significant change.
---

## Overview

Code written against an implicit spec absorbs whatever the agent guessed at
the moment it wrote each line, and those guesses drift as the session goes
on. Writing the spec first, as a document rather than a mental model, gives
every later step — planning, implementation, review — the same fixed
reference point.

## When to Use

- Starting a new project or a feature with no existing spec.
- A change is significant enough that "just start coding" would require
  redoing work if the shape turns out wrong.
- An existing spec is stale relative to what's actually being built.

## Process

1. **State the objective in one sentence**: what this accomplishes and for
   whom. If it can't fit in one sentence, the scope isn't settled yet — loop
   back to `idea-refine` or `interview-me`.
2. **Write the PRD sections, in order**:
   - *Objectives* — what success looks like, measurably.
   - *Commands* — how a person or CI invokes this (build, run, test).
   - *Structure* — where new code lives and why, relative to what exists.
   - *Code style* — conventions this change follows, and any it introduces.
   - *Testing* — what must be proven true, and at what level (unit,
     integration, end-to-end).
   - *Boundaries* — what this explicitly does not do. This section is not
     optional; scope creep lives in the boundary nobody wrote down.
3. **Cross-check the spec against the codebase**, not just against the
   request — a spec that contradicts an existing convention needs to say so
   explicitly, not silently diverge from it.
4. **Get explicit sign-off before planning starts.** A spec that was written
   but never confirmed is a draft, not a contract.
5. **Treat the spec as the source of truth for the rest of the lifecycle.**
   `planning-and-task-breakdown` decomposes it; `code-review-and-quality`
   checks the diff against it; a change to scope mid-implementation means
   the spec gets updated, not silently outrun.

## Rationalizations

| Excuse | Rebuttal |
|---|---|
| "This change is small, it doesn't need a spec." | "Small" is a claim the Boundaries section makes falsifiable; without it, small changes are exactly where scope creeps unnoticed. |
| "I'll write the spec and code at the same time." | A spec written alongside the code it describes just documents what happened, not what should — it can't catch a wrong turn because it was written after the turn. |
| "The requirements are obvious from the request." | If they were, the one-sentence objective would have been easy to write; if it wasn't easy, they weren't obvious. |

## Red Flags

- Code changes exist with no corresponding spec section, or a spec section
  with no corresponding boundary.
- The Boundaries section is empty or generic ("out of scope: everything
  else").
- A significant scope change happened mid-build and the spec was never
  updated to match.

## Verification

- The PRD exists as a file, has all six sections populated with specifics
  (not placeholders), and was explicitly confirmed before planning began.
- Every task in the resulting plan traces back to a specific spec section.
