# Which Endpoint Do I Need?

A decision guide across the full endpoint surface: Search, Scrape, Interact,
Agent, Crawl, Map, and Batch Scrape.

## Start here

1. **Do you already know every URL you need, and there's a small, fixed
   number of them (one to a few dozen)?**
   - One URL → **Scrape**.
   - A short known list → **Batch Scrape** (scrape many URLs asynchronously
     in one request instead of looping over Scrape calls).
   - No — go to 2.

2. **Do you know the site but not which pages on it?**
   - You want the pages' *content* → **Crawl** (walks an entire site and
     returns content for every page found, up to a `limit`; returns a job
     ID you poll, or the SDKs poll for you).
   - You only want the *list of URLs* (fast, no content extraction) →
     **Map** (optionally with a `search` term to order URLs by relevance to
     a keyword, e.g. `search="pricing"`).

3. **Do you not know the site at all — just a topic or question?**
   - You want links plus their page content → **Search**.
   - You want a synthesized answer (not raw pages) and are willing to let
     an AI agent navigate and figure out the URLs itself → **Agent**.

4. **Do you need to act on a page (click, type, scroll, wait) before the
   data you want is visible** (e.g. content behind a search box or a
   multi-step flow)? → **Scrape** the page first, then use **Interact**
   with a natural-language prompt describing the action, repeating as
   needed for multi-step flows.

## Endpoint summary

| Endpoint | Input | Output | When |
|---|---|---|---|
| Search | a query string | list of `{url, title, markdown}` | you have a topic, not a URL |
| Scrape | one URL | markdown / HTML / JSON / screenshot | you have exactly the page you want |
| Interact | a `scrape_id` + prompt | `{success, output, liveViewUrl}` | the page needs clicking/typing first |
| Agent | a prompt (URLs optional) | synthesized result + `sources` | you want an answer, not pages, and don't need to name URLs |
| Crawl | a starting URL + `limit` | job ID, then array of page docs | you want content from a whole site |
| Map | a URL (+ optional `search`) | array of `{url, title, description}` | you want the URL list only, fast |
| Batch Scrape | a list of URLs | array of docs, one per URL | you already have several known URLs |

## Agent is not Search or Crawl

Agent is described as the evolution of an older `/extract` endpoint — it is
faster, more reliable, and specifically does **not** require knowing URLs
upfront, which is what separates it from Search (which still returns pages
you inspect yourself) and Crawl (which requires a starting URL). Agent can
optionally be pointed at specific URLs to narrow its focus, and it can
return either freeform text or data shaped to a schema you supply (e.g. a
Pydantic model), with `result.data` populated from that schema on success.

## Picking an Agent effort/model

Agent takes either `effort` (`low`, `medium`, `high`) or the older `model`
parameter (`spark-1-mini`, `spark-1-pro`, `spark-2`) — never both in the
same request; sending both is rejected with a 400 error. If neither is
given, the request runs on `spark-1-pro`. All three `effort` levels run on
the newer `spark-2` model; `effort` selects a reasoning budget on top of
that model, it does not select among models the way `model` does.

Rule of thumb:
- Single site, simple lookup → `effort="low"` (or the legacy default,
  `spark-1-pro`, if you're not using `effort`).
- A handful of pages, a few steps → `effort="medium"`.
- Multi-site comparison, complex or gated navigation, or data where
  accuracy really matters → `effort="high"`, or the legacy `spark-1-pro`
  for the same class of task.
- Cost-sensitive, high-volume, simple tasks → the legacy `spark-1-mini`
  (cheaper than the default, no `effort` equivalent mentioned).
