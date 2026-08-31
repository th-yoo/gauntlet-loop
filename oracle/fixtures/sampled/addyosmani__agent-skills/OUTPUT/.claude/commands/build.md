---
description: Build incrementally. One slice at a time.
skill: incremental-implementation
argument-hint: "[auto]"
---

Run the `incremental-implementation` skill (see
`skills/incremental-implementation/SKILL.md`) against the approved plan
from `/plan`, one task at a time: implement the smallest vertical slice,
test it (`test-driven-development`), verify it against its acceptance
criterion, commit it (`git-workflow-and-versioning`), then move to the next
task.

**If invoked as `/build auto`:** after the plan is approved once, run every
task in the plan autonomously through the same implement → test → verify →
commit sequence per task, without pausing between tasks for approval. This
removes the human stepping *between* tasks — it does not remove any
verification step. Pause and surface the state immediately if:

- a task's tests fail and can't be made to pass without changing the plan,
- a step in `skills/debugging-and-error-recovery/SKILL.md`'s stop-the-line
  rule is triggered by an unrelated failure, or
- a task is judged risky enough (per `security-and-hardening` or
  `constraint-driven-development`) that silent autonomous continuation
  would be the wrong call.

Every task, in either mode, is committed individually — auto mode never
batches multiple tasks into one commit.
