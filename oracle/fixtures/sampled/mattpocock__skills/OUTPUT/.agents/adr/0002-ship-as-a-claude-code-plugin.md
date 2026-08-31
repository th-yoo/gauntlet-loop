# 0002 - Ship As A Claude Code Plugin

## Status

Accepted.

## Context

This repo needs to reach people on more than one coding agent, and the agents
don't offer the same distribution primitive.

Claude Code has an official plugin marketplace. A plugin installed from it is
a managed, read-only bundle: the user runs `claude plugins install
mattpocock-skills` (or `/plugin install mattpocock-skills` from inside a
session), and because it's already listed in the marketplace there is nothing
to add first — updates then arrive automatically as new versions ship.

Codex, and other agents, have no equivalent first-class plugin mechanism yet.
The only way to get these skills onto them today is the generic `skills.sh`
installer (`npx skills@latest add mattpocock/skills`), which writes the skill
files into the user's own repo as ordinary files they own and can edit, and
which they update themselves later with `npx skills update`.

These two mechanisms embody different philosophies, not just different
commands: the Claude Code plugin asks the user to *subscribe* to a bundle they
don't touch, while `skills.sh` asks them to *fork* files into their project
and hack on them. Installing both leaves every skill duplicated, once under
each philosophy, which is pure downside with no corresponding benefit — so a
user is meant to pick one, not both.

## Decision

Ship this skill set as a Claude Code plugin, published to Claude Code's
official marketplace under the name `mattpocock-skills`, as the distribution
channel for Claude Code specifically.

For every other agent (Codex included), keep using the `skills.sh`
copy-into-your-project installer as the distribution channel, rather than
waiting on a native plugin format that doesn't exist yet for those agents.
The installer already supports picking which skills to take and which agents
to install them on; `setup-matt-pocock-skills` should always be one of the
skills taken, since it is what configures a repo (issue tracker, triage
labels, doc save location) for the rest of the engineering skills to work
against.

A native Codex plugin remains on the roadmap as a future decision, not part
of this one: until it exists, Codex users are directed to `skills.sh` rather
than left without an install path.

## Consequences

- Claude Code users get a zero-setup, auto-updating install, but cannot edit
  the skill files directly without leaving the managed-bundle model.
- Codex and other non-Claude-Code users get editable, forkable files, but are
  responsible for pulling updates themselves via `npx skills update`.
- The two paths must be kept mutually exclusive in guidance: documentation
  and onboarding need to keep telling a user to pick one, since installing
  both duplicates every skill with no benefit.
- Because a native Codex plugin does not exist yet, Codex support is coupled
  to the fate of the generic `skills.sh` installer until a follow-up ADR
  revisits that roadmap item.
