---
name: debugging-and-error-recovery
description: Five-step triage - reproduce, localize, reduce, fix, guard. Stop-the-line rule, safe fallbacks. Use when tests fail, builds break, or behavior is unexpected.
---

## Overview

A fix attempted before the failure is reproduced tends to patch a symptom
that happened to be nearby, not the cause. This skill orders debugging so
that a fix is only attempted once the failure is understood well enough to
predict it, not just once a plausible-looking change makes the symptom go
away.

## When to Use

- A test fails.
- A build breaks.
- Observed behavior doesn't match the spec or a reasonable expectation, even
  without an explicit error.

## Process

1. **Reproduce.** Get the failure to happen on demand, with a known set of
   steps or inputs. A failure that can't yet be reproduced isn't ready to be
   fixed — go back to reproducing it, don't guess.
2. **Localize.** Narrow the failure to the smallest region of code or
   smallest input that still triggers it — a specific function, a specific
   commit, a specific input shape.
3. **Reduce.** Strip the reproduction down further: remove anything that
   isn't necessary to trigger the failure, so the eventual fix is aimed at
   the actual cause and not incidental context.
4. **Fix.** Change the localized, reduced cause — following
   `test-driven-development`, the reduced reproduction becomes the
   regression test written before the fix.
5. **Guard.** Add whatever prevents this class of failure from recurring
   silently: the regression test, a stricter type, an assertion, a linter
   rule — chosen for the actual failure mode, not a generic catch-all.
6. **Apply the stop-the-line rule**: a failure discovered while working on
   something else gets triaged (at least reproduced and localized) before
   continuing the original task, rather than being noted and left running.
   Use a safe fallback (feature flag off, previous version) if continuing
   to operate un-triaged would compound the damage.

## Rationalizations

| Excuse | Rebuttal |
|---|---|
| "I can see what's probably wrong, I'll just fix it." | A fix aimed at what's "probably" wrong without reproducing the failure first often changes something true and leaves the actual cause in place. |
| "This bug is unrelated to what I'm doing, I'll note it and move on." | The stop-the-line rule exists because "note it and move on" is how a known, reproducible bug ships anyway — triage it now, even briefly. |
| "The fix worked, no need for a guard." | The fix stops this instance; the guard is what stops the next one — without it, the same class of bug recurs under a different trigger. |

## Red Flags

- A fix was made without ever reproducing the original failure on demand.
- The same class of bug has recurred more than once with no guard added
  after the first fix.
- A bug found mid-task was left un-triaged and un-flagged.

## Verification

- The reproduction steps, the localized cause, and the guard added are all
  recorded — not just the diff that fixed it.
- The regression test added in the Guard step fails against the pre-fix
  code and passes against the post-fix code.
