# Could the design have disagreed? Asked of the evidence, not the write-up

**Issue:** 50. **Date:** 2026-08-27. **Instrument:** `scripts/capacity-check.mjs`, gated by
`test/capacity-check.test.mjs`, which `run-all` and CI already run.

## The result

Six constants across three ledgers, each now adjudicated with what it costs. One of them is
the defect that cost this repository a day.

| ledger | field | rows | finding |
|---|---|---|---|
| `detection.jsonl` | `artifact_a_dir` | 20 | **one value.** The A/B mapping never varied |
| `detection.jsonl` | `prompt_template_hash` | 20 | one value — constant **by design and required** |
| `detection.jsonl` | `a_path`, `b_path` | 20 | one value — constant **by absence** |
| `detection.jsonl` | `paths_unrecorded` | 20 | one value — the flag that records the absence |
| `refusals.jsonl` | — | 1 | the **ledger** never varied: one row |
| `builder.jsonl` | — | 34 | every recorded field took more than one value |

`builder.jsonl` passing clean matters: the check is not always-red.

## The finding worth the build

**`artifact_a_dir` took one value across all twenty detection trials**, because
`detection-draw` captures round 1 of a stubbed loop and `loop.js` alternates sides by
`(round + critic index)` parity. That batch cannot distinguish *"the mapping is always b"*
from *"the mapping alternates"*.

That is not a harmless constant. The inverted detection rate published earlier the same day —
17% reported where the truth was 83%, later 80% — **survived because no trial in the batch
disagreed with any other about the mapping.** A batch drawing some trials from round 1 and
some from round 2 would have produced two contradictory rates inside a single run and exposed
the inversion immediately, without anyone reading a response.

Issue 50's mechanism, in this repository's own evidence, explaining this repository's own
worst defect of the day.

## Why this does not read the prose, which was the obvious build

The run issue 50 cites — `docs/runs/2026-08-26-pairing-stability.md` — **states its own
capacity, in its own words**, at line 90:

> The prediction recorded above held, which is worth exactly what a held prediction is worth:
> it did not come back against its author, **and it could have.**

That sentence is precisely what the issue disputes. Five of six pairings in the false-refusal
cell put an unambiguous worker against an unambiguous worker; a flip was not meaningfully
available. **A check requiring a capacity statement would have passed the exact run that
motivated the issue.** A capacity claim written by the author of the design is the thing under
suspicion.

So the question is put to the ledger instead: across every row the design produced, did this
field ever take a second value? A field that never varied is a field no claim can rest on
varying, whatever the write-up says.

## The gate found its own rubber stamp immediately

The first adjudication written for `b_path` read *"Same as a_path: null on every row for the
same reason and with the same consequence."* — 84 characters, a shrug. The gate requires an
adjudication to say what the constant **costs**, and rejected it on the first run. An
adjudication that does not is a rubber stamp, and a rubber stamp is worse than no check
because it looks like one.

## What the instrument corrected about itself

**A check with two paths needs a case per path.** `capacity-check` reports two ways: a whole
LEDGER too small to vary, and an individual FIELD that never varied. The first version of the
"it can still fail" case asked only for a non-zero exit with adjudications withheld — which
the ledger branch satisfies on its own. Two separate mutations disabling **field detection
entirely** left the gate passing, because `refusals.jsonl` kept the exit code red. Both
branches are now asserted separately.

Eleven mutations are caught against a passing baseline, including: constants never detected,
unadjudicated constants never counted, always exiting 0, ignoring the adjudications file, a
one-row ledger treated as analysable, an adjudication that is a shrug, and the mapping
adjudication removed.

## What this does NOT establish

- **Whether a design COULD have disagreed, before it ran.** That is not decidable from a
  design description, and it is the half issue 50 is actually framed around. This closes the
  ability to *skip* the post-hoc half; it does not answer the pre-run question.
- **That a varied field makes a claim sound.** Variation makes unfalsifiable-by-construction
  less likely. It is necessary, never sufficient.
- **Anything about the run that motivated the issue.** The pairing-stability run emitted
  **no machine-readable data at all** — 8 pairings, 3 draws each, recorded in a fenced block
  in prose — so nothing here can reach it. Reconstructing a ledger from that narrative was
  considered and rejected: its stated figures do not cleanly reconcile (32 spawns against
  "8 pairings at 3 draws each" and "16 redraws"), and inventing structure to make a run
  checkable is the failure this repository names most often, one level up.

  That unreachability is itself a finding. **A measurement whose outcomes live only in prose
  cannot be capacity-checked by anything.** Whether run documents should be required to emit a
  ledger is a decision, not a patch, and it is not taken here.

## Reproducing

    node scripts/capacity-check.mjs
    node scripts/capacity-check.mjs --json
    node test/capacity-check.test.mjs        # the gate; also runs inside test/run-all.mjs

`CAPACITY_ADJUDICATIONS` points the check at a different adjudication file, which is how the
gate demonstrates that withholding them brings every constant back.
