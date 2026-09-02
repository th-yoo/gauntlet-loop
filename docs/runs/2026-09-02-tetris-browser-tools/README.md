# Tetris under the source's exit bar, with critics that could drive a browser

`wf_b1395dfb-e04` — 14 rounds, 75 agents, 4.63M tokens, 7h05m. Stopped by the
operator removing the run token, so the verdict was emitted rather than lost.
`exit_bar` 1 of 4 wowed, scope `whole-artifact`.

## What made this run different

**Every critic held real headless browser tools** — the first run where that was
true. `agents/gauntlet-ab-critic.md` grants nine playwright MCP tools as of plugin
0.6.0; delivery was verified before launch by making a critic CALL
`browser_navigate` and report the literal backend error.

The gaps that produced are not the kind earlier runs found. Earlier first gaps were
absences visible in a screenshot — "no next-piece preview", "no piece-queue
subsystem". These are defects that need execution and state:

- round 1: the candidate's `lockPiece()` silently discards cells above row 0
  instead of ending the game. The critic **built a reproducible** — forced an
  I-piece to lock with part of it above row 0 and called the game's own
  `lockPiece()` through `browser_evaluate`; `over` stayed false and the board lost
  a cell. It then checked the reference's single call site and found the guard.
- round 8: `fillQueue()` deals uniformly with no bag, so a type can be withheld for
  dozens of spawns.
- round 9: the reference's own score panel read 290 while its own GAME OVER modal
  read 292 **in the same rendered frame**.
- round 10: `document.querySelectorAll('audio').length === 0`.
- round 12: the reference locks pieces with empty unsupported columns beneath
  them — reproduced twice, verified by averaged pixel sampling.

One critic **overrode `Math.random`** to force deterministic O-pieces and verify a
clean double line-clear byte-exact. Two earlier rounds had reported "I could not
force a line clear" as a shortfall; a later critic simply removed the randomness.

## The exit bar changed an outcome

Round 9: the candidate WON with margin `narrow`. `wowed: false`, so it did not arm
— it built again. Under the pre-0007 bar that round would have armed the exit.

Rounds 12 and 13 then armed and confirmed on unchanged bytes with sides flipped,
and `core-mechanics-rules` won after 13 rounds. That pair is the run's paired
observation and is ingested into the split ledger.

Margins across the piece: decisive, decisive, clear x4, narrow x5, decisive, clear.
The gap closed monotonically — the field the exit now gates on behaved like a
signal here, against a prior measurement that found it unreliable.

## What this run does NOT establish

- **The verdict is at 520x760 for `play.mjs` critics and whatever the browser
  critics chose.** Three `visual-rendering-hud` critics found the candidate's
  fixed-width HUD overflowing at 360-380px, where an earlier run found the
  REFERENCE dropping HUD counters at 520px. The window decides things in both
  directions and is not recorded per verdict.
- **`inspected` is self-reported.** Every verdict here claims live execution and
  the transcripts bear that out, but nothing in the loop checks it.
- **This run predates two fixes it would have exercised.** `shortfall_path`
  (95abb80) and the deferred regression check (a7929e9) both landed after launch.
  Round 9's shortfall was an inspection limit — "I was not able to force and
  directly witness a clean line-clear event" — and it reached a builder as that
  round's work. `build_skipped` is 0 because the branch that would have caught it
  did not exist yet.
- **0 inverted verdicts.** `inconsistent_verdicts` is empty on every round. That is
  consistent with the letter/path check working, and equally consistent with no
  critic inverting this time; one run cannot separate those.
