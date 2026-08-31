## gstack

Use `/browse` from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills:

`/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`,
`/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`,
`/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`,
`/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`,
`/setup-gbrain`, `/retro`, `/investigate`, `/document-release`,
`/document-generate`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`,
`/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`,
`/learn`.

## Skill routing

Say what stage you're in instead of memorizing command names — gstack maps
plain language to the right skill:

- "run a security check" -> `/cso`
- "test the website" -> `/qa`
- "do an engineering review" -> `/plan-eng-review` (before code) or `/review` (after)

If a downstream skill (`/plan-ceo-review`, `/plan-eng-review`, `/qa`, `/ship`)
is invoked before its upstream input exists, run `/office-hours` first — the
design doc it writes is what every later skill reads from.
