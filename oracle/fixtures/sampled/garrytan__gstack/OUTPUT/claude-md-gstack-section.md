# CLAUDE.md block — paste this into the project's CLAUDE.md

This is the block a session needs so it stops reaching for ad-hoc browser
automation and instead uses the installed skill roster. Two variants are
given: a short one (enough to unblock a confused session) and the fuller
one used right after first install.

## Short variant (troubleshooting / quick fix)

```
## gstack
Use /browse for all web browsing. Never use raw browser-automation MCP tools.
Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review,
/design-consultation, /design-shotgun, /design-html, /review, /ship, /land-and-deploy,
/canary, /benchmark, /browse, /open-gstack-browser, /qa, /qa-only, /design-review,
/setup-browser-cookies, /setup-deploy, /setup-gbrain, /sync-gbrain, /retro, /investigate,
/document-release, /document-generate, /codex, /cso, /autoplan, /pair-agent, /careful, /freeze,
/guard, /unfreeze, /gstack-upgrade, /learn.
```

## Full variant (added right after Step 1 of install)

```
## gstack
Use the /browse skill for all web browsing. Never use raw browser-automation
MCP tools directly.

Available skills:
/office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review,
/design-consultation, /design-shotgun, /design-html, /review, /ship,
/land-and-deploy, /canary, /benchmark, /browse, /connect-chrome, /qa,
/qa-only, /design-review, /setup-browser-cookies, /setup-deploy,
/setup-gbrain, /retro, /investigate, /document-release, /document-generate,
/codex, /cso, /autoplan, /plan-devex-review, /devex-review, /careful,
/freeze, /guard, /unfreeze, /gstack-upgrade, /learn.

## Skill routing
When a request matches a stage of a sprint (think / plan / build / review /
test / ship / reflect), route to the matching skill above instead of
improvising the equivalent behavior from scratch. See sprint-playbook.md for
the stage-to-skill map.
```

Note on scope: this block only tells a session which slash commands exist and
which browsing path to prefer. It does not grant any new permissions — every
skill still runs inside the session's ordinary tool-approval flow.
