# Persistent Context Across Sessions — Reference Set

This is a condensed reference set for a persistent-memory system that
captures what an agent does during a session, compresses it with AI, and
injects relevant context back into future sessions. It targets Claude Code
by name and states it also works with OpenCode and Antigravity CLI, with an
OpenClaw gateway installer offered separately.

## Contents

- [OVERVIEW.md](OVERVIEW.md) — what it is, key features, core components,
  system requirements, and license.
- [INSTALL.md](INSTALL.md) — the install commands for each supported
  target, the OpenClaw gateway installer, Windows setup notes, and the
  npm-global-install trap.
- [ARCHITECTURE.md](ARCHITECTURE.md) — the lifecycle hooks, worker service,
  database, search skill, vector database, release-branch model, and mode
  configuration.
- [SEARCH_TOOLS.md](SEARCH_TOOLS.md) — the 3-layer MCP search workflow
  (`search` → `timeline` → `get_observations`) and its stated ~10x token
  savings.
- [CONFIGURATION.md](CONFIGURATION.md) — the settings file, mode/language
  configuration, privacy tags, and the bug-report generator.
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — the Windows PATH issue, the
  npm-global-install pitfall, and where to escalate further.
- [SUPPORT_AND_CONTRIBUTING.md](SUPPORT_AND_CONTRIBUTING.md) — support
  channels, the contribution workflow, branch strategy, and license.

## Reading Order

For someone evaluating whether to adopt this for persistent agent memory,
read in this order: OVERVIEW, INSTALL, ARCHITECTURE, SEARCH_TOOLS,
CONFIGURATION. TROUBLESHOOTING and SUPPORT_AND_CONTRIBUTING are reference
material for after adoption.

## Known Gaps in the Source Material

A few claims in the source material are asserted without the supporting
detail that would let a reader verify them independently:

- The MCP search surface is described as "4 MCP tools" but only three tool
  names (`search`, `timeline`, `get_observations`) are ever given; the
  fourth is not named. See SEARCH_TOOLS.md.
- The "~10x token savings" and per-result token-cost ranges (50–100 tokens,
  500–1,000 tokens) are stated as figures without a description of how they
  were measured or under what workload.
- "Auto-installed if missing" is asserted for both Bun and uv, but no
  detail is given on how the auto-install is triggered or what happens if
  it fails (e.g. on a locked-down or offline machine).

These are carried over as open questions rather than resolved, since no
further detail on them exists in the material this reference set was built
from.
