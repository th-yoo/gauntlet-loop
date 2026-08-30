# The Tetris run — the loop's first code candidate

Issue 30 says the skill's routing description claims "a program" while every recorded run
had edited Markdown. This is the first run with a code candidate and a code reference. It
was stopped before it converged; what it produced is five filed defects and answers to two
of issue 30's three questions.

**Nothing here is a win. Read it as a record of what running the instrument on code exposed.**

## Reproducing the setup

The reference is NOT vendored — it is MIT-licensed but 89KB plus 5MB of assets, and pinning
is what `commands/loop.md`'s "fetchable" test asks for.

```bash
SHA=d3319c9025f556c21ae4baa7c9e562baaad343f9
mkdir -p stage && cd stage
curl -sfL -o doc-2.html "https://raw.githubusercontent.com/MehmetMHY/tetris/$SHA/index.html"
curl -sfL -o sw.js             "https://raw.githubusercontent.com/MehmetMHY/tetris/$SHA/sw.js"
curl -sfL -o site.webmanifest  "https://raw.githubusercontent.com/MehmetMHY/tetris/$SHA/site.webmanifest"
mkdir -p assets   # fetch every file from the repo's assets/ at the same SHA
cp ../docs/runs/2026-08-29-tetris/{doc-1.html,play.mjs,GOAL.txt} .
sha256sum GOAL.txt   # must be 511357cc539479995abcdf2368cb784dbe6c08afd6e2b1bbea3267353748a3b2
```

`doc-1.html` here is the candidate as the run left it — 7,306 bytes, grown from a 3,247-byte
seed that had no wall kicks, ghost, hold or next-piece preview. It is the one artifact that
cannot be re-fetched.

`GOAL.txt` was written before any candidate existed, which is what makes
`goal_authored: 'independently'` honest; the hash is the evidence, since the loop records the
attestation as `verified: false` and can never check it itself.

## The probe

`play.mjs` has no dependencies — Node 22's built-in `fetch` and `WebSocket` drive Chrome over
CDP. Three things in it are corrections, each paid for once:

- **It serves the directory over http.** Under `file://` the browser blocks `fetch` and
  manifest loads on CORS grounds, so a page that fetches anything looks broken through no
  fault of its own, and a builder told about it would fix a defect belonging to the harness.
- **It answers `/favicon.ico` with 204.** One side shipped an icon and the other did not, so a
  404 would have been reported as a page error against whichever artifact did not think to
  include one — a difference the harness invented.
- **It runs a warm-up before the measured keys** (issue 66). Without it a start screen eats
  every movement key and the reader cannot tell "ignores movement keys" from "had not started
  yet". Measured on the reference, same keys, order only: Space last reached score **0**,
  Space first reached **34**, and with the warm-up **68**. A critic judged the reference on
  that difference and gave the piece to the candidate.

It reports what it observed rather than what it concluded: the warm-up line says it cannot
tell a dismissed start screen from keys simply playing the game, because a hard drop changes
the screen exactly as a closing menu does.

## The verdict

`verdict.json` is the run's own output, as emitted. `outcome.status` is `CANCELLED` — the
operator removed the token and the loop stopped at the round-4 boundary after 3 rounds,
which is the circuit breaker working rather than a failure. It is kept because the split
ledger's trials are derived from it and nothing else can regenerate them:

```bash
node scripts/split-ledger.mjs --ingest docs/runs/2026-08-29-tetris/verdict.json --run <any-token-string>
node scripts/split-ledger.mjs --report
```

That yields two `within-round` trials, both 1-1 splits of two critics on the same bytes.
`runs/splits.jsonl` is deliberately NOT committed while issue 71 stands: the rates it pools
depend on k, so a ledger mixing runs at different critic counts reports one number over
incomparable samples.

## What the run answered, of issue 30's three

- **The lead DOES split a code artifact — but not where issue 30 predicted.** That issue says
  "for a codebase the natural seam is module boundaries". It split on the separately-observable
  capabilities named in the GOAL: four pieces on the first run, five on the second.
- **The critic RUNS the artifact rather than reading it.** Verdicts cite 15 to 40 driver runs,
  probes it designed itself (wall-hug, rotate-heavy, timing), and in one case a script it
  injected to cycle every piece type through six rotation states and check cell-count
  integrity — then disclosed that it could only do that to the simpler artifact, whose state
  happens to be global.
- **Unanswered: what `wc -c` means as a size probe on source.**

## The first arm-confirm pair this repository has produced

Verdicts 3 and 4 of the second run: same piece, sides flipped, no build between them, the
same instrument for both — and they **disagreed**. The candidate won, then a fresh critic on
the identical bytes from the opposite position picked the reference, and the exit disarmed.

That is the paired observation `q` needs, and it is the shape issue 21 said every armed round
already produces for free. Until now nothing had ever collected one, because nothing told an
operator to ingest.

## Gaps got more specific, which is the stated test

`commands/loop.md` says the judgement to make while a run is going is whether gaps shrink and
sharpen. Across the two runs, on one piece:

1. `rotate()` has no wall-kick/offset system at all
2. the kick list exists but is undifferentiated across piece types and directions, and there
   is no lock delay
3. no DAS/ARR auto-repeat for held movement keys

## Traps, each paid for once

- **A session restart kills an in-flight run** and leaves no completion record.
- **`rm` the token is a GRACEFUL stop** — the loop halts at the next round boundary and still
  emits its verdict. A process kill does not, and the difference decides whether the run's
  trials can be ingested at all.
- **The Workflow budget is read from the message that launches the run.** A directive in an
  earlier turn does not carry, and without one the run is uncapped.
- **Do not change the probe mid-run.** The second run is instrument-split at `13:49:40Z`;
  every verdict before it used the unfixed probe, and a trajectory read across that line is
  comparing two instruments rather than two artifacts.
