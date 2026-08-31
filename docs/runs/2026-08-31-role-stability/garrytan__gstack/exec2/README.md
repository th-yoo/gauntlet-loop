# Setting up the virtual engineering team

This folder is a self-contained setup packet for turning Claude Code into a
virtual engineering team: a CEO who rethinks the product, an eng manager who
locks architecture, a designer who catches AI slop, a reviewer who finds
production bugs, a QA lead who opens a real browser, a security officer who
runs OWASP + STRIDE audits, and a release engineer who ships the PR — plus
supporting specialists for docs, security, debugging, performance, and
multi-agent coordination. All of it is slash commands, all Markdown, free,
MIT licensed.

## What's in this folder

- `install-runbook.md` — the two-step install (personal machine, then team
  mode for a shared repo), the generic path for non-Claude agents, and how to
  verify or uninstall the install.
- `CLAUDE.md` — the section to append to a project's own `CLAUDE.md` so the
  agent knows the skills exist and routes plain-language requests ("run a
  security check," "test the website") to the right one.
- `role-map.md` — the specialist roster grouped by the six headline roles
  (CEO, Designer, Eng Manager, Release Manager, Doc Engineer, QA), plus the
  additional specialists that round out the team.
- `sprint-workflow.md` — the Think -> Plan -> Build -> Review -> Test -> Ship
  -> Reflect order the skills are designed to run in, the one-command
  `/autoplan` shortcut, and how to pick between a plan-stage review and a
  live audit.
- `power-tools.md` — the safety/config slash commands (`/careful`, `/freeze`,
  `/guard`, `/codex`, ...) and the standalone CLIs that run outside a
  session (evidence ledger, egress auditor, token bill-of-materials, and so
  on).

## How to use it

1. Read `install-runbook.md` and run Step 1 on the target machine.
2. Add the block in `CLAUDE.md` to the project.
3. If the repo is shared, run Step 2 (team mode) so every teammate's session
   picks up the skills automatically.
4. Follow `sprint-workflow.md`'s quick start for the first real feature:
   `/office-hours`, then `/plan-ceo-review`, then `/plan-eng-review`, then
   build, then `/review`, then `/qa`, then `/ship`.
5. Reach for `role-map.md` when deciding which specialist a task calls for,
   and `power-tools.md` for safety rails or cross-session accounting.

## Boundaries this packet respects

- No network installs are performed here — installing the actual skill tree
  requires a live `git clone` and `./setup` run on the target machine, which
  is outside what a documentation packet can do on its own.
- Nothing here is telemetry, and no off-machine sends happen from following
  it. Telemetry is opt-in at first run, and every off-machine send the tool
  itself makes writes a receipt before sending — see `power-tools.md` for the
  auditor commands.
