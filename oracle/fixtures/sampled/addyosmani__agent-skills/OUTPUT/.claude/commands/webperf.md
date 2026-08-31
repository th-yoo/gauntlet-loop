---
description: Audit web performance. Measure before you optimize.
skill: performance-optimization
agent: web-performance-auditor
---

Run the `web-performance-auditor` persona (see
`agents/web-performance-auditor.md`), backed by the
`performance-optimization` skill (see
`skills/performance-optimization/SKILL.md`).

Choose Quick mode (headline Core Web Vitals via
`references/performance-checklist.md`) or Deep mode (full
`browser-testing-with-devtools` profiling) explicitly, and state which was
used. Report measured values with their measurement conditions — never an
inferred or estimated number reported as measured.

If this audit follows a proposed optimization, report before/after values
taken the same way, and name the specific bottleneck the fix targeted.
