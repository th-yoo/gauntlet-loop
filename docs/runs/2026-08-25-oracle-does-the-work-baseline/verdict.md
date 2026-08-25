# Oracle baseline — the pairing check's does-the-work arm

**instrument** `sha256:a546e3c339586225…` (the prompt `loop.js` produced on 2026-08-25)

The first observation of the pairing check against ground truth its author did not write.

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
