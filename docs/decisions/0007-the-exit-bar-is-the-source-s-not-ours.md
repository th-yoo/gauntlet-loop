# 0007 — The exit bar is the source's, and ours was three deltas away from it

**Status:** decided, 2026-09-01.
**Decided by:** the operator, on a re-read of the primary source; written up by Claude.

## The question

The operator's standing objection to this repo has been one sentence, repeated across
many sessions: **"our k is too small."** Every previous session translated that into a
question about our pipeline — should `args.critics` default to 2 or 3, should the lead
fan out to more pieces, should the goal text be wider. Each of those raises a number the
primary source never mentions, and each left the source's own number at 1.

The question this record answers is: **where does the source's judgement count actually
live, and what is ours?**

## What decided it

A literal re-read of `mshumer/Claude-of-Duty/prompt.md` (941 bytes, fetched 2026-09-01;
quoted in full in `skills/gauntlet-loop/references.md`). Seven sentences. Three of them
decide this.

Sentences 3 and 4 are **item-scoped**, and we match them:

> "You should /loop on each item and have a separate sub-agent check **it** visually to
> ensure it looks triple A. That separate sub-agent should be a really harsh critic, and
> if **it** doesn't look triple A, it should keep going."

One critic, one item, no round cap. That is our per-piece loop, and it is faithful.

Sentence 5 changes scope, and this is the sentence every prior session read past:

> "Don't stop until **each sub-agent** is utterly wowed with the quality **when compared
> with the actual Call of Duty game**. It should literally compare **them** side by side
> blind and say which one looks better."

"them" is our artifact against the reference artifact — not item against item. So the
source's exit condition is: **every one of the N item sub-agents performs a whole-artifact
blind A/B, and all of them must come back wowed.** Shumer's eleven critics were an outcome
of that structure, not a setting in it.

Against that, our loop has three deltas.

### Delta A — the whole-artifact comparison is a postmortem, not a gate

`loop.js:2015` declares `WON` the moment every piece has beaten the reference in its own
scoped A/B. The run is over at that line. The single whole-artifact critic then runs
*after* the outcome exists and can only relabel it `SPLIT_UNSOUND`. Nothing goes back to a
builder. The source says the opposite in sentence 4: if it is not there yet, "it should
keep going."

### Delta B — k at the whole-artifact scope is 1, and the source's is N

We spawn exactly one whole-artifact critic, ever. The source requires one per item
sub-agent, all wowed. **This is the operator's "k is too small," stated precisely.** The
knob we kept reaching for — critics per piece per round — does not exist in the source;
the number that does exist is at a scope we run once.

Worse, our own critic prompt tells the piece critics the opposite of what the source tells
its sub-agents (`loop.js:1260`):

```
JUDGE ONLY THIS PART: ${piece.name}
Differences outside this part are not yours to weigh — another critic owns them.
```

And the comment above the whole-artifact check (`loop.js:2043`) asserts:

> "NOT SOURCE FIDELITY. Neither primary text describes a whole-artifact round; the source
> stops when every sub-agent is wowed, which is what the piece verdicts already are."

That claim is false, and this record retracts it. A piece verdict is produced under an
instruction forbidding exactly the comparison sentence 5 requires. We labelled the only
source-faithful critic in the script as an unfaithful addition, and apologised for it in
the verdict's own disclosure text (`loop.js:2451`).

### Delta C — the bar is "utterly wowed," ours is "preferred at all"

The source says "utterly perfect," "utterly wowed," "really harsh critic." Ours exits on
any preference whatever, which the pinned disclosure already admits in the words A NARROW
WIN STILL EXITS.

## The decision

**Follow the source.** All three deltas close:

- **A.** The whole-artifact comparison becomes the exit gate. Not wowed sends the run back
  to building on that critic's gap; pieces re-open. `SPLIT_UNSOUND` stops being a terminal
  label for a finished run and becomes a reason to continue.
- **B.** One whole-artifact critic **per piece**, not one per run. Every one must be wowed.
- **C.** Wowed means the candidate won *and* the margin is not narrow. An absent or
  unparseable margin is **not** wowed — the loop keeps going, which is the direction the
  source fails in.

### The evidence against C, and why it does not block

We measured the `margin` field as unreliable: 4 of 5 split spawns disagreed on it, which
is why margin currently gates nothing anywhere in the loop. Making an exit depend on an
unreliable field risks a loop that never terminates.

**The source accepts exactly that**, and `loop.js:2117` already quotes it:

> "A hard bar does not need to be realistically reachable. My game did not become better
> than Call of Duty. I stopped the run while it was still improving."

Non-termination is the source's design, not a defect in it, and the operator's off-switch
already exists here — removing the run token is a graceful stop that still writes a
verdict. So the unreliable field costs rounds, not correctness, and the run's own operator
decides when to stop paying. The measurement stays disclosed; it does not veto.

## What was weighed against it

**Declined, with reasons:**

- **Keep tuning `args.critics` / fan-out width** (every prior session's answer). Declined:
  it raises a count the source does not have while leaving the count the source *does*
  have at 1. This is the thing the operator has been objecting to, and doing it again
  would be the fourth repetition.
- **Close Delta B only — N whole-artifact critics, still as a postmortem.** Declined: N
  critics that cannot send the run back to work produce a more expensive label and no
  more artifact. Sentence 4's "keep going" is the half that does the work.
- **Close Delta A only — one gating whole-artifact critic.** Declined: this is the
  cheapest rung and it is genuinely tempting under the parent CLAUDE.md's escalation rule.
  It is refused because the operator's objection is specifically about the count, and
  because a single judge at the exit is the n=1 that decision 0003 already declined to
  trust for reverts.
- **Change nothing; record the deltas as disclosures.** Declined: we have done this. The
  hole at `loop.js:2020` was disclosed accurately every run for five runs and nothing
  filled it. The repo's own rule is that a disclosure repeated is not a fix.
- **Bundle C silently into A and B.** Declined: it reverses an evidence-based choice, so
  it is named here as its own delta with its own falsifier rather than arriving as a side
  effect of a structural change.

## What would reopen

- **A or B:** a run where the per-piece whole-artifact critics disagree with each other on
  an artifact that a later outside measure (the oracle set, a spec suite, a human read)
  finds uniformly good or uniformly bad. That would say the N judgements are noise around
  a single value and the source's N is buying variance, not coverage. Concretely: if
  across runs the N whole-artifact verdicts are unanimous in ≥90% of cases, N is paying
  for nothing and Delta B should revert to 1.
- **C:** if the margin field's unreliability turns out to be non-stationary — if a run
  shows a piece whose margin flips between narrow and clear on a byte-identical artifact
  across fresh critics, at a rate high enough that the gate is deciding on the coin rather
  than the artifact. The arm-and-confirm machinery already measures exactly this shape and
  can be pointed at it.
- **All three:** a reading of sentence 5 in which "them" means the item and the reference's
  corresponding item rather than the two whole artifacts. That is the reading our code
  currently assumes. It is declined here because sentence 6's antecedent is sentence 5's
  "the quality ... compared with the actual Call of Duty game," but it is the only
  competing reading and a better one would reopen everything above.

## What this record cannot establish

That the source's structure is *better*. It establishes only that it is the source's, and
that ours was not. The Tetris run at `docs/runs/2026-08-31-tetris-converged/` is the
standing evidence for why that matters: it exited `WON` — all three pieces beat the
reference blind — while the reference remained the better game on hold, menus, touch and
polish. No clause of our goal demanded those, no piece owned them, and under Delta A the
run had no way to notice. That is one run, and one run is not a rate.
