# References — the source this instrument implements

Two artifacts are the source. Both are quoted in full below, because the point of
a citation is that the reader does not have to trust the summary. Until this file
existed, every claim this repo made about Shumer's method was a paraphrase with no
sentence behind it.

**Transcribed 2026-08-24.** Published prompts get edited; verify against the live
source before relying on exact wording.

---

## Source 1 — the seed prompt

`https://github.com/mshumer/Claude-of-Duty/blob/main/prompt.md`
Page states: *"This is the entire prompt that produced this repository."*

```
I want you to build a first-person shooter at the level of the most recent Call
of Duty games. It should be utterly perfect, visually beautiful, with every single
thing done at AAA quality—from textures to physics to anything you could think of.

Fan out sub-agents and have sub-agents tackle each one individually so that the
game is utterly perfect. You should /loop on each item and have a separate
sub-agent check it visually to ensure it looks triple A. That separate sub-agent
should be a really harsh critic, and if it doesn't look triple A, it should keep
going.

Don't stop until each sub-agent is utterly wowed with the quality when compared
with the actual Call of Duty game. It should literally compare them side by side
blind and say which one looks better. Do this in ThreeJS. /loop until it's utterly
perfect. Fan out sub-agents and ultracode.
```

Note what is absent: no roster, no gate sequence, no anchor rule, no output
contract, no round cap, no calibration of the critic. The method is five
sentences and a reference exemplar.

---

## Source 2 — the meta-prompt

`https://somethingbig.ai/gauntlet-loop` — Matt Shumer, "How to Run a Gauntlet
Loop", 2026-07-27.

```
I want to run a Gauntlet Loop for this goal:

[GOAL]

Possible references or quality bars:

[OPTIONAL REFERENCES]

Choose the strongest concrete bar that an agent can actually inspect and compare
its work against. If I have not supplied one, propose a useful comp or measurement
that plays the same role for this task that real Call of Duty screenshots played
for Matt Shumer's Claude of Duty game (read the prompt:
https://github.com/mshumer/Claude-of-Duty/blob/main/prompt.md). Explain the bar in
one sentence.

Then write a short prompt for Claude Code or Codex in the style of Matt's prompt
(minimal is better here, we want the agent to decide the specifics!).

Give the lead agent the goal and the bar, but let it choose the approach. Tell it
to divide the goal into the smallest pieces that can be improved and judged
independently. For each important piece, it should fan out a builder and a
separate critic with fresh context.

Each critic must inspect the real output, compare it directly with the bar—using a
blind A/B comparison when possible—identify the biggest remaining gap, and send it
back for another round. Keep looping until our output wins or I stop the run.

Have the lead agent maintain a simple live progress page that shows the work
evolving over time.

Have it use subagents and ultracode. Do not prescribe the architecture, exact
decomposition, or a fixed number of rounds. Keep the final prompt short, just like
Matt's.
```

---

## The sentences the provenance claims rest on

All from Source 2 unless noted.

| claim made here | the sentence |
|---|---|
| builder + critic per piece | "Each piece gets its own builder and a separate critic with fresh context." |
| critic is blind to the builder | "Spawn a fresh critic and give it the goal, the bar, the relevant rules, and the actual artifact. Do not give it the builder's history or explanation." |
| blind A/B against a reference exemplar | "It looks at our output and the reference, without being told which is which. It chooses the better one." |
| critic inspects the real output | "The critic should inspect the actual thing: the real pixels, running product, rendered page, test results, or finished writing. It should never grade a summary written by the builder." |
| a fixed round count is a failure mode | "Do not tell it to do three rounds and stop… there should be no arbitrary final round." |
| the bar need not be reachable | "A hard bar does not need to be realistically reachable. My game did not become better than Call of Duty. I stopped the run while it was still improving." |
| no gate sequence | Neither source contains one. The method never asks whether the loop should run. |
| the smoothing pass is optional, not core | "This is useful, but it is not the core of the Gauntlet Loop. The core is still: split, build, judge, repeat." |

## Recorded outcomes — gate 3 form (a) material

From the Claude of Duty repository README, `https://github.com/mshumer/Claude-of-Duty`:

> "Eleven independent adversarial critics scored the frames against that bar.
> Scores went 3.59 → 4.14 → 4.05 → **5.05** out of 10. Two shots reached 'CLOSE';
> the rest remain 'AMATEUR'. In a blind A/B, **every critic in every round picked
> the real Call of Duty frame.**"

Two facts worth carrying, because both bear on decisions made here:

- **Round 3 regressed** (4.14 → 4.05). An uncapped loop absorbs a bad round; a
  capped one can terminate on it. The source method's answer is the ratchet —
  keep the best candidate so far, replace it only on a head-to-head win.
  `loop.js` has none, and that is a DECISION taken 2026-08-24 under issue #18
  rather than an omission: a Workflow script
  has no filesystem, so both the snapshot and the revert would be spawned-agent
  actions the script cannot observe, and a snapshotter that silently no-ops
  leaves the run reporting a preserved best version that does not exist. A
  two-party hash probe can falsify the copy; nothing available falsifies the
  revert, which is the half a ratchet exists for. `loop.js` has had no round cap
  since `1978f66`.
- **The build lane never won.** Every critic, every round, picked the reference.
  Its record is measured improvement under a bar it never cleared — not a record
  of passing.

Also from the repo README, on a round that made things worse:

> "Prior rounds had been crushing albedos to fight bright-part complaints, which
> killed diffuse and made it worse. The fix was the opposite of what was asked for."

## The failure mode gate 3 exists for

Independent write-ups converge on one weak point in the source method: the critic
needs something concrete to measure against, or it invents a standard and the loop
burns tokens on a bar nobody set. That is the case gate 3's form (b) — a
structural prior — is written for, and it is the strongest argument for a judge
lane existing at all: the build lane requires a reference exemplar, and most
specs, plans and designs do not have one.

## Name collision

`gauntlet-loop` is shipped by other public repositories as Shumer's *build* loop,
including `duolahypercho/gauntlet-loop` and `robonuggets/gauntlet-loop`. This
repository uses the name for a different instrument and inherits none of that
method's evidence.
