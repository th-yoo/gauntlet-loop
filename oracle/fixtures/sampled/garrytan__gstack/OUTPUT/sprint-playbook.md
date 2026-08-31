# Sprint playbook: Think → Plan → Build → Review → Test → Ship → Reflect

The setup is a process, not a toolbox. Each stage below produces an artifact
the next stage reads — skip a stage and the next one is missing its input,
not just missing a nice-to-have.

## 1. Think

Run `/office-hours`. Describe the pain in specific, concrete terms — not the
feature you already decided to build. Expect it to push back on the framing,
challenge premises you didn't know you were assuming, and propose a few
implementation angles with rough effort estimates.

**Output:** a design doc. Every downstream stage reads this file; don't skip
straight to planning without it.

## 2. Plan

Three planning lenses, run separately or bundled:

- `/plan-ceo-review` — is this the 10x version of the idea, or should scope
  hold / shrink? Reads the design doc from stage 1.
- `/plan-eng-review` — architecture, data flow, edge cases, and the test
  matrix, forced into the open before code exists.
- `/plan-design-review` and/or `/plan-devex-review` — only if the feature has
  a user-facing surface (design) or a developer-facing surface (DX).

Or run `/autoplan` once, which sequences CEO → design → DX → eng
automatically (engineering review always runs last, since it has to review
the plan as amended by the others, not the original draft) and surfaces only
the genuinely subjective calls back to you.

**Output:** an amended plan with architecture, edge cases, and a test matrix
attached.

## 3. Build

This stage has no dedicated skill — it's where the plan gets implemented.
The point of stages 1–2 is that by the time you get here, the hard decisions
are already made, so building is comparatively mechanical.

## 4. Review

Run `/review`. It looks for the bugs that pass CI but detonate in
production, auto-fixes the obvious ones, and flags anything it thinks is
over-built without blocking on that opinion. For anything security-shaped,
run `/cso` as well (OWASP Top 10 + STRIDE, high confidence bar, concrete
exploit scenario per finding). For a second, differently-biased opinion, run
`/codex` and diff its findings against `/review`'s.

**Output:** a set of auto-fixed issues plus a short list of things that need
a human decision.

## 5. Test

Run `/qa` against a real staging URL. It opens an actual browser, clicks
through the flows the plan's test matrix described, fixes what it finds, and
writes a regression test for every fix so the same bug can't come back
silently. Use `/qa-only` instead if you want the bug report without letting
it touch code.

**Output:** a growing regression suite, plus a fixed set of bugs the plan
didn't anticipate.

## 6. Ship

Run `/ship`: sync main, run the full suite, audit coverage, push, open the
PR. It bootstraps a test framework from nothing if the project doesn't have
one yet, and it invokes the doc-update stage below automatically so shipping
and documenting aren't two separate steps someone forgets to do the second
of. After merge, `/land-and-deploy` takes it the rest of the way — merge,
wait on CI and deploy, verify production is actually healthy, not just that
the deploy command returned zero.

**Output:** a merged PR, a deploy, and a verified-healthy production check.

## 7. Reflect

Run `/retro`. Per-person breakdown, shipping streaks, test-health trend,
where the growth opportunities are. This is the stage most tempting to skip
under deadline pressure and the one that keeps the other six honest over
multiple sprints rather than just the current one.

## Running several of these at once

Nothing above requires one sprint to finish before the next starts, provided
each sprint gets its own isolated workspace. Ten sprints in different stages
at once is normal; without the stage discipline above, ten parallel sessions
would just be ten sources of chaos instead. Check in on the calls that
matter (stage 1 and 2's framing decisions, stage 4's flagged-for-human
items); let mechanical stages run unattended.
