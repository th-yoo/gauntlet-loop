---
description: Simplify the code. Clarity over cleverness.
skill: code-simplification
---

Run the `code-simplification` skill (see
`skills/code-simplification/SKILL.md`) against the target code.

Before removing any complexity, establish why it's there (Chesterton's
Fence) — find the reason or flag its absence explicitly, don't assume. Use
the Rule of 500 as a prompt to check a file's structure, not an automatic
split trigger. Simplify in slices, re-running the full test suite after
each slice so any behavior change is caught at the step that caused it, not
at the end.

Do not combine a simplification with an unrelated bug fix in the same
slice — split them.
