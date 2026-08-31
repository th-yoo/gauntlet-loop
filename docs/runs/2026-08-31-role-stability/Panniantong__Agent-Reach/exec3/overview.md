# Giving an Agent Eyes on the Internet — Concept Overview

## The problem

An AI agent can already write code, edit documents, and manage a project. But
the moment it is asked to go find something on the live internet, it typically
fails in one of these ways:

- A YouTube link is dropped in front of it and it cannot pull a transcript.
- It is asked what people are saying about a product on Twitter/X, and the
  official search API is paywalled.
- It is pointed at Reddit to check whether anyone else hit the same bug, and
  the request comes back 403 — the server's IP is simply not welcome.
- It is asked to check the sentiment on a product review site that requires a
  login before anything renders.
- It is handed a video-hosting link, and the general-purpose downloader it
  would normally reach for has been blocked wholesale by that platform's
  anti-scraping defenses.
- It is asked to do a broad web search and the only tools available are
  either paid or low quality.
- It fetches a web page and gets back a wall of raw HTML tags instead of
  readable text.
- It can read a public code-hosting repository, but authentication for
  private repos or for filing issues/PRs is fiddly enough that it stalls.
- It is asked to watch a handful of feeds for updates and would otherwise
  need a library installed and glue code written just to do that.

None of these are individually hard. What makes them costly is that **every
platform has its own threshold to cross** — a paid API here, a block to route
around there, a login to establish, a data format to clean up — and an agent
(or the person setting it up) has to hit each of those thresholds separately,
one integration at a time, before it can do anything useful.

## The proposed shape of a fix

The fix is not "build one more scraping tool." It is a **capability layer**:
something that sits one level above any individual implementation and takes
responsibility for:

1. **Selection** — for each destination (a platform, a page, a feed), decide
   which underlying tool is currently the most reliable way to reach it.
2. **Installation** — get that tool and its dependencies in place.
3. **Health-checking** — verify, by actually probing it, that the chosen path
   still works today, not just that the command exists on disk.
4. **Routing** — if the first-choice tool for a destination breaks (a
   platform tightens its anti-bot defenses, an API changes, a project goes
   unmaintained), fall back to the next candidate in an ordered list, without
   the person operating the agent having to notice or intervene.

The layer itself does not do the reading. It decides *how* the reading should
happen and keeps that decision current. The actual fetch, search, or read is
still carried out by the agent calling the underlying tool directly — there is
no additional wrapper process sitting in the data path.

## Why this generalizes rather than being one more integration

The naive version of "give the agent internet access" is to hard-wire one
tool per platform. That fails the moment any single tool goes away, because
the fix has to be re-applied by hand, once per broken integration, forever.

The capability-layer version instead treats "which tool reaches this
platform right now" as a fact to be *measured and kept current*, not a fact
to be hard-coded once. Concretely:

- Every destination is backed by an **ordered list** of candidate backends
  (first choice, then fallback, then a further fallback if needed), not a
  single hard-coded tool.
- Swapping the active backend is a change to *list order*, not a rewrite of
  the calling code.
- A single "doctor" style check walks every destination, actually exercises
  each candidate backend rather than merely checking that a binary exists,
  and reports which one is currently in effect and what's broken if none are.

This is the part that is meant to transfer: the same ordered-fallback +
active-probe pattern is what should be applied to *any* new destination added
later, not just the ones enumerated on day one. A destination with no
fallback candidates (a genuinely single-path integration) is a visible gap in
the list, not a silent one — that gap should be the thing that gets worked on
next, rather than a fact the checklist has learned to look past.

## Explicit non-goals

- It does not claim to make every destination free of login or configuration
  — some destinations (private social feeds, some subscription content)
  fundamentally require a signed-in session, and the honest answer for those
  is "no zero-configuration path exists," not a workaround that pretends
  otherwise.
- It does not claim permanence for any single backend choice. "Current best
  choice" is explicitly a snapshot, expected to be revisited as platforms
  change their defenses and as upstream tools rise or fall in maintenance.
- It does not take on the reading/parsing work itself — it hands the agent a
  working command and gets out of the way.
