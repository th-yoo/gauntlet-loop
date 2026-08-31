# Claude-Mem — Overview

Source: the project README (the only material used to build this document).

## What it is

Claude-Mem is a persistent memory compression system built for Claude Code.
It seamlessly preserves context across sessions by:

- automatically capturing tool usage observations,
- generating semantic summaries,
- making them available to future sessions.

This lets Claude maintain continuity of knowledge about a project even after
a session ends or reconnects — the "persistent context across sessions"
capability the project is built around.

- License: Apache License 2.0
- Version shown in the README badge: 13.4.0
- Node.js requirement: >= 20.0.0
- Author: Alex Newman (@thedotmack)
- Also works with OpenCode and the Antigravity CLI, and as an OpenClaw
  gateway plugin, per the Quick Start section.

## Key Features (as listed in the README)

- Persistent Memory — context survives across sessions
- Progressive Disclosure — layered memory retrieval with token cost visibility
- Skill-Based Search — query project history with the mem-search skill
- Web Viewer UI — real-time memory stream at the worker URL printed on startup
- Claude Desktop Skill — search memory from Claude Desktop conversations
- Privacy Control — `<private>` tags exclude sensitive content from storage
- Context Configuration — fine-grained control over what context gets injected
- Automatic Operation — no manual intervention required
- Citations — reference past observations with IDs through the worker API or
  the web viewer
