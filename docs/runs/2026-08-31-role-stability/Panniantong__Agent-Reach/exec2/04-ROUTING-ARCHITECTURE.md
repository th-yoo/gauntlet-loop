# Architecture: Ordered Backends per Platform

## The core mechanism

Each supported platform is represented as its own small module, and each
module holds an **ordered list of candidate backends**: a first choice, then
one or more fallbacks. A per-platform health check actually probes each
candidate in order (not merely checking whether a command exists on the
system) and selects the first one that is genuinely working end to end. If
the first choice is broken, the module reports what is broken and what would
fix it, and falls through to the next candidate.

Swapping which backend a platform uses is therefore a matter of **re-ordering
a list**, not rewriting an integration — which is the mechanism that is
claimed to make the whole thing durable against any one upstream tool
breaking or a platform tightening its defenses. The reading/searching work
itself is always done by the agent invoking the winning upstream tool
directly; the module's job stops at selecting and verifying that path.

## The current ordering, platform by platform

| Platform | 1st choice | 2nd choice | 3rd choice |
|---|---|---|---|
| Web pages | Reader service (Jina Reader) | — | — |
| Twitter/X | A dedicated Twitter CLI | Browser-automation tool (login-session reuse) | A third client, listed as a further fallback |
| YouTube | A well-known open-source downloader (yt-dlp) | — | — |
| GitHub | The official `gh` CLI | — | — |
| Bilibili | A Bilibili-specific CLI | Browser-automation tool | A plain search API |
| Reddit | Browser-automation tool (desktop, login-session reuse) | A dedicated Reddit CLI (cookie-based) | — |
| Facebook | Browser-automation tool (desktop Chrome session reuse) | — | — |
| Instagram | Browser-automation tool (desktop Chrome session reuse) | — | — |
| Xiaohongshu | Browser-automation tool (existing session only) | A dedicated MCP tool | A legacy CLI |
| LinkedIn | A dedicated LinkedIn MCP server | Reader service (Jina Reader) | — |
| RSS/Atom | A standard feed-parsing library | — | — |
| Web-wide search | Exa, via an MCP launcher | — | — |

## Why each first choice was picked (stated rationale)

- **Web pages** — free, no API key required.
- **Twitter/X** — the dedicated CLI tested as the more stable option for
  search; the browser-automation fallback exists for when that breaks,
  since it reuses an existing login session as a backstop.
- **Reddit** — there is no zero-config path at all: the anonymous endpoint is
  blocked and the official API requires an approval process, so a
  login-session route is the only route, full stop.
- **Facebook** — official Graph/Groups API access has tightened, so a
  real browser session is described as the currently practical path.
- **Instagram** — unofficial scraping-style approaches are described as
  unstable; the browser-automation route is preferred because it rides on a
  genuine browser session rather than emulating one.
- **YouTube** — a widely used, heavily starred open-source project, still
  considered the best option, but explicitly *no longer* used for Bilibili.
- **Bilibili** — the same YouTube downloader that used to also serve
  Bilibili was blocked by that platform's anti-scraping defenses (HTTP 412,
  observed in real testing), so the Bilibili-specific CLI was promoted to
  first choice; it needs no login for search or read.
- **Web-wide search** — an AI-native semantic search provider, connected via
  an MCP launcher, free with no key required.
- **GitHub** — the official CLI, giving full API capability once
  authenticated.
- **RSS** — the standard choice in the Python ecosystem for this purpose.
- **Xiaohongshu** — the browser-automation route is preferred specifically
  because it only ever uses a session the user already has open; the other
  backends require a manually exported cookie instead.
- **LinkedIn** — an MCP service that does its own browser automation.

## Historical churn this design is meant to absorb

Two concrete instances of the underlying access landscape shifting are
called out directly:

1. A cohort of single-platform CLI tools stopped being maintained all at
   once; the response was to change which backends the affected platforms
   route through, not to redesign the platform modules themselves.
2. The general-purpose video downloader that previously also covered
   Bilibili got fully blocked by that platform's anti-scraping controls;
   the fix was promoting the Bilibili-specific CLI to first choice, with
   zero action required from anyone already using the capability layer.

The selections above are explicitly framed as a snapshot from periodic
re-testing against the real platforms, not a permanent commitment — the
diagnostic command is the source of truth for which backend is in use *right
now*, not this table.
