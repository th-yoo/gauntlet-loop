# Tetris under the source's exit bar — run record

**Status: IN PROGRESS at the time this file was written.** Everything below the setup was
recorded at round 10, before the run produced a verdict. That is deliberate: a caveat
written after the outcome is known cannot be told apart from an excuse for it.

- Run: `wf_45e39bc2-96e`, launched 2026-09-01 13:38 local, uncapped and attended.
- Token: `/tmp/gauntlet-loop/1788237516.token`
- Stage: `/tmp/gauntlet-tetris-1788237133`
- Candidate: `doc-1.html`, the 2026-08-29 seed (8,033 B) with a silent byte-level mutation
  so it is not identical to the committed copy — sha `f74793e0…` → `f6d65b69…`.
- Reference: `doc-2.html` = `MehmetMHY/tetris` at `d3319c9025f556c21ae4baa7c9e562baaad343f9`,
  89,340 B, plus `assets/`, `sw.js`, `site.webmanifest` so the bar runs at full strength.
- Goal: unchanged from the earlier Tetris runs, sha `511357cc…`, `goal_authored: independently`.
- `critics: 1` — the same line the converged 2026-08-31 run used, so any change in
  trajectory is attributable to the exit bar rather than to k.
- First code run under decision 0007: whole-artifact per-piece judging, the "utterly
  wowed" bar, and the new `shortfall` field.

## THE VIEWPORT CAVEAT — the verdict is at 520×760, not "in general"

**Every critic in this run inspects through `scripts/play.mjs`, which starts Chrome with
a hard-coded `--window-size=520,760`** (`scripts/play.mjs:134`; no environment override
exists). Nothing in the loop tells a critic that number, and nothing in the verdict
records it.

That window is narrow enough to change what one of the two artifacts shows.

**The reference is responsive and sheds information at this width.** Its CSS collapses to
a mobile grid and drops the Level and Lines counters from the HUD. At 520px its on-screen
text reads `HOLD SCORE 38 NEXT MENU` — no Level, no Lines. The desktop layout that shows
them is unreachable under these conditions.

**The candidate is fixed-width and loses nothing.** At the same 520px it reads
`Score 32 Level 1 Best 32 Restart Pause HOLD NEXT` plus a control legend.

So at the viewport the run actually judges in, the candidate displays *more* HUD than the
reference — not because it does more, but because the reference's own responsiveness hides
part of itself and the candidate has no responsive behaviour to hide anything.

### How this was found, and by whom

Independently, twice, which is why it is recorded rather than argued:

1. **A round-6 critic found it unprompted**, as its `shortfall` on the round it gave to the
   reference: *"At the 520px-wide viewport this harness actually renders in, doc-2's
   responsive CSS collapses to its mobile grid and silently drops the Level and Lines
   counters from the HUD (confirmed: on-screen text at that width reads only 'HOLD SCORE …
   NEXT MENU') — the desktop layout that shows them is dead code under these conditions."*
2. **Confirmed afterwards from outside the loop** by driving both artifacts through the
   same probe and reading the rendered pixels — `evidence/candidate-520px.png` and
   `evidence/reference-520px.png`. `evidence/candidate-1000px.png` is the candidate at a
   desktop viewport for contrast: it leaves most of the width empty, which is the other
   half of the same fact.

### What it does and does not invalidate

**It does not make the A/B unfair.** Both sides are inspected through the identical probe
at the identical size, so no side is being handled differently, and that symmetry is what
the blind comparison rests on.

**It does mean the verdict is conditional on the viewport.** "The candidate beat the
reference" in this run means "at 520×760". A reader who takes it as a general statement
about the two artifacts is reading more than the run measured — particularly on the
clauses of the goal about what is *visible at a glance*, which is exactly the dimension the
window size moves.

**It is a fact about our harness, not about either artifact.** A game that adapts to the
window is being judged in the window where it adapts most, against one that cannot adapt
at all. Neither behaviour is a defect; the measurement simply does not separate them.

### What would settle it

Run the same pairing at a desktop viewport and compare the verdicts. If the sides swap, the
window is doing the deciding and `play.mjs`'s size belongs in the verdict as a recorded
parameter — arguably as a swept one. If they agree, the caveat costs nothing and this note
is the record of having checked. **Not done here**, and not counted as evidence either way:
one run at one size cannot distinguish those outcomes, and saying so is the point of
writing this before the verdict exists.

## Rounds so far (A/B against the reference only)

The regression check spawns the *same agent type* as the A/B critic and compares a build
against its own previous snapshot. Reading the two as one series is wrong, and was done
wrongly in this session's live commentary before being corrected: rounds below are only
those whose two artifacts are the candidate and the reference.

| round | outcome | margin |
|---|---|---|
| 1–3 | reference won | clear |
| 4 | reference won | narrow |
| 5–9 | reference won | clear |
| 10 | **candidate won** | clear → wowed, arms the exit |

Ten rounds, ten distinct gaps, no gap restated. Separately, 8/8 regression checks preferred
the new build over its predecessor, so decision 0003's reopen trigger has not fired.

The candidate grew 8,033 → 22,088 B and now carries: next-piece preview, hold, ghost piece,
restart, pause, level display, persisted best score, and a 7-bag randomiser — one per gap.
