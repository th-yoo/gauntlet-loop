# Troubleshooting

If you experience issues, describe the problem to Claude — the troubleshoot
skill will automatically diagnose and provide fixes.

## Windows: `npm` not recognized

```powershell
npm : The term 'npm' is not recognized as the name of a cmdlet
```

Make sure Node.js and npm are installed and added to your PATH. Download the
latest Node.js installer from nodejs.org and restart your terminal after
installation.

## The npm global install trap

`npm install -g claude-mem` installs the SDK/library only — it does not
register the plugin hooks or set up the worker service. If context is not
appearing across sessions, confirm installation happened via `npx
claude-mem install` or the `/plugin marketplace add` + `/plugin install`
commands, not via a bare global npm install.

## After changing configuration

Restart the host application (Claude Code, etc.) after changing the
`CLAUDE_MEM_MODE` setting for the change to take effect.

## Generating a Bug Report

```bash
cd ~/.claude/plugins/marketplaces/thedotmack
npm run bug-report
```

## Where to Get Further Help

- GitHub Issues, for filing a bug
- The official Discord, for community support
- The official documentation site, for guides not covered here
