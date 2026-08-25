# Oracle — ground truth for the pairing check

`loop.js`'s pairing check can **refuse a run**. It is the only component here with
that authority, and it acquired it on two observations from real agents, both
`generator`, both on prompt-shaped references, scored against predictions its own
author wrote. Issue #33 exists because that is not an evidence base.

This directory holds ground truth that nobody's opinion supplied.

## What a row is

`corpus.jsonl`, one JSON object per line. A row pairs an artifact with a goal and an
expected role — and with the **evidence that settles it**.

For the `does-the-work` arm the evidence is a shell command. `scripts/oracle-add.mjs`
runs it, here, now, and refuses to write the row unless it exits 0. No model is
consulted, and a command that mentions one is refused: a ground truth produced by the
kind of judgement under test cannot audit that judgement.

The `generator` arm has no mechanical acceptance test — "this document is a request
addressed to someone else" is not a shell exit code — so its rows come from
`generator-procedure.md`, not from `oracle-add.mjs`.

## Why this is not a registry

The classification RULE is one rule, fixed: *does executing this artifact terminate in
the goal's deliverable, or in a request addressed to a further party.* It does not
gain a branch when a row is added, and adding a row costs no code.

What grows per row is EVIDENCE — each artifact needs its own acceptance command,
because "the deliverable exists" is a different observation for a Makefile than for a
spec. That is data, the way a test's expected output is data. The distinction matters:
the first version of the pairing check shipped a hand-written list of generator shapes,
one entry per shape, and every refusal it produced echoed the list back.

## Adding a row

```
node scripts/oracle-add.mjs --arm does-the-work \
  --artifact <absolute path> \
  --goal "<what someone is pursuing>" \
  --acceptance "<shell command that exits 0 iff the deliverable exists>" \
  --id <id> --note "<why this row is here>"
```

Use an **absolute** path: that is the shape `loop.js` receives, and the path is part
of the prompt, so it is part of the instrument's hash.

Write the `--note`. Why a row is in the corpus is the part a later reader cannot
reconstruct, and selection is the bias this corpus does **not** solve.

## Making an observation

```
node scripts/oracle-extract.mjs --artifact <path> --goal "<goal>" --json
```

That prints the **live** prompt `loop.js` would send, plus its hash. Hand the prompt to
a fresh agent unchanged, then:

```
node scripts/oracle-record.mjs --row <id> --predicted <role> --reasoning "..." \
  --prompt-hash <hash> --schema-fingerprint <hash> --observer <who>
```

The recorder re-extracts and refuses the observation if the hashes no longer match —
which is what makes instrument staleness mechanical instead of remembered.

## Reading the report

```
node scripts/oracle-report.mjs
```

It reports per-side accuracy as the primary number and the derived per-run false
refusal rate as secondary, under a stated independence assumption. It reports distinct
artifacts beside observations, refuses to pool across prompt hashes, and says "cannot
be posed" rather than printing a rate a single-digit sample cannot support.

## What this cannot establish

Selection bias, answer stability under repeated draws, and coverage of the artifact
space. The report prints all three every run.
