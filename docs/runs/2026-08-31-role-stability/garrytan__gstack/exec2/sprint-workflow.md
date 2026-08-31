# Running one sprint

The skills are meant to run in the order a sprint runs, and each step feeds
the next: `/office-hours` writes a design doc that `/plan-ceo-review` reads;
`/plan-eng-review` writes a test plan that `/qa` picks up; `/review` catches
bugs that `/ship` verifies are fixed.

**Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect**

## Quick start (five commands, in order)

1. `/office-hours` — describe what you're building. Expect it to push back on
   the framing, extract capabilities you didn't realize you were describing,
   challenge premises, and propose implementation approaches with effort
   estimates, ending in a written design doc.
2. `/plan-ceo-review` — on the feature idea. Reads the design doc, challenges
   scope, runs a 10-section review.
3. `/plan-eng-review` — locks architecture: ASCII diagrams for data flow,
   state machines, and error paths; a test matrix; failure modes; security
   concerns.
4. Approve the plan and exit plan mode — this is where the code gets written.
5. `/review` — Staff Engineer pass. Auto-fixes obvious issues, flags the rest
   for approval (e.g. a race condition), flags completeness gaps. Advisory
   simplification lens flags over-built code without blocking or auto-
   applying.
6. `/qa <staging-url>` — QA Lead opens a real browser, clicks through flows,
   finds and fixes a bug, generates a regression test.
7. `/ship` — Release Engineer syncs main, runs tests, audits coverage,
   pushes, opens the PR.

That is the same order the README's own worked example walks through: a
"daily briefing app" request gets reframed by `/office-hours` into a
"personal chief of staff AI," narrowed to the smallest shippable wedge, run
through `/plan-ceo-review` and `/plan-eng-review`, implemented, caught one
race condition in `/review`, QA'd on staging, and shipped with a PR and nine
new tests — eight commands end to end.

## One-command version

`/autoplan` collapses the plan stage into one call: it runs CEO -> design ->
DX -> eng review automatically, auto-detecting which of those apply, with
eng review always run last so the shipping gate reviews the final amended
plan. Only taste decisions surface for approval.

## Choosing which review to run

| Building for... | Plan stage (before code) | Live audit (after shipping) |
|---|---|---|
| End users (UI, web app, mobile) | `/plan-design-review` | `/design-review` |
| Developers (API, CLI, SDK, docs) | `/plan-devex-review` | `/devex-review` |
| Architecture (data flow, perf, tests) | `/plan-eng-review` | `/review` |
| All of the above | `/autoplan` | — |

## After shipping

- `/land-and-deploy` merges the approved PR and verifies production health.
- `/canary` watches the deploy for console errors, performance regressions,
  and page failures.
- `/benchmark` baselines page load, Core Web Vitals, and resource sizes
  before/after.
- `/document-release` (now auto-invoked by `/ship`) updates every doc that
  drifted and reports a Diataxis coverage map.
- `/retro` closes the loop with a team-aware weekly retrospective.

## Running several sprints at once

The sprint structure is what makes parallelism safe rather than chaotic: with
think-plan-build-review-test-ship as the shared discipline, each parallel
agent (for example, one running `/office-hours` on a new idea while another
runs `/review` on a PR and a third runs `/qa` on staging) knows exactly what
to do and when to stop, so ten agents running at once stay ten sources of
progress instead of ten sources of chaos.
