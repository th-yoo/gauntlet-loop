---
name: idea-refine
description: Structured divergent/convergent thinking to turn a vague idea into a concrete proposal. Use when there is a rough concept that needs exploration before it's specific enough to spec.
---

## Overview

A vague idea handed straight to `spec-driven-development` produces a spec
that's precise about the wrong thing, because the divergence step got
skipped. This skill forces an explicit widen-then-narrow pass: generate real
alternatives before committing to one, so the eventual spec is precise about
a choice that was actually made rather than the first shape that came to
mind.

## When to Use

- A request states a goal ("make onboarding better") with no shape yet.
- Multiple plausible approaches exist and none has been named or compared.
- An idea is being spec'd on the first framing it arrived in.

## Process

1. **Diverge: generate at least three distinct approaches**, not three
   variations of the same one. Each should differ in a load-bearing way —
   different mechanism, different scope, different tradeoff — not just
   different wording.
2. **Name the tradeoff each approach makes explicit.** For every approach,
   state what it optimizes for and what it costs. An approach with no
   stated cost hasn't been thought through yet.
3. **Converge against the actual constraints**, not against which idea is
   most interesting. Cross each approach against what's already known about
   scope, timeline, and existing system boundaries.
4. **Write the chosen approach as a one-paragraph proposal**: what it is,
   why it beat the alternatives, and what it explicitly does not attempt.
5. **Hand off to `spec-driven-development`** with the proposal as input, not
   as a fait accompli — the spec step can still surface that the proposal is
   underspecified.

## Rationalizations

| Excuse | Rebuttal |
|---|---|
| "The first idea is obviously the right one, skip straight to it." | If it's obviously right it will still look right after two alternatives are named; if it doesn't, that's the divergence step doing its job. |
| "Generating alternatives just for the sake of it wastes time." | An alternative that costs one paragraph to write and rule out is cheaper than a spec built on the wrong shape. |
| "We can pivot later if this approach is wrong." | Pivoting after code exists costs a rewrite; pivoting during divergence costs a sentence. |

## Red Flags

- Only one approach was ever written down.
- The "tradeoff" listed for an approach is generic ("more flexible") rather
  than a specific cost.
- The chosen approach was picked before the constraints it needs to satisfy
  were named.

## Verification

- At least three genuinely distinct approaches are recorded, each with a
  named cost.
- The chosen proposal states explicitly what it does not attempt, not just
  what it does.
