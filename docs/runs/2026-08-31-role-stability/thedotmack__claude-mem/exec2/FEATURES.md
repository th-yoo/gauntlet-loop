# Feature Checklist

Use this to confirm a given deployment actually has the capabilities you're
counting on, rather than assuming everything below is active by default.

## Memory capture and continuity

- [ ] Context survives across sessions without manual re-explanation
- [ ] Tool-usage observations are captured automatically during a session
- [ ] Observations are compressed into semantic summaries, not stored verbatim
- [ ] Summaries are injected into future sessions automatically
- [ ] Layered ("progressive disclosure") retrieval, so cheap summaries are
      fetched first and expensive full detail is fetched only when needed
- [ ] Token cost of each retrieval layer is visible before it's paid

## Search

- [ ] Natural-language search skill over project history
- [ ] Compact index-style search results (cheap, for scanning many candidates)
- [ ] Chronological "timeline" lookup around a specific result
- [ ] Full-detail fetch for a filtered, specific set of IDs
- [ ] Hybrid semantic + keyword search via a vector database, not keyword-only
- [ ] Citations: past observations can be referenced by ID from the API or
      viewed directly in a web UI

## Operability

- [ ] Web viewer showing a real-time stream of captured memory
- [ ] Local worker service reachable over HTTP, with the URL printed on startup
- [ ] Fully automatic operation once installed — no manual intervention step
- [ ] Optional cloud sync of memories, performed by the worker on write (no
      separate background daemon required for it)
- [ ] Optional real-time observation feeds out to external chat platforms

## Privacy and control

- [ ] A dedicated tag to mark content that should be excluded from storage
- [ ] Fine-grained settings for what context gets injected and how much
- [ ] Configurable AI model, worker port, data directory, and log level

## Not covered by this checklist

The full notification/integration surface, the complete list of supported
agent CLIs, and the exact set of built-in languages beyond the two called out
by name in the source material are tracked here only as single line items
above rather than expanded — enumerating them further would be inventing
detail the source material doesn't actually give.
