# Overview

This system seamlessly preserves context across sessions by automatically
capturing tool usage observations, generating semantic summaries, and making
them available to future sessions. This enables an agent to maintain
continuity of knowledge about a project even after a session ends or
reconnects.

It is a persistent memory compression system built for Claude Code, and it
also works with OpenCode and the Antigravity CLI.

## Key Features

- **Persistent Memory** — Context survives across sessions.
- **Progressive Disclosure** — Layered memory retrieval with token cost
  visibility.
- **Skill-Based Search** — Query project history with the mem-search skill.
- **Web Viewer UI** — Real-time memory stream at the worker URL printed on
  startup.
- **Claude Desktop Skill** — Search memory from Claude Desktop conversations.
- **Privacy Control** — Use `<private>` tags to exclude sensitive content
  from storage.
- **Context Configuration** — Fine-grained control over what context gets
  injected.
- **Automatic Operation** — No manual intervention required.
- **Citations** — Reference past observations with IDs through the worker
  API or view all in the web viewer.

## Core Components

1. **5 Lifecycle Hooks** — SessionStart, UserPromptSubmit, PostToolUse,
   Stop, SessionEnd (6 hook scripts in total).
2. **Smart Install** — A cached dependency checker that runs as a pre-hook
   script; it is not itself a lifecycle hook.
3. **Worker Service** — A local HTTP API with a web viewer UI and search
   endpoints, managed by Bun.
4. **SQLite Database** — Stores sessions, observations, and summaries.
5. **mem-search Skill** — Natural language queries with progressive
   disclosure.
6. **Chroma Vector Database** — Hybrid semantic + keyword search for
   intelligent context retrieval.

## System Requirements

- Node.js 20.0.0 or higher
- Claude Code, latest version, with plugin support
- Bun (JavaScript runtime and process manager; auto-installed if missing)
- uv (Python package manager for vector search; auto-installed if missing)
- SQLite 3 (bundled) for persistent storage

## License

Licensed under the Apache License 2.0. The stated rationale is that durable
agentic memory should be easy to embed in developer tools, local agents, MCP
servers, enterprise systems, robotics stacks, and production agent harnesses.
The `ragtime/` directory is separately licensed, also under Apache License
2.0.
