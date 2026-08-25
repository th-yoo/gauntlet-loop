# Run record — 2026-08-24 — the unanimity exit fires, and a falsification test that failed usefully

Two runs, back to back, on one pairing. The first cleared two items off the
"still not established" list. The second was run to falsify the first, did not
falsify it, and exposed a defect in one of the instruments instead.

Both used a design-decision document as the artifact class — the first time the
loop has been pointed at a decision rather than at a skill doc.

```
candidate:  /tmp/gauntlet-loop/trial-3/doc-2.md   (43-line stub, seeded by the operator)
reference:  superpowers 6.3.0 docs/superpowers/specs/2026-07-15-sdd-fix-loop-redesign-design.md
            staged as doc-1.md, 196 lines
critics:    2
```

The candidate stub stated a problem — the builder-retrieval mechanism of #25 —
and deliberately decided nothing, closing with "Nothing is decided." The
reference is a real approved design spec written by someone outside this repo.

## Run 1 — `wf_dec93fe9-401` — WON at round 2

**11 agents · 170k tokens · 8.4 min · 0 errors**

```
round 1   candidate as B                 LOST   decisive
round 2   candidate as A and as B        WON    2/0   clear
```

**The unanimity exit fired, for the first time.** Round 2's first critic let the
candidate through, so escalation bought the second — the branch that had never
executed in any prior run, because every earlier k=2 round lost at critic 1 and a
losing round cannot exit. Positions were split within the round: ours was A for
one critic and B for the other, and both picked it.

**A verdict flip was observed.** Lost, built once, won. The only run before this
that iterated never won, and the only one that won never iterated.

**The lead refused to split**, correctly: "the five required questions are
mutually dependent parts of one continuous decision narrative [...] doc-2's
actual defect is an absence spanning the whole document, not a weakness locatable
in any one part."

**The builder retrieved rather than produced.** It grounded the new section in
`scripts/seed-loop-trial.mjs` and commit `ace18d0`, which had already made a
version of this decision, and disclosed it unprompted in `ambiguity`. That is the
second builder in a row to self-report retrieval without being asked — the
mechanism of #25, in an ordinary run rather than a seeded trial.

**The flip was confounded, and the loop said so before it happened.**
`goal_fairness` returned `partly`, naming one clause the reference does not
attempt at all: "what it costs if the choice turns out wrong — there is no risk,
rollback, or failure-cost section." Both round-2 critics then rested on exactly
that clause, each calling it the more important of their two reasons. The
candidate won on a dimension the reference never entered. The probe worked; the
operator read the NOTE and launched anyway — the same error class as #25, where
gate 7 predicted the leak and the trial was designed regardless.

## Run 2 — `wf_2a9fd968-e7b` — WON at round 1

**7 agents · 101k tokens · 6 min · 0 errors · no build round**

Run to falsify run 1's flip. One variable changed: the cost-if-wrong clause was
cut from the goal. The candidate file was left untouched and verified identical
by md5 — editing it to remove the matching section would have made two changes.

The prediction was registered before launch: a win means the flip was real, a
loss means it rode on the unfair clause.

It won round 1, 2/0, positions split. But the prediction was badly specified and
the result settles less than it looks like.

**The reference-side contamination was real and removable.** `goal_fairness` went
`partly` to **`attempts`**, `parts_not_attempted: None`. One clause out, verdict
flips, nothing else touched — a clean demonstration that the probe measures what
it claims.

**The mirror contamination appeared.** `goal_fitted` went `need` to **`fitted`**,
on a byte-identical candidate. Its reasoning is quoted in #27. The short version:
it caught that goal and artifact are no longer independent, and inferred the
wrong direction — the builder had written the artifact from the goal in run 1's
round 2, which is the loop working.

**This is now #27.** `goal_fitted` cannot distinguish a goal fitted to the
candidate from a candidate built to the goal, and the failure is monotone in the
loop's own success: every build round makes the goal read more like a description
of the artifact. It degrades precisely on the runs that converged.

**Critics judged past the stated goal.** Both round-2 critics of run 2 credited
the candidate's "Cost if this is wrong" section, which the new goal no longer
asks for. One called it "a level of self-audit the other document lacks
entirely."

## What survived both runs, over-determined

Three agents with different blindnesses independently faulted **rows 3 and 5** of
the reference's decision table for stating a rationale without naming a rejected
alternative, and all three singled out row 3's "Jesse's call" as an appeal to
authority: the `goal_fairness` probe, which never saw the candidate and reported
before any critic ran, and both blind critics, from opposite positions. More
anchors than fitted parameters. The candidate is genuinely better on that axis.

## What these runs establish

- The unanimity exit fires, and escalation buys the extra critic only on a round
  that could end the run.
- A verdict can flip after a build round.
- `goal_fairness` measures what it claims: cutting the clause it named moved it
  from `partly` to `attempts`.
- The loop runs on a decision document, and the lead refuses to split one.

## What they do not

- **That the loop makes artifacts better.** Run 1's content was retrieved from a
  commit; run 2 won without building at all. Neither is evidence that the
  iteration produced the quality.
- **Still no calibration.** Neither run had a seeded defect. The disclosure
  `NO CALIBRATION ANYWHERE` is unchanged.
- **A clean convergence observation.** The one flip is confounded on the clause
  its own probe flagged in advance.

## Defect found by running

`loop.js:1089` reported "N separate critic spawn(s); M produced a recorded
verdict" with M interpolated from `history.length` — rounds, not verdicts. At
`critics: 1` the two are equal, so every earlier run and the existing test read
correctly. Escalation makes them diverge, and run 1 was the first time that shape
ever existed: 3 spawns, 3 verdicts, reported as 2, which reads as if a critic had
returned nothing. Fixed, with a test at `critics: 2` that fails against the old
line.

The existing k=1 test was not wrong. It could not discriminate — the fifth
instance of a check in this repo that passed because its input never varied.
