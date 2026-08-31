---
name: doubt-driven-development
description: Adversarial fresh-context review of every non-trivial decision in-flight - CLAIM -> EXTRACT -> DOUBT -> RECONCILE -> STOP, with optional user-authorized cross-model escalation. Use when stakes are high (production, security, irreversible), working in unfamiliar code, or a confident output is cheaper to verify now than to debug later.
---

## Overview

A single continuous train of reasoning can be confidently wrong all the way
through, because nothing inside it is positioned to doubt its own premises.
This skill inserts an adversarial pass — ideally from a context that didn't
generate the original claim — whose only job is to try to break it before
it ships.

## When to Use

- The decision touches production, security, or is otherwise expensive or
  impossible to reverse.
- Work is happening in unfamiliar code where intuition is least reliable.
- An output reads as confident and the cost of being wrong later
  outweighs the cost of doubting it now.

## Process

1. **CLAIM**: state the decision or output under review as a specific,
   falsifiable claim — not "this looks right" but "this function returns
   the cached value if and only if the key exists and is unexpired."
2. **EXTRACT**: pull out every assumption the claim depends on, including
   ones that feel too obvious to state.
3. **DOUBT**: from as fresh a context as available (a new conversation
   turn, ideally a separate reviewing pass), actively try to construct a
   case where the claim is false. Doubt each extracted assumption in turn —
   don't stop at the first one that survives.
4. **RECONCILE**: for every doubt that found a real gap, fix the claim (or
   the code) and restate it. For every doubt that didn't hold, note why it
   was ruled out, so the same doubt doesn't need re-litigating.
5. **STOP**: once doubts are exhausted and reconciled, stop — this is not
   an infinite regress. State explicitly that this pass is complete and
   what residual uncertainty, if any, remains.
6. **Escalate to a second model only with explicit user authorization.**
   Cross-model escalation is a deliberate additional check, not a default
   step, because it has a real cost and needs consent.

## Rationalizations

| Excuse | Rebuttal |
|---|---|
| "This is my own careful reasoning, it doesn't need doubting." | Careful reasoning from a single continuous context is exactly what this skill exists to catch — care doesn't substitute for an adversarial pass from outside it. |
| "Doubting everything would never finish." | The process names STOP explicitly: doubt the extracted assumptions, reconcile what breaks, and stop once they're exhausted — it is bounded by construction. |
| "The claim sounds right, that's enough signal." | Sounding right is exactly the property a confidently wrong claim also has — it's not evidence either way. |

## Red Flags

- A high-stakes decision shipped with no CLAIM ever stated explicitly.
- "Doubt" consisted of restating the original reasoning rather than trying
  to construct a counterexample.
- A found gap was noted but never reconciled into a fix.

## Verification

- The CLAIM, the extracted assumptions, and the outcome of doubting each
  one are all recorded, not just the final reconciled version.
- Any residual uncertainty is stated explicitly in the final STOP, not
  silently dropped.
