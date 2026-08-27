# Measuring the builder arm — the method, and what it cannot establish

**Issue:** #25. **Date:** 2026-08-27. **Instrument:** `gauntlet-builder`'s prompt as
deployed by `loop.js`, captured by driving the script through `test/harness.mjs`.

This file is the method and its limits. The numbers are in `verdict.md` beside it.

**When this was written, stated precisely, because it decides what it pre-registers.**
It was written after the first batch of 16 trials had been drawn and before the second
batch was drawn or read. So it pre-registers the second batch and not the first, and the
"what the instrument corrected about itself" section below is a record of what the first
batch had already shown — not a prediction. Saying otherwise would claim a stronger
guarantee than the timing supports, which is the failure #50 is about.

**One claim in this file was found false by the trials it pre-registered, and it is left
standing rather than edited.** The table below calls `factual-substitution` "an arbitrary
number, implied by nothing". It is not: numbers recur, list ordinals are given by their
neighbours, and an impossible fraction announces its own damage. Rewriting the sentence
now would be adjusting the plan to the result. The correction is in `verdict.md`, where a
reader can see both.

## What #25 records, and why it is worse than no data

The only seeded-defect test of the loop ever run produced a **false pass**. A copy of
`SKILL.md` with a 22-line section removed was placed in `/tmp`, the builder was asked to
close the gap, and it recovered the text from `skills/gauntlet-loop/SKILL.md` in the
working tree — stating so in its own `ambiguity` field:

> "using the wording and position that appear in **the real, undegraded SKILL.md for this
> same plugin** (verified against the actual command/script files on disk in the repo),
> rather than composing new prose."

Nothing there is the builder's fault. It was asked to fix a gap and found the most
accurate available source. The fault is in the test design, and the repository's deleted
gate 7 had written the rule beforehand: *"if the removed text is recoverable from public
sources or the model's own prior, no sandbox closes it and a tighter re-run yields a false
pass."*

## Two leak channels, and only one of them closes

1. **The filesystem.** Closed by staging outside this repository and confining each
   spawn's working directory to its own trial. Checkable, and checked: the text that was
   removed is searched for in everything the builder can reach, **before** anything is
   spent on the trial. A trial that fails the search is recorded VOID — not a pass, not a
   miss — and never spawns.
2. **The model's own prior.** Not closable, by anyone. So it is not claimed shut. It is
   crossed against.

## The crossing

Every trial plants one mechanical transform in one real repository document. The classes
differ in one property that decides what a repair means:

| class | reconstructible from the artifact alone? | what a repair there means |
|---|---|---|
| `inverted-constraint` | **yes** — a flipped `must`/`never`/`cannot` contradicts the text around it | the capability under test |
| `factual-substitution` | **no** — an arbitrary number, implied by nothing | evidence of a leak, not of reconstruction |
| `section-removal` | partly both, per section | excluded from the scored set rather than guessed at |

A builder working honestly under isolation can score on the derivable class and **cannot**
score on the underivable one. So the underivable arm is not a second data point; it is the
instrument's own leak detector, and it must read at chance for the derivable number to
mean anything. That is this repository's standing rule turned on the builder arm: arrange
the cases so an instrument reading the confound scores at chance, and compute the key
rather than assert it.

## Two observables, never one

`repaired` demands the original line back. `located` asks only whether the damaged line
survived. They separate two outcomes that a single field reported identically:

- one builder rewrote `The only run that iterated **always won**` as `always **lost**` —
  which means what the original `never won` means. It found the defect and fixed it in its
  own words: `located` true, `repaired` false.
- another edited a **different** line, changing `four artifacts` to `six artifacts` —
  inventing a new factual error and never touching the plant: `located` false.

Merging those reports neither. It is the same split the critic arm needed between noticing
a difference and converting it into a verdict.

`footprint` is recorded beside them: a builder that rewrites the whole artifact has failed
the prompt's own instruction ("Fix that gap. Only that gap"), and a wholesale rewrite is
also the shape in which a **recalled** original arrives, since reproducing a document from
memory restores the damaged line as a side effect.

## What the instrument corrected about itself, before it was believed

Recorded because each was found by running it, and because a method section that lists only
what went right is an advertisement.

1. **Trials staged as siblings shipped each other's answer keys.** Two trials planted in the
   same document damage different lines, so the second copy still carries the first's
   undamaged original. Measured: every one of ten trials was exposed this way, while a
   comment above the code asserted isolation. Closed by construction — sources are
   discovered rather than listed, no two trials share a document, and the cross-exposure is
   **measured and printed** on every staging run rather than assumed.
2. **The leak detector fired, and reading the artifacts showed no leak.** Every underivable
   trial the builder repaired had its original value sitting elsewhere in the same document
   — `6.0` on two other lines, `16` on one, `15` on two. The builder cross-referenced within
   the artifact. That is the derivable arm's behaviour appearing in trials mislabelled as
   underivable, and it is a positive observation of the capability rather than a breach.
3. **So `factual-substitution` does not reliably produce underivable defects.** Numbers
   recur. Staging now selects a site whose original token does not appear elsewhere in the
   document, rather than checking after the fact.
4. **A check that could not fire.** The first recoverability test searched for the widened
   span around the change (`"16 red"`, `"it 6.0"`), which never recurs because it drags its
   neighbouring words along. It reported 14 of 15 plants clean; searching the changed
   **token** instead reported 6.

## What this cannot establish

- **Whether these defects resemble what a real round meets.** They are single mechanical
  transforms. A real round hands the builder a critic's gap in prose, about an artifact that
  differs from its reference in every way at once.
- **The model-prior channel is bounded, not closed.** The underivable arm bounds how much
  of a repair can be recall. It cannot eliminate the possibility, and no design can.
- **Whether an underivable plant is really underivable** is decided by a string search, so
  it catches an original that *recurs* and misses one that is merely *implied* — a heading
  sequence gives `Step 2` away with no such string present anywhere.
- **`repaired` understates by construction.** A correct fix in different words scores false.
  The artifacts are kept so a reader can settle any individual case; the rate cannot.
- **One gap statement for every trial.** The same sentence is handed to every builder, which
  is what makes the two arms comparable — and is not the gap a real critic writes.
- **One model, one day.** No claim about other models, or about drift.
