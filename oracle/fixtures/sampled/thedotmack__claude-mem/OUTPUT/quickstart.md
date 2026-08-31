# Claude-Mem — Quick Start

Extracted from the "Quick Start" section of the README.

## Install with a single command

```bash
npx claude-mem install
```

## Install for OpenCode

```bash
npx claude-mem install --ide opencode
```

## Install for Antigravity CLI

See the setup guide at https://docs.claude-mem.ai/antigravity-cli/setup.

```bash
npx claude-mem install --ide antigravity
```

## Install from the plugin marketplace inside Claude Code

```bash
/plugin marketplace add thedotmack/claude-mem

/plugin install claude-mem
```

After installing, restart Claude Code. Context from previous sessions will
automatically appear in new sessions.

> **Note:** Claude-Mem is also published on npm, but `npm install -g claude-mem`
> installs the SDK/library only — it does not register the plugin hooks or set
> up the worker service. Always install via `npx claude-mem install` or the
> `/plugin` commands above.

## OpenClaw Gateway install

Install claude-mem as a persistent memory plugin on OpenClaw
(https://openclaw.ai) gateways with a single command:

```bash
curl -fsSL https://install.cmem.ai/openclaw.sh | bash
```

The installer handles dependencies, plugin setup, AI provider configuration,
worker startup, and optional real-time observation feeds to Telegram,
Discord, Slack, and more. See the OpenClaw Integration Guide
(https://docs.claude-mem.ai/openclaw-integration) for details.

## System Requirements (as listed in the README)

- Node.js: 20.0.0 or higher
- Claude Code: latest version with plugin support
- Bun: JavaScript runtime and process manager (auto-installed if missing)
- uv: Python package manager for vector search (auto-installed if missing)
- SQLite 3: for persistent storage (bundled)

## Windows Setup Note

If you see:

```powershell
npm : The term 'npm' is not recognized as the name of a cmdlet
```

Make sure Node.js and npm are installed and added to PATH. Download the
latest Node.js installer from https://nodejs.org and restart the terminal
after installation.
