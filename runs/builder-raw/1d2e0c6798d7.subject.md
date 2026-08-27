# Issue 28 — suspects, and the one reproducible that was built

**CORRECTED 2026-08-26, after the result.** This file was published at `06c8751` calling
these five things ROOT CAUSES. Four of them were not, and one had already been refuted in
its causal half by the time the word was committed. The correction and what it cost are at
the bottom, under *The naming outran the evidence*; the status line now on each heading is
the substance of it.

S1-S5 were RC1-RC5 in `06c8751`. **The numbering is kept, and so is this file's name**, so
that the pointer in `brief-emitter`'s corpus note and the commit message still resolve. The
`rc-` in the filename is now wrong and is left wrong on purpose.

A ROOT CAUSE IS A COUNTERFACTUAL: the defect occurs because of this, and would not if this
were removed. Inspection establishes a FACT. It does not establish that link, and this
project's own rule says reading the source finds nothing. Each heading below therefore
carries what its evidence actually is:

| status | what it means |
|---|---|
| VERIFIED FACT | computed or grepped from the artifact. True, and not thereby a cause |
| OBSERVED FAILURE | something went wrong in a way that was watched. The only status that earns "cause" |
| UNTESTED | a conjecture with no input built. This is where four of the five sat |
| REFUTED IN ITS CAUSAL HALF | the fact holds, the failure it predicted was built and did not occur |
| UNREPRODUCIBLE BY CONSTRUCTION | no input can fail it, so no reproducible will ever exist |

**Written before the classification and before the draw.** The prediction below is recorded
while the answer is unknown.

## Where #28 stands after the stability run

`0bf7bab`/`1ea6eff` closed one of the issue's three gaps: 8 pairings x 3 draws, zero flips.
The remaining two are not the same kind of thing, and one of them is partly stale.

## S1 — the corpus cannot separate ROLE from FILE SHAPE in the direction that matters

**Status: VERIFIED FACT, and REFUTED IN ITS CAUSAL HALF.** The occupancy below is computed.
The claim it was named for — that the probe is therefore reading shape — was built into an
input and did not occur. See *The result*.

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

## S2 — the gap as filed is partly stale, and the residual moved

**Status: the staleness is a VERIFIED FACT (two timestamps). The residual is UNTESTED** —
nothing here shows the probe uses `Bash` to find provenance, only that it could.

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

## S3 — the answer key is still the author's

**Status: UNREPRODUCIBLE BY CONSTRUCTION.** A sampling frame cannot fail a test, which is
why #38 is permanent rather than open.

Unchanged, and the largest. The generator arm reads its label off a blind second agent
rather than off a flag, which is real, but the SELECTION of rows is one person's, and
selection bias cannot be fixed by adding rows of the same kind (#38, #33).

## S4 — the evidence is reported stronger than it is

**Status: OBSERVED FAILURE.** The only one of the five that earned the word. It happened
to this session's own numbers, in front of the person quoting them.

Found while running the stability draws: `oracle-report` computes Wilson intervals over
observations (`:336`) and over draws (`:541`), while printing, two lines above,
`distinct artifacts <- the number that bears on any statistical claim`. Redrawing the same
six pairings narrowed the false-refusal interval from `[0%, 39%]` to `[0%, 18%]` without a
single new pairing being tested. An instrument's evidence looking twice as strong as it is
makes the authority-evidence mismatch worse from the reporting side.

## S5 — the authority is unconditioned

**Status: VERIFIED FACT, causal half UNTESTED.** The grep is 0. That the refusal *would*
behave differently if it could read the rate is a counterfactual nothing here tests, and
arguably nothing can while nothing reads it.

```
$ grep -c 'oracle\|corpus\|results.jsonl' skills/gauntlet-loop/loop.js
0
```

`loop.js` never consults the corpus. There is no threshold, no switch, and no degradation
path: if tomorrow's measured false-refusal rate were 40%, the probe would refuse exactly as
it does today. Whatever the corpus says, it says it somewhere the instrument cannot hear.
The remedy #28 proposes — downgrade the refusal to a warning — has nowhere to attach.

## The reproducible

S1 is the only one of the five that admits an input that can FAIL. S3 never will, S2 and S5
would need a counterfactual, and S4 had already failed on its own. The empty cell is the
reproducible: **an executable whose deliverable is a request to another party.**

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
S5's: give the refusal somewhere to be downgraded from.

---

# The result

**The probe got it right, twice, and the reasoning shows why.** The prediction recorded
above held — which is worth what a held prediction is worth, and no more.

```
brief-emitter  produces-an-instruction  CORRECT
brief-emitter  produces-an-instruction  CORRECT
```

The label came from the blind classifier, which quoted *"The page does not exist until the
studio builds it from this brief."* The probe, drawn twice afterwards, agreed — and its own
reasoning is the informative part, because it did not read the file at all in the sense the
confound predicts:

> *"Ran it: `sh emit-brief.sh` writes exactly one file, run/design-brief.md (960 bytes), and
> prints 'wrote .../design-brief.md'. No HTML, CSS, copy, or assets are emitted... Following
> this artifact to its end leaves the landing page untouched — the handoff is by design, not
> a failed attempt."*

**It executed the artifact and classified the emission.** That is the live prompt's own
instruction — *"Where it can be run or measured, run and measure it"* — being followed, and
it is direct evidence against the shape hypothesis rather than another correct label on a
row that could have been right for the wrong reason.

## What this buys, and what it does not

The empty cell has one entry. The shape-only baseline is now:

```
shape-only classifier: 17/20 = 85% on the non-absence corpus
on the writer arm alone: 6/7 — 1 executable writer(s) now break it
```

That is one row less degenerate, not a crossed confound. An instrument reading shape still
scores far above chance here, because the cell has one entry and the arm has 7. The
cross is crossed when a shape-only classifier scores at chance, and it does not yet.

**What is now known that was not:** the probe's correctness on this row does not rest on
the file extension, because the probe said what it did instead — it ran the thing. That is
a mechanism, and it predicts where it would fail: an artifact that cannot be run, or whose
run emits nothing, leaves it with nothing but the text and the shape.

**That is the next reproducible**, and it is derivable from this result rather than from
knowing an answer: an executable writer whose execution emits NOTHING observable — a script
that prints a request to stdout and writes no file. If the probe reads the emission, it has
none to read.

## The four suspects this did not touch

S2 (environment blindness — the agent still holds `Bash` and every fixture lives inside
this repository), S3 (the selection is one person's), S4 (Wilson over observations rather
than distinct artifacts), and S5 (`grep -c 'oracle|corpus' loop.js` = 0, so the refusal has
nothing to be downgraded from). S5 is the one that makes #28's own proposed remedy
impossible today, and no measurement will fix it.


---

# The naming outran the evidence

This file called five things root causes. One was.

A root cause asserts a counterfactual — *the defect occurs because of this*. What produced
four of these five was inspection: an occupancy table, two timestamps, a tools list, a
`grep` returning 0. Every one of those is true. None of them is a cause, and the difference
is not pedantic: **S1's causal half was built into an input within the hour and did not
happen.** The probe ran the artifact and classified its emission. Had the word stayed
uncorrected, this file would record a cause that the file's own experiment refutes two
sections later.

The precedent was in this repository, from earlier the same day. `2026-08-26-rc5-suspects.md`
calls its seventeen items SUSPECTS and puts VERIFIED, PARTLY VERIFIED or FIXED on each,
because a list that cannot say what it has established will assert everything at the
strength of its strongest item. That discipline was available and was not applied here.

There is a second reason it mattered for this issue specifically. **#28 is not a
malfunction.** Nothing produces a wrong output; the complaint is that authority exceeds
evidence. A defect with no wrong output has no failing input — the same shape as #46's RC5,
recorded there as *"a composition has no owner — neither file is wrong, so no reproducible
can be built that FAILS."* For that class, "root cause" is the wrong frame from the start,
and suspects-with-status is the instrument that fits.

**What still has no reproducible, stated plainly:** S2 and S5. Both are buildable and
neither is built. S4's failure was watched but is not yet a test, so it can recur silently.
S1 keeps its status until a shape-only classifier scores at chance on this corpus, which
one row does not achieve.

---

# Where each suspect stands, 2026-08-26 end of session

The paragraph above was true when it was written and is not any more. Kept rather than
edited, because what it got wrong is the record: two of the five were called unbuildable-
for-now and were built within the hour.

| suspect | then | now |
|---|---|---|
| S1 shape confound | VERIFIED FACT, causal half REFUTED | unchanged. `brief-emitter` put the first executable in the writer arm (`1ea6eff`) and the probe ran it rather than reading its extension. One row is not a crossed confound |
| S2 environment blindness | UNTESTED | **still UNTESTED.** No input built. It is the only suspect nothing has been spent on |
| S3 answer key is the author's | UNREPRODUCIBLE BY CONSTRUCTION | unchanged, and permanent (#38) |
| S4 interval over the wrong unit | OBSERVED FAILURE, no test | **FIXED** (`81df191`). `test/interval-unit.test.mjs` reproduces it on synthetic ledgers; the shipped figures moved back to `0/6, CI [0%, 39%]` and `0/17, CI [0%, 18%]` |
| S5 authority unconditioned | VERIFIED FACT, causal half UNTESTED | **HALF FIXED** (`8dbdc7f`). `args.on_refusal` makes the refusal answerable, with the unreadable verdict deliberately not downgradable and the downgrade recorded. The other half stands: `grep -c 'oracle\|corpus' loop.js` is still 0 |

**The half of S5 that is not fixed is the half S5 named.** #28 asks for a refusal that can
be downgraded *when the evidence says so*. What ships is a refusal an operator can overrule.
Conditioning authority on a person is not conditioning it on a measurement, and the corpus
still cannot reach the decision it is about.

**What the S5 work found that was not S5.** `drift-guard` scans `args.*` in three places
with three copies of a pattern that excludes underscores, so the first underscored argument
in `loop.js` read as `args.on` in all three — the guard demanding documentation for a name
that does not exist. Two were fixed and the failure moved to the third. Same shape as #46
RC4, found the same way: by adding something the assumption had never met.
