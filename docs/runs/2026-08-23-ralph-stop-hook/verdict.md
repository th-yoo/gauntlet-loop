# Run record — 2026-08-23 — ralph-loop `stop-hook.sh`

First end-to-end execution of `gauntlet.js`. The artifact was chosen because four of its
defects had already been established **by executing it**, independently of any panel, so the
run has a known answer it never sees.

**14 agents · 533k tokens · 34 min · verdict COMPLETE · under the 1.2M ceiling**

## Invocation

```
scriptPath: skills/gauntlet-loop/gauntlet.js
args: {
  artifact: ".../plugins/ralph-loop/hooks/stop-hook.sh",   // 191 lines, == upstream main
  scratch:  "/tmp/gauntlet-scratch",
  need:     "A session hook that continues an agent loop until the task is genuinely
             complete, and stops when it is, without ending the loop for reasons that
             merely look like completion. An operator must be able to tell, after the
             fact, which of those two things happened.",
  calibratedLens: "parsing",
  lenses: [termination, parsing, state, docs]
}
```

Operator gates, recorded before spending. **Gate 0 — NO**: tool calls genuinely did settle
what is wrong with this file; that is exactly why it works as an oracle. **Gate 1 — does not
apply**: the required form is "one agent would miss X, because one agent Y", and it cannot be
completed honestly here, because the run measures the panel rather than reviews ralph.
**Gate 4 — 1.2M.** Not logged in `runs/refusals.jsonl`: this is a harness test, and putting a
measurement run into the firing-rate denominator would corrupt the one number that ledger
exists to produce.

## Calibration — CALIBRATED, attempt 1, 0 voids, 0 misses

The seeder mutated the `sed` at line 25 so the promise's trailing quote is retained. Since
`setup-ralph-loop.sh:135` always writes the promise quoted, the mutation leaves a trailing `"`
on every real state file, and the literal `=` test at line 137 can then never succeed. The
judge verified materiality by running both `sed` chains: original yields `All tests pass`,
mutant yields `All tests pass"`.

**The result is genuinely ambiguous and the judge said so rather than picking.** The critic
named the exact line, the exact operand and the exact mutated behavior — but in `SPILLOVER`,
classified as another lens's problem, with no consequence stated, no anchor, no falsifier, no
fix. In the judge's words: *"detection happened; triage failed."*

> If the panel's scoring counts only filed findings, this reads as a miss with a near-miss
> note; on the literal question asked ("did the critic name the planted defect"), it is a catch.

**This is a defect in gate 7, not in the critic.** `CAL_JUDGE_SCHEMA` asks for
`caught: boolean`. Reality has a third state — *named but not filed* — and a binary schema
forces the judge to round it, in whichever direction flatters. Filed as a follow-up.

## Scored against the oracle

| # | known defect | result |
|---|---|---|
| 1 | perl at `:133` discards context around the first `<promise>` tag, so a prose mention, a bare utterance, or an explicit refusal all terminate the loop | **CAUGHT** — `TEXT-1` (no-tag case) + `TEXT-2` (mention/negation case), both high, both GROUNDED, correct line |
| 2 | zero-flag form has no designed stop: `MAX_ITERATIONS=0` skips the cap via its own `-gt 0`, `COMPLETION_PROMISE="null"` skips the promise block | **MISSED** — and read in the flattering direction. Line 61 was filed as a `GETS-RIGHT`: *"a real, unconditional numeric cap on forced continuation"*. It is unconditional only when the flag is set, and the default is 0. |
| 3 | `rm "$RALPH_STATE_FILE"` at 9 of 12 exits, so the file's absence means the loop ended, not that the task finished | **CAUGHT** — `state-file-authority-2`, GROUNDED, held under cross-check. Listed 8 of the 9 sites (missed `:162`). |
| 4 | `setup-ralph-loop.sh:167` says the loop "cannot be stopped manually" while `cancel-ralph.md` ships exactly that stop | **OUT OF SCOPE** — the artifact given was `stop-hook.sh` alone. A scoping error in the run design, not a miss by the panel. |

**2 of 3 in-scope defects recovered, including the one nominated in advance as the miss test.**

## What the panel found that the oracle did not

- **`state-file-authority-1` (high, GROUNDED, HELD under cross-check).** An empty or absent
  `session_id` falls through the ownership guard, so the hook acts on *any* session's state
  file. I had read that code and noted the legacy fallthrough without recognising it as a
  defect.
- **`TEXT-3` (med, GROUNDED).** The two operands of the comparison are normalised
  asymmetrically — `PROMISE_TEXT` is whitespace-collapsed, `COMPLETION_PROMISE` is not.
- **A correction to the operator's own claim.** A critic fetched
  `https://code.claude.com/docs/en/hooks` and anchored, verbatim: *"Claude Code overrides the
  hook and ends the turn after 8 consecutive blocks."* I verified this myself against the same
  page. **This refutes my standing claim that the zero-flag form "runs forever" / is an
  "unbounded billed run".** The hook's own logic has no stop in that configuration — that part
  survives — but the harness caps forced continuation regardless. A finding produced by the
  instrument that corrects the person who built it.

## Cross-check did real work

3 HELD, **1 KNOCKED-DOWN** — the `docs` critic knocked down `ralphstop-1` (the `termination`
critic's claim that a cap-hit on the same turn as a correct promise misreports). Round 2 is not
decorative.

## Properties the README advertises, checked against the returned object

| property | held |
|---|---|
| bar text contains no substring of `args.artifact` | ✅ |
| bar written blind, 4 criteria, `form: structural-prior` | ✅ |
| verdict carries `3-of-4 lenses uncalibrated` | ✅ |
| `enforced` (9) and `not_enforced` (5) both reported | ✅ |

The bar is the strongest artifact the run produced. Written by an agent with no file tools,
from a restated need alone, it anchored on documented specification-gaming outcomes and the
Stop-hook semantics, and each of its four criteria carries a concrete passing and failing case.

## Grounding rate is suspiciously high

8 of 9 findings GROUNDED, 1 UNVERIFIED-CHEAP, **zero NOT-GROUNDED**. Either the anchor rule is
working upstream of the verifier, or the verifier is not discriminating. This run cannot tell
which, and the run that could is the verifier canary described in `runs/README.md` — splice one
fabricated anchor into the pooled set and see whether it comes back GROUNDED. ~300 tokens. It
was not done here and should be next.

## Honest limits

n=1. One artifact, one panel, one seeded defect. All critics share a model family, so the panel
carries fewer independent votes than its width suggests. The oracle was established by the same
person who designed the run, and defect 4 was excluded by that person's own scoping error.
Nothing here measures whether the *gates* are right — only whether the panel, once spawned,
recovers what is known to be there.
