---
name: ci-cd-and-automation
description: Shift Left, Faster is Safer, feature flags, quality gate pipelines, failure feedback loops. Use when setting up or modifying build and deploy pipelines.
---

## Overview

A defect caught in production costs an incident; the same defect caught in
CI costs a red build; caught pre-commit it costs a moment. This skill places
each check as early in the pipeline as it can run reliably (Shift Left), and
treats pipeline speed itself as a safety property, not just a convenience
one — a slow pipeline is one people route around.

## When to Use

- Setting up a new build or deploy pipeline.
- Modifying an existing pipeline's stages or gates.
- A defect reached production that a pipeline stage should have caught.

## Process

1. **Shift each check as early as it can reliably run.** Lint and
   type-check pre-commit; unit tests and fast integration tests in CI on
   every push; expensive checks (full end-to-end, load tests) at a later
   gate that doesn't block every push. Placement follows `CONSTRAINTS.md`
   from `constraint-driven-development`, not convenience.
2. **Treat "Faster is Safer" as a real constraint on pipeline design**: a
   pipeline slow enough that people skip it or batch changes around it
   produces worse outcomes than a faster pipeline with a slightly narrower
   per-push check set and a fuller nightly or pre-merge one.
3. **Gate deploys on the quality checks that matter for that stage**, not
   on every check that exists — a staging deploy gate and a production
   deploy gate can differ in what they require.
4. **Use feature flags to decouple deploy from release** — a change can
   reach production dark, then be enabled deliberately, so a bad deploy and
   a bad release are two separately reversible events rather than one.
5. **Close the failure feedback loop fast and specifically.** A failing
   pipeline stage should tell the person who triggered it what failed and
   why within the time it takes to context-switch away, not require digging
   through logs to find the actual assertion that failed.

## Rationalizations

| Excuse | Rebuttal |
|---|---|
| "This check is important, run it on every push regardless of cost." | Importance justifies running it somewhere, not running it everywhere — an expensive check on every push is what makes people start skipping the pipeline. |
| "We'll skip the flag and just deploy straight to production, it's a small change." | The flag isn't insurance against the change being wrong, it's insurance against the five minutes after deploy when nobody yet knows whether it is. |
| "The pipeline failure log has everything, that's enough feedback." | A wall of log output that requires digging is a slower feedback loop in practice than one that surfaces the actual failing assertion up front. |

## Red Flags

- An expensive check runs on every push and people are visibly starting to
  batch commits to avoid triggering it.
- A production incident traces back to a defect a pipeline stage could
  have caught but wasn't placed to catch.
- Deploys and releases are the same event, with no flag decoupling them.

## Verification

- Each pipeline stage's checks are traceable to `CONSTRAINTS.md`'s stated
  enforcement point for that check.
- A failing stage's output names the specific failure within the pipeline
  log's first screen, not buried in full output.
