# Platform Support Matrix

This is a reference table of what should work immediately after setup versus
what requires an explicit configuration step, organized by destination. Two
questions are asked of every row: (a) what is usable with zero configuration,
and (b) what does an additional configuration step unlock.

## Zero-configuration destinations

These should work the moment the capability layer is set up, with no login
and no key.

| Destination | What's usable out of the box |
|---|---|
| Generic web pages | Read any URL as clean text (not raw HTML) |
| YouTube | Transcript/subtitle extraction, plus video search |
| RSS / Atom feeds | Read and parse any feed URL |
| V2EX | Hot posts, node-scoped posts, post detail + replies, user info |
| Xueqiu (stock/finance forum) | Quotes, stock search, hot posts, hot-stock rankings |

## Configure-to-unlock destinations

These have no fully anonymous path, or unlock meaningfully more once a
credential or login step is completed.

| Destination | Zero-config capability | What configuration adds |
|---|---|---|
| Full-web semantic search | none built-in | Full semantic search across the web (auto-configured via an MCP connector, no paid key required) |
| GitHub | Read public repos, search | Private repos, filing issues/PRs, forking |
| Twitter/X | Read a single tweet by link | Search, timeline browsing, reading long-form posts |
| A video platform with strict anti-bot defenses (case study below) | Search + video detail via a dedicated CLI, no login required | Subtitle extraction (needs an additional login-backed tool) |
| Reddit | **None** — the anonymous API path is blocked outright | Search plus reading posts and comments, via either a desktop browser-session tool or a cookie-based CLI |
| Facebook | none | Search, home feed, group listing — via a desktop tool that reuses an existing browser session |
| Instagram | none | User search, profile, a user's recent posts, explore feed — same browser-session approach |
| A cookie-gated content-discovery platform (login required to view anything) | none | Search, reading, comments — either via a desktop tool reusing an existing browser session, or via a manually exported cookie |
| LinkedIn | Public pages via a generic web reader | Full profile detail, company pages, job search |
| A podcast platform | none | Audio-to-text transcription (via a free-tier speech-to-text key) |

## Reading the "no zero-config path" rows honestly

Reddit is the sharpest example: the table above states plainly that there is
**no** anonymous route — the platform's anonymous API surface has been closed
off, and the official API is behind an approval process that most individual
users won't clear. The only paths that work require either (a) a desktop
browser session that is already logged in, reused in place, or (b) a
credential the user exports by hand. Neither of those is "zero
configuration," and the matrix should not pretend otherwise by burying it in
a footnote — a destination with a real access barrier gets marked with
**none**, not with an asterisk.

The same honesty applies to the cookie-gated discovery platform and to
Facebook/Instagram: all three rows above read "none" in the zero-config
column, and all three require reusing a session the user already established
themselves. Nothing here performs a login on the user's behalf, and nothing
here reads a browser's stored session without the user's own tool having put
it there first.

## Case study: a backend can be revoked entirely, not just degraded

One destination in the table above (the video platform with strict anti-bot
defenses) illustrates a fallback failure mode worth naming: the general
downloader tool that used to also serve this platform was blocked outright by
that platform's anti-scraping system (observed returning an HTTP 412 rejection
on every attempt). The fix was not "retry harder" — it was demotion to
retired status for that platform specifically, and promotion of a
purpose-built CLI (with no login requirement) as the new first choice, with a
generic browser-session tool and a plain search API kept as further
fallbacks.

The lesson that generalizes: a backend being *good enough for platform A* is
not evidence it will keep working for platform A once that platform tightens
enforcement, and it is definitely not evidence it will keep working for a
different platform B just because both used to share the same generic tool. A
routing table has to be able to represent "this specific pairing of tool and
destination is now dead," not just "this tool is generally healthy or
unhealthy."
