# Project instructions: virtual engineering team roster

This section tells a Claude Code session, working in this project, that the
six-role specialist roster and its power tools are available and how to
prefer them over ad-hoc equivalents.

## gstack

Use the `/browse` skill for all web browsing. Never use
`mcp__claude-in-chrome__*` tools.

Available skills, grouped by the role they serve (see `SKILLS-BY-ROLE.md`
for what each one does):

- **CEO** — `/office-hours`, `/plan-ceo-review`
- **Designer** — `/plan-design-review`, `/design-consultation`, `/design-review`, `/design-shotgun`, `/design-html`
- **Eng Manager** — `/plan-eng-review`, `/plan-devex-review`, `/devex-review`, `/review`, `/investigate`, `/autoplan`, `/retro`
- **Release Manager** — `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`
- **Doc Engineer** — `/document-release`, `/document-generate`, `/make-pdf`, `/diagram`
- **QA** — `/qa`, `/qa-only`, `/browse`, `/setup-browser-cookies`, `/pair-agent`, `/cso`
- **Cross-cutting utilities** — `/spec`, `/learn`
- **Power tools** — `/codex`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/open-gstack-browser`, `/setup-deploy`, `/setup-gbrain`, `/sync-gbrain`, `/gstack-upgrade`

## Skill routing

Drive work in sprint order — Think, Plan, Build, Review, Test, Ship,
Reflect — and let each stage's written output (design doc, plan, test plan,
review findings) feed the next stage instead of re-deriving it:

1. `/office-hours` then `/plan-ceo-review` before any code is written on a
   new feature idea.
2. `/plan-eng-review` (and `/plan-design-review` / `/plan-devex-review` when
   the change is user-facing or developer-facing) to lock architecture and
   scope before implementation.
3. `/review` after implementation, before QA.
4. `/qa` against a real running instance of the change.
5. `/ship` to open the PR, and `/land-and-deploy` once it is approved.
6. `/document-release` so docs are updated as part of shipping, not after.
7. `/retro` on a cadence, independent of any single change.

Say "stop suggesting" to turn off proactive skill suggestions for the rest
of a session if a role's skill is not wanted at that point in the flow.
