# Observability Checklist

Supplementary detail for `skills/observability-and-instrumentation/SKILL.md`.

## On-call questions this system should be able to answer

- [ ] Is this system healthy right now? (RED metrics, at a glance)
- [ ] If it's not healthy, which dependency or code path is responsible?
      (tracing)
- [ ] What changed recently that could explain a new symptom? (deploy
      markers correlated with metrics)
- [ ] Can I reconstruct what happened to a specific failed request?
      (structured logs with a correlation/trace ID)

If any of these can't be answered from the tooling as it exists today, that
gap is the next instrumentation task — not a gap to discover during an
incident.

## Structured logging

- [ ] Logs are emitted as structured fields (JSON or equivalent), not free
      text requiring pattern matching.
- [ ] Every log line includes a correlation/trace ID connecting it to the
      request or job it belongs to.
- [ ] Log levels are used consistently (error = actionable failure, warn =
      degraded but handled, info = normal operation milestones) — not
      everything logged at `info` or everything at `error`.

## RED metrics (per request-driven service/endpoint)

- [ ] **Rate**: requests per unit time.
- [ ] **Errors**: error rate, broken out by error type/status where
      possible.
- [ ] **Duration**: latency distribution (p50/p95/p99, not just average —
      an average hides the tail that users actually feel).

## USE metrics (per resource — CPU, memory, connection pool, queue)

- [ ] **Utilization**: percent of capacity in use.
- [ ] **Saturation**: work queued waiting for the resource.
- [ ] **Errors**: resource-level error events (e.g., connection refused).

## Tracing

- [ ] Distributed traces span every service boundary a request crosses.
- [ ] A trace can be found starting from a single request ID a user or
      support agent could plausibly report.

## Symptom-based alerting

- [ ] Every alert maps to a user-visible symptom (elevated error rate,
      elevated latency, a failed critical path) — not an internal cause
      with no visible effect.
- [ ] Alert thresholds are set from historical baseline data, not a
      round-number guess.
- [ ] Every alert has a runbook link or next-step guidance, not just a
      page with no context.

## Pre-launch observability gate

- [ ] RED metrics exist and are receiving live data for the feature being
      launched, confirmed before traffic hits it.
- [ ] At least one alert exists mapped to the feature's most likely
      failure mode.
