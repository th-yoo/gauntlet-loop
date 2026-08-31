# Agent Reach — offline artifact

Everything in this directory was built from a single source: the top-level
`README.md` of `Panniantong/Agent-Reach`, sampled as this task's fixture. No
other part of that repository (e.g. `docs/install.md`, `docs/update.md`, the
`channels/` Python sources) was fetched, because the task requires using only
the given artifact and forbids network access.

The upstream project installs itself over the network by having an agent
fetch and execute `docs/install.md`. That step is out of reach here on
purpose — it needs the network and it runs an installer, both of which this
task disallows. What can be built from the README alone, without either, is
the *routing knowledge* the README already states in full: which platforms
work with zero configuration, which need the user to say "帮我配 XXX", and
which upstream backend (primary ▸ fallback) each channel is documented to use.

## Files

- `channels.json` — a structured transcription of the README's "支持的平台"
  and "当前选型" tables and the `channels/` tree: one entry per platform, its
  zero-config capability, what configuring unlocks, how to configure it, and
  its primary▸fallback backend chain. Includes the caveats the README states
  explicitly (Twitter cookie scope, XiaoHongShu session-only policy).
- `SKILL.md` — the skill sheet an agent would consult before acting on a
  user's request: maps a request ("看看这个链接", "B站搜一下...") to the
  concrete zero-config command the README names, and maps a request that
  needs login to the exact "帮我配 XXX" phrase to hand back to the user
  rather than attempting it silently.
- `doctor.sh` — a read-only, offline stand-in for the `agent-reach doctor`
  command the README describes. It checks which of the named upstream CLI
  binaries (`yt-dlp`, `gh`, `curl`, etc.) are already present on this
  machine's `PATH`. It installs nothing, fetches nothing, and writes nothing;
  it only reports presence/absence, and states on every run that binary
  presence is not the same as a working login session — that distinction is
  taken directly from the README's own account of what needs a real Chrome
  session or an in-process token versus what needs only an installed CLI.

## What this deliberately does not do

- It does not run `agent-reach install`, `pip install`, `npm install`,
  `mcporter`, or any other installer — the task forbids commands that change
  system state.
- It does not curl `docs/install.md` or any other URL from the README — the
  task forbids network access.
- It does not fabricate capabilities the README does not state (e.g. it does
  not claim a channel is "working" — only that a named binary is or is not on
  PATH, which is the one thing this environment can check honestly).
