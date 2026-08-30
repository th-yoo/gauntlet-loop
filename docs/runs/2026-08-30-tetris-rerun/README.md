# Failure report — the tetris re-run, 2026-08-30

Two launches. Neither judged a single round. The candidate was then played by hand and
found to have a defect no round of any previous run had named.

**Nothing here is a result about the method's ceiling. It is a record of what stopped it
from being exercised at all, and of what one person pressing one key found in ten seconds.**

## 1. Both runs died at round 0

| run | rounds | agents | cause |
|---|---|---|---|
| `wf_048b9951-92e` | 0 | 1, errored | breaker agent type not registered |
| `wf_fbbc08f8-24f` | 0 | 1, errored | same, after copying agents into the live cache |

`.claude-plugin/plugin.json` stayed at `0.2.0` when `2548f55` replaced the entire agent
set. The cache path is version-pinned, so an installed `0.2.0` still serves the six panel
agents, and the five the loop spawns are absent — **zero overlap**. The breaker is the
first agent of every run, so nothing reaches a critic. Filed as #68 and closed at `8b05b57`
(bump to 0.3.0) and `86b6e67`, which diffs `agents/` against the commit that set the
version, so a swap without a bump fails rather than needing a hand-kept list.

The second launch established, at a cost of two seconds, what the first only suggested:
**the agent registry is fixed at session start.** Copying the agents into the live cache
mid-session registers nothing. #68's fix needs a reinstall and a restart, and neither has
happened, so the loop has still never been run against this candidate.

## 2. The verdict blamed the wrong thing, then blamed it again one field over

Run 1 said, as its `outcome.why`:

> the run token at `…/1788017311.token` was already absent before any round ran — either
> the operator cancelled immediately, or it was never created (**check the path**)

The token was on disk before the run and after it. The loop had already computed the
distinction — `breakerSilent` is set only when the breaker never answered — and `why`
branched on `history.length` instead. Filed as #69, fixed at `0663070`.

Run 2 proved the fix and the residual in the same output. `why` was correct. The
`enforced` list, in the same verdict, still said the token was absent at the first check:
`ROUND_COUNT_CLAIM`, the identical `history.length` proxy, one field over. I had written
that residual into #69 myself — *"not established whether other verdict fields branch on a
proxy for a fact they hold directly"* — and then walked past it. Fixed at `2d1cbb1`, with
the test now asserting the property over **every** field rather than over one more named
site, because naming sites is what produced it.

## 3. What the artifact actually is

Both driven by the same twelve keys. `candidate.png` and `reference.png` in this
directory.

| | candidate | reference |
|---|---|---|
| bytes | 7,306 | 89,340 |
| next-piece preview | — | yes |
| hold | — | yes |
| ghost piece | — | yes |
| score after 12 keys | **0** | **120** |

It is a real Tetris: pieces fall, move, rotate, hard-drop, lock and stack. It has SRS kick
tables indexed by piece type and rotation pair, lock delay with capped resets, and custom
DAS/ARR. Those are the *hard* parts, and the loop built them across three rounds.

## 4. The defect a person found by pressing a key

The on-screen instructions say `Z rotates CCW`. It does not, for this operator.

```
Z  (US layout)   [1,0] -> [1,3]   rotated
Z  (Korean IME)  [1,3] -> [1,3]   NO CHANGE
X  (Korean IME)  [1,3] -> [1,3]   NO CHANGE
```

Reproduce with `zprobe.mjs` in this directory. Ours matches on the **character produced**:

```js
else if (e.key === 'z' || e.key === 'Z') rotate(-1)
```

With a non-Latin input source the Z key reports `e.key === 'ㅋ'` and nothing fires. Arrows
and Space keep working, because their `e.key` is layout-independent — which is exactly the
symptom: the game plays, and only rotation-by-letter is dead.

The reference matches on `e.code === "KeyZ"`, the physical key. It is immune.

**Not one round of any run named this**, and the artifact's own on-screen text asserts the
behaviour it does not have.

## 5. Why the loop could not have closed the gap anyway

- **One gap per round is the source's, verbatim** — `references.md:71`, *"identify the
  biggest remaining gap, and send it back for another round"*. Singular. Not our throttle
  and not a defect.
- **The throughput the source intends is across pieces** — *"For each important piece, it
  should fan out a builder and a separate critic"*.
- **And the path lock serialises that away for a single-file artifact.** `loop.js:1828`
  keys the lock on `piece.candidate || CANDIDATE`; every piece of a one-HTML-file candidate
  resolves to the same key and runs one at a time. The fan-out becomes a queue, so the run
  buys one improvement per round however well the lead splits.
- **The split decides what can be seen — and here the piece existed and starved.** This is
  the one claim of mine the record overturned. `docs/runs/2026-08-29-tetris/README.md` shows
  `decomposition.pieces[3]` is `at-a-glance-hud-and-next-piece`, whose observable is the
  next-piece indicator: the lead *did* cut a piece for the clause. All three rounds went to
  `movement-and-rotation`, and the piece never got one, because both wait on the same file.
  So #67's premise — that nobody was made responsible — was wrong, and the mechanism is
  worse than the one I filed: the responsibility existed and the path lock starved it.
  `d6cb3a9` records this as `never_judged`, which is the distinction that matters.

`loop.js` also carries a comment claiming "Pieces run SEQUENTIALLY, one at a time", which
the scheduler below it contradicts: disjoint paths do run concurrently. Stale, not corrected
here.

## 6. The inversion, stated plainly

Every reproducible built in this session pointed at the **instrument**: the critic's
needle, the spawn scan, the plugin manifest, the verdict's wording. Each found something
real. None pointed at the game.

So the harness got sharper — 165 pinned properties, four issues closed — and the artifact
kept a defect that one person found by pressing one key. Rigour aimed at the measuring
device does not improve the thing being measured, and this run is what that looks like.

My own share of it: asked to check whether Z worked, I dispatched a **US-layout** key event
against a **US-layout** binding, watched it pass, and used that to tell the operator they
were probably on the wrong tab. A check whose pass condition is satisfied by the broken
thing — the defect this repository names more often than any other — used to contradict a
correct bug report.

## 7. What this does NOT establish

- **Nothing about the method's ceiling.** No round was judged. The loop has never run to
  its exit condition on any recorded run, and the stops have all been infrastructure —
  never a budget, never a round cap. No ceiling was set on either launch.
- **Not established: whether a restart fixes launch.** The 0.2.1 bump should write a fresh
  cache on reinstall. Unverified from here.
- **Not established: whether the loop would ever name the keybinding defect.** It plausibly
  would, given a piece for "controls do what the screen says" and a critic that presses the
  keys. No run has tested that.
- **One operator, one input source.** The IME finding is one person's keyboard. That it is
  a real difference from the reference is established; how often it bites is not.
- **Not established: that the probe was sound on this host at all.** `scripts/play.mjs`
  could not start on darwin (`google-chrome` is not on PATH there) and waited only ten
  seconds for a debugging port while `test/play.test.mjs` starts six Chromes at once. Both
  fixed at `4c7e4cf`. Every observation in section 3 was taken with a locally patched copy,
  and the numbers have not been re-taken with the fixed probe in the tree.

## Reproducing

    cd <stage>                       # doc-1.html, doc-2.html, play.mjs, GOAL.txt
    node play.mjs doc-1.html /tmp/one.png
    node play.mjs doc-2.html /tmp/two.png
    node zprobe.mjs doc-1.html       # needs the stage served on :8731

Staging is `docs/runs/2026-08-29-tetris/README.md`. Two probe changes were made before
launch and are portability only: the Chrome binary is resolved for darwin, and the
DevTools port wait went 10s to 60s because Chrome's first launch on this host exceeds ten
and every launch after takes two — left alone, a critic probing one artifact cold and the
other warm reads "the page never loaded" against whichever went first.
