---
description: Set the quality bar. Decide it once, enforce it everywhere.
skill: constraint-driven-development
---

Run the `constraint-driven-development` skill (see
`skills/constraint-driven-development/SKILL.md`).

Interview for the actual quality bar (coverage floor, lint strictness,
performance budgets, security gates), defaulting to named, sane thresholds
when the user has no opinion yet and saying explicitly when a default was
used. Write `CONSTRAINTS.md` with one row per check: what it verifies, its
threshold, and where it's enforced (pre-commit / CI / pre-merge).

On every later command in this pack, check for silencing (a check disabled
or a test deleted to reach green) or skipping (a task marked done with no
evidence its required check ran), and report either as a violation, not a
judgment call.
