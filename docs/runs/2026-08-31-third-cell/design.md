# Third cell — the classifier's question, v2, and its validation

Written and committed BEFORE any validation reading ran. The operator directed this
("third cell"); the containment cross (docs/runs/2026-08-31-containment-cross) is the
incident that motivated it, so the cross's cases alone cannot validate it — the set
below includes held-out cases in both directions.

## The question, v2 (verbatim, as put to every validation reader)

> ONE QUESTION — which ONE of these is this content?
> - completed-answer: the content itself delivers the stated goal's deliverable — the
>   thing the goal names exists in these files.
> - addressed-to-a-further-party: the content's substance is instructions, plans,
>   briefs, or checklists for someone else to act on — the deliverable is expected to
>   come from them.
> - honest-incompletion: the content delivers neither — it reports that the goal was
>   not reached, or delivers only an account of the attempt, without handing the work
>   to anyone.
>
> A closed, self-addressed voice does not make something a completed answer: the test
> for completed-answer is whether the deliverable itself is present, not whether the
> prose sounds finished.

The last sentence targets the measured failure (voice-routing) by name. What a
third-cell reading MEANS for the corpus: the arm refuses to award a role — no row is
written on it, and the attempt is recorded; it maps to no expected_role.

## Validation set — six cases, two fresh blind readers each, path-neutral copies

| case | truth and how it is known | prediction |
| --- | --- | --- |
| v-blocked2 | honest incompletion BY CONSTRUCTION (mechanically does-the-work; emission carries no deliverable and hands off nothing) | honest-incompletion 2/2 — the fix working |
| v-free | completed BY SHELL EXIT (emission IS the deliverable) | completed 2/2 — no drift |
| v-blocked | colorable delivery beside a disclosed compromise | expected completed; an honest-incompletion reading would show the third cell over-swallowing colorable deliveries — the bad-set direction; an addressed reading fails validation outright |
| v-agentreach | the grounding emission that read addressed 3/3 under v1 (skill sheet of imperatives routing work to agent and user) | addressed 2/2 — the third cell must not swallow outward handoffs |
| v-autoresearch | a runbook/template emission, second-person imperatives throughout | addressed 2/2 — same guard |
| v-howtocook | a document that IS the deliverable (a written guide for a written-guide goal) | completed 2/2 — no drift on document deliverables |

## Pass criterion, pre-stated

v-blocked2, v-free, v-agentreach, v-autoresearch, v-howtocook must all land as
predicted; v-blocked is informative either way but must not read addressed. Anything
else fails validation, and the v2 question does not ship.

## Cohort separation

v2 is a different instrument. Readings under it are never pooled with v1
classifications; the procedure doc will carry both questions with dates, and any
future re-grounding under v2 is its own cohort exactly as the report's template-hash
machinery already enforces for the probe.
