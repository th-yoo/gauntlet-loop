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
  --artifact <path inside the repository> \
  --goal "<what someone is pursuing>" \
  --acceptance "<shell command that exits 0 iff the deliverable exists>" \
  --id <id> --note "<why this row is here>"
```

**The path must be inside the repository, and it is stored repo-relative.** Pass it
either way — absolute or relative — and `oracle-add` normalises it. A row in the tracked
corpus is ground truth only if any checkout can re-establish it, and a path that leaves
the tree cannot be re-established anywhere else; this is refused rather than stored. (A
throwaway corpus, with `ORACLE_CORPUS` set, may point outside the tree: nothing commits
it and nothing re-reads it, which is what lets a trial build a fixture in a sandbox.)

This used to say the opposite — use an absolute path, because that is the shape `loop.js`
receives. The reasoning was about the prompt and missed what the corpus is for. Absolute
paths went in, CI ran the suite on a machine that had not written them, and the suite went
red; `ebb630a` fixed it.

Write the `--note`. Why a row is in the corpus is the part a later reader cannot
reconstruct, and selection is the bias this corpus does **not** solve.

### The other two arms

`--arm generator` takes `--emission <file>`, **once per file the execution produced**: the
things executing the artifact emitted. Its label comes from what it emitted, not from anyone
saying so — see `generator-procedure.md`. Pass every file. The label rests on the whole
output, and a row that pins one of two leaves the other free to change with nothing
noticing — which is what happened to `teardown-request`, whose cover memo was the half the
blind classifier quoted.

`--arm could-not-open` takes a path that must **not** exist, and an `--acceptance` that
establishes the absence (`test ! -e <path>`). Its grounding is inverted rather than new:
the command still has to exit 0, and what it settles is that there is nothing there. This
is the third verdict the probe can return and the third way a run gets refused, and it had
no observations for a long time — not because nobody drew it, but because the row could
not be added.

## Declaring a pairing

```
node scripts/oracle-pair.mjs --sides <rowA>,<rowB> --note "<why this pairing>"
```

A refusal fires when exactly **one side** of a pair is an instruction-writer, so the thing
that refuses a run is a property of two artifacts under **one goal** — not of one artifact.
Every per-side observation in this corpus measures `roleOf`; none measures the verdict.

A pairing is two existing rows that share a goal. It needs no new kind of row: both sides
are already grounded, and role is goal-relative, so `oracle-pair` refuses sides whose goals
differ. Nothing derived is stored — the expected verdict is recomputed on every read by
**running** `loop.js` with the two rows' expected roles (`oracle-derive.mjs`), because a
copy of a rule that is already written down once is the drift this directory exists to
avoid.

### Observing a pairing

```
node scripts/oracle-draw.mjs --pairing <id> [--draws 1]
node scripts/oracle-draw.mjs --all-pairings [--draws 1]
```

**Both sides are drawn in ONE invocation**, and that is the whole point of the mode. The
pairing check runs `roleOf` on both artifacts in one pass and composes the verdict from
what comes back; two sides drawn at different times are two measurements of two moments,
and no amount of pooling turns them into one. Each side is recorded as an ordinary
per-side observation carrying `--pairing` and a shared `--pairing-draw` id, and it is that
shared id — nothing else — that makes the pair an observation of the verdict.

Nothing about the verdict is written down. `oracle-report` recomposes it on every read by
running `loop.js` on the two observed roles, exactly as the expected verdict is derived
from the two rows' expected ones.

What the join records and what it does not: it says these two sides belong to one draw. It
cannot establish that they were **drawn together** — a hand-recorder can pass one draw id
to two sides taken an hour apart, and no check here would know. That is the same residual
`--raw` carries about where an answer came from, and the report prints it beside the rate.

If one side produces nothing — a dead probe, a non-JSON answer — the draw is abandoned as
a pairing and the surviving side is recorded as a plain per-side observation with no
pairing tag. Half a pairing is not a smaller pairing, and a draw the report could only
exclude is worse than an untagged observation that still counts for what it measures.

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

Before it prints any number it reads the prompt **loop.js sends today** — out of the
script, through `oracle-instrument.mjs`, never out of the ledger — and labels every
cohort `LIVE`, `SUPERSEDED` or `UNKNOWN INSTRUMENT` against it. A run whose
observations all belong to a superseded prompt says so and **exits non-zero**, because
every figure in it then describes an instrument nobody runs. If the live prompt cannot
be read at all, the report prints no numbers: that is a broken extraction, not a stale
corpus, and the two need opposite repairs.

It also **re-establishes the ground truth rather than reading back what was written**.
Every `does-the-work` and `could-not-open` row's acceptance command is re-run, every
generator row's emission files are each checked for existence and hash, and `correct` and `disputed`
are re-derived from the corpus row instead of being taken from the observation. A row
whose command no longer exits 0, or an observation that disagrees with the corpus it was
scored against, refuses the run. This is not belt-and-braces: a row's evidence used to be
a stored exit code, so breaking a file the command read — one the row did not pin, because
a row pins one artifact and a command reads whatever it likes — left the whole suite green.
`scripts/staleness-trial.mjs` builds all four of those situations.

Two figures say what the numbers rest on rather than what they are:

- **`corroborated N/M`**, per arm. An observation either names a response on disk whose
  fields were checked against it, or it does not. Neither says where the answer came from —
  that is not recoverable here and is not claimed. It currently reads `0/25` on the live
  cohort, because everything predating `oracle-draw.mjs` was recorded by hand and no
  responses were kept. That cannot be improved retroactively.
- **`answer stability`**, per arm. A row drawn twice that comes back differently is
  unstable whether or not either draw was correct, and one draw per row cannot tell a
  systematic bias from a coin landing the same way twice.

Finally it reports the **pairing arm**: every declared pairing with the verdict `loop.js`
derives for it, every draw with the verdict its two observed roles compose to, and the
false-refusal rate measured from those draws. Two cells are reported separately, because
they answer different questions — the pairings whose true verdict is `comparable`, where
any refusal is FALSE, and the pairings whose true verdict is a refusal, where the check
firing is it working.

Three things keep that number from saying more than it can. Draws that are not one draw
are named and excluded rather than dropped — a half draw, two sides drawn against
different instruments, a side whose row is disputed. Below five distinct pairings the rate
is not posed at all, which is the threshold the per-side arm already applies to distinct
artifacts. And the report states that these draws' sides are also counted in the per-side
arm, so the measured figure and the derived `2q(1-q)` one rest on the same evidence:
comparing them tests the independence assumption, it does not corroborate either with a
second body of evidence.

## What this cannot establish

Selection bias and coverage of the artifact space. The report prints both every run,
along with the part of answer stability that repeat draws do not reach — a redraw is
the same model asked again, not an independent draw.

Selection bias is the one that cannot be fixed by adding rows, and adding rows can hide
it: see #38, which holds that as a permanent disclosure rather than as work.

What the pairing arm still cannot reach: a pairing is two artifacts under **one** goal,
and which pairings exist is the same selection this corpus does not solve. The rate is a
rate over the pairings someone chose to declare, and the cell that decides whether an
automatic refusal is safe is exactly the cell where a corpus of easy pairings would score
perfectly. Every comparable pairing here therefore puts an instruction-shaped worker — a
README, a checklist, a schema, a rules file — against an unambiguous one, because a cell
that could only come back correct measures the corpus rather than the check.
