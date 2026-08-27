# The builder arm, measured

**Issue:** #25. **Date:** 2026-08-27. **Method and limits:** `method.md` beside this file,
written before these numbers were known. **Ledger:** `runs/builder.jsonl`; artifacts in
`runs/builder-raw/`; sealed notes in `runs/builder-sealed/`.

## The result

34 trials drawn. 2 void (refused before spawning), 2 repeats of a unit already measured
(kept as evidence, excluded from the rate), leaving **30 distinct scored units**.

| arm | n | located the defect | restored the original exactly |
|---|---|---|---|
| **derivable** — a flipped constraint | **12** | **9 / 12 = 75%** (Wilson 47–91%) | **8 / 12 = 67%** (Wilson 39–86%) |
| underivable, but recoverable by reading | 10 | 6 | 6 |
| **underivable and genuinely unrecoverable** — the leak detector | **8** | **2** | **2**, both adjudicated as reconstruction |

Edit footprint: median **0.011** of lines changed, maximum **0.033**. No builder rewrote an
artifact. Two of thirty never edited anything at all.

## What this establishes, and it is the first positive observation the builder arm has ever had

**The builder repairs a defect it cannot look up.** On planted contradictions, under an
isolation that was verified per trial rather than asserted, it finds the damaged line three
times in four and restores the original wording two times in three.

#25 said the question was open: *"Whether the builder can close a gap it cannot look up.
That is still unmeasured."* It is now measured, on this set, at 67% exact repair with a
39–86% interval.

**The one prior observation is superseded, not confirmed.** The trial in #25 was void — the
builder recovered the removed section from `skills/gauntlet-loop/SKILL.md` in the working
tree. That trial said nothing about capability. This set says something, and it says it
without the channel that invalidated the first one.

## The leak detector fired eight times, and no firing was a leak

This is the part that could have gone the other way. Every firing was read against the
artifact rather than counted:

| firing | plant | why it is reconstruction |
|---|---|---|
| b16 | `6.0 min` → `13.0 min` | `6.0` appears on two other lines |
| b14 | `16 redraws` → `23` | `16` appears on another line |
| b12 | `15 observations` → `22` | `15` appears on two other lines |
| bt2-26 | `8.` → `15.` | a numbered list item; `7.` and `9.` head neighbouring lines |
| bt2-22 | `Section 2` → `Section 9` | `Section 1` and `Section 3` are both present |
| bt2-12 | `0/3 flipped` → `7/3` | numerator exceeds denominator — impossible on its face |
| bt2-10 | `about 300%` → `about 307%` | the same sentence states the rule, `3/n`, and n is 1 |
| bt3-12 | `6 obs` → `13 obs` | the CI on that same line is computed over 6 (`0/6`), and the row below shows the pattern (`7 obs … 0/7`) |

Six of the eight tightened the instrument: the first three showed that a substituted number
is not underivable merely because it was substituted, and the next three showed that
recurrence is not the whole of derivability either. Staging now excludes all of those shapes,
computed from the artifact. The last two are recorded in `adjudications.jsonl`, which
`test/builder-rate.test.mjs` requires for every hit in the clean arm — a reading that lives
only in a transcript is not evidence, and the next reader would see a repaired underivable
trial with no record of why it is not a breach.

**No leak was observed. That is not the same claim as "no leak occurred", and the difference
is the whole residual of this measurement.** Derivability by reasoning has no finite
enumeration — arithmetic, ordinal position, rounding convention, internal consistency — so
the clean arm bounds the model-prior channel rather than closing it. A ninth shape may appear
in the next batch.

## What the instrument corrected about itself

Each was found by running it, and each would have produced a wrong number if it had not been.

1. **Trials staged as siblings shipped each other's answer keys.** Two trials planted in one
   document damage different lines, so each carried the other's undamaged original. Measured:
   ten of ten exposed, while a comment above the code asserted isolation. Now one document per
   trial, sources discovered rather than listed, and cross-exposure **measured at 0** on every
   staging run.
2. **The staging filter's shape check was inert.** It was handed a candidate whose text field
   is `text` while the function reads `degraded_text`, so it saw no document and returned
   `false` — which means *clean*. A check that could not run was issuing all-clears, and it
   had admitted three shape-recoverable trials into the leak arm. It now returns `null` and
   refuses.
3. **`repaired` conflated two outcomes.** One builder rewrote `always won` as `always lost` —
   which means what the original `never won` means — and scored identically to one that edited
   a different line and invented a new error. Split into `located` and `repaired`.
4. **The rate counted rows, not units.** 22 of 31 plants in the second batch were identical to
   the first batch's, because the transforms are deterministic. Drawing one again adds a row
   and no information. The drawer now skips repeats without spawning, and the rate counts
   distinct units.
5. **`recoverableByShape` took three attempts.** Two hardcoded patterns; then a generalisation
   that dropped positional context and began calling plain measurements ordinals; then one
   that requires the sibling value to sit in the same syntactic slot. Only the third survives a
   mutation that removes the label from the neighbour search.

## What this does NOT establish

- **Fifteen-ish units per arm is small.** The derivable interval runs 39–86%. What it excludes
  is "the builder cannot do this at all", not much else.
- **These are single mechanical transforms.** A real round hands the builder a critic's gap in
  prose about an artifact differing from its reference in every way at once.
- **`repaired` understates by construction** — a correct fix in different words scores false,
  and exactly one derivable unit is in that state. The artifacts are kept so any single case
  can be settled; the rate cannot.
- **One gap statement for every trial**, which is what makes the two arms comparable and is not
  the gap a real critic writes.
- **The model-prior channel is bounded, not closed**, for the reason given above.
- **Nothing here measures the loop.** This is the builder arm in isolation. Whether a builder
  and a critic together converge is a different question, and #19 and #18 are about its
  stopping rule.

## Reproducing

    node scripts/builder-draw.mjs --stage --tag <batch>
    node scripts/builder-draw.mjs --draw --limit N
    node scripts/builder-draw.mjs --rescore
    node test/builder-rate.test.mjs
    node test/builder-parse.test.mjs

Re-scoring never needs re-spawning: every artifact the builder produced is written to
`runs/builder-raw/` before it is read, which is why five scoring corrections during this run
cost re-scores rather than live agents.
