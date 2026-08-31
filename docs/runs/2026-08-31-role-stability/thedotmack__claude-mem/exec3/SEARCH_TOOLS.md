# MCP Search Tools

Memory search is exposed through **4 MCP tools** following a token-efficient
**3-layer workflow pattern**.

## The 3-Layer Workflow

1. **`search`** — Get a compact index with IDs (roughly 50–100 tokens per
   result).
2. **`timeline`** — Get chronological context around interesting results.
3. **`get_observations`** — Fetch full details ONLY for the filtered IDs
   (roughly 500–1,000 tokens per result).

Working this way (index first, then filter, then fetch full detail) yields
roughly a **10x token savings** compared to fetching full details up front.

## Available MCP Tools

1. **`search`** — Search the memory index with full-text queries; supports
   filters by type, date, and project.
2. **`timeline`** — Get chronological context around a specific observation
   or query.
3. **`get_observations`** — Fetch full observation details by ID (always
   batch multiple IDs in a single call rather than calling once per ID).

Note: the workflow above lists three tools used in the three layers; a
fourth MCP tool is also provided as part of the full search-tool surface,
beyond the three that appear in the 3-layer example.

## Example Usage

```typescript
// Step 1: Search for index
search(query="authentication bug", type="bugfix", limit=10)

// Step 2: Review index, identify relevant IDs (e.g., #123, #456)

// Step 3: Fetch full details
get_observations(ids=[123, 456])
```

## Practical Guidance

- Start broad with `search` to build an index rather than fetching details
  immediately.
- Use `timeline` when you need to understand what else was happening around
  a specific observation, not just the observation in isolation.
- Reserve `get_observations` for IDs you have already filtered down to —
  batch multiple IDs into one call.
- Citations to past observations can be made by ID, either through the
  worker API or by browsing the web viewer.
