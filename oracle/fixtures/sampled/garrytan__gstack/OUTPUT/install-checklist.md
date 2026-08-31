# Setup checklist — solo-founder Claude Code stack

Requirements before starting: Claude Code, Git, Bun v1.0+, and (Windows only) Node.js.

## Step 1 — install on your machine

Open Claude Code and paste the following. Claude runs the clone + setup script itself:

```
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup
```

Immediately after, have Claude add a "gstack" section to the project's `CLAUDE.md`
(see `claude-md-gstack-section.md` in this folder for the exact block) so the
session knows: use the browsing skill for all web work, never fall back to a raw
browser-automation tool, and here is the full skill roster.

Then ask whether teammates should get this too — that decides whether you stop
here (solo) or continue to Step 2 (shared repo).

## Step 2 — team mode (shared repos, recommended once more than one person touches the repo)

From inside the repo:

```
(cd ~/.claude/skills/gstack && ./setup --team) && ~/.claude/skills/gstack/bin/gstack-team-init required && git add .claude/ CLAUDE.md && git commit -m "require gstack for AI-assisted work"
```

This vendors nothing into the repo — teammates get the tooling automatically,
with a throttled (once/hour), network-failure-safe, silent auto-update check on
every session start. Swap `required` for `optional` to nudge instead of block.

## Verification pass (run these five, in order, on any real branch)

1. `/office-hours` — describe what you're building; confirm it pushes back on
   framing rather than just taking dictation.
2. `/plan-ceo-review` on a feature idea — confirm it produces the four-mode
   strategic read (Expansion / Selective Expansion / Hold Scope / Reduction).
3. `/review` on a branch with changes — confirm it distinguishes auto-fixed
   issues from ones it asks you about.
4. `/qa` against a staging URL — confirm it actually opens a browser rather
   than reasoning about the page from static analysis.
5. Stop. That's enough evidence to decide whether the rest of the roster earns
   a place in your workflow.

## Troubleshooting quick reference

| Symptom | Fix |
|---|---|
| Skill not showing up | `cd ~/.claude/skills/gstack && ./setup` |
| `/browse` fails | `cd ~/.claude/skills/gstack && bun install && bun run build` |
| Install feels stale | run the self-updater, or turn on `auto_upgrade: true` in the global config |
| Want `/qa` instead of `/gstack-qa` | rerun setup with the no-prefix flag |
| Want namespaced commands instead (to coexist with other skill packs) | rerun setup with the prefix flag |
| Windows + Git Bash without Developer Mode | symlinks silently become frozen copies; rerun setup after every `git pull` |

## Decommission path (keep for when the trial ends)

- If the tool is still on disk: run its own uninstall binary from inside the
  install directory. It tears down skills, symlinks, global and per-project
  state, browser daemons, and temp files. A `--keep-state` flag preserves
  config/analytics; `--force` skips the confirmation prompt.
- If the install directory is already gone: uninstall by hand — stop any
  browser-automation daemons, delete every per-skill directory whose
  `SKILL.md` symlinks back into the install, delete the install directory
  itself, delete its global state directory, delete the per-agent
  integration directories for any other coding agents it was pointed at, and
  clean the per-project directories (a `.gstack` state dir, worktree cache,
  and the vendored `.claude/skills` copy if team mode was ever committed).
- Either path leaves hook entries in Claude Code's own settings file if you
  skip the script — the manual path must also delete those by hand, or every
  matching event errors once the install directory is gone.
- Manual removal does not touch `CLAUDE.md`. Delete the added section by hand.
