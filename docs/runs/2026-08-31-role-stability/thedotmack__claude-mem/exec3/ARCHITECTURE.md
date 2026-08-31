# Architecture

## How It Works

The system operates automatically, capturing observations of tool usage
during a session, compressing them into semantic summaries, and injecting
relevant context back into future sessions.

**Core Components:**

1. **5 Lifecycle Hooks** — SessionStart, UserPromptSubmit, PostToolUse,
   Stop, SessionEnd. These are implemented across 6 hook scripts.
2. **Smart Install** — A cached dependency checker. It runs as a pre-hook
   script rather than as one of the 5 lifecycle hooks.
3. **Worker Service** — A local HTTP API, managed by Bun, that exposes a web
   viewer UI and search endpoints.
4. **SQLite Database** — Stores sessions, observations, and summaries.
5. **mem-search Skill** — Provides natural language queries over history
   using progressive disclosure.
6. **Chroma Vector Database** — Provides hybrid semantic + keyword search
   for intelligent context retrieval.

## Release Branches

Stable releases ship from `main` and are published to npm.

- `main` — stable, published to npm.
- `core-dev` — source-run branch for early reliability fixes.
- `community-edge` — source-run branch for community integrations.

Only `main` is published to npm; `core-dev` and `community-edge` are run
from source.

## Configuration Storage

Settings are managed in `~/.claude-mem/settings.json`, which is
auto-created with defaults on first run. This file configures the AI model,
worker port, data directory, log level, and context injection settings.

## Modes

Workflow modes and observation language are both controlled by a single
`CLAUDE_MEM_MODE` setting in `~/.claude-mem/settings.json`, e.g.:

```json
{
  "CLAUDE_MEM_MODE": "code--zh"
}
```

Modes are defined in `plugin/modes/`. Locally installed modes can be listed
with:

```bash
ls ~/.claude/plugins/marketplaces/thedotmack/plugin/modes/
```

Built-in modes:

| Mode | Description |
|------------|-------------------------|
| `code` | Default English mode |
| `code--zh` | Simplified Chinese mode |
| `code--ja` | Japanese mode |

Language-specific modes follow the pattern `code--[lang]`, where `[lang]` is
an ISO 639-1 code (e.g. `zh` for Chinese, `ja` for Japanese, `es` for
Spanish). `code--zh` ships built in already, so it needs no additional
installation or plugin update.

Restart the host application after changing the mode configuration.
