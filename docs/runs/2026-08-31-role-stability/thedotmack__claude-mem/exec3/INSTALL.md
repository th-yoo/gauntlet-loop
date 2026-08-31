# Installation

## Quick Start

Install with a single command:

```bash
npx claude-mem install
```

Or install for OpenCode:

```bash
npx claude-mem install --ide opencode
```

Or install for Antigravity CLI (see the Antigravity CLI setup guide in the
official documentation):

```bash
npx claude-mem install --ide antigravity
```

Or install from the plugin marketplace inside Claude Code:

```bash
/plugin marketplace add thedotmack/claude-mem

/plugin install claude-mem
```

After installing, restart Claude Code. Context from previous sessions will
automatically appear in new sessions.

> **Note:** The package is also published on npm, but `npm install -g
> claude-mem` installs the SDK/library only — it does not register the
> plugin hooks or set up the worker service. Always install via `npx
> claude-mem install` or the `/plugin` commands above.

## OpenClaw Gateway

Install as a persistent memory plugin on OpenClaw gateways with a single
command:

```bash
curl -fsSL https://install.cmem.ai/openclaw.sh | bash
```

The installer handles dependencies, plugin setup, AI provider configuration,
worker startup, and optional real-time observation feeds to Telegram,
Discord, Slack, and more. See the OpenClaw Integration Guide in the official
documentation for details.

## Windows Setup Notes

If you see an error like:

```powershell
npm : The term 'npm' is not recognized as the name of a cmdlet
```

Make sure Node.js and npm are installed and added to your PATH. Download the
latest Node.js installer from nodejs.org and restart your terminal after
installation.

## Auto-Installed Dependencies

Two dependencies are auto-installed if missing:

- **Bun** — the JavaScript runtime and process manager used to run the
  worker service.
- **uv** — the Python package manager used for vector search.

SQLite 3 is bundled and requires no separate installation.
