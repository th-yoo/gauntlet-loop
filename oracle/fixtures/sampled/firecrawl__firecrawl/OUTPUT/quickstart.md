# Quickstart: Search, Scrape, and Interact with the Web

This is a condensed, task-oriented walkthrough of the three core operations —
Search, Scrape, and Interact — plus the fastest path to getting an API key.

## 0. Get an API key

Sign up at the vendor's website to get an API key (keys are prefixed
`fc-`). A hosted playground is available for trying requests before writing
any code.

## 1. Search — find sources

Search the web and get full page content back, not just links.

```python
from firecrawl import Firecrawl

app = Firecrawl(api_key="fc-YOUR_API_KEY")

search_result = app.search("firecrawl", limit=5)
```

Equivalent shapes exist in Node.js (`app.search("firecrawl", { limit: 5 })`),
cURL (`POST /v2/search` with a JSON body of `query` and `limit`), and a CLI
form (`firecrawl search "firecrawl" --limit 5`).

Expect a list of results, each with `url`, `title`, and `markdown` content
already extracted — no separate fetch step needed.

## 2. Scrape — turn one URL into clean content

```python
from firecrawl import Firecrawl

app = Firecrawl(api_key="fc-YOUR_API_KEY")

result = app.scrape('firecrawl.dev')
```

The same call is available as a Node import, a `POST /v2/scrape` cURL
request, or a CLI invocation (`firecrawl scrape https://...`, with
`--only-main-content` to strip navigation/boilerplate). Output defaults to
clean markdown; JSON, HTML, and screenshots are also selectable via a
`formats` option (see the Python SDK section for the `formats=["markdown"]`
form).

## 3. Interact — act on a page, then extract

Interact re-uses a scrape's session so you can click, type, and navigate
before pulling content:

```python
from firecrawl import Firecrawl

app = Firecrawl(api_key="fc-YOUR_API_KEY")

result = app.scrape("https://amazon.com")
scrape_id = result.metadata.scrape_id

app.interact(scrape_id, prompt="Search for 'mechanical keyboard'")
app.interact(scrape_id, prompt="Click the first result")
```

The pattern is always: scrape first to get a `scrape_id` (Node calls it
`scrapeId`), then issue one or more `interact` calls against that same ID
with a natural-language `prompt` describing the action. A response includes
`success`, a plain-text `output`, and a `liveViewUrl` for watching the
interaction happen. In cURL, this is a two-step call: `POST /v2/scrape` to
get the ID, then `POST /v2/scrape/SCRAPE_ID/interact` with the prompt.

## Choosing between these three

- Don't know the URL yet, only a topic → **Search**.
- Have a specific URL and want its content as markdown/JSON/screenshot →
  **Scrape**.
- Have a page open and need to click, type, or navigate before the content
  you want appears → **Scrape** to open it, then **Interact** to drive it.

## Rate limits, JS, and reliability

No special handling is required on the caller's side for JavaScript-heavy
pages, rotating proxies, or rate limiting — these are handled server-side.
By default, requests respect target sites' `robots.txt` directives; it
remains the caller's responsibility to also respect each site's terms of
use and applicable privacy policies.
