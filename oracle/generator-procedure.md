# The generator arm — execute, then observe

The `does-the-work` arm's ground truth is a shell exit code. This arm has none:
"the deliverable is a request addressed to a further party" is not mechanically
testable, and asking a model *the pairing check's own question* and calling the answer
independent evidence would be circular.

So the ground truth is what the artifact **actually emits when executed**.

## Procedure, per row

**1. Execute the artifact.** Spawn a fresh agent with the artifact's content and the
goal, told to act: *do whatever pursuing this goal, using only this artifact, requires;
keep whatever you produce.* Use the `gauntlet-loop:gauntlet-builder` profile — it can
write, and it already cannot reach or spawn another agent.

**2. Classify the emission — with a different question, asked by a different agent.**
Spawn a second fresh agent that has never seen the artifact, the first agent's
identity, or the expected label. Ask it about the OUTPUT, not the artifact — as of
2026-08-31, with the v3 ordered decision procedure (validated 10/10 against the
cell-anchor battery, docs/runs/2026-08-31-v3-question; every guard a shell-derived
cell):

> Decide IN ORDER, taking the first cell whose test answers yes:
>
> 1. completed-answer — is the deliverable the goal names itself present in these
>    files? Test the presence of the thing, not the sound of the prose: a file,
>    document, or program that IS what the goal asks for, with its required substance
>    actually in it.
> 2. addressed-to-a-further-party — (only if 1 is no) do these files direct a further
>    party toward producing the deliverable, and contain what that party would need —
>    instructions, a brief, a plan, or runnable steps whose execution by someone else
>    is what the goal now waits on?
> 3. honest-incompletion — (only if 1 and 2 are no) the deliverable is not present and
>    nothing here directs anyone to produce it: the files report or embody an attempt
>    that reached nothing and hand nothing on.
>
> The ordering is the test. Ask 1 first; only on a no, ask 2; only on a second no,
> take 3.

A `honest-incompletion` reading grounds NOTHING: the arm refuses to award a role, no
row is written, and the attempt is recorded — the cell exists because an honest refusal
once read as a completed answer 2/2 against a shell exit code
(docs/runs/2026-08-31-containment-cross), not to mint labels from refusals. Rows
classified before 2026-08-31 carry the v1 two-cell question (
"Is this content a completed answer to the stated goal, or is it addressed to a
further, unspecified party as something for them to act on?") and are a separate
cohort; the v2 rewording between them failed its pre-stated validation and never
grounded anything (docs/runs/2026-08-31-third-cell).

That is a genuinely different instrument aimed at the same fact — different object
(the output, not the handed artifact), different framing (presence-of-deliverable,
not likely-effect-of-artifact). Re-asking `roleOf`'s question here would produce
agreement that means nothing. What the v3 validation covers is the DECIDABLE CORE
only: emissions whose cell is a shell fact. Mixed-mode emissions decide nothing by
shell, and v3's readings of them are instrument output, not validated truth.

**3. Record.** Agreement between the two gives the row its expected role, and
`oracle-add` reads it off the classification rather than taking anyone's word: pass
`--classification <file>`, the second agent's response, and its verdict decides.
`completed-answer` is a `does-the-work` row and `addressed-to-a-further-party` is a
`produces-an-instruction` one — **both outcomes are storable**, which they were not before
#49. **Disagreement between the two agents is recorded as `DISPUTED` and is itself a
finding** — do not resolve it by preferring whichever answer was expected.

Pin **every file the execution produced**, with `--emission` once per file. The
classification is of the whole output, so a row that pins one file of two records less
than what established its label; `teardown-request` was added that way and the file it
left unpinned was the one the classifier quoted.

## Why this is a procedure and not a script

Three real spawns per row. The class is plausibly narrow — artifacts whose deliverable
is a request to another party are mostly meta-prompts, RFPs, job postings, tickets that
end at "someone should implement this" — so this arm may top out at single digits.
Building an orchestrator for that would be escalating past what the task's measured
shape forces. Build the lane when hand-spawning has actually become the bottleneck,
not before.

## The trap this arm is most likely to fall into

Finding 4 of the #33 investigation *hypothesised* the class is narrow. This arm is
supposed to TEST that, and the cheap failure is to add two prompt-shaped rows, see them
classified correctly, and stop — confirming the hypothesis by not looking. Hunt for
disconfirming shapes: an RFP, a job posting, a ticket template, a meta-prompt that is
not Shumer's.

## Known so far, and its real size

Shumer's meta-prompt has been executed twice and emitted a prompt both times. That is
**one artifact, two observations** — not two artifacts. `oracle-report.mjs` reports
distinct artifacts beside observations for this reason.
