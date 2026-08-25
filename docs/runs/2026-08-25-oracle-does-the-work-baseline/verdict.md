# Oracle baseline — the pairing check's does-the-work arm

**instrument** `sha256:e788e8e1904448c0…` (template hash — the prompt wording, with each
row's own goal and artifact blanked out)

Four observations of the pairing check against ground truth its author did not write.

## What was measured

One corpus row, `make-hello`: a two-target Makefile plus its `hello.c`, goal *"a working
hello executable exists and prints hello"*.

Its expected role was established **mechanically, with no model consulted**:

```
make -C oracle/fixtures/make-hello && oracle/fixtures/make-hello/hello | grep -qx hello
```

`scripts/oracle-add.mjs` ran that command itself and refused to write the row until it
exited 0. That exit code — not anyone's judgement — is what says executing this
artifact terminates in the goal's deliverable.

## The observation

A fresh agent, given the prompt `loop.js` would actually send (captured, not retyped),
told nothing about the expected answer:

> `{"role": "does-the-work", …}` — *"An agent handed this file would run `make`, which
> directly invokes cc to compile and link hello.c into the hello executable, and running
> the resulting ./hello prints 'hello' — verified by executing it. The artifact is not a
> description or spec for someone else to implement later."*

The agent ran the build before answering. **Expected `does-the-work`, got
`does-the-work`.** Correct.

## What this establishes

Almost nothing, and the report says so rather than dressing it up:

```
observations       1
distinct artifacts 1
misclassified      0
rate               CANNOT BE POSED — 1 distinct artifact supports no rate.
                   0/1 wrong is consistent with a per-side error rate anywhere
                   up to 100% — at n=1 the rule of three bounds nothing.
```

What it does establish is that **the pipeline works end to end**: a row can be grounded
without an opinion, the live prompt can be captured rather than copied, an observation
can be pinned to the instrument that produced it, and the report refuses to state a rate
it cannot support.

## What it does not establish

- **Any rate.** n=1.
- **Selection bias.** One row, chosen by whoever built it. The relation in the row is
  mechanical; the choice of row is not, and adding more of the same kind hides this
  rather than fixing it.
- **Answer stability.** One draw. A correct answer at n=1 is not evidence of accuracy.
- **The generator arm.** Nothing measured. It has no mechanical acceptance test and
  its rows come from `oracle/generator-procedure.md`, unbuilt.

## Why the instrument hash is in the header

The pairing check's prompt changed once already and silently invalidated five of the
seven observations then on record — they had been made against a two-verdict question
that no longer existed. `scripts/oracle-record.mjs` now re-extracts and refuses an
observation whose hash does not match, and `scripts/oracle-report.mjs` refuses to pool
cohorts across hashes. A reader comparing a future number against this one runs:

```
node scripts/oracle-extract.mjs --artifact <row's artifact> --goal "<row's goal>" --json
```

Same hash, same instrument. Different hash, and this baseline does not apply.

## Corrections this run made to its own design

The blueprint's oracle set, as originally filed on #33, listed a Makefile as a
**generator**. It is not: handed one, an agent runs `make` and the goal is met. All five
of #33's proposed generator rows are `does-the-work` artifacts, which makes them a
control arm measuring the false-refusal rate — the number that decides whether the
automatic refusal is safe — rather than the generator arm they were filed as.

The report tool's first run printed *"up to about 300%"* — the rule of three is `3/n`,
which exceeds 1 below n=3. Capped, and below n=3 it now says the bound carries no
information instead of printing an impossible rate.

---

## The four rows, and why these four

| row | artifact | why it is in the corpus |
|---|---|---|
| `make-hello` | a Makefile | build tool; `make && run` settles it |
| `sh-report` | a POSIX shell script | a second language, so the corpus is not one shape repeated |
| `py-slug` | a Python script | a third |
| `readme-build` | **prose that instructs** | **the hard case** — see below |

`readme-build` is the row that was chosen for being *near* the boundary rather than far
from it. It is a `BUILD.md` saying "run `cc -O2 -o counter counter.c`, then `./counter`".
It reads like an instruction, and a careless classifier calls it
`produces-an-instruction`. It is not: the reader following it reaches the deliverable
themselves, and the prompt's own wording counts "the instructions for operating
something that does the thing right now" as does-the-work. That is where a false
refusal would come from, so that is where a row was put.

The agent got it right, and cited exactly that distinction unprompted:

> *"Nothing here is addressed to a separate party or deferred for later action — it is a
> runbook for a program that already exists… That matches the does-the-work criterion
> 'instructions for operating something that does the thing right now', not
> produces-an-instruction (which requires the goal to remain untouched when the
> artifact-following is done)."*

## The result

```
observations       4
distinct artifacts 4
misclassified      0
rate               CANNOT BE POSED — 4 distinct artifacts supports no rate.
                   0/4 wrong is consistent with a per-side error rate anywhere
                   up to about 75% (rule of three at n=4). Not evidence of accuracy.
```

**Four for four is not evidence of accuracy**, and the tool refuses to present it as
such. What it rules out is a classifier that is badly wrong on obvious cases — which was
not known before, since the does-the-work arm had never been measured at all.

## Two bugs this run found in its own instruments

**The cohort key was wrong.** Cohorts were grouped by `prompt_hash` — but the goal and
artifact path are interpolated *into* the prompt, so no two rows can ever share one. The
report's first four-row run printed four cohorts of one, which is how it was caught.
Cohorts now group by `template_hash`: the prompt with this row's own goal and artifact
blanked out, stable across rows and moving only when the wording itself changes — which
is the event that must actually split a cohort.

**Test runs had written to the tracked ledger.** Four observations carrying
`prompt_hash: sha256:0000` were in `results.jsonl`, put there by suite runs before the
suite was sandboxed — a mutation disabling the staleness check let a test write a real
row. Dropped, and the report now honours `ORACLE_RESULTS` so a test can never reach the
real ledger again. Same class as the corpus pollution recorded in
`../2026-08-25-oracle-fork-bomb/incident.md`, found the same way: by reading a number
rather than trusting a restore.

---

## Generator arm, same day — and it tests finding 4

Finding 4 of the #33 investigation hypothesised that the `produces-an-instruction`
class is *genuinely narrow* — mostly meta-prompts — rather than under-sampled. The cheap
failure mode is to add two prompt-shaped rows, watch them classify correctly, and call
the hypothesis confirmed by not looking.

So both generator rows are deliberately **not prompts**:

| row | artifact | its stated deliverable |
|---|---|---|
| `brief-writer` | a creative-brief template for an external design studio | a brief the studio designs from |
| `spec-generator` | an internal spec-request form | a specification an engineering team builds from |

Ground truth came from execution, per `oracle/generator-procedure.md`:

1. **Executed.** A builder agent given the artifact and the goal produced a filled brief
   and a filled spec form respectively. Both reported the goal **still outstanding** —
   *"The document I produced is a brief for the studio to design from, not the landing
   page itself"*; *"Nothing is built by completing this form."*
2. **Classified independently.** A second agent, shown only the two emissions and never
   the artifacts, asked a *different* question — is this content a completed answer, or
   addressed onward? Both: `addressed-onward`.

No disagreement, so neither row is `DISPUTED`.

Then the probe, given the captured prompt and told nothing: both
`produces-an-instruction`. Correct.

```
   generator arm
     observations      2
     distinct artifacts 2
     misclassified     0
     rate              CANNOT BE POSED — 2 distinct artifacts supports no rate.
```

**What this adds.** The class is not only prompt-shaped — a brief template and an intake
form are both plainly in it, and the probe caught both. Finding 4's hypothesis is
*weakened*, which is the useful direction: the arm is not stuck at single digits for
lack of candidate shapes, and the falsification hunt should continue rather than stop.

**What it does not add.** Two artifacts, one draw each. No rate, and no claim of one.
