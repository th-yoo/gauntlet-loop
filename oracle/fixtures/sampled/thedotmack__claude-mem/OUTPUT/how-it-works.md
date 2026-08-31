# Claude-Mem — How It Works

Extracted from the "How It Works" and "MCP Search Tools" sections of the
README.

## Core Components

1. **5 Lifecycle Hooks** — SessionStart, UserPromptSubmit, PostToolUse, Stop,
   SessionEnd (6 hook scripts total).
2. **Smart Install** — cached dependency checker (a pre-hook script, not a
   lifecycle hook).
3. **Worker Service** — local HTTP API with web viewer UI and search
   endpoints, managed by Bun.
4. **SQLite Database** — stores sessions, observations, summaries.
5. **mem-search Skill** — natural language queries with progressive
   disclosure.
6. **Chroma Vector Database** — hybrid semantic + keyword search for
   intelligent context retrieval.

Full details: https://docs.claude-mem.ai/architecture/overview

## MCP Search Tools

Claude-Mem provides intelligent memory search through 4 MCP tools following
a token-efficient 3-layer workflow pattern:

1. **`search`** — get a compact index with IDs (~50-100 tokens/result).
2. **`timeline`** — get chronological context around interesting results.
3. **`get_observations`** — fetch full details only for filtered IDs
   (~500-1,000 tokens/result).

Workflow: Claude uses MCP tools to search memory, starts with `search` to
get an index, uses `timeline` to see what was happening around specific
observations, then uses `get_observations` to fetch full details for
relevant IDs. This gives roughly 10x token savings by filtering before
fetching details.

### Available MCP Tools

1. `search` — search the memory index with full-text queries, filtered by
   type/date/project.
2. `timeline` — get chronological context around a specific observation or
   query.
3. `get_observations` — fetch full observation details by IDs (always batch
   multiple IDs).

### Example usage (from the README)

```typescript
// Step 1: Search for index
search(query="authentication bug", type="bugfix", limit=10)

// Step 2: Review index, identify relevant IDs (e.g., #123, #456)

// Step 3: Fetch full details
get_observations(ids=[123, 456])
```

See https://docs.claude-mem.ai/usage/search-tools for detailed examples.
