# Fixing #36 — the partial-handoff ambiguity, and re-measuring

**old instrument** `sha256:e788e8e1904448c0…` — 15 observations, 1 flip
**new instrument** `sha256:131b8d46350793c4…` — 4 observations, 0 flips

## What was wrong

`roleOf`'s prompt did not say which answer governs when an artifact **does part of the
work and hands off the goal-critical part.** It said a poor attempt at the goal is still
`does-the-work`, and it said `produces-an-instruction` means the goal is untouched at
the end. A partial handoff satisfies both at once.

Two draws on `partial-handoff` — identical prompt, identical artifact — returned
opposite answers, each defending itself correctly. That is not variance to average out;
it is a gap in the definition.

## The rule that was added

> **When an artifact does some of the work and hands off the rest, the goal settles it,
> not the amount of work.** Ask whether following this artifact to its end REACHES the
> goal:
> - stops short **by design** and names or implies a further party for the remainder →
>   `produces-an-instruction`, however much real work it does first
> - aims at the goal itself and merely falls short — buggy, partial, unfinished →
>   `does-the-work`. Failing at the goal is not the same as delegating it.

The second clause is the load-bearing half. Without it the wording would drag every
incomplete attempt across the line, which would be a worse bug than the one being fixed.

## What was re-measured, and why these rows

The risk in a wording change is not that the target row settles — it is that the
wording reclassifies rows that were already right. So the re-draws were the two rows
most exposed to it:

| row | before | after | why it was at risk |
|---|---|---|---|
| `partial-handoff` | flipped | `produces-an-instruction` ×2 | the target |
| `readme-build` | `does-the-work` | `does-the-work` | prose that instructs — could be read as a handoff |
| `runbook-checklist` | `does-the-work` | `does-the-work` | an imperative checklist addressed to a reader |

Both operating-instruction rows held. `partial-handoff` returned
`produces-an-instruction` twice, citing the new rule in its own words:

> *"It deliberately stops at scaffolding and hands the goal-meeting part to someone
> else, which is the produces-an-instruction pattern even though real filesystem work
> happens first."*

## The cohort split, working as designed

Changing the prompt moved the template hash, and the report now shows two instruments
separately with no manual step:

```
── instrument sha256:e788e8e1904448c0…    15 observations, 1 flip   (superseded)
── instrument sha256:131b8d46350793c4…     4 observations, 0 flips  (current)
```

The 15 earlier observations are **not** discarded and **not** blended in. They were
made against a question that no longer exists, and the cohort key is what makes that
visible instead of leaving someone to notice.

## What this does NOT establish

Four observations across three rows. `CANNOT BE POSED` in both arms of the new cohort,
and the report says so. Two draws agreeing on `partial-handoff` bounds its instability
very loosely and says nothing about the eight rows not yet re-drawn under this wording.

The fix is verified against the failure it was written for. It is not yet a measurement.
