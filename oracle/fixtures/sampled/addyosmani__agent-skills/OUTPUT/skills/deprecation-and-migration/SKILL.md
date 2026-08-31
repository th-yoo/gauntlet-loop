---
name: deprecation-and-migration
description: Code-as-liability mindset, compulsory vs advisory deprecation, migration patterns, zombie code removal. Use when removing an old system, migrating users, or sunsetting a feature.
---

## Overview

Code that stays around after it's no longer the intended path doesn't stop
costing anything — it keeps requiring maintenance, security patching, and a
mental tax on anyone reading the codebase, while providing shrinking value.
This skill treats every piece of old code as a liability to be actively
retired, not just a thing that can be ignored until it causes a problem.

## When to Use

- An old system, API version, or feature is being replaced.
- Users need to migrate from one behavior to another.
- Code is suspected of being unused ("zombie code") but hasn't been
  confirmed or removed.

## Process

1. **Decide compulsory vs. advisory deprecation explicitly.** Compulsory:
   the old path will stop working by a stated date regardless of migration
   status. Advisory: the old path is discouraged but continues to work
   indefinitely. Pick one on purpose — a deprecation with no stated category
   defaults to being ignored.
2. **Design the migration path before announcing the deprecation** — what
   a caller does to move from old to new, ideally with an automated or
   mechanical step, not just a note saying "please migrate."
3. **Set and communicate a removal date for compulsory deprecations**, with
   enough runway for realistic migration, and hold that date once
   committed — a compulsory deprecation that keeps slipping trains
   everyone to ignore the next one.
4. **Confirm zombie code is actually unused before removing it** — check
   call sites, feature flags gating it, and any external consumers; "looks
   unused" is a hypothesis, not a finding.
5. **Remove the old path fully once its removal date passes** or its
   replacement is confirmed adopted — a deprecation that's never actually
   removed just adds a permanent second path to maintain.

## Rationalizations

| Excuse | Rebuttal |
|---|---|
| "We'll keep the old path around indefinitely just in case." | "Just in case" is an unstated advisory deprecation with no plan to ever retire it — decide the category and the date on purpose, or don't call it deprecated. |
| "This code looks unused, I'll just delete it." | "Looks unused" hasn't checked call sites, flags, or external consumers — confirm before removing, because restoring deleted code after an incident is more expensive than confirming first. |
| "The removal date is close but migration isn't done, let's just extend it again." | An extension is sometimes right, but a pattern of extensions is how compulsory deprecations become de facto permanent — extend once, deliberately, not by default. |

## Red Flags

- A deprecation notice exists with no stated category (compulsory or
  advisory) and no removal date.
- Code was removed with no check of call sites or feature-flag state
  beforehand.
- A compulsory deprecation's date has passed and the old path is still
  live with no updated plan.

## Verification

- Every active deprecation states its category, its migration path, and
  (if compulsory) its removal date.
- Removed code has a recorded check confirming it had no remaining call
  sites or active consumers at removal time.
