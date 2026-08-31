---
name: documentation-and-adrs
description: Architecture Decision Records, API docs, inline documentation standards - document the why. Use when making architectural decisions, changing APIs, or shipping features.
---

## Overview

Code shows what was built; it rarely shows what else was considered and
rejected, or why. That missing "why" is exactly what a future change needs
before it can safely revisit the decision — without it, every reconsideration
starts from scratch, including possibly repeating a rejected approach.

## When to Use

- An architectural decision is being made (a technology choice, a
  structural pattern, a tradeoff between approaches).
- A public API is being introduced or changed.
- A feature is shipping and its behavior needs to be discoverable by future
  readers, not just the person who built it.

## Process

1. **Write an ADR for any decision that would be expensive to
   re-litigate from scratch**: the decision, the alternatives considered,
   the tradeoff that decided it, and the date. An ADR is a record of a
   choice made at a point in time, not a living document that gets rewritten
   when the decision is later revisited — a new decision gets a new ADR that
   references the old one.
2. **Document API docs at the contract level** (see
   `api-and-interface-design`): what a caller needs to use the interface
   correctly, kept next to the interface so it doesn't drift independently
   of it.
3. **Write inline documentation for why, not what.** A comment restating
   what the next line of code does adds a second thing to keep in sync for
   no benefit; a comment explaining why the obvious-looking alternative was
   rejected is the one that survives being useful after the author is gone.
4. **Update documentation as part of the same change** that makes it
   stale, not as a follow-up task that may or may not happen — treat a
   change that alters documented behavior without updating the doc as
   incomplete.

## Rationalizations

| Excuse | Rebuttal |
|---|---|
| "The code is self-explanatory, an ADR is unnecessary ceremony." | Code shows what was built, not what was rejected and why — that's exactly the information the next person revisiting this decision needs and can't get from the diff. |
| "I'll update the docs in a follow-up PR." | A follow-up that may or may not happen is how docs drift from behavior; if the change is worth making, the doc update is part of it, not after it. |
| "This comment restating the code is harmless, it doesn't hurt to have it." | It's a second thing to keep in sync that adds no information — the harm is the false confidence that the comment is meaningful documentation. |

## Red Flags

- A significant architectural decision exists only as a Slack message or a
  memory, with no ADR.
- Documentation and the code it describes disagree.
- Comments describe what the code does line by line with no comment
  anywhere explaining why a non-obvious choice was made.

## Verification

- Every architectural decision with real alternatives has a corresponding
  ADR stating what was rejected and why.
- A change that alters documented behavior includes the documentation
  update in the same change, not a separate one.
