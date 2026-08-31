# Security Checklist

Supplementary detail for `skills/security-and-hardening/SKILL.md`.

## Pre-commit checks

- [ ] No secret (API key, password, token, private key) anywhere in the
      diff, including in test fixtures and example configs.
- [ ] No `.env` or credentials file staged.
- [ ] Dependency additions/updates checked against known vulnerability
      databases for the exact version pinned.

## Authentication and authorization

- [ ] Sessions/tokens expire and are invalidated on logout.
- [ ] Authorization is checked on every request that needs it — not only
      rendered conditionally in the UI.
- [ ] Password storage uses a modern, salted hash (never reversible
      encryption, never plaintext).
- [ ] Privilege checks use the narrowest scope the operation needs, not a
      broad "is authenticated" check standing in for "is authorized."

## Input validation

- [ ] Every external input is validated at the boundary where it enters
      (type, range, format) before use.
- [ ] Validation happens once, at the boundary — not re-implemented with
      different rules deeper in the call stack.
- [ ] User-supplied strings used in queries, commands, or templates are
      parameterized or escaped for that specific sink, not just
      "sanitized" generically.

## Headers and transport

- [ ] `Content-Security-Policy` set and scoped, not disabled for
      convenience.
- [ ] `Strict-Transport-Security` set for anything served over HTTPS.
- [ ] Cookies marked `HttpOnly`, `Secure`, and `SameSite` appropriate to
      the flow.

## CORS

- [ ] Allowed origins are an explicit list, not a wildcard, for any
      endpoint handling credentials.
- [ ] Preflight responses don't leak more than the actual allowed
      methods/headers.

## OWASP Top 10 — check against each

1. Broken access control — authorization checked server-side, per request.
2. Cryptographic failures — no sensitive data in plaintext at rest or in
   transit.
3. Injection — parameterized queries/commands; no string concatenation of
   untrusted input into a query, command, or template.
4. Insecure design — trust boundaries identified and tiered before
   implementation, not patched in after.
5. Security misconfiguration — no default credentials, no verbose error
   output exposing internals in production.
6. Vulnerable and outdated components — dependencies audited at the time
   they're introduced or updated.
7. Identification and authentication failures — sessions/tokens expire;
   no predictable session identifiers.
8. Software and data integrity failures — dependencies and CI artifacts
   verified against a trusted source (checksums/signatures) where
   available.
9. Security logging and monitoring failures — auth failures and
   authorization denials are logged in structured form (see
   `observability-checklist.md`).
10. Server-side request forgery — outbound requests built from user input
    are validated against an allow-list of destinations.
