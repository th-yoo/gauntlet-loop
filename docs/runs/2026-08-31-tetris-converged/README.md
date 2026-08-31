# 2026-08-31 — the first CONVERGED code run: WON at round 19

The run this repository had never had. Both prior Tetris runs (2026-08-29, 2026-08-30)
died on a session restart or were stopped; this one ran to its own exit: **every one of
the 3 pieces beat the reference in a blind A/B**, arm + confirm, sides flipped, bytes
unchanged across each confirmation.

## Setup

- Goal: verbatim `docs/runs/2026-08-29-tetris/GOAL.txt` (sha `511357cc…`), attested
  `goal_authored: independently` — an attestation, not a proof, and the verdict says so.
- Candidate: the committed evolved seed `docs/runs/2026-08-29-tetris/doc-1.html`
  (8,033 B, rotation fix 4243791), staged as `doc-1.html`.
- Reference: `MehmetMHY/tetris` `index.html` @ `d3319c9` (89,340 B) + full `assets/`,
  `sw.js`, `site.webmanifest`, staged as `doc-2.html`. Sizes verified against the pin's
  git tree at fetch time.
- `critics: 1` floor; the lead raised **at-a-glance-clarity to 3** ("perceptual/design
  judgment… different reviewers read differently from a single screenshot") — issue 63's
  mechanism doing its job unprompted.
- Workflow `wf_b260d9ac-c65`, 92 agents, 2,652,712 subagent tokens, 1,209 tool uses,
  ~3h53m wall clock. Token `/tmp/gauntlet-loop/1788173958.token`, held for the whole run.

## The trail: 19 rounds, 10 builds, 8,033 → 15,104 B

Every gap different, code-level, and fixed once (`gaps_in_order` in `verdict.json` has
them verbatim): canvas-only Game Over → no restart path → no drop scoring → naive RNG →
7-bag → difficulty ramp unreachable → speed gated on lines only → no NEXT preview → no
board grid → no visual hierarchy → no unified HUD → mobile-breakpoint HUD compression.
The regression check preferred the new version in **10/10** checked rounds — the
size_note reads the growth as additions a critic accepted, where bytes alone would have
called it bloat. `regressed: []` — decision 0003's reopen trigger did not fire.
`snapshot_durable: true` on every build (the durable-snapshot follow-up, validated live);
the snapshot chain is archived in `snapshots/`.

Exits armed and DISARMED three times before the three that held — core round 1→2
(critic 1: reference's own game-over is not latched, any key restarts it; critic 2:
candidate has no restart at all), core 3→4, clarity 6→7. Each disarm is a discordant
pair of fresh judges on identical bytes, which is the measurement (below).

## What it fed the split ledger

`node scripts/split-ledger.mjs --ingest verdict.json` → **10 new trials** (6
within-round from clarity's 3-critic line, 4 arm-confirm). Ledger after (12 panels,
28 judges): d = 47% [23%, 72%], **by k: k=2 d=63% over 8, k=3 d=17% over 4** — the
first second-k stratum the ledger has ever held; the by-k independence diagnostic is
runnable for the first time. The apparent drift with k is 8-vs-4 panels of noise until
panels accumulate — the report's own words. q = 38% [13%, 50%] under the
judge-beats-a-coin assumption; critics for ≤5% false exit: 2 / 4 / 5 (low / point /
high). Interval still spans 2–5: undecided, but now from 12 panels, not 2.

## Residuals, from the verdict's own `not_enforced` (26 entries; the load-bearing ones)

- **NOT blind on content**: the staged candidate was byte-identical (sha `f74793e0…`)
  to the committed copy in this repo — the probe caught it before round 1 and the run
  withheld its blindness claim. Cost of staging the committed file verbatim; a future
  run should stage a mutated copy or accept the disclosure.
- Goal clause 1 ("a person can actually sit down and play") **cited by no piece** —
  covered by nobody, and only the goal_coverage field says so.
- All critics share one model family; k copies resample one model's habits.
- A narrow win still exits; margin gates nothing (on evidence: 4/5 spawns on one
  unchanged pair split).
- No outside oracle exists for Tetris: this is our instrument grading our own method.

## Files

- `verdict.json` — full 19-round history, splits, disclosures (217 KB)
- `doc-1-final.html` — the winning candidate, 15,104 B, self-contained
- `snapshots/` — per-build durable snapshots + critic screenshots (248 KB)
