---
name: api-and-interface-design
description: Contract-first design, Hyrum's Law, One-Version Rule, error semantics, boundary validation. Use when designing APIs, module boundaries, or public interfaces.
---

## Overview

Every observable behavior of a public interface becomes a de facto contract
the moment a caller depends on it, whether or not it was documented as one
(Hyrum's Law). This skill designs the contract deliberately, before
implementation, so the behavior a caller ends up depending on is the one
that was actually intended.

## When to Use

- Designing a new public API, module boundary, or shared interface.
- Modifying an existing interface's behavior in a way callers might notice.
- Deciding how errors should surface across a boundary.

## Process

1. **Write the contract before the implementation**: inputs, outputs, error
   cases, and invariants — as a specification a caller could code against
   without reading the implementation.
2. **Assume every observable behavior will be depended upon (Hyrum's
   Law).** If a behavior isn't part of the intended contract, don't just
   avoid documenting it — make it genuinely unobservable, or expect a
   caller to eventually rely on it anyway.
3. **Apply the One-Version Rule** where it fits the ecosystem: support one
   version of the interface at a time rather than accumulating parallel
   versions indefinitely; see `deprecation-and-migration` for retiring an
   old one.
4. **Design error semantics as part of the contract, not as an
   afterthought** — what's a client error vs. a server error, what's
   retryable, what's the exact shape of an error response. A caller should
   be able to branch on error type without inspecting a message string.
5. **Validate at the boundary, not past it.** Every external input is
   validated at the point it enters the system; code past that point trusts
   the validated shape rather than re-checking it defensively everywhere.
6. **Version the contract explicitly when it must change**, and use
   `documentation-and-adrs` to record why.

## Rationalizations

| Excuse | Rebuttal |
|---|---|
| "This internal detail isn't part of the API, callers won't rely on it." | Hyrum's Law: if it's observable, someone eventually depends on it — the fix is to make it unobservable, not to hope. |
| "I'll document the error format later." | An undocumented error format is still a contract the moment the first caller starts pattern-matching on it — document it before that happens. |
| "Validating input again deeper in the call stack is just extra safety." | Re-validating past the boundary duplicates the contract in two places that can drift; validate once, at the boundary, and trust it afterward. |

## Red Flags

- A caller is observed depending on an "internal" behavior that was never
  part of the documented contract.
- Error responses vary in shape across endpoints of the same API with no
  stated reason.
- The same input is validated in multiple layers with inconsistent rules.

## Verification

- The contract (inputs, outputs, errors, invariants) is written down before
  or alongside the implementation, not reconstructed from it afterward.
- A caller can branch on error type using a documented field, not a message
  string.
