# Setup

## Requirements

- Claude Code
- Git
- Bun v1.0+
- Node.js (Windows only — Bun has a known pipe-transport bug with the browser
  server on Windows, so the browse server falls back to Node there)

## First run, at the machine level

1. Clone the skill package into the Claude Code skills directory and run its
   setup script.
2. Add the `gstack` section from `CLAUDE.md` in this package to the project's
   own `CLAUDE.md` so a session knows the roster exists and which browsing
   skill to prefer.
3. Optionally switch the shared repo to team mode so every teammate's session
   picks up the roster automatically, instead of each person installing it
   by hand.

## First run, at the project level

1. Run `/office-hours` and describe what is being built. Expect it to push
   back on the framing before it writes anything down.
2. Run `/plan-ceo-review` on the resulting design doc, or on any existing
   feature idea directly.
3. Run `/review` on any branch that already has changes.
4. Run `/qa` against a staging URL.
5. Stop there — that sequence alone is enough to tell whether the roster fits
   how a given team wants to work, before adopting the rest of it.

## The sprint order

```
Think → Plan → Build → Review → Test → Ship → Reflect
```

Each stage's skill writes something the next stage's skill reads:
`/office-hours` writes a design doc that `/plan-ceo-review` reads;
`/plan-eng-review` writes a test plan that `/qa` picks up; `/review` finds
bugs that `/ship` should show as fixed by the time it runs. Running the
skills out of this order is possible but breaks the hand-off each one
expects from the last.

## Uninstall

Two paths exist depending on whether the original clone is still on disk:
a bundled uninstall script that also cleans up hook entries in the global
Claude Code settings file, global state, browse daemons, and temp files; or,
if that clone is gone, a manual sequence that stops browse daemons, removes
every skill directory that symlinks back into the package, removes global
state, removes the integrations for any other agent host that was set up,
and removes temp files. Either way, the `gstack` and `Skill routing`
sections added to a project's `CLAUDE.md` are left in place and have to be
removed by hand — the uninstall path does not touch project files.
