---
name: security-and-hardening
description: OWASP Top 10 prevention, auth patterns, secrets management, dependency auditing, three-tier boundary system. Use when handling user input, auth, data storage, or external integrations.
---

## Overview

Security defects are disproportionately introduced at trust boundaries —
wherever data crosses from a less-trusted context into a more-trusted one.
This skill treats every such crossing as a checkpoint with a specific set of
questions, rather than trusting that general code quality will catch
security issues incidentally.

## When to Use

- Handling any user-supplied input.
- Implementing or modifying authentication or authorization.
- Storing secrets or sensitive data.
- Integrating with an external service or dependency.

## Process

1. **Classify each boundary into the three-tier system**: untrusted
   (external input, third-party responses), semi-trusted (internal services
   you don't fully control), and trusted (your own validated internal
   state). Apply validation and least-privilege proportional to the tier —
   untrusted input gets full validation every time it's used, trusted state
   doesn't get re-validated defensively at every call site.
2. **Check the change against the OWASP Top 10** categories relevant to it
   — injection, broken auth, sensitive data exposure, and the rest — using
   `references/security-checklist.md` as the concrete list, not a vague
   recollection of the categories.
3. **Never place secrets in code, logs, or version control.** Use the
   project's secret-management mechanism; a secret that leaked once should
   be rotated, not just removed from the visible diff.
4. **Apply least-privilege to auth decisions** — a component gets the
   narrowest scope that lets it do its job, not the broadest scope that's
   convenient.
5. **Audit dependencies introduced or updated** for known vulnerabilities
   before merging, not as a periodic sweep disconnected from the change
   that introduced them.
6. **Treat a security review as blocking**, not advisory, for any change
   touching the categories above — a Nit-severity label from
   `code-review-and-quality` does not apply here.

## Rationalizations

| Excuse | Rebuttal |
|---|---|
| "This input comes from an internal service, it doesn't need validation." | Internal is a tier, not an exemption — semi-trusted still gets validated at the boundary where it enters, just proportional to its tier. |
| "I'll remove the hardcoded secret from the file, that fixes it." | Removing it from the current diff doesn't un-leak it from history or logs — a leaked secret is rotated, not just deleted from view. |
| "This dependency update is minor, no need to audit it." | A minor version bump can introduce a new transitive dependency with a known vulnerability — the audit is proportional to what changed, not to the version number's size. |

## Red Flags

- User input reaches a query, command, or template without going through
  validation at the boundary.
- A secret appears anywhere in a diff, a log line, or a commit message.
- A dependency was updated with no vulnerability check against the new
  version.

## Verification

- Every trust boundary touched by the change is identified with its tier,
  and validation proportional to that tier is demonstrated, not asserted.
- The relevant rows of `references/security-checklist.md` were checked
  explicitly, and any unresolved finding blocks merge.
