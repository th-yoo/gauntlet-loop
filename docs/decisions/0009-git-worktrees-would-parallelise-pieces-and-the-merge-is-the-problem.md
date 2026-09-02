# 0009 — Git worktrees would parallelise pieces on a single-file artifact, and the merge is what decides it

**Status:** decided, 2026-09-02.
**Decided by:** the operator asked for it; written up by Claude with the constraint that blocks the obvious implementation.

## The question

The 2026-09-02 wide-goal run decomposed into four pieces and ran them **strictly one at a
time**. Measured from the transcripts: after the lead, maximum simultaneous agents was 1,
for the whole run.

That is not a cap. Nothing in the loop limits concurrency. It is `pathLock` — pieces are
chained per candidate path — and all four pieces inherited `args.candidate`, because the
artifact is one HTML file.

The loop already parallelises pieces that own different files. Measured, same harness, same
lead shape, only the paths differing:

    SAME path  : one-r1  one-r2  two-r1  two-r2  three-r1  three-r2   (serial)
    DIFF paths : one-r1  two-r1  three-r1  one-r2  two-r2  three-r2   (parallel)

So the capability works and was simply unreachable. **Can git worktrees make it reachable
for an artifact that is genuinely one file** — each piece building in its own checkout, in
parallel, the results merged afterwards?

## What decided it

Two facts, one enabling and one blocking.

**The loop cannot do it itself.** `skills/gauntlet-loop/loop.js` is a Workflow script with
no filesystem, no `import`/`require`, and no `child_process`; drift-guard enforces all
three. It cannot create a worktree, copy a file, or run `git` under any circumstances. Only
agents — which hold Bash — can. So any worktree scheme is agents doing filesystem work
between the loop's spawns, not the loop managing checkouts.

**The ordering does not admit the obvious version.** A piece's FIRST round spawns a critic,
not a builder, and that critic must open the piece's candidate path. So the worktrees have
to exist before any piece runs. But the piece set is decided by the lead, which runs after
staging. The operator cannot stage N worktrees for a decomposition that does not exist yet,
and the builder cannot create its own worktree because the critic reads the path first.

That leaves one shape that actually works:

> **A setup agent between the lead and the pieces.** After decomposition, spawn one agent
> with Bash that creates a worktree per piece and copies the candidate into each; the loop
> rewrites each piece's `candidate` to its worktree path; the pieces then run in parallel
> exactly as they already do for multi-file artifacts. At the end, a merge agent combines
> the worktrees and the existing whole-artifact check judges the merged result.

It is implementable. Every part exists: the loop spawns agents, pieces already accept their
own paths, and the whole-artifact check already runs after every piece wins.

## The decision

**Not built. The blocker is the merge, and worktrees do not address it.**

A worktree gives isolation. It does not give a merge. Four agents independently rewriting
the same 8 KB HTML file — one adding a piece queue, one restyling the board, one adding a
pause overlay, one adding a game-over screen — produce four divergent versions of the same
region, and `git merge` on that yields conflicts in the general case rather than as an edge
case. Something must resolve them, and whatever resolves them produces an artifact **that
no critic ever judged**.

That is the specific failure this loop is built to prevent. Every verdict in the run would
attach to a version that no longer exists, and the whole-artifact check at the end would be
judging the merge tool's output. A conflict resolved by an agent is worse still: an
unjudged builder edit, made under a different prompt, on the artifact the run reports on.

The serialisation is therefore buying correctness rather than caution. On a shared file it
is not a limitation to route around — it is the property that keeps a verdict attached to
the bytes it was made about.

**What was done instead**, and it is small: the lead prompt now says that pieces naming
different candidate paths run concurrently and pieces sharing one run serially, with the
measured evidence. The fields existed in `PIECE_SCHEMA` and the lead was never told they
existed or what they bought — it had been choosing `focus` by default. That makes the
existing parallelism reachable on every multi-file artifact, which is most of them, and
changes nothing about single-file ones.

## What was weighed against

**Declined, with reasons:**

- **Worktree-per-piece with an automatic merge.** Declined above: the merged artifact is
  unjudged, and the run's verdicts describe versions that no longer exist.
- **Worktree-per-piece with a merge-resolver agent.** Worse, not better. It puts an
  unreviewed builder edit into the artifact after every critic has finished.
- **Parallel critics on a shared file, serial builders.** Tempting, and it is the narrow
  version of the operator's point: reads do not race. Declined because they are not
  concurrent-safe here either — piece 1's builder rewrites the file while piece 2's critic
  is reading it, so piece 2 returns a verdict about bytes that no longer exist and names a
  gap nobody can reproduce. Not a data race; an unreproducible verdict, which is worse.
- **Freeze-then-judge: all pieces' critics judge one pinned snapshot in parallel, builders
  then apply serially.** This is the only declined option that would genuinely work, and it
  is declined for now rather than refused. It breaks the standing rule that a critic
  inspects the real artifact rather than a copy, and it changes what a round means — every
  piece would judge the same frozen version, so a later piece never sees an earlier piece's
  improvement within the same pass. That is a different loop, and it needs its own record
  and its own measurement rather than being smuggled in as a concurrency fix.
- **Splitting the Tetris artifact into several files to make the pieces real.** Not
  declined on merit — it is the source's own model, "six agents each owning one directory"
  — but it changes the artifact under test, so a run using it is not comparable with the
  eight runs already on record. Worth doing as a NEW pairing, not as a change to this one.

## What would reopen

- **A merge that is judged.** If the whole-artifact check ran on the merged result AND a
  loss sent the merge back for another round — rather than merely relabelling the run
  `SPLIT_UNSOUND` — then an unjudged merge would no longer be unjudged, and the blocking
  argument above weakens considerably. That is a real design and it is worth building if
  parallel pieces on a shared file ever become the bottleneck that matters.
- **An artifact whose pieces genuinely do not overlap in the file.** If a run shows four
  pieces touching four disjoint regions, `git merge` succeeds without conflict, and the
  merged artifact is byte-identical to applying them in any order, then the merge risk is
  measured rather than assumed and this record is too conservative. The measurement is
  cheap: run the four builders on four copies and try the merge.
- **Wall-clock becoming the binding constraint.** This run cost 98 minutes for 5 rounds of
  ONE piece, with three pieces never started. If a run has to finish inside a window and
  serialisation is what prevents it, that is a cost argument this record does not weigh —
  it weighs only correctness.

## What this record cannot establish

That the merge would in fact conflict. No merge was attempted; the argument is from the
shape of the edits — four builders adding features to one 8 KB file, each instructed to
modify it in place — and from the fact that the loop's own snapshot machinery exists
because builders rewrite rather than append. A cheap experiment could settle it, and the
reopen section names it.
