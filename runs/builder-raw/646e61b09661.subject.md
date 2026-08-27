# Pairing-verdict stability — pre-registration

**Written and committed BEFORE the draws.** Everything below is a commitment about how the
result will be read, made while the result is unknown. A decision rule written afterwards
is not a decision rule.

## The question, and why it is worth agents

`checkComparability` in `skills/gauntlet-loop/loop.js` is the only component in this plugin
that can **stop a run**. It refuses at `:795`, and `:1150` / `:1159` turn that refusal into
a terminated run before the lead spawns. Issue 28 says the mismatch between that authority
and its evidence is the largest in the plugin.

Since #28 was filed, the per-side classifier acquired real stability evidence — the live
instrument reports `0/7 redrawn rows flipped` on does-the-work, `0/4` on
produces-an-instruction. **The pairing verdict did not.** Every one of the 8 declared
pairings has exactly one draw, so the composed verdict — the one that refuses — has never
been drawn twice, anywhere. The measured false-refusal rate `0/6, 95% CI [0%, 39%]` rests
entirely on single draws.

## What will be run

```
node scripts/oracle-draw.mjs --all-pairings --draws 2
```

8 pairings x 2 draws x 2 sides = 32 live spawns, under the ceiling of 40. Added to the
existing draw, that is 3 draws per pairing — the number #28 asked for.

## The decision rule, fixed now

A **flip** is any pairing whose composed verdict is not identical across all of its draws
(`comparable` / `generator` / `unreadable`).

- **Any flip in the false-refusal cell** (the 6 pairings whose true verdict is `comparable`:
  inventory, counter, release, subscribers, slug, writers) — the automatic refusal is noise
  carrying authority. It must be **downgraded from a refusal to a warning** until stability
  is established, and #28 stays open with that as its exit test.
- **Any flip in the refusal-fires cell** (`landing-pair`, `inventory-absent-pair`) — the
  refusal is unreliable in the other direction too. Same downgrade, and the report must say
  the fired-correctly count no longer means what it says.
- **Zero flips across all 8** — one failure mode is ruled out. The refusal keeps its
  authority, on stated grounds, and the bound goes in the report as what it is: 0 flips over
  16 redraws bounds instability loosely and says nothing about correctness.
- **A draw that errors, times out, or cannot be parsed** counts as neither a flip nor a
  hold. It is reported as excluded, with its count, on whichever branch the verdict takes.
  A stability figure that quietly drops its failures is measuring the draws that worked.

## The prediction, recorded so it can come back against me

**I expect zero flips.** The per-side arms have not flipped in 12 redraws between them, and
a composed verdict of two stable sides should be stable. If that is right this run buys a
bound and no news; the run is worth making because the alternative outcome changes what the
instrument is allowed to do, and nothing else in the corpus can produce it.

## What this cannot establish, whatever it returns

- **A redraw is the same model asked again**, not an independent draw. The report already
  says this about the per-side arms and it is equally true here.
- **Stability is necessary, not sufficient.** A consistently wrong probe passes this test
  perfectly. Correctness needs ground truth nobody here authored — that is #33.
- **Selection bias is untouched** (#38). These are the pairings their author chose to
  declare.
- **It does not test the composition.** Both sides of a pairing are drawn in one invocation
  by the same process; nothing here establishes they are independent draws, which is the
  same residual the report already carries about the derived `2q(1-q)` figure.

---

# The result

**32 spawns, 32 recorded, 0 excluded.** No draw errored, timed out, or failed to parse, so
the exclusion branch of the rule above is empty — stated here because a stability figure
that silently drops its failures is measuring the draws that worked.

**Zero flips, across all 8 pairings at 3 draws each.** Every pairing's composed verdict is
identical in every draw:

```
inventory-pair         comparable  x3        landing-pair            generator   x3
counter-pair           comparable  x3        inventory-absent-pair   unreadable  x3
release-pair           comparable  x3        writers-pair            comparable  x3
subscribers-pair       comparable  x3
slug-pair              comparable  x3
```

By the rule fixed before drawing: **the automatic refusal keeps its authority.** One failure
mode — a verdict that does not reproduce — is ruled out to the extent 16 redraws can rule
anything out. The prediction recorded above held, which is worth exactly what a held
prediction is worth: it did not come back against its author, and it could have.

**This does not close #28.** That issue names three gaps, and this run closes one:

| #28's gap | after this run |
|---|---|
| n=1 per pairing — nothing shows a verdict reproduces | **closed** — 3 draws per pairing, 0 flips |
| the answer key is the probe author's | open — #33 |
| no blindness: the probe reads both artifacts and has shown it can identify a side | open |

## What the run exposed, which was not what it was looking for

`oracle-report` narrowed the false-refusal interval from `0/6, 95% CI [0%, 39%]` to
`0/18, 95% CI [0%, 18%]` — **on redraws of the same six pairings.** No pairing was added.
Nothing new was tested. The interval halved because the same six questions were asked three
times each.

The report already knows this is wrong, in its own words, at `scripts/oracle-report.mjs:342`:

> `distinct artifacts ${distinct}   <- the number that bears on any statistical claim`

and in the comment directly above it:

> *repeat executions of ONE artifact are not independent evidence, and a rate computed over
> observations would let one artifact measured twice masquerade as two*

Then `:336` computes `wilson(wrong.length, n)` over observations, and `:541` computes
`wilson(refused.length, cell.length)` over draws. **The report prints the correct principle
beside a number that violates it**, on both arms.

A redraw does buy something — it is exactly what bounds instability, which is why this run
was worth making. What it does not buy is a narrower interval on the rate, because the
population that rate is about is pairings someone might run, not draws someone chose to
repeat. Filed separately; the honest reading of this run is `0 falsely refused over 6
distinct pairings`, whose interval is the one that was there before: `[0%, 39%]`.
