# 0003 — A regressed round is measured, recorded, and not reverted

**Status:** decided, 2026-08-30. **Decided by:** the operator (th-yoo), by instructing that
issue 18 be closed; the reasons below are the evidence on file as read at that time, and
the operator can overturn them by changing the one assertion that encodes them.
**Closes:** the last open half of issue 18 — *"should a regressed round be rolled back
automatically?"*
**Records this rests on:** `docs/runs/2026-08-27-detection-rate/verdict.md` (the critic's
detection rate), `docs/runs/2026-08-29-tetris/verdict.json` (the only run made since the
regression check shipped), `test/regression-check.test.mjs` (the assertion that nothing is
reverted).

## The question

Since `e917952` every built round takes a snapshot before editing and asks one fresh critic
which version is closer to the goal — this round's, or the copy taken before it. The answer
is recorded per round as `regression`, with `regressed: true` when the critic preferred the
copy. Nothing is rolled back. Issue 18 declined an automatic revert on the ground that the
critic's detection rate was one observation; that rate was then measured at 12/15, so the
stated reason was void and the question stood open with no answer on file.

## What was measured before deciding

- **The critic's detection rate is 12/15 = 80%, Wilson 95% CI 55%–93%, 0/5 false alarms** —
  measured on pairs that differ by one mechanical transform, where every miss was a defect
  of three bytes or fewer. At the bottom of that interval an automatic revert discards
  good work nearly half the time it fires. And a regression in a real round is not that
  shape: it is a builder's rewrite, not a planted transform.
- **The regression rate on the only run on file is 0/3.** The Tetris run built three
  rounds, the builder reported a snapshot on each, and the regression critic preferred the
  new version each time (`history[*].regressed` is `false` three times, `regression.prefers`
  is `"new"` three times). A revert would have fired zero times. Three rounds bound the
  rate at 0%–56%, which is to say they do not bound it; but there is no observed regression
  to have saved.
- **"Recoverable by hand" is as durable as the snapshot's location.** The three snapshot
  paths in that verdict are under `/tmp` and a session scratchpad. The record names them;
  the files outlive the session only if something keeps them. This was not known when the
  sentence "the previous version is named in the record, so a regression is recoverable by
  hand" was written, and it narrows that sentence.
- **The revert cannot be verified by the script, and that is structural.** A Workflow
  script has no filesystem. A copy can be made checkable — a second Bash-only agent hashes
  both paths and the script compares two strings from two parties. Nothing available checks
  that a *revert* restored the right bytes, or restored anything: the script would report a
  preserved best version on the builder's word. Issue 18's comment of 2026-08-24 made this
  argument, and the detection-rate measurement does not touch it.
- **A wrong revert is quieter than a wrong refusal.** A refusal stops the run loudly. A
  revert silently discards a round, and the next round's critic never sees what went.
- **The regression verdict is one judge on one day**, and it cannot tell an improvement
  from a lateral move. The exit's own confirmation needs two judges on unchanged bytes;
  a revert on one judge would apply a weaker standard to a more destructive action.

## The decision

**No automatic revert. The loop measures, records, and leaves the artifact as the builder
left it.** `history[n].regressed` and `history[n].snapshot` are the operator's to act on.
`test/regression-check.test.mjs` asserts `reverted !== true` on a regressed round, as an
assertion rather than an absence, so turning revert on has to change that line deliberately.

Declined, with reasons:

- **Revert on `regressed: true`.** Acts on one judge, at a detection rate measured on
  nothing like the case it would decide, through a mechanism the script cannot verify,
  with a silent failure mode. Four objections; the measurement removed none of them.
- **Revert gated on `margin`.** Dead on evidence: in issue 18's own measurement four of five
  judges reported `clear` on both sides of a 3–2 split. The field does not separate a
  stable verdict from a coin flip.
- **Revert with a hashing agent to verify it.** Verifies that a copy exists and matches;
  does not verify that restoring it was the right call. It closes the smaller gap.

## What would reopen this

- **The first `regressed: true` in a real run.** Then the question has an instance: what
  did the next round do with the un-reverted artifact, and what would it have done with
  the snapshot — one more critic answers it, and that is the measurement issue 18 asked for
  and no run has yet supplied.
- **A detection measurement on round-shaped regressions** — a builder's rewrite that made
  things worse — rather than on single mechanical transforms. The 80% is for the wrong
  shape.
- **Snapshots at a durable path.** Today the builder chooses where the copy goes and chose
  `/tmp`. A snapshot beside the artifact would make "recoverable by hand" true past the
  session. That is a change to the builder's instruction, not to this decision, and it is
  worth making whichever way this decision goes.

## What this decision does not establish

That revert would be wrong. It establishes that nothing on file supports it and that the
mechanism cannot be checked; the regression rate that would price the trade is 0/3 and
says nothing. The disclosure in `loop.js` (`THERE IS NO RATCHET; REGRESSIONS ARE MEASURED
AND NOT REVERTED`) states the same on every run, and points here.
