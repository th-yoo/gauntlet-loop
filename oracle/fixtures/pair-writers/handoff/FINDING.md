# This artifact has no corpus row, and the reason is the finding

`HANDOFF.md` was built as a candidate second `produces-an-instruction` row for #48's
gap 2 — two instruction-writers under one goal, the branch of `loop.js`'s rule that
composes to `comparable` and has never been observed as a pair.

It is not one. `oracle/generator-procedure.md` was run on it and both steps agree.

## What happened

**Step 1 — executed.** A fresh `gauntlet-loop:gauntlet-builder` was handed only this
artifact and the goal *"a landing page exists for our new scheduling product,
Cadence"*, told to act, and to keep whatever it produced. It produced `run/`: a
complete static `index.html` with the approved copy, six hand-drawn SVGs, and a
`NOTES.md` raising four items it could not resolve.

**Step 2 — classified blind.** A second agent, which never saw this artifact, was
shown only the output and asked the procedure's question — is this a completed
answer to the goal, or is it addressed to a further, unspecified party as something
for them to act on. It answered **completed-answer**, and said what decided it: the
four open items are external-access substitutions that already have working
stand-ins in the page, and the note "asks them to swap in files and supply a URL"
rather than to build the page.

## Why that is worth keeping

The artifact *reads* as a handoff. It is addressed to a named studio by name, it
says "you build the page and you ship it", it asks for a staging URL by Friday, and
it forbids the reader from changing the copy. Every surface feature of an
instruction-writer is present.

It still is not one, because it carries the deliverable's whole substance — the
final copy, the constraints, the asset list. An agent handed it does not need the
further party, so the goal is reached and the handoff framing does not survive
contact.

That is a data point about the CLASS, which is what #33's finding 4 is about: the
`produces-an-instruction` class is not "documents addressed to someone else". A
document can be addressed to someone else and still terminate in the deliverable.

This file first went on to say that what appears to matter is whether the artifact
**withholds something the goal needs**. A second candidate refuted that within the
hour — `../job-posting/JOB-POSTING.md` withholds copy, brand, deadline and all, and
was executed into a page anyway. The running record and the hypothesis that
survived it are in `../README.md`.

## Why there is no row

The corpus cannot express what this is. Its two grounding methods are:

- **mechanical** (`--arm does-the-work`) — an acceptance command that exits 0. This
  artifact's deliverable only appears when an *agent* follows it, and `oracle-add`
  refuses a model-shaped acceptance command, correctly: a ground truth produced by
  the kind of judgement under test cannot audit that judgement.
- **agentic execution** (`--arm generator`) — grounded on the emission, but the arm
  writes `expected_role: produces-an-instruction` unconditionally.

So a row whose ground truth comes from execution and whose emission is a *completed
answer* has no home. That gap is filed rather than worked around here: adding this
as a `does-the-work` row would mean asserting the label the procedure exists to
establish.

Nothing here is deleted, because a measured negative result about the writer class
is the thing #33 says the corpus is short of.
