# Skills by role

> **Count note.** The source material's headline states "twenty-three
> specialists and eight power tools." Its own main skill table lists 30
> specialist rows and its own power-tools table lists 15 rows. This document
> uses the fuller, table-derived lists below rather than trimming to match the
> headline number, since the headline text and the tables disagree within the
> same source and nothing in the source explains which one is stale.

## CEO

Rethinks the product before code gets written; challenges the framing and the
scope.

| Skill | What it does |
|---|---|
| `/office-hours` | Six forcing questions that reframe the product before anyone writes code. Pushes back on the framing, challenges premises, generates implementation alternatives. Writes a design doc that every downstream skill reads. |
| `/plan-ceo-review` | Rethinks the problem and looks for the 10-star product hiding inside the request. Four modes: Expansion, Selective Expansion, Hold Scope, Reduction. |

## Designer

Owns product feel: design systems, AI-slop detection, and turning an approved
mockup into shippable HTML.

| Skill | What it does |
|---|---|
| `/plan-design-review` | Rates each design dimension 0-10, explains what a 10 looks like, edits the plan to get there. Interactive, one question per design choice. |
| `/design-consultation` | Builds a complete design system from scratch: researches the landscape, proposes creative risks, generates mockups. |
| `/design-review` | Runs the same audit as the plan-stage review, then fixes what it finds, with atomic commits and before/after screenshots. |
| `/design-shotgun` | Generates several AI mockup variants, opens a side-by-side comparison board, collects feedback, and iterates. Learns taste over repeated rounds. |
| `/design-html` | Turns an approved mockup into production HTML/CSS with computed, responsive text layout — not a demo that breaks off the one viewport it was designed at. |

## Eng Manager

Locks architecture, keeps reviews rigorous, and runs the retro.

| Skill | What it does |
|---|---|
| `/plan-eng-review` | Locks in architecture, data flow, diagrams, edge cases, and tests; forces hidden assumptions into the open. |
| `/plan-devex-review` | Interactive developer-experience review across personas, competitor benchmarks, and friction points. |
| `/devex-review` | Live audit of the actual onboarding flow — navigates docs, times time-to-hello-world, screenshots errors — and compares against the plan-stage DX score. |
| `/review` | Finds the bugs that pass CI but blow up in production; auto-fixes the obvious ones; flags completeness gaps and over-built code. |
| `/investigate` | Systematic root-cause debugging under an "no fixes without investigation" rule; stops after three failed fixes. |
| `/autoplan` | Runs CEO, design, DX, and eng review in one pass (eng always last), surfacing only the taste decisions that need a human call. |
| `/retro` | Team-aware weekly retro: per-person breakdowns, shipping streaks, test-health trends. |

## Release Manager

Ships the PR, merges and deploys it, and watches it once it's live.

| Skill | What it does |
|---|---|
| `/ship` | Syncs main, runs tests, audits coverage, pushes, opens the PR. Bootstraps a test framework if one doesn't exist. |
| `/land-and-deploy` | Merges the PR, waits for CI and deploy, verifies production health — one command from "approved" to "verified in production." |
| `/canary` | Post-deploy monitoring loop watching for console errors, performance regressions, and page failures. |
| `/benchmark` | Baselines page load time, Core Web Vitals, and resource sizes; compares before/after on every PR. |

## Doc Engineer

Keeps every doc file honest against what actually shipped.

| Skill | What it does |
|---|---|
| `/document-release` | Reads every doc file, cross-references the diff, updates whatever drifted (README, architecture doc, contributing guide, changelog). Builds a coverage map across reference/how-to/tutorial/explanation so gaps show up in the PR body. |
| `/document-generate` | Generates missing docs from scratch, researching the codebase first, in the same four-category framework. Can run standalone or be chained automatically when the release-doc coverage map finds a gap. |
| `/make-pdf` | Turns Markdown into a publication-quality document; diagram fences render as vector graphics; can emit a single self-contained HTML file or a Word doc. |
| `/diagram` | Turns a plain-English description into an editable diagram triplet (diagram source, an editable file, and a rendered image) that Markdown and the PDF skill can both embed. |

## QA

Tests the running app with a real browser, reports or fixes what it finds,
and audits security.

| Skill | What it does |
|---|---|
| `/qa` | Opens a real browser, clicks through flows, finds and fixes bugs with atomic commits, auto-generates a regression test per fix. |
| `/qa-only` | Same methodology, report only — no code changes. |
| `/browse` | The underlying real-browser primitive: real clicks, real screenshots. |
| `/setup-browser-cookies` | Imports cookies from a real browser session so authenticated pages can be tested headlessly. |
| `/pair-agent` | Lets a second AI agent (different vendor) share the same browser session in its own tab, for cross-agent QA. |
| `/cso` | OWASP Top 10 + STRIDE threat model with a confidence gate and independent finding verification; each finding ships with a concrete exploit scenario. |

## Skills that don't sit inside one role

Two specialist-table rows are utilities the whole roster shares rather than a
single role's output:

| Skill | What it does |
|---|---|
| `/spec` | Turns a vague request into a precise, executable spec through five phases, gated by a quality check before it's filed. |
| `/learn` | Manages what the system has learned across sessions — review, search, prune, export project-specific patterns and preferences. |

## Power tools

Named as a separate category from the specialist roster; not counted against
any of the six roles above.

| Skill | What it does |
|---|---|
| `/codex` | Independent second-opinion code review from a different model family; three modes (pass/fail review, adversarial challenge, open consultation). |
| `/careful` | Warns before destructive commands (recursive delete, dropping a table, force-push). |
| `/freeze` | Restricts edits to one directory while debugging. |
| `/guard` | `/careful` and `/freeze` together, for production work. |
| `/unfreeze` | Removes the `/freeze` boundary. |
| `/open-gstack-browser` | Launches a branded, stealth-hardened browser window with a sidebar agent and cookie import. |
| `/setup-deploy` | One-time deploy configuration (platform, production URL, deploy commands) that `/land-and-deploy` then uses. |
| `/setup-gbrain` | Onboards a persistent, cross-session knowledge base for the agent. |
| `/sync-gbrain` | Re-indexes a repo's code into that knowledge base and keeps the project's search guidance current. |
| `/gstack-upgrade` | Self-updates the whole install and reports what changed. |
| `/ios-qa` | Drives a real iPhone over USB for live-device QA. |
| `/ios-fix`, `/ios-design-review`, `/ios-clean`, `/ios-sync` | The iOS-specific bug-fix loop, HIG design audit, debug-bridge cleanup, and accessor resync that pair with `/ios-qa`. |
