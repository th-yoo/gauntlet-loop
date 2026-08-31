---
description: Review before merge. Improve code health.
skill: code-review-and-quality
---

Run the `code-review-and-quality` skill (see
`skills/code-review-and-quality/SKILL.md`) against the current diff.

Size the change first; if it's well past the ~100-line target, recommend a
split before reviewing it as one unit. Review against all five axes
(correctness, design, complexity, tests, naming/readability), and label
every finding Nit / Optional / FYI / blocking — nothing left unlabeled.

For anything touching auth, user input, storage, or an external
integration, also invoke `security-and-hardening`
(`agents/security-auditor.md`) as a separate, blocking pass — a Nit
severity does not apply to a security finding.
