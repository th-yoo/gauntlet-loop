# Claude-Mem — Configuration

Extracted from the "Configuration" section of the README.

## Settings file

Settings are managed in `~/.claude-mem/settings.json` (auto-created with
defaults on first run). It configures the AI model, worker port, data
directory, log level, and context injection settings.

Full reference: https://docs.claude-mem.ai/configuration

## Mode & Language Configuration

Claude-Mem supports multiple workflow modes and languages via the
`CLAUDE_MEM_MODE` setting. This option controls both:

- the workflow behavior (e.g. code, chill, investigation), and
- the language used in generated observations.

### How to configure

Edit `~/.claude-mem/settings.json`:

```json
{
  "CLAUDE_MEM_MODE": "code--zh"
}
```

Modes are defined in `plugin/modes/`. List all available modes locally:

```bash
ls ~/.claude/plugins/marketplaces/thedotmack/plugin/modes/
```

### Available modes (as listed in the README)

| Mode | Description |
|------------|-------------------------|
| `code` | Default English mode |
| `code--zh` | Simplified Chinese mode |
| `code--ja` | Japanese mode |

Language-specific modes follow the pattern `code--[lang]`, where `[lang]` is
the ISO 639-1 language code (e.g., `zh` for Chinese, `ja` for Japanese, `es`
for Spanish).

> Note: `code--zh` (Simplified Chinese) is already built in — no additional
> installation or plugin update is required.

### After changing mode

Restart Claude Code to apply the new mode configuration.

## Release Branches

Stable releases ship from `main` and are published to npm. `core-dev` and
`community-edge` are source-run branches for early reliability fixes and
community integrations. See https://docs.claude-mem.ai/branches for the
branch flow and non-stable run instructions.
