# How Memory Search Is Meant To Be Used

The search surface is exposed as four tools, but they're designed to be used in
a specific three-layer order rather than interchangeably, because each layer
trades completeness for token cost.

## Layer 1 — search

Start here. It returns a compact index of matches (roughly 50–100 tokens per
result), filterable by type, date, and project. This is cheap enough to run
broadly and skim.

Example:

```
search(query="authentication bug", type="bugfix", limit=10)
```

## Layer 2 — timeline

Once a result from the index looks relevant, use this to see the chronological
context around it — what happened immediately before and after that
observation — without yet paying for every full record nearby.

## Layer 3 — get_observations

Only after the index and timeline have narrowed things down to specific IDs,
fetch the full detail for exactly those IDs (roughly 500–1,000 tokens per
result). IDs should be batched into a single call rather than fetched one at a
time.

Example:

```
get_observations(ids=[123, 456])
```

## Why the order matters

Skipping straight to full-detail fetches means paying the 500–1,000-token cost
for every candidate instead of only the ones that survive filtering at the
cheap index layer. Used as intended — search, then timeline, then a batched
detail fetch — this workflow is described as achieving roughly a 10x token
savings compared to fetching full details for every candidate directly.

## Practical guidance

- Treat `search` as the default first move for any "what happened with X"
  question about a project's history.
- Reach for `timeline` when a single index hit needs surrounding context to
  make sense, not as a replacement for `search`.
- Only call the full-detail tool for IDs you've already decided matter, and
  send them together rather than one request per ID.
