# Configuration

Settings are managed in `~/.claude-mem/settings.json`, which is
auto-created with defaults on first run. It configures:

- AI model
- Worker port
- Data directory
- Log level
- Context injection settings

## Mode & Language

The `CLAUDE_MEM_MODE` setting controls both the workflow behavior (e.g.
code, chill, investigation) and the language used in generated
observations.

Edit `~/.claude-mem/settings.json`:

```json
{
  "CLAUDE_MEM_MODE": "code--zh"
}
```

Modes are defined in `plugin/modes/`. List all available modes locally
with:

```bash
ls ~/.claude/plugins/marketplaces/thedotmack/plugin/modes/
```

| Mode | Description |
|------------|-------------------------|
| `code` | Default English mode |
| `code--zh` | Simplified Chinese mode |
| `code--ja` | Japanese mode |

Language-specific modes follow the pattern `code--[lang]`, with `[lang]` an
ISO 639-1 language code (e.g. `zh`, `ja`, `es`). `code--zh` is already
built in, so no additional installation or plugin update is required for
it.

Restart the host application after changing the mode configuration for it
to take effect.

## Privacy Control

Wrap sensitive content in `<private>` tags to exclude it from storage.

## Bug Reports

An automated bug-report generator is available:

```bash
cd ~/.claude/plugins/marketplaces/thedotmack
npm run bug-report
```
