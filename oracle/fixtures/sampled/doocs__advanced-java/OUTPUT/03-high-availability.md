# High-Availability Architecture

### Q: What is Hystrix, and what problem does it solve?

Hystrix is a library for wrapping calls to remote services (or anything
that can fail/be slow) so a single failing dependency can't take down the
caller. The core failure mode it prevents is **cascading failure**: if
Service A calls slow-or-down Service B synchronously without protection,
A's threads pile up waiting on B, A's own thread pool exhausts, and A
becomes unresponsive to *its* callers too — one slow dependency ends up
taking the whole call graph down with it. Hystrix wraps each dependency
call in a `Command` that runs under **resource isolation** (its own
thread pool or a semaphore), a **timeout**, and a **circuit breaker**, and
falls back to a default/degraded response instead of letting the failure
propagate.

### Q: Walk through an example: an e-commerce product-detail page's architecture.

A product page is a good illustration of *why* isolation matters, because
it aggregates several independent, differently-reliable backend services
into one page: pricing, inventory, reviews, recommendations, shipping
estimate, marketing promos. Each is called through its own Hystrix
command with its own thread pool. If the recommendations service is slow,
only the recommendations widget times out and falls back to
"recommendations unavailable" — pricing, inventory, and the rest of the
page still render normally, because they run on separate thread pools
that the recommendations slowdown can't touch. Without per-dependency
isolation, one slow, non-critical widget could exhaust a shared thread
pool and blank the entire page, including the parts customers actually
need (price and add-to-cart).

### Q: How does thread-pool isolation work, and how is it different from semaphore isolation?

**Thread-pool isolation**: each dependency gets its own bounded thread
pool; the calling thread hands off the actual remote call to a worker in
that pool and waits (with a timeout) for it to finish. Because each
dependency has a *separate* pool, one dependency saturating its pool
cannot starve threads belonging to another dependency, and a timeout can
actually **interrupt** a call that's still running on the worker thread
even if the underlying network call itself doesn't time out on its own.
Cost: a thread hand-off per call (CPU/scheduling overhead), which matters
at very high QPS.

**Semaphore isolation**: no thread hand-off — the calling thread executes
the dependency call directly, but only after acquiring a permit from a
counting semaphore sized to that dependency; once the configured number
of concurrent calls is in flight, further calls are rejected immediately
rather than queued. Much lower overhead (no extra thread), but it cannot
enforce a true timeout on a call that's already hung inside the caller's
own thread — you're isolating *concurrency*, not isolating *latency*.

**When to use which**: thread-pool isolation for anything that can be
slow/unreliable (most network calls) since you get real timeout
enforcement; semaphore isolation for extremely high-volume,
already-low-latency, in-process-ish calls where the thread-hop overhead
would itself become the bottleneck.

### Q: What does "fine-grained isolation strategy control" mean in Hystrix?

It means isolation is configured **per command group / per dependency**,
not globally — you size each thread pool (or semaphore permit count)
according to that specific dependency's actual traffic and latency
profile, rather than sharing one pool across every downstream call.
A high-volume, low-latency dependency and a low-volume, occasionally-slow
one have very different right-sized pool configurations, and putting them
in the same pool means the slow one can still starve the fast one — fine
granularity is what actually delivers the "one failure can't sink
everything" property, not isolation in the abstract.

### Q: What actually happens inside Hystrix when a command executes?

Roughly: check whether the circuit is already open (short-circuit to
fallback immediately if so) → check the request cache (return cached
result if this exact request was already served in this request context)
→ check the semaphore/thread-pool for available capacity (reject to
fallback if exhausted) → execute the underlying call under a timeout →
on success, record it, and if configured, cache the result and publish it
to the request-collapser/batching layer → on failure/timeout/rejection,
increment the circuit breaker's failure metrics and invoke the configured
fallback. Every step publishes metrics (success/failure/timeout/rejection
counts) that both the dashboard and the circuit breaker's own health
calculation consume.

### Q: What is request-cache-based optimization, and how does it help something like a batch product-data lookup?

Within a single user request's execution context, multiple code paths
often ask for the same piece of data more than once (e.g., three
different widgets on a page each need the same product's base info).
Hystrix's request cache memoizes a command's result by its
cache key for the lifetime of that single incoming request, so the second
and third callers get the cached result instantly instead of re-issuing
the same downstream call — this doesn't reduce load across different
users' requests, only redundant calls *within* one request/response
cycle, but for pages that fan out into many small dependent calls that
redundancy is often substantial.

### Q: What is a local-cache-based fallback ("degrade to local cache")?

When a remote dependency's circuit is open (or the call fails/times out),
instead of returning an empty/error response, the fallback method serves
the **last known good value from a local, in-process cache** that was
populated on a previous successful call. This trades freshness for
availability: users see slightly stale data (e.g., yesterday's
recommendation list) instead of a broken page — an acceptable trade for
non-critical, slowly-changing data, and a much better user experience
than an error or blank widget.

### Q: Explain the circuit breaker's internal state machine.

Three states:

- **Closed** (normal): calls pass through; the breaker tracks a rolling
  window of success/failure counts.
- **Open**: once the failure rate in the rolling window crosses a
  threshold (and a minimum request-volume floor is met, so a handful of
  failures on low traffic doesn't trip it prematurely), the breaker trips
  open — every call for a configured sleep window is short-circuited
  straight to the fallback, without even attempting the real call. This
  is the mechanism that actually stops cascading failure: it stops
  hammering an already-struggling dependency and stops burning the
  caller's own capacity waiting on calls likely to fail anyway.
- **Half-Open**: after the sleep window elapses, the breaker lets a single
  trial call through. If it succeeds, the breaker closes and resumes
  normal traffic; if it fails, the breaker reopens and the sleep window
  restarts.

### Q: How do Hystrix's thread-pool isolation and rate limiting work together?

Thread-pool sizing *is* a form of concurrency-based rate limiting: a pool
of size N means at most N concurrent calls to that dependency regardless
of how much demand arrives, and the (bounded, typically small or
zero-length) queue in front of it means excess demand is rejected fast
(fail-fast, feeding the fallback) rather than queued indefinitely and
timing out slowly. Pool size is chosen from the dependency's
measured `p99 latency x desired throughput` (Little's Law) — the
same math used to size any bounded worker pool — so the pool itself
functions as the rate limit **for that dependency specifically**, without
needing a separate global limiter to protect it from overload.

### Q: What is a timeout-based safety mechanism, and why is it necessary even with thread/semaphore isolation?

Isolation bounds *how many* concurrent calls can be in flight to a
dependency; it doesn't bound *how long* any one of them takes. Without an
explicit timeout, a dependency that hangs (not fails — hangs) will
eventually occupy every permit/thread in its pool one call at a time,
which is functionally the same outcome as no isolation at all, just
delayed. A configured timeout (set from the dependency's normal p99, with
margin — not an arbitrary round number) guarantees every call vacates its
resource slot within a bounded time, which is what actually makes the
pool-sizing math above hold in practice.

### High-Availability Systems

### Q: How would you design a highly-available system overall?

- **Eliminate single points of failure** at every layer — redundant load
  balancers, multi-instance stateless app tier, replicated
  database/cache, multi-AZ or multi-region where the business justifies
  the cost.
- **Isolate failures** so one dependency's outage doesn't propagate (the
  Hystrix pattern above, generalized to every external call: timeout +
  bulkhead isolation + circuit breaker + fallback).
- **Rate-limit and shed load** at the edge before internal capacity is
  exhausted, rather than letting every layer discover overload
  independently and fail messily.
- **Automate failover** (leader election / health-check-driven traffic
  shifting) so recovery doesn't depend on a human noticing and acting
  within the SLA window.
- **Design for graceful degradation**: define, per feature, what it
  degrades to when its dependency is unavailable (cached/stale data,
  a simplified response, or an explicit "temporarily unavailable" for
  that widget only) rather than an undefined failure that takes the whole
  request down.
- **Practice the failure**: chaos-engineering-style fault injection
  (kill an instance, black-hole a dependency) in a non-prod (or carefully
  scoped prod) environment is the only way to confirm the isolation
  boundaries actually hold under real conditions rather than in theory.

### Rate Limiting

### Q: How do you implement rate limiting, and how would you actually build it?

Common algorithms, in order of sophistication:

- **Fixed window counter**: count requests in the current time bucket
  (e.g. per second), reject once the limit is hit, reset at the boundary.
  Simple, but allows up to 2x the limit in a short window straddling the
  boundary (burst right before and right after a reset).
- **Sliding window log/counter**: track request timestamps (or weighted
  counts across the current and previous fixed windows) so the boundary
  problem above is smoothed out — more accurate, slightly more
  bookkeeping.
- **Leaky bucket**: requests enter a fixed-size queue and are processed
  (leaked) at a constant rate; excess requests overflow and are dropped.
  Produces a perfectly smooth output rate, at the cost of not allowing any
  burst at all.
- **Token bucket**: tokens accumulate at a fixed rate up to a cap; a
  request consumes one token and is allowed if one is available. Allows
  controlled bursts (up to the bucket size) while still bounding the
  long-run average rate — generally the preferred algorithm for API rate
  limiting because it tolerates natural burstiness without letting the
  long-term rate exceed the limit.

Real-world implementation: for a single instance, a `Guava RateLimiter`
(token bucket) is enough; for a distributed rate limit shared across many
app instances, the counter has to live somewhere shared — a Redis
`INCR` + `EXPIRE` per window (fixed window) or a Redis Lua script
implementing token-bucket/sliding-window logic atomically (so
check-and-increment doesn't race across concurrent requests from
different app instances).

### Circuit Breaking

### Q: What does circuit breaking mean in general, what frameworks implement it, and how do you choose between Sentinel and Hystrix?

Circuit breaking, generalized beyond Hystrix specifically, is the pattern
already described above: monitor a dependency's error rate, and stop
sending it traffic once it crosses a threshold, so the caller fails fast
instead of waiting on calls likely to fail, and the struggling dependency
gets relief instead of pile-on load — both sides benefit.

**Sentinel vs. Hystrix, as a technology choice:**
- **Hystrix** is thread/semaphore-isolation-first, per-command
  configuration, and — importantly — is in maintenance mode (Netflix
  moved on); still fine for existing systems, a weaker default for new
  ones.
- **Sentinel** models flow control more richly (QPS-based, concurrent-thread-based,
  and system-adaptive-load-based rules, plus "hot spot" per-parameter
  limiting), separates rule configuration from code (rules can be pushed
  dynamically from a console/config-center without redeploying), and is
  actively maintained.
- **Practical guidance**: for a new system, Sentinel's richer rule model
  and dynamic configuration generally outweigh Hystrix's simplicity and
  larger historical adoption; for an existing Hystrix-based system that
  isn't in active pain, "in maintenance mode" alone usually isn't enough
  reason to force a migration — evaluate against the actual gap (e.g. "we
  need dynamic rule pushes without redeploy" is a real reason; "it's
  newer" is not).

### Degradation

### Q: What does "degradation" mean, and how do you implement it?

Degradation is a deliberate, usually manually-or-automatically-triggered
decision to **turn off or simplify non-critical functionality** to
protect the critical path during overload or a dependency outage — it's
the same fallback concept from the circuit-breaker section, but applied
proactively as a capacity-management lever rather than only reactively on
failure. Implementation is typically a **feature-flag/switch system**
(often backed by a config center pushing changes without redeploy) that
each non-critical code path checks before doing expensive/optional work —
e.g., disable personalized recommendations and serve a static popular-items
list during a flash-sale traffic spike, freeing that capacity for
checkout and payment, which is the path that actually matters to revenue
and cannot be degraded.
