# Platform Matrix: What Works Out of the Box vs. What Needs Setup

Six channels are described as active with **zero configuration** immediately
after install. Everything else requires the operator to explicitly name the
platform before any login-based access is enabled — nothing that needs
credentials is turned on silently.

## Works immediately (no configuration)

| Platform | What you get | Underlying approach |
|---|---|---|
| Web pages | Read any web page as clean text instead of raw HTML | A reader service that converts a URL into readable content |
| YouTube | Subtitle/transcript extraction + video search | A well-established open-source downloader |
| RSS / Atom | Read any feed | A standard feed-parsing library |
| Web-wide search | (only after one auto-config step below) | — |
| V2EX | Hot posts, node/category posts, post detail + replies, user info | Direct, no login needed |
| Xueqiu (Chinese stock/social finance site) | Stock quotes, stock search, hot posts, hot-stock rankings | Direct, no login needed |

## Auto-configured on first use (no manual key needed)

| Platform | What unlocks | Notes |
|---|---|---|
| Web-wide semantic search | Full semantic search across the web | Wired up automatically via an MCP connector; the search provider is free and requires no API key |

## Read-only or partial without login; more after configuration

| Platform | Works immediately | Unlocked after "please configure me" | How it's configured |
|---|---|---|---|
| GitHub | Read public repos, search | Private repos, opening issues/PRs, forking | Ask the agent to log in to GitHub |
| Twitter/X | Read a single tweet | Search, timeline browsing, reading long-form posts | Ask the agent to configure Twitter |
| Bilibili | Search + video detail (via a Bilibili-specific CLI, no login) | Subtitles | Ask the agent to configure Bilibili |
| LinkedIn | Public pages via the reader service | Profile detail, company pages, job search | Ask the agent to configure LinkedIn |
| Podcast transcription (Xiaoyuzhou) | — | Audio-to-text transcription via a free speech-to-text key | Ask the agent to configure it |

## Requires login/session; nothing works anonymously

| Platform | Why there's no zero-config path | How it's configured |
|---|---|---|
| Reddit | The anonymous API path is blocked entirely | A desktop browser-automation tool that reuses an existing logged-in browser session, or a dedicated CLI plus a manually exported cookie |
| Facebook | Same constraint | Desktop browser-automation tool reusing the existing Chrome session |
| Instagram | Same constraint | Desktop browser-automation tool reusing the existing Chrome session |
| Xiaohongshu (RedNote) | Requires a logged-in session to view anything | The browser-automation route only ever uses a session the user already has open and controls; nothing logs the user in automatically and no browser cookie is read on the user's behalf. Where no existing session is available, the user exports cookies manually and configures a separate MCP tool or legacy tool instead |

## A note on credential handling that is called out explicitly

- Twitter access accepts **only** cookies the user manually exports via a
  cookie-editor extension — nothing is scraped from the browser automatically.
- A saved Twitter cookie is used **only** so the diagnostic command can report
  whether configuration is complete; actually invoking the underlying
  Twitter CLI still requires the two auth values to be set explicitly in the
  running process's environment.
- For Xiaohongshu specifically: the tool never performs the login itself,
  never reads the browser's Xiaohongshu cookies on its own, and the
  "configure Xiaohongshu cookies" command does not inject a cookie into the
  browser-automation tool or the browser — cookie-based configuration is a
  separate, explicit path used only when no existing logged-in session is
  available.

## Operator takeaway

If the goal is read-only reach into the public web (pages, YouTube, RSS,
GitHub public repos, general search, Bilibili public content), that reach is
available immediately. Anything that requires standing in for a logged-in
human (Reddit, Facebook, Instagram, Xiaohongshu, full Twitter) is opt-in,
named explicitly by the operator, and — per the security guidance in this
brief's companion document — should be done from a secondary/burner account
rather than a primary one.
