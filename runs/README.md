# runs/

## Why this exists

`SKILL.md` concedes the hole this directory closes:

> Past that single case the false-negative rate is unmeasured, and every "the gates saved us"
> story is unfalsifiable — **after a NO, nothing runs.**

A refusal produces no output, so there is nothing to score, so the gates have never been
tested against anything. This ledger stops the verdict evaporating.

It adds **no step**. Gates 0, 1 and 4 are free prose the operator already runs
(`SKILL.md:35`: *"Gates 0 and 1 are free and always run, so the sequence can always refuse
without paying"*). Writing six fields down costs nothing that is not already being produced —
it only stops that output being discarded.

## The reframe that makes this cheap

Gate 0 does not make a statistical claim. It makes a **universal claim about a specific
artifact**: *a few tool calls settle it.* Universal claims die to one counterexample.

So the question is not "what is the false-negative rate of the gates" — distinguishing the
arms at the published effect size needs roughly **991 paired defects**, which is two orders of
magnitude beyond anything affordable. The question is **"does this particular refusal survive
one counterexample attempt?"** That needs n=1.

## What to write, and when

One line in `refusals.jsonl`, **before anything spawns**:

```json
{
  "date": "2026-08-23",
  "artifact": "path/or/description",
  "artifact_lines": 191,
  "gate0": "NO",
  "gate0_reason": "the sentence, verbatim, naming the files you believe settle it",
  "gate0_files": ["src/a.ts", "src/b.ts"],
  "gate1": "width-1",
  "gate1_reason": "one agent would miss X, because one agent Y — verbatim, or why you could not complete it",
  "gate4_number": 250000,
  "outcome": null
}
```

`scripts/refusal-log.mjs` writes this for you; see `--help`.

**A blank `gate4_number` is itself a finding.** It means the ceiling this whole argument is
denominated in is not actually being set. The tally reports that rate separately.

`gate0_files` exists to make the scoring rule below checkable by someone else.

## The standing rule

**A gate-0 NO triggers the width-1 lane anyway** — bar writer, one critic, verifier. Three
spawns, ~150k (`SKILL.md:37`).

Gate 0, not gate 1, for the reason `SKILL.md:97` already gives: *"Only gate 0 refuses to zero
agents."* Overriding gate 0 costs ~150k; overriding gate 1 costs the panel's ~950k margin.
Six times cheaper, and it is the gate that actually refuses to zero.

Then fill in `outcome`:

```json
"outcome": {
  "override_run": true,
  "high_grounded_findings": 1,
  "anchored_outside_gate0_files": true,
  "verdict": "FALSE_NEGATIVE"
}
```

### Scoring — all three conditions, or it does not count

A refusal is a recorded **FALSE_NEGATIVE** if and only if the width-1 lane produced a finding
that is:

1. **high severity**, and
2. **GROUNDED** by the verifier (not GROUNDED-WEAK, not NOT-GROUNDED), and
3. anchored **outside** the files named in `gate0_files`.

Condition 3 is the one that matters. Without it this measures whether a critic can find
something — which is not in dispute. With it, it measures gate 0's actual claim: that reading
*those specific files* settles the question.

Anything else is **GATE0_HELD**.

## How this ends, in three directions

- **Programme unposeable — and this is the cheapest possible outcome.** If the ledger shows
  gate 0 refuses to zero on, say, 1 run in 20, the deadlock is over a decision that fires once
  a quarter, no measurement can ever accumulate, and the right move is to stop and say so. Two
  weeks, zero tokens.
- **Gates vindicated.** Five consecutive gate-0 NOs whose overrides yield no qualifying
  finding. By the rule of three that bounds the false-negative rate at ≤60% at n=5, ≤30% at
  n=10, ≤20% at n=15. Weak, but it is arithmetic rather than a story.
- **Gates are costing real findings.** One override yields a qualifying finding. That
  falsifies *"a few tool calls settle it"* on that instance, and you have the artifact and the
  finding to point at. One instance suffices, because gate 0 makes a universal claim.

## Free riders on the override run

The override *is* a width-1 run, so these cost nothing extra:

- **Anchor audit.** It emits a full anchor set, which is the sample for the
  evidence-acquisition question.
- **Verifier canary — the highest-value 300 tokens available.** Splice one fabricated anchor
  into the pooled findings handed to the verifier: a real URL with a misquote, or a
  `file:line` off by twenty. If the verifier returns GROUNDED, **every anchor number from
  every run is void**, and you have measured that instead. This is gate 7 pointed at the
  verifier, which nothing currently checks.
- **Gate-7 1-in-3 rule.** Sample the deployed critic three times on the seeded copy and accept
  the plant only if it is missed at least once (CriticGPT's tampering protocol). Without it,
  MISS is confounded with plant difficulty at n=1.

## Reading the numbers

```
node scripts/refusal-tally.mjs
```

Reports the firing rates, the false-negative count with a Wilson interval, the rule-of-three
bound when the count is zero, and the rate at which `gate4_number` is being left blank.
