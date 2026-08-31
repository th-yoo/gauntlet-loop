# The virtual team, organized by role

The pitch is a virtual engineering team: a CEO, a Designer, an Eng Manager, a
Release Manager, a Doc Engineer, and QA. The skill roster doesn't ship
pre-sorted into exactly those six buckets, so here is that sort, done once,
so nobody has to re-derive it per feature.

A note before the table: the source material claims "twenty-three
specialists" in prose, but the two places it actually enumerates skills list
30 (the sprint table) and 35 (the install-time CLAUDE.md list) distinct
slash commands respectively. Those two lists also don't match each other —
`/pair-agent` and `/spec` appear in the sprint table but not in the install
list; `/connect-chrome`, `/setup-deploy`, `/setup-gbrain` appear in the
install list but not the sprint table. Rather than pick 23 of them to match
the prose number, this map sorts everything that is enumerated anywhere,
and says so, so the count under each role below is honest about what it
covers.

## CEO — frame the problem before anyone writes code

| Skill | Job |
|---|---|
| `/office-hours` | Six forcing questions that reframe the request before implementation starts; writes the design doc every downstream skill reads. |
| `/plan-ceo-review` | Finds the bigger product hiding inside the request; four modes from Expansion to Reduction. |
| `/autoplan` | Runs the whole review pipeline (CEO → design → DX → eng) in one call when you don't want to sequence it by hand. |

## Designer — taste and interface quality

| Skill | Job |
|---|---|
| `/plan-design-review` | Scores each design dimension 0–10 against what a 10 looks like, interactively. |
| `/design-consultation` | Builds a design system from a blank page: research, creative risk, mockups. |
| `/design-shotgun` | Generates several mockup variants, opens a side-by-side board, learns your taste over rounds. |
| `/design-html` | Turns an approved mockup into production HTML/CSS with dynamic, reflowing layout. |
| `/design-review` | The live-audit twin of `/plan-design-review` — same rubric, but it also fixes what it finds. |

## Eng Manager — architecture, review discipline, team health

| Skill | Job |
|---|---|
| `/plan-eng-review` | Locks architecture, data flow, edge cases, and the test plan before building. |
| `/review` | Finds bugs that pass CI but would blow up in production; auto-fixes the obvious ones. |
| `/investigate` | Root-cause debugging with a hard rule against fixing before understanding. |
| `/cso` | OWASP + STRIDE threat modeling with a high confidence bar before it reports anything. |
| `/codex` | An independent second opinion from a different model, cross-checked against `/review`'s findings. |
| `/retro` | Team-aware weekly retrospective — per-person breakdowns, streaks, test-health trend. |
| `/plan-devex-review` / `/devex-review` | Same plan-then-verify pattern, aimed at the experience of developers who consume what you build rather than end users. |

## Release Manager — get it out the door and keep it healthy

| Skill | Job |
|---|---|
| `/ship` | Sync, test, audit coverage, push, open the PR; bootstraps a test framework if none exists. |
| `/land-and-deploy` | Merge, wait on CI and deploy, verify production health — one command end to end. |
| `/canary` | Post-deploy watch loop for console errors, performance regressions, page failures. |
| `/benchmark` | Baseline and compare load time / Core Web Vitals / resource size across a PR. |
| `/setup-deploy` | One-time configuration so `/land-and-deploy` knows the platform and the deploy commands. |

## Doc Engineer — keep the written record honest

| Skill | Job |
|---|---|
| `/document-release` | Reads every doc in the project, cross-references the diff, updates what drifted. |
| `/document-generate` | Writes missing docs from scratch, researching the code first, structured as reference / how-to / tutorial / explanation. |
| `/make-pdf` | Turns markdown (including diagrams) into a publication-quality document. |
| `/diagram` | Produces an editable diagram triplet from a plain-English description. |

## QA — verify it actually works

| Skill | Job |
|---|---|
| `/qa` | Opens a real browser, clicks through flows, fixes what it finds, writes a regression test. |
| `/qa-only` | The report-only version — same audit, no code changes. |
| `/browse` | The underlying "give the agent eyes" primitive the QA skills sit on top of. |
| `/setup-browser-cookies` | Imports a real browser session so authenticated pages are testable. |
| `/pair-agent` | Lets a second agent (different vendor) share the same browser session for joint QA. |

## Doesn't cleanly fit one of the six

A handful of skills are cross-cutting rather than role-specific — they are
safety rails or infrastructure that every role above depends on rather than
a specialist in their own right: `/careful`, `/freeze`, `/guard`,
`/unfreeze` (destructive-command guardrails and edit-scope locks),
`/gstack-upgrade` (self-updater), `/learn` (cross-session memory),
`/spec` (turns intent into a filed, executable spec — closer to a shared
intake form than a single role), and `/setup-gbrain` / `/sync-gbrain`
(persistent knowledge base plumbing). Keep these visible in the routing
list, but don't force them into the six-role chart above.

## Coverage tally

Six named roles cover 29 of the enumerated skills above (CEO 3, Designer 5,
Eng Manager 7, Release Manager 5, Doc Engineer 4, QA 5 — some skills, like
`/plan-devex-review`, are counted once even though they touch more than one
concern). The remaining handful — `/careful`, `/freeze`, `/guard`,
`/unfreeze`, `/gstack-upgrade`, `/learn`, `/spec`, `/setup-gbrain`,
`/sync-gbrain` — are the cross-cutting infrastructure listed above, not a
seventh role.
