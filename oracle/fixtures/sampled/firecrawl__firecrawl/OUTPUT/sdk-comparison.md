# SDK Comparison

Nine language surfaces are documented, all covering roughly the same four
operations (scrape, agent, crawl, search), with one omission worth noting
below.

| Language | Install | Client construction | Notes |
|---|---|---|---|
| Python | `pip install firecrawl-py` | `Firecrawl(api_key="fc-...")` | Reference examples throughout use this SDK; supports `formats=["markdown"]` on scrape. |
| Node.js | `npm install firecrawl` | `new Firecrawl({ apiKey: 'fc-...' })` | `crawl`'s returned docs use `sourceURL` (capital URL) in metadata, unlike Python's `source_url`. Search results nest under `results.data.web`. |
| Go | `go get github.com/firecrawl/firecrawl/apps/go-sdk` | `firecrawl.NewClient(option.WithAPIKey("fc-..."))`, or reads `FIRECRAWL_API_KEY` from the environment if no key is passed | Explicit `context.Context` on every call; options are typed structs (`ScrapeOptions`, `CrawlOptions`, `SearchOptions`); `Limit` takes a `*int` via a `firecrawl.Int(...)` helper. |
| Java | Gradle/Maven dependency, `com.github.firecrawl:firecrawl-java-sdk` via JitPack | `new FirecrawlClient(apiKey, null, null)` | Agent is two calls: `createAgent(...)` to start, then `getAgentStatus(id)` to fetch the result — the only SDK shown with an explicit start/poll split for Agent in the example code. |
| Elixir | `{:firecrawl, "~> 1.0"}` | no client object — module functions instead (`Firecrawl.scrape_and_extract_from_url`, `Firecrawl.crawl_urls`, `Firecrawl.search_and_scrape`, `Firecrawl.map_urls`) | Every call returns `{:ok, response}`; function names differ noticeably from the other SDKs' `scrape`/`crawl`/`search`/`map`. No Agent example shown. |
| Rust | `firecrawl = "2"` (crate), plus `tokio` with `macros`/`rt-multi-thread` features | `Client::new("fc-YOUR_API_KEY")?` | Async via `tokio`; `client.scrape(url, None)` takes an `Option` for settings. No Agent example shown. |
| Ruby | `gem install firecrawl-sdk` | `Firecrawl::Client.new(api_key: "fc-...")` | Options are explicit model objects, e.g. `Firecrawl::Models::ScrapeOptions.new(formats: ["markdown"])`. |
| .NET | `dotnet add package firecrawl-sdk` | `new FirecrawlClient("fc-YOUR_API_KEY")` | Async/await throughout (`ScrapeAsync`, `CrawlAsync`, `SearchAsync`); `Formats` takes `List<object>`. No Agent example shown. |
| PHP | `composer require firecrawl/firecrawl-sdk` | `FirecrawlClient::create(apiKey: 'fc-...')` | Named-argument style construction (`ScrapeOptions::with(formats: [...])`); metadata access via array indexing (`getMetadata()['sourceURL']`). |

## What's consistent across all of them

- Every SDK's examples handle **polling for async operations automatically**
  — you call `crawl` (or the language's equivalent) and get back completed
  data, rather than manually checking job status the way the raw cURL
  example for Crawl requires.
- Every SDK example scrapes to markdown by default or via a `formats`
  option containing `"markdown"`.

## What's inconsistent (check before assuming parity)

- **Agent examples are shown only for Python, Node.js, Go, Java, and Ruby.**
  Elixir, Rust, .NET, and PHP examples in this material cover scrape,
  crawl, search (and, for Elixir, map) but do not include an Agent call —
  that gap is in the example set, not necessarily a statement about
  feature availability.
- **Metadata field casing differs by language convention**: `source_url`
  (Python, snake_case) vs. `sourceURL` (Node.js/Java/PHP, camelCase-ish
  original API casing) vs. no field example at all in some SDKs.
- Java's Agent flow is explicitly two calls (start, then poll status);
  no other SDK's example shows that split for Agent specifically, though
  the general claim above is that SDKs "handle polling automatically" —
  worth verifying directly rather than assuming Java's Agent polls
  silently elsewhere in that SDK.
