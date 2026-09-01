# 0008 — "Side by side" is the original's word, "A/B" is not, and the difference is who holds the conditions constant

**Status:** decided, 2026-09-01.
**Decided by:** the operator, who asked whether "A/B" appears in the original prompt; written up by Claude.

## The question

Every comparison surface in this repo is named for A/B: `AB_SCHEMA`,
`gauntlet-loop:gauntlet-ab-critic`, the `:ab` spawn label, "A/B round" throughout the
docs. The operator asked whether "A/B" appears in Shumer's original prompt.

**It does not.** The two primary texts differ, and `references.md` ships both verbatim:

- **Source 1**, the 941-byte prompt that produced Claude-of-Duty: *"It should literally
  compare them **side by side** blind and say which one looks better."* The string "A/B"
  does not occur anywhere in it.
- **Source 2**, the later meta-prompt: *"compare it directly with the bar—using a **blind
  A/B comparison when possible**."*

So the vocabulary is sourced, and the provenance table cites Source 2 for it correctly. It
is simply not the original's language. The question this record answers is whether the
difference is only vocabulary, or whether the loop implements something weaker than what
Source 1 describes.

## What decided it

Reading what our implementation actually guarantees, rather than what the name suggests.

The critic receives both paths in **one prompt** and holds `Bash` and `Read`, so for a
document it can read both and compare them with both in context. That is side by side in
every sense that matters, and the first draft of this record overstated the gap by calling
our procedure "sequential" as though the critic could only hold one at a time. It can hold
both.

**What is genuinely different is who fixes the conditions of the comparison.**

Source 1's "literally compare them side by side" describes one act performed under one set
of conditions — two things in view at once, necessarily rendered the same way, because
they are in the same view. Our loop hands over two paths and leaves the procedure entirely
to the critic. Nothing requires it to inspect both sides under matched conditions, and
nothing records whether it did.

**This run shows the asymmetry is real, not hypothetical.** In
`docs/runs/2026-09-01-tetris-exit-bar`:

- A round-1 critic reported four separate 254-key runs against `doc-2` and did not report a
  comparable battery against `doc-1`.
- A round-3 critic reported "roughly 700 combined real key presses in this session,
  spanning several deliberately-varied placement strategies" as a single pooled figure, so
  how it divided between the two artifacts is not recoverable.
- A round-9 critic wrote in its own shortfall that it *"never actually drove A to its Game
  Over / high-score overlay by execution"* while having driven the other side there — an
  explicitly uneven inspection, disclosed by the critic and invisible to the loop.

The viewport is the one condition the harness does hold constant: `scripts/play.mjs:134`
starts Chrome at a hard-coded `--window-size=520,760` for whichever artifact it is given.
Everything else — how many keys, which strategies, how many sessions, whether the artifact
was driven to game over — is chosen per side by the critic, per round, and never recorded.

That is the delta. Not "sequential versus simultaneous", which we mostly satisfy, but
**unmatched inspection effort across the two sides of a single verdict**, which a literal
side-by-side render would make impossible by construction.

## The decision

**Record the delta and change nothing yet.** Specifically:

- The naming stays. It is cited to Source 2 and renaming every surface buys nothing but
  churn — the provenance table already says which source each word comes from.
- The comparison procedure stays as it is, and this record is the disclosure that it
  leaves inspection effort to the critic.
- **The change is gated on a measurement, specified below.** Building a side-by-side
  renderer first would be escalating on a hunch, which the parent `CLAUDE.md` names as
  fitting: structure added "because this task seems to want it".

## What was weighed against

**Declined, with reasons:**

- **Build the side-by-side renderer now** — compose both artifacts into one image at one
  viewport and judge that. Declined: it is a real change to the instrument justified by
  zero measurements. If the verdicts do not move, it is cost with no return, and we would
  not know because nothing would be comparing the two procedures.
- **Add a required `inspection_effort_per_side` field to `AB_SCHEMA`.** Tempting, because
  it makes the asymmetry visible for the price of one field, and because `margin` was made
  required for exactly that kind of reason. Declined for now: it is one new field per
  incident, which is the 1:1 growth the parent file calls memorising. It also cannot be
  verified — a critic reporting its own effort is the same shape as a critic grading its
  own work, which this method exists to avoid.
- **Rename everything to "side by side"** to match Source 1. Declined: cosmetic, and it
  would make the provenance table wrong, since the phrase we would be citing is the one
  Source 2 does not use.
- **Treat this as settled by the existing viewport caveat.** Declined: that caveat is about
  a condition the harness DOES fix and fixes at one value. This is about conditions the
  harness does not fix at all. They are different failures and the second is the larger one.
- **Do nothing and record nothing.** Declined for the reason 0007 exists: the hole at
  `loop.js:2020` was disclosed accurately for five runs and nothing filled it, and an
  accurate disclosure that is never acted on is how a known gap becomes permanent.

## What would reopen

**The crossing that would decide it**, and it is cheap because both arms already exist:
take one pairing and one artifact state, and run two arms of critics — one under the
current procedure, one shown a single image with both artifacts rendered at the same
viewport side by side. Same goal, same bar, fresh critics, sides balanced across both arms.

- **If the two arms' verdicts diverge at a rate above what the split ledger already
  measures for judge variance on unchanged bytes (d, currently 47% over 12 panels), the
  procedure is load-bearing** and the renderer should be built. Note the comparison this
  needs: the ledger's d is the noise floor, and a side-by-side effect has to clear it to be
  distinguishable from two critics disagreeing for the ordinary reason.
- **If they agree at or below that rate**, the naming is the only difference and this
  record closes as measured rather than as asserted.

Two other things would reopen it independently:

- **A run where a critic's own report shows it inspected one side materially harder and the
  verdict went to the side it inspected more.** Round 9 of the Tetris run is one half of
  that pattern — uneven inspection, disclosed — but its verdict went to the side it
  inspected LESS, which is evidence against the effect mattering, and is recorded here
  because it cuts against the case this document is making.
- **A domain where the artifacts cannot both be held in context** — very large binaries,
  long videos, anything where "read both" is not available. There the first draft's
  "sequential" framing would become literally true, and the decision was taken on the
  assumption that both fit.

## What this record cannot establish

That the original's "side by side" was meant literally as one rendered view rather than as
ordinary English for "compare these two". Shumer's own run judged rendered frames of a 3D
game, which is the reading that makes it literal, but the prompt does not say so and the
author is not available to ask. This record takes the literal reading as the stronger of
the two and then declines to act on it without a measurement — which is the right order,
because the weaker reading costs nothing if it turns out to be right.
