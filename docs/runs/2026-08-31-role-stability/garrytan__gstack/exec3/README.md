# Virtual engineering team setup for Claude Code

This package instantiates the opinionated multi-role Claude Code setup described
in the source project: a fixed roster of slash-command "specialists" that stand
in for a small engineering organization — a CEO who rethinks the product, an
eng manager who locks architecture, a designer who catches AI slop, a QA lead
who opens a real browser, a release engineer who ships the PR, and a
documentation engineer who keeps the docs honest — plus a set of power tools
that sit alongside the roster rather than inside it.

The intent, straight from the source material: this is a **process**, not a
loose bag of tools. The specialists run in sprint order —

```
Think → Plan → Build → Review → Test → Ship → Reflect
```

— and each stage's output feeds the next stage's input (a design doc feeds a
plan review, a test plan feeds QA, a review's findings feed the ship gate).

Files in this package:

- `SKILLS-BY-ROLE.md` — every specialist and power tool, grouped under the six
  headline roles (CEO, Designer, Eng Manager, Release Manager, Doc Engineer,
  QA), with the utility skills and power tools that don't sit inside any one
  role called out separately rather than forced in.
- `CLAUDE.md` — the project-level configuration block a repo needs so an
  agent session knows the roster exists and which browsing skill to prefer.
- `SETUP.md` — the install and first-run sequence, and the sprint order the
  roster is meant to be driven in.

## Headline claim vs. the actual roster

The source material's own headline says **"twenty-three specialists and eight
power tools."** Working through the same material's own tables gives a
larger count on both sides: 30 named specialist rows (across the main skill
table) and 15 named power-tool rows. That gap is recorded here as a fact
about the material, not resolved by guessing which number is authoritative —
see the note at the top of `SKILLS-BY-ROLE.md`.
