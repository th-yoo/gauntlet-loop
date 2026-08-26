# The critic's defect-detection rate, measured

**Issue:** #29. **Date:** 2026-08-27, corrected the same day. **Instrument:**
`gauntlet-ab-critic` as deployed by `loop.js`, prompt captured from the live
script, one template hash across all trials.

> **THIS DOCUMENT WAS WRONG IN ITS HEADLINE NUMBER AND HAS BEEN CORRECTED TWICE.**
> It first reported detection at **2/12 = 17%** and concluded the critic does not
> discriminate. Two defects, both in how the ledger was read rather than in
> anything the critic did:
>
> 1. Every trial was scored by comparing the critic's **ARTIFACT** letter against
>    the **directory** letter the degraded bytes were staged under, and those are
>    opposite for every trial in the batch — so the published rate was the exact
>    complement of the real one.
> 2. `parseWinner` demanded a `#` heading the prompt never asked for, dropping
>    three responses that answered in the prompt's own numbered form, and read the
>    word `tie` anywhere in the item, turning one control's disclaimed pick into a
>    refusal (#53).
>
> The rate is **12/15 = 80%**. Nothing was re-spawned for either correction; the
> responses on disk are unchanged and were re-parsed.

## The result

| | |
|---|---|
| detection | **12 / 15 degraded trials = 80%** |
| interval | Wilson 95% CI **55% – 93%** |
| against chance | P(≥12 of 15 \| coin) = **0.018** |
| named the defect | **13 / 15** degraded trials quoted text only one side carried |
| false alarms | **0 / 5** controls |
| unread | **0 / 15** |

By defect class:

| class | detected |
|---|---|
| section-removal | **5 / 5** |
| factual-substitution | 4 / 5 |
| inverted-constraint | 3 / 5 |

## What this establishes

**The critic discriminates.** On this set it picks the undegraded artifact about
five times in six, it raises no false alarm on five undegraded control pairs,
and no trivial strategy available to it reproduces that:

| strategy | scores |
|---|---|
| always pick ARTIFACT A | 8 / 15 |
| always pick ARTIFACT B | 7 / 15 |
| always pick the longer file | 9 / 15 (3 trials are size-identical, where it cannot choose at all) |
| **the critic** | **12 / 15** |

The length confound is the one that matters most at a high rate, because
section-removal makes the degraded copy strictly shorter and a critic that always
preferred the longer file would score 4/4 on that class while reading nothing.
It does not explain the result: three of the twelve detections are on pairs where
the degraded side is **longer** (a planted `not ` or a substituted token adds
bytes), two more are on pairs that are **byte-identical in length**, and across
the twelve trials whose sides differ in size the critic picked the longer file 7
times — near chance.

**#29's original anecdote is now consistent with the measurement rather than an
outlier.** The issue rested on one observation: `wf_a4a68ddd-317`, a 22-line
section removed from a SKILL.md, found and confirmed by running grep. That is a
section-removal detection, and section-removal came in at 5/5. One draw from an
80% detector detecting is the ordinary case.

## What the critic does on the controls

Every one of the five undegraded control pairs was correctly called identical —
zero false alarms — under a prompt that tells it in as many words that *"a tie is
a critic declining to look closely enough"*. **One** control answered outright
that there is no winner — *"None. Not a tie from shallow looking — a literal
identity. I ran the diff."* The other four picked a side while stating in the same
breath that the pick carried no signal: *"**A** — by coin-flip convention only,
not earned"*, *"**A** — forced pick only"*. So the critic is not a
difference-seeker: it reports no difference when there is none, and finds the
difference when there is one.

An earlier version of this section said *two* controls answered `neither`
outright. That was the parser, not the critic: `parseWinner` scanned the whole
item for the word `tie` and read *"…would be worse than reporting the tie"* — the
tail of a sentence whose subject was a pick for A — as a refusal to pick. Fixed
under #53; a pick with a disclaimer is a pick, and the disclaimer is
`declaredNoDifference`'s job.

## And it quotes the defect it finds

`named_defect` records whether the response contains text that **only one side
carries**: the span where the two lines diverge, widened to at least twelve
characters, or the removed section's heading.

| | named the defect |
|---|---|
| the 12 detections | 10 / 12 |
| the 3 misses | 3 / 3 |
| all degraded trials | **13 / 15** |

Read against an 80% detection rate this is unremarkable and that is the point:
the critic locates the planted text and converts it into the verdict. It is the
same field that, read against the inverted 17%, produced issue **#52** — "the
critic quotes the planted defect and picks the degraded side anyway, on 8 of the
10 trials it got wrong". With the mapping corrected there are **three** trials it
got wrong, not ten, and n=3 is an anecdote. **#52's premise does not survive the
correction.**

The quoting-volume confound behind the field is unaffected by any of this, since
it never involved which side won. The needle was crossed against a **placebo of
the same length, from the same source file, taken from a line the transform never
touched**:

| | rate |
|---|---|
| needle (text one side carries) | **13 / 15 = 87%** |
| placebo (untouched text, same length) | **10 / 258 = 4%** |

The floor of twelve characters was chosen by that crossing rather than picked: at
a floor of 4 the needles came out `"nnot"`, `"1. b"`, `"0001"` and the placebo ran
at 22%. `test/detection-parse.test.mjs` re-runs the crossing and fails if the
placebo climbs back above 15% or the needle stops beating it.

## What was wrong, and how it was found

The sealed note records which **directory** the degraded copy was staged under —
`a/` or `b/`. The critic answers with an **ARTIFACT** letter, because that is what
the prompt calls the two files. The runner scored every trial as

```js
detected: picked !== note.degraded_side
```

which is only correct if the prompt puts `a/subject.md` on the `ARTIFACT A` line.
It does not. `loop.js` alternates which side the candidate occupies by
`(round + critic index)` parity, and the round the runner captures renders

```
ARTIFACT A: <trial>/b/subject.md
ARTIFACT B: <trial>/a/subject.md
```

so the comparison ran across two coordinate systems and returned the exact
complement of detection on every trial.

**The evidence was in the instrument's own output the whole time, and nothing
read it.** Four of the twenty responses annotate the mapping in plain words —
`` `b/subject.md` (ARTIFACT A, 318 lines) `` — and two name the file they chose
beside the letter they answered: `WINNER — **B** (`a/subject.md`)`. Reading one
response end to end is what found it; every automated check in the repository
passed on the inverted ledger.

It was then established without depending on that reading:

- **The prompt was rebuilt and hashed.** `templateHash` redacts the two paths, so
  it is independent of where the trials were staged, and the recomputed hash
  matched the `prompt_template_hash` recorded on all twenty rows byte-for-byte.
  The redacted prompt reads `ARTIFACT A: <PATH-UNDER-B>`. Because the redaction
  keeps the mapping inside the hash, one template hash across the batch is also
  proof the whole batch shared one mapping.
- **Both sides of every trial were reconstructed from the source document and the
  sealed note**, and both hashes matched on 20 of 20 — so the true byte counts of
  every `a/` and `b/` file are known.
- **The critic's own reported byte counts were crossed against those.** Where a
  response states a size — `a/subject.md (43 lines, 2695 bytes)` — it matches the
  true file in that directory. The critic read the files correctly; the ledger
  scored the reading backwards.

The p-value did not move: 0.019 either way, because the inverted rate is the
complement and the binomial is symmetric. A statistic that "excluded chance" did
exclude it — in the wrong direction — and read as confirmation.

## What was changed

- **The mapping is derived, never assumed.** `artifactSides()` reads the
  `ARTIFACT A`/`ARTIFACT B` lines out of the prompt each trial was actually judged
  under and returns `null` when it cannot; a trial whose mapping cannot be read is
  skipped rather than scored. The reason it is a derivation and not a corrected
  constant is that a constant is right only until the parity, the round index or
  `args.critics` changes it.
- **Both coordinates are recorded per row** — `degraded_side` (directory) and
  `degraded_artifact` (the letter the critic could have typed) — with
  `artifact_a_dir` beside them, so a row can be audited without rebuilding
  anything.
- **The scoring rule exists once.** It had been written three times — in the
  drawer, in the re-parser, and in the test meant to audit them — and all three
  copies carried the same defect, which is why the audit agreed with what it
  audited. `scoreDetection()` is now the only copy.
- **A second live defect was found while fixing this**: `picked === 'neither'`
  scored as a **detection**, because `'neither' !== 'A'`, while the comment beside
  that line said the opposite. It never fired only because every `neither` in the
  ledger landed on a control.
- **A third**: `--reparse` recomputed `prompt_hash` from `STAGE_DIR`, which
  defaults under `tmpdir()` and was recorded nowhere. Re-parsing this ledger on
  this machine reproduced **0 of 20** stored hashes and would have silently
  replaced all twenty with hashes of prompts that were never sent. The paths are
  now recorded per row; rows drawn before that carry their original hash and are
  flagged `paths_unrecorded` rather than overwritten.
- **`test/artifact-mapping.test.mjs`** is the reproducible. It was committed
  failing, and it fails against three constructed ledgers: one scored the old way,
  one with the mapping fields stripped, and one with a single row's letters
  inconsistent.

## Method

Twenty trials. Fifteen degraded across three classes, five undegraded controls.
Planting is mechanical — deterministic transforms over real repository documents,
with each sealed note recording the exact before/after strings, so no author chose
what to damage. The prompt is captured by driving `loop.js` through
`test/harness.mjs`, never retyped.

Blinding, after two invalid batches taught what it costs to get wrong:

- both sides are `subject.md` under `a/` and `b/` — identical basename
- trial directories are opaque hashes, so no path names the defect class
- sealed notes live outside the trial tree, which a critic holding Bash can list
- trials are staged outside this repository, and each spawn runs with `cwd` at
  its own trial directory, so the pristine original is not two levels up

The identical basenames are what made the defect invisible in prose: `a/` and
`b/` look like they must mean ARTIFACT A and ARTIFACT B, and they do not.

## What this does NOT establish

- **Whether these defects resemble the ones a real run meets.** They are planted,
  and a planted defect is one somebody chose. The rate is about detecting *this*
  set and generalises only as far as the set does.
- **Fifteen is small.** The interval is 38 points wide, 55% to 93%. What it
  excludes is chance, not much else — and the per-class figures (5/5, 4/5, 3/5)
  are each too small to separate from one another.
- **The denominator moved once already, for a reason that had nothing to do with
  the critic.** This document first reported the rate over twelve trials, because
  `parseWinner` demanded a `#` heading and dropped three responses that answered
  in the prompt's own numbered form. Fixed under #53; the rate is now over all
  fifteen. A 20% drop set by markdown decoration narrowed every interval here and
  nothing noticed until the ledger was read by hand.
- **The mapping of these twenty rows rests on loop.js's alternation as it is
  today**, plus the shared template hash, rather than on a prompt rebuilt from
  each trial's own recorded paths — those paths were not recorded when the batch
  was drawn. Every row drawn from now on records them and is verified against a
  rebuilt prompt.
- **The builder arm.** #25 is the same question about the other agent and has no
  positive observation at all.
- **One model, one day.** No claim about other models or about drift.
- **That a high rate here licenses trusting a verdict in a real run.** These pairs
  differ by one mechanical transform. A real round compares two artifacts that
  differ in every way at once, and nothing here measures that.

## What it licenses, and what it does not

**#18's automatic revert was declined on a number that was wrong, so the decline
no longer has its reason.** The argument was: rollback authority handed to an
evaluator detecting at 17% would discard work more often than it saved any. At
80% that argument is gone. **It does not follow that the revert arm should be
turned on** — that is a decision for the operator, on a rate whose interval runs
from 55% to 93%, measured on planted single-transform defects that are not the
thing a revert would act on. What has changed is that the question is open again
and the old answer's stated basis is void.

**Verdicts already in the record are stronger than the previous version of this
document said, and no weaker than before it.** That version concluded a loop
exiting on this critic's pick "is exiting on a judgement that, on planted defects,
lands below chance". That sentence was false and is withdrawn.

**#52 is refuted on its own evidence** and should be closed as such rather than
worked.

## Reproducing

    node scripts/detection-draw.mjs --stage
    node scripts/detection-draw.mjs --draw --limit 20
    node scripts/detection-draw.mjs --reparse
    node test/detection-rate.test.mjs
    node test/detection-parse.test.mjs
    node test/artifact-mapping.test.mjs
    node test/winner-parse.test.mjs

The ledger is `runs/detection.jsonl`, responses are `runs/detection-raw/`, sealed
notes are `runs/detection-sealed/`. Re-parsing never needs re-spawning: every
response is written to disk before it is read, which is why a defect that
inverted every verdict cost a re-parse and no live agents.

## Second correction: the parser set the denominator (#53)

Found while writing up the first correction. `parseWinner` located the verdict by
matching a heading, `/^#{1,4}\s*\d*\.?\s*WINNER\b/`. The prompt never asks for a
`#` — it asks for a numbered list, `1. WINNER — A or B` — so three responses that
complied literally, writing `**1. WINNER — B**`, were recorded as unread and
dropped from the rate. A fourth defect in the same function read the word `tie`
anywhere in the item, turning a control's *"**A** — by coin-flip convention
only… worse than reporting the tie"* into a refusal to pick.

The fix is not a wider catalogue of markdown shapes. The labels are read out of
the prompt's own numbered template (`templateLabels`), a section line is any line
carrying one of those labels once decoration and an item number are stripped, and
the answer is the FIRST answer token inside the item — because the template reads
`1. WINNER — A or B`, so the answer is what follows the label, and everything
after it is the critic continuing to talk. `DEPLOYED_LABELS` is crossed against
the live prompt on every run, so the fallback cannot go stale in silence.

Effect on the ledger: four of twenty answers changed — the three that were
unread, plus the control that was recorded `neither` and had picked A. Sixteen
were unchanged. **The rate moved from 10/12 = 83% to 12/15 = 80%**, which was
written into #53 before the fix was built precisely so the fix could not be
graded by whether it moved the number in a welcome direction.

`test/winner-parse.test.mjs` is the reproducible. Six mutations of the parser are
caught by it, including one — deleting the word-boundary check that stops a label
from matching a longer word — that survived the first version of the test. The
property was asserted in the code and no input needed it, which is the
can't-fail-check rule one level in: the check existed, and nothing established
that it did anything.

## Earlier correction to this document, kept

The first version reported "1 of the 2 detections quoted the planted text". That
was produced by a needle built from the **first 60 characters of the changed
line** — so a substitution deeper than character 60 left the needle identical on
both sides, and a critic that quoted the sentence while noticing nothing scored
the same as one that found the number. Three of the fifteen degraded trials have
that shape.

The parse now lives in `scripts/detection-parse.mjs`, apart from the spawner,
because `test/containment.test.mjs` forbids anything the suite runs from naming a
spawner — which is why the parse had no test and all four of its defects were
found by reading it. The ledger was rebuilt from the responses already on disk; no
trial was re-run.

That correction and this one are the same defect at two levels. Both are a check
whose value was computed from a fact nobody crossed against the artifact: there,
a needle assumed to be side-exclusive that was not; here, a letter assumed to mean
a directory that did not. **The rule both of them are instances of: a fact that is
derivable from the artifact must be derived from it, not stored beside it — and
where it is stored, something must recompute it and fail on disagreement.**
