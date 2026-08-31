---
name: git-workflow-and-versioning
description: Trunk-based development, atomic commits, change sizing (~100 lines), the commit-as-save-point pattern. Use when making any code change (always).
---

## Overview

A commit is the smallest unit that can be reverted, bisected, or reviewed in
isolation. This skill treats commit boundaries as a deliberate part of the
work, not an afterthought applied once a session's changes are already
tangled together.

## When to Use

- Always — every code change goes through this skill's commit discipline,
  regardless of size.

## Process

1. **Work on trunk (or a short-lived branch merged quickly) in small,
   frequent integrations**, rather than long-lived branches that accumulate
   conflicting drift with everyone else's work.
2. **Make each commit atomic**: one logical change, complete and correct on
   its own — buildable and (where applicable) passing tests at that commit,
   not only at the branch tip.
3. **Size commits toward the same ~100-line target `code-review-and-quality`
   uses for diffs** — a commit that can't be reviewed as a unit usually
   can't be reverted as a clean unit either.
4. **Treat each commit as a save point.** Commit as soon as a slice from
   `incremental-implementation` is verified, so there's always a recent,
   working point to return to rather than losing a session's progress to
   one bad edit.
5. **Write commit messages that state why, not just what** — the diff
   already shows what changed; the message is for the reason a future
   reader (or bisect) needs and the diff can't supply.
6. **Never rewrite shared history** (force-push over commits others have
   based work on) without explicit coordination.

## Rationalizations

| Excuse | Rebuttal |
|---|---|
| "I'll commit everything at the end in one big commit." | One commit at the end can't be bisected or partially reverted — if slice three breaks something, the whole commit is what you're stuck reverting. |
| "The commit message can just say 'fix stuff', the diff explains itself." | The diff shows what changed; it can't show why an alternative was rejected — that's the part a message needs to carry. |
| "This branch has been open a while, I'll merge it as one big commit to keep history clean." | A branch open long enough to accumulate that much drift is the trunk-based-development problem this skill exists to prevent, not a reason to compress the evidence of it. |

## Red Flags

- A single commit spans multiple unrelated logical changes.
- Commit messages consist only of "fix", "wip", or similar with no reason
  stated.
- A long-lived branch has diverged far enough from trunk that merging it
  requires resolving substantial conflicts.

## Verification

- Each commit builds and passes its own relevant tests in isolation
  (checkable via a tool like bisect), not only at the tip of the branch.
- Commit messages state the reason for the change, not only a restatement
  of the diff.
