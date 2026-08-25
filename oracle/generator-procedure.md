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
identity, or the expected label. Ask it about the OUTPUT, not the artifact:

> Is this content a completed answer to the stated goal, or is it addressed to a
> further, unspecified party as something for them to act on?

That is a genuinely different instrument aimed at the same fact — different object
(the output, not the handed artifact), different framing (addressee-of-output, not
likely-effect-of-artifact). Re-asking `roleOf`'s question here would produce agreement
that means nothing.

**3. Record.** Agreement between the two gives the row its expected role. **Disagreement
is recorded as `DISPUTED` and is itself a finding** — do not resolve it by preferring
whichever answer was expected.

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
