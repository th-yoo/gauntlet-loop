# 0002 — The false-anchor generator has no consumer, and is deleted

**Status:** decided, 2026-08-27. **Decided by:** the operator (th-yoo).
**Settles:** issue 51 — *"a live generator with no consumer"*, carried out of issue 24
whose verifier was deleted. Issue 51's own terms: *"either a consumer … or a recorded
decision to keep it dormant with the reason, or to delete it and drop its three sweep
properties. What should not happen is a third session finding it and re-asking the same
question."*

## The question

`scripts/canary.mjs` took a true anchor — a file and a line — and produced a provably
false claim about it, mechanically and deterministically, in two modes (`line-shift`,
`word-swap`). Its reasoning was sound and is worth keeping in the record:

> A verifier's specificity is only measured if something it should reject is put in
> front of it. Until now those were written by hand, by whoever knew how the verifier
> works — exactly the contamination the deleted gate sequence tried to avoid… A script
> has no knowledge to leak and no preference about which fabrications are catchable, so
> it removes the author instead of asking the author to be fair.

The verifier it was built to measure was deleted with issue 24. Nothing has fed it
anything since. Its only callers were its own test and three coverage-sweep properties —
so the repository was actively guarding a capability nobody used, and the guarding is
what made it invisible: every property CAUGHT, everything green, and no check anywhere
that asks whether the thing is used.

## What decided it, and it was not an argument

Issue 51 named exactly one thing that would keep it: a consumer, and it said where that
consumer would live — *"a specificity arm for the critic that puts generated false
anchors in front of it and counts rejections, which is #29's missing half."*

**That arm was built on 2026-08-27, and it did not use this generator.** The critic's
detection rate was measured over twenty blinded trials with
`scripts/defect-transforms.mjs` — three deterministic transforms over real repository
documents, each sealed note recording the exact before/after strings, both instruments
importing one copy. Same argument for mechanical planting, different mechanism, and it
carries something canary.mjs never had: the plant can be **re-run** from the source
document and must reproduce the note exactly, which is what `verifyPlant` now requires
of all 105 undrifted notes on file.

So the deciding fact is not a preference. The consumer arrived, and it chose otherwise.

## What was weighed against deleting

- **The reasoning is worth more than the code.** It is quoted above, and the same
  argument now lives in `scripts/defect-transforms.mjs`, which has users.
- **It is recoverable.** The file is in git history; nothing here is lost, and a future
  verifier-specificity arm can lift it back out in one command.
- **The cost of keeping was measured, not asserted.** A test file and three properties,
  paid on every full sweep, for a script nothing calls.

## What this costs

Three coverage-sweep properties go with it (144 → 141). They pinned real behaviour of a
script that no longer exists, so their removal is not a coverage regression — but it is
a coverage *reduction*, and the sweep count moving down for a good reason is exactly the
kind of change that should be written down rather than noticed later.

## What would reopen it

A verifier that judges claims against source, and a reason to measure its specificity.
That is the consumer issue 51 asked for. If it arrives, lift `canary.mjs` out of history
rather than rewriting it.
