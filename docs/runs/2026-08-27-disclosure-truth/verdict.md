# Pinned for presence, never for truth

**Issue:** 54. **Date:** 2026-08-27.
**Instruments:** `scripts/disclosure-audit.mjs`, `test/disclosure-behaviour.test.mjs`,
gated by `test/disclosure-audit.test.mjs`, which `run-all` and CI already run.

## The defect this came from

`loop.js` asserted *"the source gets width by decomposing the goal, **which this loop does not
do**"*. The loop decomposes. That sentence was **pinned**: `drift-facts` held it, `drift-guard`
failed if it vanished, and `guard-sweep` broke it and confirmed drift-guard went red *and named
it*. All of that machinery faithfully protected a false statement, because a disclosure is
pinned for **presence** and nothing checked it was **true**.

That is worse than an unpinned false claim. A reader who sees a disclosure covered by a guard
reasonably concludes someone checked it.

## Before and after

| | before | after |
|---|---|---|
| exercised by a behavioural test | 6 | **12** |
| adjudicated as undrivable | 0 | **7** |
| **neither** | **13** | **0** |

## The fix is a partition, not nineteen truth-checks

One assertion per sentence is the growth this project calls cheating, and it goes stale at the
twentieth disclosure. Instead every pinned disclosure must be one of two things, and **which
one is discovered**:

- **EXERCISED** — a behavioural test names it in *live* code. Comments are stripped first, the
  same stripper `drift-guard` carries and for the same reason; and the test must import the
  harness, because a test that never drives the loop cannot have checked a claim about it.
- **ADJUDICATED** — recorded as undrivable, with the reason. *"Nothing verifies that a harsh
  INSTRUCTION produced a harsh CRITIC"* has no behavioural form, and saying so is half the
  answer rather than a gap in it.

Anything that is neither is a sentence nobody has checked and nobody has admitted cannot be
checked. That count can only go down, and a new disclosure has to declare which kind it is.

## Six disclosures now driven against the loop

`A NARROW WIN STILL EXITS` · `A RUN CANCELLED WHILE ARMED … IS NOT A WIN` ·
`THE CONFIRMATION MEASURES JUDGE REPRODUCIBILITY, NOT ARTIFACT IMPROVEMENT` ·
`THERE IS NO RATCHET; REGRESSIONS ARE MEASURED AND NOT REVERTED` ·
`The breaker is checked at ROUND BOUNDARIES, not continuously` ·
`THE SPLIT IS CHECKED ONE WAY ONLY`

The last one is written to test the **asymmetry** the disclosure claims — a losing
whole-artifact check is a positive detection (`SPLIT_UNSOUND`), a passing one lets the run win
*and the passing run still carries the disclosure saying a pass proves nothing*. Testing only
the comfortable half would confirm the half that is comfortable.

## Where the loop was right and the test was wrong

The split case first failed. `split_check.ran` was `false`, and the loop's own reason was
better than the test: *"the pieces edited their own candidate files … so a whole-artifact A/B
on that path would judge a file no builder touched. A pass there would cover none of the
work."* The scenario was wrong, not the loop — pieces must share the artifact for that check
to mean anything. Fixed by reading the reason rather than adjusting the assertion.

## The check reproduced the defect it was built for, one level down

The first version of the gate verified that `scripts/disclosure-audit.mjs` **contained the
string** `stripLineComments`. That is a presence check standing in for a behaviour — exactly
what this issue is about — and **two mutations that removed the behaviour while leaving the
identifier in place survived it**: counting a comment-only mention as exercised, and counting a
test that never drives the loop.

Replaced with cases that hand the audit synthetic test files and read its answer. Six mutations
are now caught against a passing baseline.

One exclusion is **deliberately not claimed as tested**: `NOT_EVIDENCE`, which keeps
`drift-facts`/`drift-guard` from counting as evidence for their own pins, is redundant with the
behavioural filter — neither imports the harness, so neither can be counted regardless. A
mutation removing it changes no answer. It stays as defence in depth and is recorded as
untested rather than covered by a contrived case.

## What this does NOT establish

- **That an exercised disclosure is TRUE.** The audit confirms a behavioural test names it in
  live code — evidence a human wired the sentence to a run, not evidence the assertion checks
  the claim. It is a floor, and it sits one level down from the defect that produced it: a test
  could quote a disclosure and assert something else entirely, and this would call it covered.
  The remedy for that is reading the test.
- **That an adjudicated disclosure is true either.** It records that someone looked and said
  why it cannot be driven.
- **Anything about disclosures elsewhere.** This covers `LOOP_DISCLOSURES`. The other pinned
  lists — `LOOP_PINNED`, `COMPARER_CONTRACT` — carry claims of the same kind and are outside
  this audit.

## Reproducing

    node scripts/disclosure-audit.mjs
    node test/disclosure-behaviour.test.mjs
    node test/disclosure-audit.test.mjs      # the gate; also runs inside test/run-all.mjs

`DISCLOSURE_ADJUDICATIONS` points the audit at another file, which is how the gate shows that
withholding them brings every unaccounted disclosure back.
