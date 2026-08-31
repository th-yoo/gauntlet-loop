---
description: Prove it works. Tests are proof.
skill: test-driven-development
---

Run the `test-driven-development` skill (see
`skills/test-driven-development/SKILL.md`) against the current change.

Confirm red-green-refactor evidence exists for new/changed behavior, check
test-pyramid balance, and apply the Beyonce Rule to anything relied upon
but untested. For anything running in a browser, verify with
`browser-testing-with-devtools` rather than unit tests alone.

If a claim about the change's behavior has no test that proves it by name,
treat it as unproven per the Prove-It pattern in
`agents/test-engineer.md`.
