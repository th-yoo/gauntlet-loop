---
name: shipping-and-launch
description: Pre-launch checklists, feature flag lifecycle, staged rollouts, rollback procedures, monitoring setup. Use when preparing to deploy to production.
---

## Overview

The moment right before a launch is the last cheap point to catch a missing
rollback plan or an unmonitored failure mode — every moment after is spent
inside whatever gap wasn't caught. This skill is the final gate that checks
the things every earlier skill assumed would exist by the time launch
arrived.

## When to Use

- Preparing to deploy any change to production.
- A feature flag is transitioning from off to a staged rollout, or from
  rollout to fully on.

## Process

1. **Confirm the pre-launch checklist**: tests passing
   (`test-driven-development`), review complete
   (`code-review-and-quality`), security checks clear
   (`security-and-hardening`), telemetry in place
   (`observability-and-instrumentation`). This skill doesn't redo those
   checks; it confirms they actually happened, with evidence, not from
   memory.
2. **Manage the feature flag lifecycle deliberately**: off by default at
   deploy, staged rollout to increasing traffic percentages with a
   monitoring check between stages, then fully on — and eventually remove
   the flag once it's no longer providing optionality (`code-simplification`
   territory, but the removal is this skill's responsibility to schedule).
3. **Write the rollback procedure before launch, not during an incident.**
   State exactly what reverses this change (flag off, previous version,
   database migration reversal) and confirm it's actually exercised, not
   just described.
4. **Set up monitoring for this specific launch** before traffic hits it —
   the RED metrics and alerts from `observability-and-instrumentation`,
   confirmed live and receiving data, not just configured in principle.
5. **Stage the rollout and check monitoring at each stage** before
   advancing to the next — advancing on a timer rather than on a clean
   monitoring check defeats the purpose of staging.

## Rationalizations

| Excuse | Rebuttal |
|---|---|
| "We tested this thoroughly, we can go straight to 100% rollout." | Thorough testing catches what testing can reproduce; staged rollout catches what only production traffic surfaces — they check different things. |
| "The rollback is just flipping the flag, no need to write it down or test it." | "Just flipping the flag" tested for the first time during an incident is the worst time to discover it doesn't fully revert the change. |
| "Monitoring is already set up generally, this launch doesn't need its own check." | General monitoring may not cover this launch's specific new failure mode — confirm the specific metric exists and is receiving data before traffic hits it. |

## Red Flags

- A launch proceeds straight to full rollout with no staged percentage in
  between.
- A rollback procedure exists only as a description, never actually
  exercised.
- Monitoring for a launch is assumed to exist rather than confirmed live.

## Verification

- The pre-launch checklist items each have evidence attached (a passing
  test run, an approved review, a clean security check, a live dashboard),
  not a checkmark taken on faith.
- The rollback procedure was exercised at least once (in staging or via a
  dry run) before it's relied on in production.
