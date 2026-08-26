# Issue 28 — root causes, and the reproducible for the one that is buildable

**Written before the classification and before the draw.** The prediction at the bottom is
recorded while the answer is unknown.

## Where #28 stands after the stability run

`0bf7bab`/`1ea6eff` closed one of the issue's three gaps: 8 pairings x 3 draws, zero flips.
The remaining two are not the same kind of thing, and one of them is partly stale.

## RC1 — the corpus cannot separate ROLE from FILE SHAPE in the direction that matters

Computed from `oracle/corpus.jsonl`, not asserted:

```
role x shape occupancy
  does-the-work            code   11        produces-an-instruction  prose  6
  does-the-work            prose   2        produces-an-instruction  code   0   <- EMPTY
  could-not-open           code    1        could-not-open           prose  1

a shape-only classifier (code -> does-the-work, prose -> produces-an-instruction)
scores 17/19 = 89% on the non-absence corpus, and 6/6 on the writer arm.
```

Every artifact ever labelled `produces-an-instruction` in this corpus is a markdown
document. The reverse cell is populated — `readme-build/BUILD.md` and
`runbook-checklist/RELEASE.md` are prose that does the work, which is why the shape-only
baseline is 89% and not 100% — but **no executable has ever been labelled a writer.**

So the probe's `0 misclassified` cannot distinguish "reads the role" from "reads the file
shape" in the direction where a mistake means **the refusal fails to fire**: a generator
read as a worker returns `comparable`, the run proceeds, and the pairing the check exists
to stop is compared anyway. The corpus's refusal-fires cell is 2 pairings, one of which is
an absent file.

This is the parent rule in `CLAUDE.md` applied to this instrument: cross the claimed
property against the confound it is probably measuring instead, and arrange the cases so an
instrument reading the confound scores at chance. Today it scores 89%.

## RC2 — the gap as filed is partly stale, and the residual moved

#28 says *"the probe reads both artifacts with a shell"* and cites the P6 trial, where its
reasoning showed it had identified which side belonged to this repo. That describes a
design that stopped shipping 63 minutes after the issue was filed:

```
#28 filed          2026-08-25T03:12:02Z
95ff1fe            2026-08-25T04:15:11Z   refactor(loop): ask each artifact alone and
                                          derive the pairing verdict
```

`checkComparability` now calls `roleOf(CANDIDATE)` and `roleOf(REFERENCE)` concurrently,
each with ONE path, and the verdict is a three-line pure derivation over the two answers.
The agent's own description says it *"sees only one artifact and is never told what it
faces."*

The residual survives in a different form and is unmeasured: `gauntlet-goal-check` holds
`Bash`, `Grep` and `Glob`, so a one-artifact prompt does not prevent the agent from reading
the filesystem around the artifact. Blindness of the CONTENT is structural now; blindness of
the ENVIRONMENT is not, and nothing in the corpus tests it — every fixture sits inside this
repository, where provenance is exactly what a `grep` would find.

## RC3 — the answer key is still the author's

Unchanged, and the largest. The generator arm reads its label off a blind second agent
rather than off a flag, which is real, but the SELECTION of rows is one person's, and
selection bias cannot be fixed by adding rows of the same kind (#38, #33).

## RC4 — the evidence is reported stronger than it is

Found while running the stability draws: `oracle-report` computes Wilson intervals over
observations (`:336`) and over draws (`:541`), while printing, two lines above,
`distinct artifacts <- the number that bears on any statistical claim`. Redrawing the same
six pairings narrowed the false-refusal interval from `[0%, 39%]` to `[0%, 18%]` without a
single new pairing being tested. An instrument's evidence looking twice as strong as it is
makes the authority-evidence mismatch worse from the reporting side.

## RC5 — the authority is unconditioned

```
$ grep -c 'oracle\|corpus\|results.jsonl' skills/gauntlet-loop/loop.js
0
```

`loop.js` never consults the corpus. There is no threshold, no switch, and no degradation
path: if tomorrow's measured false-refusal rate were 40%, the probe would refuse exactly as
it does today. Whatever the corpus says, it says it somewhere the instrument cannot hear.
The remedy #28 proposes — downgrade the refusal to a warning — has nowhere to attach.

## The reproducible

RC1 is the only one of the five that is buildable as an input that FAILS. The empty cell is
the reproducible: **an executable whose deliverable is a request to another party.**

`oracle/fixtures/brief-emitter/emit-brief.sh` — a POSIX shell script, `set -eu`, `mkdir`,
heredoc, exit-0, shaped exactly like the eleven scripts and Makefiles in the
`does-the-work` arm. Run it and it writes `run/design-brief.md`, a brief for a studio, and
the landing page does not exist. Same goal string as `brief-writer` and
`teardown-request`, so the row sits in the arm it belongs to.

Ground truth comes from execution, per `oracle/generator-procedure.md`, with one deviation
recorded here: **step 1 was mechanical, not agentic.** The artifact is an executable, so
running it IS the execution — no agent interpretation stands between the artifact and its
emission, which is stronger evidence than the procedure's own step 1, not weaker. Step 2 is
unchanged: a second agent that has never seen the script classifies the OUTPUT with the
addressee question, and `oracle-add` reads the label off that response.

## The prediction, recorded before the classifier and the draw run

**I expect the probe to get this right — `produces-an-instruction`.** The live prompt names
the handoff case explicitly (*"stops short BY DESIGN and names or implies a further
party"*), and the emitted brief says the page is not built. Call it 70/30.

If that holds, the row buys one thing and it is not vindication: the empty cell gets its
first entry, and the shape-only baseline on the writer arm drops from 6/6 to 6/7. One row
does not remove a confound — it starts crossing it.

If it comes back `does-the-work`, that is a misclassification in the direction that makes
the refusal FAIL TO FIRE, and the corpus's perfect record becomes explainable by shape. In
that case #28's authority question is no longer about stability at all, and the remedy is
RC5's: give the refusal somewhere to be downgraded from.
