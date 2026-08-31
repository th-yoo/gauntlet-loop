---
name: using-agent-skills
description: Maps incoming work to the right skill workflow and defines the shared operating rules every other skill inherits. Use when starting a session or deciding which skill applies to the current request.
---

## Overview

This is the router. It does not do the work of any lifecycle phase; it
decides which skill should, and it states the handful of rules that apply
across every skill in the pack so they don't need to be repeated in each one.

## When to Use

- At the start of a session, before any other skill has been chosen.
- Whenever a request doesn't obviously match one skill, or plausibly matches
  several.
- Whenever an agent is tempted to freelance a workflow instead of loading the
  skill that already defines it.

## Process

1. **Classify the request** against the trigger table below. Match on what
   the user is trying to *accomplish*, not the words they used — "make the
   login page look right on mobile" triggers `frontend-ui-engineering`, not
   a literal search for "mobile."
2. **Load exactly the skill(s) that match.** Most requests match one skill.
   A request that spans phases (e.g., "add this feature") loads the skill
   for the *current* phase and defers to the next skill once its
   verification step passes — it does not load all of them speculatively.
3. **If nothing matches confidently, ask.** Use `interview-me`-style
   single-question clarification rather than guessing which skill applies
   and running the wrong workflow to completion.
4. **Never let a skill invoke another skill's authority for itself.** A
   persona under `agents/` can *recommend* invoking a skill; it does not
   silently perform that skill's steps under its own name. See
   `references/orchestration-patterns.md`.
5. **Shared operating rules**, inherited by every skill below unless a skill
   explicitly overrides one:
   - A step is not done until its Verification evidence exists, not when the
     work "should" satisfy it.
   - A rationalization named in a skill's table is refused, not negotiated,
     the first time it's reached for.
   - Any check placed by `constraint-driven-development` is enforced, not
     silenced, by every other skill that runs after it.

## Trigger table

| Signal in the request | Skill |
|---|---|
| Ask is vague, or user says "interview me" / "grill me" | `interview-me` |
| Rough concept, no shape yet | `idea-refine` |
| New project, feature, or significant change, no written spec yet | `spec-driven-development` |
| No quality bar written down, or agent output nobody reads | `constraint-driven-development` |
| Spec exists, needs implementable units | `planning-and-task-breakdown` |
| Any change touching more than one file | `incremental-implementation` |
| Implementing logic, fixing a bug, changing behavior | `test-driven-development` |
| Starting a session, switching tasks, output quality dropping | `context-engineering` |
| Need source-cited code for a framework/library | `source-driven-development` |
| High stakes, unfamiliar code, or a confident-sounding output | `doubt-driven-development` |
| Building or modifying a user-facing interface | `frontend-ui-engineering` |
| Designing an API, module boundary, or public interface | `api-and-interface-design` |
| Building or debugging anything that runs in a browser | `browser-testing-with-devtools` |
| A test fails, a build breaks, behavior is unexpected | `debugging-and-error-recovery` |
| Before merging any change | `code-review-and-quality` |
| Code works but is harder to read than it should be | `code-simplification` |
| Handling user input, auth, storage, or an external integration | `security-and-hardening` |
| Performance requirements exist, or a regression is suspected | `performance-optimization` |
| Making any code change | `git-workflow-and-versioning` |
| Setting up or modifying build/deploy pipelines | `ci-cd-and-automation` |
| Removing an old system, migrating users, sunsetting a feature | `deprecation-and-migration` |
| Making an architectural decision, changing an API, shipping a feature | `documentation-and-adrs` |
| Adding telemetry, or shipping anything that runs in production | `observability-and-instrumentation` |
| Preparing to deploy to production | `shipping-and-launch` |

## Rationalizations

| Excuse | Rebuttal |
|---|---|
| "This request is simple enough to skip the routing step." | The routing step is one classification, not a workflow; skipping it is how a bug fix quietly skips `test-driven-development`. |
| "I'll just follow the general shape of the right skill from memory." | Skills exist because "the general shape" is exactly what gets shortcut under pressure — load the file. |
| "Multiple skills apply, I'll blend them into one pass." | Load the skill for the current phase; blending erases the verification gate each one ends with. |

## Red Flags

- A change is being made with no skill loaded and no reason given for why
  none applies.
- A skill's steps are being paraphrased from memory rather than the file
  being open and followed.
- A persona (`agents/*.md`) is executing a lifecycle skill's process under
  its own name instead of naming the skill it's invoking.

## Verification

- The chosen skill (or the decision that none applies, plus the question
  asked instead) is stated before work starts, not reconstructed after the
  fact.
- If a request spanned more than one skill, each skill's own Verification
  section was satisfied before the next one loaded.
