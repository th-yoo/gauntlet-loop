# Install runbook

Prerequisites: Claude Code, Git, Bun v1.0+, and (Windows only) Node.js.

## Step 1 — install on your machine

Inside Claude Code, paste an instruction telling it to:

1. Run:
   ```
   git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup
   ```
2. Add the `## gstack` section (see `CLAUDE.md` in this folder) to the
   project's `CLAUDE.md`.
3. Ask whether to also add gstack to the current project so teammates get it
   too.

## Step 2 — team mode (recommended for shared repos)

From inside the target repo:

```bash
(cd ~/.claude/skills/gstack && ./setup --team) && ~/.claude/skills/gstack/bin/gstack-team-init required && git add .claude/ CLAUDE.md && git commit -m "require gstack for AI-assisted work"
```

This bootstraps the repo so teammates get gstack automatically — no vendored
files, no manual upgrades. Every session then runs a fast auto-update check,
throttled to once per hour, network-failure-safe, and silent. Swap `required`
for `optional` to nudge teammates instead of blocking them.

## Non-Claude agents

For the other nine supported agents, the generic install is:

```bash
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/gstack
cd ~/gstack && ./setup
```

or target one directly with `./setup --host <name>` (`codex`, `opencode`,
`cursor`, `factory`, `kiro`, `slate`, `openclaw`, `hermes`, `gbrain`). Any
rules-reading agent that doesn't have a dedicated host target can instead
copy the instruction-only digest at `agents-digest/gstack-AGENTS.md` into
whatever file it reads.

## Verifying the install

- `/browse` failing → `cd ~/.claude/skills/gstack && bun install && bun run build`
- Skills missing → `cd ~/.claude/skills/gstack && ./setup`
- Stale version → run `/gstack-upgrade`, or set `auto_upgrade: true` in
  `~/.gstack/config.yaml`
- Command names feel wrong → `./setup --no-prefix` for bare names (`/qa`) or
  `./setup --prefix` for namespaced ones (`/gstack-qa`)

## Uninstall

If the repo is still cloned: `~/.claude/skills/gstack/bin/gstack-uninstall`
(`--keep-state` preserves config/analytics, `--force` skips confirmation).
This removes skills, symlinks, global state, project-local state, browse
daemons, and temp files, but it does not edit `CLAUDE.md` — remove the
`## gstack` and `## Skill routing` sections manually in every project where
they were added.
