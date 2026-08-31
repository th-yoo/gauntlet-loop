---
name: observability-and-instrumentation
description: Structured logging, RED metrics, OpenTelemetry tracing, symptom-based alerting - instrument as you build. Use when adding telemetry, or shipping anything that runs in production.
---

## Overview

Instrumentation added after an incident answers the question that incident
raised and no others. Instrumentation added while building answers questions
nobody has asked yet, because it was designed around what the system does,
not around what already went wrong.

## When to Use

- Adding telemetry to a new or existing system.
- Shipping anything that will run in production, as part of the same
  change rather than a follow-up.
- Setting up or revising alerting.

## Process

1. **Log in structured form**, not free text — fields an alerting or query
   system can filter and aggregate on, not a sentence that has to be
   pattern-matched.
2. **Instrument the RED metrics** for anything request-driven: Rate,
   Errors, Duration. These three answer "is this system healthy" without
   needing a specific incident to motivate each one.
3. **Add distributed tracing (e.g., OpenTelemetry) across service
   boundaries** so a slow or failing request can be localized to the hop
   that caused it, not just observed as slow overall.
4. **Alert on symptoms users would notice, not on internal causes** — alert
   on elevated error rate or latency, not on every internal retry; a cause
   without a user-visible symptom is a metric to graph, not a page to send.
5. **Instrument as you build the feature**, not after it ships — the
   `documentation-and-adrs` rule about doing the update in the same change
   applies here too: telemetry for a feature is part of that feature's
   definition of done.

## Rationalizations

| Excuse | Rebuttal |
|---|---|
| "We'll add logging once this is actually in production and we see what we need." | By the time you see what you need, the incident that would have told you already happened uninstrumented — RED metrics and structured logs are cheap to add now and expensive to reconstruct after. |
| "This internal retry is worth alerting on so we notice it." | An internal cause with no user-visible symptom is a metric to graph and review, not a page — alerting on it trains responders to ignore pages. |
| "Free-text logs are fine, we can grep them later." | Grep answers "does this string appear"; structured fields answer "what's the rate of this condition over time" — only one supports the RED metrics this skill requires. |

## Red Flags

- A production-bound feature ships with no logging, metrics, or tracing
  attached to it.
- Alerts fire on internal conditions with no corresponding user-visible
  symptom.
- Logs exist only as free text with no structured fields to query on.

## Verification

- RED metrics (rate, errors, duration) exist for the shipped feature and
  are queryable, not just logged as text.
- Every configured alert maps to a stated user-visible symptom, checked
  against `references/observability-checklist.md`.
