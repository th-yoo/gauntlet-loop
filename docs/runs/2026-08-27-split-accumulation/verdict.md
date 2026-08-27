# Accumulating the loop's own splits, so N never needs a study

**Issue:** 21. **Date:** 2026-08-27.

## What issue 21 asked for, and what was already there

The issue proposed four things. Re-running its evidence first — the standing rule here,
which has now falsified or narrowed four issues — three of them were already shipped:

| # | requirement | state |
|---|---|---|
| 1 | `args.critics` is a run parameter, not a constant | **already done** — `loop.js:203` |
| 2 | every round records its split, plus each critic's margin | **already done** — `loop.js:1449`, `split.for_candidate` / `split.against_candidate`, `positions[].margin` |
| 3 | every round records the position breakdown | **already done** — `positions[].side` |
| 4 | accumulated across runs, those splits ARE the trials | **nothing did this** |

Without (4) the first three are a diary. `p` stays where #20 left it at 2/5, and the interval
keeps spanning **N=1** ("the tunnel buys nothing") to **N=19** ("the tunnel is unaffordable").

## What was built

`scripts/split-extract.mjs` — pure, verdict in, trials out. `scripts/split-ledger.mjs` —
ingest and report. `test/split-extract.test.mjs` — the gate, driving **real verdicts through
the stubbed harness** rather than hand-written history, because a structure I invent agrees
with a reader I write.

**The thing that makes this work at the default `k=1`, which the issue predates.** #18's
confirmation arm spawns a *second* critic against the **unchanged artifact with the sides
flipped** — the loop does not build while armed. That is two independently spawned judges on
identical bytes at opposite positions: exactly the paired observation `q` needs, produced by
every armed run at no additional cost. Issue 21 assumed the trials would only come from
`k>1`, which has never been run. They come from every armed run instead.

Two trial shapes are counted separately, because nothing shows they draw from one
distribution: `arm-confirm` (2 judges) and `within-round` (k judges, when an operator sets
`args.critics > 1`).

**N is derived, never tabulated.** `impliedN(p)` returns 1, 4 and 19 at p = 0.05, 0.40 and
0.85 — reproducing issue 21's own table from the arithmetic rather than copying it. A table
would go stale the moment `p` moved, which is the entire point of accumulating.

## What the instrument corrected about itself

Two defects, both found by **building the input that distinguishes the right rule from the
wrong one** — and neither visible in any run this repository has ever done.

**1. Pairs were built by adjacency in `history`, not by piece.** With a decomposition the
history interleaves:

    one@r1(armed)  two@r1(armed)  one@r2(confirmed)  two@r2(confirmed)

so `history[i+1]` pairs piece **two's** arm with piece **one's** confirm — two different
artifacts recorded as one paired observation of the same bytes — while piece one's real pair
is dropped, because its neighbour is piece two's arm. Every run so far has had one piece, and
with one piece "the next entry" and "the next entry for this piece" are the same entry, so no
existing run could tell the two rules apart.

**2. The unit key collided across pieces.** Both pieces arm at round 1 and confirm at round 2,
so a key of `(run, kind, rounds)` is identical for both and the ledger silently drops one of
two genuine observations. A deduplicating key that is too coarse does not inflate the
denominator — it **shrinks** it, which is the harder direction to notice.

**And one guard was removed for being unable to fail.** The extractor re-checked that no build
intervened between arm and confirm. Once the lookup became piece-scoped, that branch became
unreachable: the next entry for a piece that armed is always its confirm or its disarm. The
property it defended is asserted at its source — `test/exit-confirmation.test.mjs:86`,
*"neither the arming round nor the confirming round builds, so the artifact is unchanged
across the confirmation"* — so the duplicate was deleted rather than kept as decoration. A
second copy of a property guarded elsewhere is the duplication that has cost this repository
three defects already.

Nine mutations are caught by the gate, against a passing baseline: a lone critic counted as a
unanimous panel, pairing by adjacency, never recording a disagreement, hardcoding N, N=0 for a
never-dissenting judge, a unit key without the piece, the interval collapsed to its point, the
ledger not deduping, and an empty ledger reporting silently.

## The result today

**Zero trials.** The ledger is empty because no run has been ingested, and the report says so
rather than printing a reassuring number:

> `split-ledger: p is UNMEASURED here. Nothing has been ingested, so this says nothing about
> the critic and does not narrow #20's 2/5. An empty ledger is an empty ledger, never a low
> disagreement rate.`

That is the honest state and it is the point: this issue asked for the mechanism that makes
`p` narrow from runs that were going to happen anyway, not for a number. Verified end to end
against harness-produced verdicts — ingest, dedupe on re-ingest, `p` with a Wilson interval,
implied N at both ends, and the per-side breakdown.

## What this does NOT establish

- **`p` itself.** Nothing here measures the critic. Until runs are ingested the interval stays
  exactly as wide as #20 left it, and issue 21 stays open on its own terms — its falsifiers
  are about accumulated splits converging, which needs runs.
- **That `arm-confirm` and `within-round` trials are exchangeable.** Both are judges on the
  same bytes; nothing shows they draw from one distribution. They are counted separately for
  that reason, and pooling them would be a claim nobody has evidence for.
- **A sampling frame.** Trials come from whatever runs happen to be ingested — no frame over
  artifacts, models or goals — so any interval is about that set of runs.
- **That the loop ingests automatically.** `loop.js` writes nothing to disk (issue 41 records
  this), so ingestion is a deliberate operator step. Wiring it into the loop means introducing
  persistence to a script that has none, which is a design decision and not a patch.

## Reproducing

    node scripts/split-ledger.mjs --ingest <verdict.json> --run <token>
    node scripts/split-ledger.mjs --report
    node test/split-extract.test.mjs        # the gate; also runs inside test/run-all.mjs

`SPLIT_LEDGER` points the ledger at a scratch file, which is how the gate exercises it without
writing to the tracked one.
