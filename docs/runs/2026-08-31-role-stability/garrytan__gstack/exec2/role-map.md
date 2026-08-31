# The virtual team, by role

Each slash-command skill is written as one specialist on a virtual
engineering team. Grouped by the roles the team is meant to cover:

## CEO
- `/plan-ceo-review` — **CEO / Founder.** Rethinks the problem, looks for the
  10-star product hiding inside the request. Four modes: Expansion,
  Selective Expansion, Hold Scope, Reduction.
- `/office-hours` — **YC Office Hours.** Not a CEO title on paper, but plays
  the same forcing-question role upstream of the CEO review: six questions
  that reframe the product before any code is written, and the design doc it
  writes is what `/plan-ceo-review` reads.

## Designer
- `/plan-design-review` — **Senior Designer.** Rates each design dimension
  0-10, explains what a 10 looks like, edits the plan toward it. Includes AI
  Slop detection.
- `/design-review` — **Designer Who Codes.** Same audit as the plan-stage
  review, but live: fixes what it finds, atomic commits, before/after
  screenshots.
- `/design-consultation` — **Design Partner.** Builds a design system from
  scratch: researches the landscape, proposes creative risks, generates
  mockups.
- `/design-shotgun` — **Design Explorer.** Generates 4-6 mockup variants,
  opens a comparison board, collects feedback, iterates. Has taste memory.
- `/design-html` — **Design Engineer.** Turns an approved mockup into
  production HTML/CSS (Pretext computed layout, framework-aware, per-layout
  API routing).

## Eng Manager
- `/plan-eng-review` — **Eng Manager.** Locks architecture, data flow,
  diagrams, edge cases, tests; forces hidden assumptions into the open.
- `/retro` — **Eng Manager.** Team-aware weekly retro with per-person
  breakdowns, shipping streaks, test health trends, growth opportunities.
  `/retro global` runs across every project and AI tool.

## Release Manager
- `/ship` — **Release Engineer.** Syncs main, runs tests, audits coverage,
  pushes, opens the PR; bootstraps test frameworks if none exist.
- `/land-and-deploy` — **Release Engineer.** Merges the PR, waits on CI and
  deploy, verifies production health — one command from "approved" to
  "verified in production."
- `/canary` — **SRE.** Post-deploy monitoring loop for console errors,
  performance regressions, and page failures — the release role's follow
  through once `/land-and-deploy` finishes.

## Doc Engineer
- `/document-release` — **Technical Writer.** Reads every doc file, cross-
  references the diff, updates whatever drifted (README, ARCHITECTURE,
  CONTRIBUTING, CLAUDE.md, TODOS). Builds a Diataxis coverage map. `/ship`
  now auto-invokes it.
- `/document-generate` — **Documentation Author.** Generates missing docs
  from scratch with the Diataxis framework (reference / how-to / tutorial /
  explanation), invoked standalone or chained from `/document-release` when
  the coverage map finds gaps.

## QA
- `/qa` — **QA Lead.** Opens a real browser, tests the app, finds bugs, fixes
  them with atomic commits, re-verifies, auto-generates regression tests.
- `/qa-only` — **QA Reporter.** Same methodology, report only — no code
  changes.
- `/devex-review` — **DX Tester.** Live developer-experience audit: navigates
  docs, tries the getting-started flow, times TTHW, screenshots errors.
  Compares against `/plan-devex-review` scores.
- `/browse` — **QA Engineer.** The underlying eyes: real Chromium, real
  clicks, real screenshots, ~100ms per command.

## Named in the sprint but outside the six headline roles
The full roster also names a **Chief Security Officer** (`/cso` — OWASP Top
10 + STRIDE), a **Debugger** (`/investigate` — root-cause methodology, Iron
Law: no fixes without investigation), a **Performance Engineer**
(`/benchmark`), a **Developer Experience Lead** (`/plan-devex-review`), a
**Multi-Agent Coordinator** (`/pair-agent`), a **Session Manager**
(`/setup-browser-cookies`), a **Review Pipeline** (`/autoplan`, which chains
CEO -> design -> DX -> eng review with eng always last), a **Spec Author**
(`/spec`), and a **Memory** keeper (`/learn`), plus publishing skills
(`/make-pdf`, `/diagram`). These fill out the team beyond the six roles named
above, but are not themselves CEO, Designer, Eng Manager, Release Manager,
Doc Engineer, or QA.
