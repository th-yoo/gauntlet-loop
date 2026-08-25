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

---

## Re-measured in full under the fixed instrument

The first pass re-drew only the three rows the wording change put at risk. The other
eight were still stranded in the old cohort, which left the new instrument's generator
arm at one distinct artifact — a thin number that reads like a measurement.

All eleven rows have now been drawn under the current wording:

```
── instrument sha256:131b8d46350793c4…
   does-the-work    6 obs / 6 distinct / 0 wrong    0/6, 95% CI [0%, 39%]
   generator        7 obs / 5 distinct / 0 wrong    0/7, 95% CI [0%, 35%]
                    partial-handoff: 3 draws, 0 flips
```

`partial-handoff` reached the three clean draws #36 asked for and did not flip. The
other ten rows kept their classifications: the wording change fixed the case it was
written for without dragging anything across the line, which was the risk that made it
worth re-drawing all of them rather than only the target.

The old cohort's 15 observations remain in the ledger, reported separately, neither
deleted nor blended in.

## Still not a measurement

Both intervals reach past 35%. Eleven correct across eleven shapes — including three
built specifically to be hard — rules out a classifier badly wrong on obvious cases. It
does not establish accuracy, and stability is measured on exactly one row.

---

## Stability, measured on five rows instead of one

`answer stability` had been the report's own standing complaint, and after the #36 fix
it was satisfied on exactly one row — `partial-handoff`, the row the fix was about.
Every other row had a single draw, so "no flips" meant "not looked at".

Four more second draws, chosen where a flip was most plausible: the two does-the-work
rows nearest the boundary, the one declarative artifact, and one generator.

```
   does-the-work    9 obs / 6 distinct / 0 wrong    0/9, 95% CI [0%, 30%]
                    0/3 redrawn rows flipped
   generator        8 obs / 5 distinct / 0 wrong    0/8, 95% CI [0%, 32%]
                    0/2 redrawn rows flipped
```

Five rows now drawn twice, none flipped — plus `partial-handoff` drawn three times.
Before the #36 fix, the one flip in the record was on that row.

One draw is worth quoting, because it shows the rule being applied rather than
pattern-matched. On `sql-schema`, the second drawer noticed the schema's primary key is
a surrogate `id` rather than `email` itself, called the fit to *"keyed by email"*
imperfect — and still answered `does-the-work`, citing the clause: a partial or
imperfect attempt at the goal is not a handoff.

**What this still does not support.** Six rows in one arm and five in the other, both
intervals past 30%, and five of eleven rows have any stability evidence at all. The
report continues to say so.
