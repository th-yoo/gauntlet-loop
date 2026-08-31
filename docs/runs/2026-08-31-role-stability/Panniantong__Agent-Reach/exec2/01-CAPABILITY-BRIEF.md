# Capability Brief: Giving an Agent Internet Reach

## The problem being solved

An AI agent that can already write code, edit documents, and manage a project
still hits a wall the moment it is asked to go get something from the live
web:

- "Summarize this YouTube tutorial" — it cannot fetch the transcript.
- "See what people are saying about this product on Twitter/X" — the API is
  paywalled.
- "Check Reddit for others hitting the same bug" — anonymous requests get
  403'd; the server IP is blocked.
- "Check the reputation of this product on Xiaohongshu (RedNote)" — the site
  requires a login to view anything.
- "Summarize this Bilibili tech video" — generic downloaders are blocked by
  the platform's anti-scraping controls.
- "Search the web for the latest LLM framework comparisons" — no good search
  option that is both free and high quality.
- "Read this web page" — fetching it back returns a wall of raw HTML, not
  readable text.
- "What does this GitHub repo do, what do the issues say?" — technically
  possible, but the auth setup is fiddly.
- "Watch these RSS feeds for updates" — requires installing a library and
  writing code.

None of these are individually hard. What makes them costly is that **every
platform has its own barrier** — a paid API, a block to route around, a login
session to establish, or messy output that needs cleaning — and an operator
has to rediscover and re-solve each one from scratch.

## The one-line answer

The capability being delivered is a **capability layer**, not another single
tool: something that sits one level above any specific implementation and is
responsible for *selecting, installing, health-checking, and routing* to the
best current backend for each platform. The actual fetching/searching is done
by the agent invoking the upstream tool directly — there is no wrapper
process in between.

Practically, this means:

1. A short instruction is handed to the agent (a one-line "install me" or
   "update me" request).
2. The agent installs a small CLI, checks for the system building blocks it
   needs (a JS runtime, the GitHub CLI, an MCP launcher), and reports what is
   missing.
3. By default, nothing is changed on the system and no config file is
   written — it only *checks* unless explicitly told to make changes.
4. The agent detects whether it is running on a personal machine or a server
   and adjusts its advice (e.g., a paid outbound proxy is only relevant on a
   server, roughly $1/month, and is never needed locally).
5. A small number of platforms work immediately with zero configuration; the
   rest are only activated if the operator names them — nothing that needs a
   login gets touched without being asked for by name.
6. A single diagnostic command reports, per platform, what is reachable, what
   is not, and what backend is currently in use.

## Why this is durable rather than a one-off trick

Individual access methods for any one platform break over time — rate
limits change, anti-bot defenses get stricter, a small CLI project stops
being maintained. The design response to that churn is **not** to hard-code
one access method per platform, but to keep an *ordered list of candidate
backends* per platform ("first choice, then fallback, then fallback").
Swapping to a new access method is a matter of re-ordering that list, not
rewriting the integration. A worked example already baked into the design:
a general-purpose video downloader that used to also work for Bilibili got
blocked by that platform's anti-scraping controls, and the ordering was
updated to prefer a Bilibili-specific CLI instead, first with a fallback to a
browser-automation tool and then to a plain search API — with zero action
required from anyone already using it.

## Bottom line

The stated goal — "read and search Twitter, Reddit, YouTube, GitHub,
Bilibili, Xiaohongshu — one CLI, zero API fees" — is delivered by treating
"internet reach" as an operations problem (pick the best current path per
platform, verify it actually works, keep a fallback, expose a single health
check) rather than a code problem (write one bespoke integration per site
and hope it keeps working).
