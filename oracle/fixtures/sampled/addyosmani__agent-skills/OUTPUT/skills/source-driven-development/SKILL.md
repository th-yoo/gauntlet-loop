---
name: source-driven-development
description: Ground every framework decision in official documentation - verify, cite sources, flag what's unverified. Use when you want authoritative, source-cited code for any framework or library.
---

## Overview

An agent's training data can be stale, mixed across incompatible versions,
or simply wrong about a specific API's current shape. This skill requires
checking a claim about a framework or library against its current
authoritative documentation before writing code that depends on it, and
saying explicitly when that check couldn't be done.

## When to Use

- Writing code against a framework or library API whose exact current
  behavior matters (signature, defaults, deprecations).
- A decision is being justified by "I recall that this framework does X."
- Two plausible APIs conflict and the choice matters for correctness.

## Process

1. **Identify every framework-specific claim the code depends on** — a
   function's signature, a config default, whether a feature is
   deprecated.
2. **Verify each claim against the current authoritative documentation**
   for the version actually in use, not against general recollection of
   the framework.
3. **Cite the source next to the decision** (a doc section or changelog
   entry), so a reviewer can re-check it without redoing the search.
4. **Flag explicitly what could not be verified.** "Unverified: could not
   confirm this default in the docs for this version" is a valid and
   required outcome when verification isn't possible — silence is not.
5. **Prefer the documented behavior over the remembered one** whenever they
   conflict, and note that the conflict was found and resolved this way.

## Rationalizations

| Excuse | Rebuttal |
|---|---|
| "I'm confident about this API, no need to check." | Confidence isn't evidence of currency — a remembered signature from an older major version reads exactly as confidently as a current one. |
| "Checking every claim is too slow." | Only claims the code actually depends on need checking — that's a short, bounded list, not the whole framework. |
| "I couldn't verify this, but it's probably fine." | "Probably fine" and "flagged as unverified" cost the same amount of honesty to write down; only one lets a reviewer catch it if it isn't. |

## Red Flags

- Code depends on a specific default or signature with no citation and no
  flag that it's unverified.
- A documentation citation points at a different major version than the one
  in use.
- An unverified flag was raised and then quietly dropped in a later pass
  without being resolved.

## Verification

- Every framework-specific claim the change depends on has either a
  citation or an explicit "unverified" flag — no claim is left silent.
- Citations reference the version actually in use, not a generic search
  result.
