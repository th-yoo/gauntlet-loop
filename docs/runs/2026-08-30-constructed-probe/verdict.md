# The probe, measured against ground truth nobody authored

**Issue:** 33 (the closing step its 2026-08-27 comment named: "nothing here runs the probe").
**Date:** 2026-08-30. **Instrument:** `gauntlet-goal-check` as `loop.js` prompts it, drawn by
`scripts/oracle-draw.mjs` — 20 spawns of `claude -p`, both sides of each pairing in one
invocation, two draws per pairing. **Ledger:** `oracle/constructed-results.jsonl`, raw responses
under `oracle/raw/constructed-*`. **Report:** `report.txt` beside this file, as
`scripts/oracle-report.mjs` printed it.

## The result

| pairing | constructed verdict | draw 1 | draw 2 |
|---|---|---|---|
| `constructed-generator-pair` (scaffold + direct, file goal) | generator | generator | generator |
| `constructed-comparable-pair` (direct + make, file goal) | comparable | comparable | comparable |
| `constructed-absent-pair` (absent + direct, file goal) | unreadable | unreadable | unreadable |
| `constructed-commit-generator-pair` (scaffold + direct, commit goal) | generator | generator | generator |
| `constructed-commit-comparable-pair` (direct + plumbing, commit goal) | comparable | comparable | comparable |

Per side: `does-the-work` 0/4 distinct artifacts wrong over 12 draws; `produces-an-instruction`
0/2 over 4; `could-not-open` 0/1 over 4. **0 of 7 redrawn rows flipped** between draws. Every
verdict the composition can produce — generator, comparable, unreadable — was produced, under
two goals whose deliverables are a file and a git commit, and each matched the answer that
follows from running the artifacts.

**The false-refusal cell reads NO RATE.** Two distinct comparable pairings sit under the five
`oracle-report` requires before posing a rate, and it says so rather than printing 0/2. The
per-side arm at four distinct artifacts is bounded by the rule of three at about 75%. So this
run establishes that the probe is right where the answer is knowable, seven times over, and
establishes no rate at all.

## What the first draw found instead

The first 20 spawns classified every side correctly and **recorded two of them**. Eighteen were
refused at the ledger layer: `oracle-record` pins an artifact by an `artifact_hash` the
constructed rows had never stored, and `oracle-report` grounds a mechanical row by an
acceptance command these rows do not have — they carry a `probe`, and their ground truth is a
derivation. The constructed frame had a verifier, a manifest and a gate, and no way to be
*observed*. Both are wired now: the rows pin their hashes (recomputed by
`test/constructed-oracle.test.mjs`, which fails when a fixture changes under its hash), and the
report grounds a probe row by calling `constructed-verify`'s own `deriveRole` at read time — a
row whose derivation no longer agrees with its declared role is refused by name, which the gate
drives with a manifest that lies about the scaffold. The orphaned responses from the first draw
were deleted; the twenty on disk are the second draw, all recorded.

## What this does not establish

- **A rate.** See above. Adding constructed comparable pairings would move it; redrawing these
  would not.
- **Anything about the corpus the probe is used on.** These artifacts were built so one
  relationship is definitional. That is what makes them ground truth and what makes them
  unrepresentative — they bound whether the probe can be right on a knowable case.
- **Selection bias** (#38): the labels are unauthored; the selection is not. Seven artifacts
  chosen by the person building the set, two goals chosen the same way.
- **Independence across draws.** Both draws of every pairing were made within minutes by one
  model family against one prompt hash. Zero flips at n=7 bounds instability loosely.
- **The refusal's authority.** `loop.js`'s `REFUSAL_EVIDENCE` is the corpus frame's cell and
  stays so. This frame is deliberately not pooled with it: mixing a constructed set into a
  sampled one moves every rate over a corpus that already has no sampling frame.

## Reproducing

    ORACLE_CORPUS=oracle/constructed.jsonl \
    ORACLE_PAIRINGS=oracle/constructed-pairings.jsonl \
    ORACLE_RESULTS=oracle/constructed-results.jsonl \
    node scripts/oracle-report.mjs            # the report above, from the ledger on disk

    # to draw again (spawns live agents; refused under GAUNTLET_SUITE):
    ORACLE_CORPUS=... ORACLE_PAIRINGS=... ORACLE_RESULTS=... node scripts/oracle-draw.mjs --all-pairings --draws 2
