# Distributed Systems

## System Decomposition & RPC

### Q: Why split a monolith into services, and could you skip an RPC framework (like Dubbo) and just call over HTTP?

You split when a monolith's independent parts start needing independent
**scaling, deployment cadence, and failure isolation** — a traffic spike in
one module shouldn't force scaling (or risk crashing) the whole
application, and a bug fix in one module shouldn't require redeploying
everything.

You *can* skip a dedicated RPC framework and call over plain HTTP/REST —
plenty of systems do — but you give up, and have to hand-build, what an
RPC framework provides out of the box: service discovery (who's
currently serving this service, and where), client-side load balancing,
connection pooling, a binary serialization format that's cheaper than
JSON-over-text, built-in retry/timeout/circuit-breaking, and often a more
convenient interface-based programming model (call a remote method as if
it were local). The trade is framework coupling and a steeper learning
curve versus HTTP's universality and simplicity.

### Q: How does Dubbo work end-to-end? If the registry center goes down, can services still talk?

At startup, a **provider** registers its address with the **registry**
(e.g. Zookeeper/Nacos); a **consumer** subscribes to the registry for that
service's provider list and gets push notifications when it changes. At
call time the consumer picks a provider from its **locally cached** list
(via a load-balancing strategy), serializes the request, and sends it
directly to the provider over the network — the registry is never in the
data path of an actual RPC call.

So: **yes**, calls keep working if the registry goes down, because
consumers already cached the provider list before the outage. What breaks
is *change propagation* — a provider that goes up or down after the
registry outage won't be reflected in consumers' caches until the registry
recovers, so a genuinely dead provider might keep getting called until the
consumer's own health-check/retry logic notices.

### Q: What serialization protocols does Dubbo support? Describe Hessian's data model, and why is Protobuf the fastest?

Dubbo supports Hessian2 (default), JSON, Kryo, FST, and Protobuf, among
others.

**Hessian**: a compact binary serialization format that's
self-describing (the type information travels with the data, so a generic
deserializer can read it without a pre-shared schema) and cross-language.

**Protobuf** is generally the fastest/smallest because it does the
opposite trade: the schema (`.proto` field numbers and types) is
**compiled ahead of time** into both ends, so the wire format carries
almost no type/field-name metadata — just field-number tags and raw
values using variable-length integer encoding — producing a smaller
payload and a deserializer that doesn't have to infer structure at
runtime. The cost is a build-time step (compiling `.proto` files) and
schema evolution discipline (never reuse a field number).

### Q: What load-balancing and cluster fault-tolerance strategies does Dubbo have? What about dynamic proxying?

**Load balancing** (which provider instance gets this call):
Random (default, weighted by provider capacity), RoundRobin, LeastActive
(prefer the provider currently handling the fewest in-flight requests —
a good proxy for "currently least loaded"), and ConsistentHash (route the
same parameter value to the same provider — useful when a provider keeps
local state/cache keyed by that parameter).

**Cluster fault-tolerance** (what to do when a call fails):
Failover (retry on another provider — the default; fine for idempotent
reads, dangerous for non-idempotent writes), Failfast (fail immediately,
no retry — correct default for non-idempotent operations), Failsafe
(swallow the exception and log — for non-critical calls like audit
logging), Failback (fail now, queue for asynchronous retry later),
Forking (call several providers in parallel, take the first success —
trades extra load for lower tail latency), and Broadcast (call every
provider, used for cache-invalidation-style fan-out).

**Dynamic proxy**: the consumer's local interface stub is generated at
runtime (JDK dynamic proxy or, for higher throughput, Javassist/bytecode
generation) so application code calls the remote interface as if it were
a local Java object, and the proxy transparently handles serialization,
network transport, and unmarshaling the response.

### Q: What is Dubbo's SPI (Service Provider Interface) mechanism?

Dubbo extends Java's built-in SPI (`META-INF/services`) into its own
**Extension mechanism**, adding what plain Java SPI lacks: named lookup
(load one specific implementation by key instead of every implementation
on the classpath), lazy loading (only instantiate the extension actually
requested), IoC-style dependency injection between extensions, and AOP-style
wrapping (`Wrapper` classes that decorate an extension, which is how
cross-cutting features like caching/logging/monitoring get layered onto
core extensions like the protocol or load balancer). It's the plugin
backbone that lets almost every piece of Dubbo — protocol, serialization,
registry, load balancer, cluster strategy — be swapped or extended without
touching Dubbo's own code.

### Q: How do you do service governance, degradation, and retry/timeout with Dubbo?

- **Governance**: a control plane (Dubbo Admin or similar) manages routing
  rules, weight-based traffic shifting (canary releases), and dynamic
  configuration pushed through the registry/config-center without
  redeploying services.
- **Degradation**: `mock`/fallback configuration lets a consumer return a
  default value or invoke local fallback logic when a remote call is
  disabled or failing, instead of propagating the failure to the caller.
- **Retry**: `retries` count on the reference, combined with the Failover
  cluster strategy — only safe for idempotent calls.
- **Timeout**: a per-method or per-service `timeout` bounds how long a
  consumer waits before giving up on a slow provider, which is essential
  for preventing a single slow downstream service from exhausting the
  caller's own thread pool (the classic cascading-failure trigger this
  guide's High-Availability document covers via circuit breaking).

### Q: How would you design an idempotent distributed service interface (e.g., "can't deduct payment twice")?

Every idempotency scheme boils down to: **attach a unique token to the
logical operation, and make the effect conditional on that token not
having been applied yet**, atomically.

- **Client-generated idempotency key** (a UUID the caller generates once
  per logical intent and resends on every retry) recorded in a unique-keyed
  table/Redis entry *in the same transaction* as the side effect, so a
  retry either finds the key already present (and just replays the
  previously-computed response) or applies the effect exactly once.
- **State-machine guard**: `UPDATE account SET balance = balance - ?,
  status='DEDUCTED' WHERE order_id=? AND status='PENDING'` — the
  conditional `WHERE` makes a duplicate call a no-op (0 rows affected)
  instead of a double deduction.
- **Token/ticket pre-issue**: for anti-double-submit forms, the server
  issues a one-time token up front; the actual operation consumes
  (deletes) the token atomically, so a resubmitted request finds no token
  and is rejected.

### Q: How do you guarantee ordering for a distributed service's incoming requests?

Same underlying answer as message-queue ordering: ordering is only
meaningful for a defined sequence key (e.g., all operations on one order
ID), so route/serialize requests for the same key to the same
processing unit — a single-threaded handler, a lock keyed by that ID, or a
message-queue partition keyed by it — and attach a strictly increasing
sequence number or version per key so a receiver can detect and reject
(or reorder-buffer) an out-of-order delivery rather than assuming network
delivery order matches send order (it generally doesn't, across
independent TCP connections/retries).

### Q: How would you design your own RPC framework, roughly like Dubbo?

1. **Interface + dynamic proxy** — caller invokes a local interface;
   a proxy intercepts the call and turns method + arguments into a
   request object.
2. **Serialization** — pick a compact binary codec (Protobuf/Hessian) to
   turn the request/response into bytes.
3. **Transport** — a persistent connection pool over TCP (Netty is the
   usual choice in Java) rather than opening a new connection per call.
4. **Service registry** — providers register on startup; consumers
   subscribe and cache the list, refreshed on registry push (the same
   pattern as Dubbo's design above).
5. **Load balancing + fault tolerance** — pick a provider per call, with a
   pluggable strategy, and a pluggable failure-handling strategy
   (failover/failfast/etc.).
6. **Async request/response correlation** — since one TCP connection is
   multiplexed across many concurrent calls, tag each request with a
   unique ID and match responses back to the waiting caller (typically via
   a `CompletableFuture` keyed by that ID) rather than one call per
   connection.
7. **Cross-cutting concerns as pluggable filters** — timeout, retry,
   tracing/context propagation, and monitoring hooks applied uniformly
   around every call, the same SPI-driven extension point pattern Dubbo
   uses.

### Q: What does the "P" in the CAP theorem mean, and why does it matter?

**P is Partition tolerance** — the system continues operating despite
messages being dropped or arbitrarily delayed between nodes (a network
partition). CAP's actual claim is narrower than "pick 2 of 3" folklore
suggests: **partitions will happen** in any real distributed system (you
don't get to opt out of P), so the real choice CAP forces is, *during* a
partition, whether to sacrifice **C**onsistency (keep serving, possibly
stale/divergent, reads on both sides of the split) or **A**vailability
(refuse to serve on the minority side until the partition heals). Systems
are typically described as CP (e.g. Zookeeper, which refuses to serve
writes without quorum) or AP (e.g. Cassandra/Eureka in default config,
which stays available and reconciles later) based on that choice — not
because they "don't support" the third property outside of a partition.

---

## Distributed Locks

### Q: What are Zookeeper's common use cases?

- **Distributed lock** — via ephemeral sequential znodes.
- **Service registry/discovery** — provider registers an ephemeral node
  under a path; consumers watch the path (this is exactly Dubbo's default
  registry mechanism above).
- **Leader election** — the same ephemeral-sequential-node trick: the
  smallest-sequence node holds leadership, and if it dies, the ephemeral
  node disappears and the next-smallest is promoted.
- **Distributed configuration management** — centralized config pushed to
  all watching clients on change.
- **Distributed coordination/barriers** — e.g. all workers must reach a
  checkpoint znode before proceeding.

### Q: How do you design a distributed lock with Redis vs. Zookeeper — and which is more efficient?

**Redis**: `SET lock_key unique_client_token NX PX 30000` acquires the
lock atomically with an expiry (so a crashed holder doesn't lock everyone
out forever); release is a Lua script that checks the token matches
before deleting (so a client can never release someone else's lock after
its own lease expired). For multi-node reliability, Redlock acquires the
lock against a majority of independent Redis masters. Correctness caveat:
plain Redis locking is not safe against clock/GC-pause-induced lease
expiry racing with the holder still running — acceptable for most
"best-effort mutual exclusion to reduce duplicate work" use cases, but not
a fencing-token-free guarantee against a stalled holder resuming after
losing the lock.

**Zookeeper**: create an **ephemeral sequential** znode under a lock path;
the client with the lowest sequence number holds the lock, everyone else
watches the next-lowest node and wakes up when it's deleted. If the
holder's session dies (crash or lost connection), the ephemeral node is
automatically removed by Zookeeper itself and the next waiter is granted
the lock — no manual TTL/expiry tuning needed, and no lease-expiry race
because the lock only disappears when the session is actually gone.

**Which is more efficient?** Redis is lower-latency and higher-throughput
for lock acquire/release (in-memory, single round trip) — the right choice
when locks are short-lived and acquired at high frequency. Zookeeper is
more *correct* under failure (no clock-based expiry to get wrong, cleaner
crash semantics) but has higher per-operation latency (a filesystem-backed
consensus write per lock op) — the right choice when correctness under
partial failure matters more than raw throughput, e.g. leader election or
a lock guarding an expensive, rare operation.

---

## Distributed Transactions

### Q: How do you handle distributed transactions? What if TCC's network is unreachable? How does XA guarantee consistency?

Distributed transaction strategies, roughly cheapest/loosest to
strongest/most expensive:

- **Best-effort with reconciliation**: fire the operations, and run an
  offline job that finds and fixes mismatches — acceptable when eventual
  consistency plus an audit trail is good enough.
- **Reliable messaging / transactional outbox**: write the local DB change
  and an outbound "event to publish" row in the *same local transaction*,
  then a separate relay publishes the event and marks it sent — guarantees
  the event is eventually published if and only if the local transaction
  committed, without a distributed commit protocol.
- **TCC (Try-Confirm-Cancel)**: each participant exposes three operations —
  `Try` (reserve resources, e.g. freeze funds), `Confirm` (commit the
  reservation), `Cancel` (release it). A coordinator calls `Try` on every
  participant; if all succeed, it calls `Confirm` on all; if any fails, it
  calls `Cancel` on all that succeeded. **If the network is unreachable**
  during Confirm/Cancel, the coordinator must retry with backoff until it
  succeeds — this is why every TCC participant's Confirm/Cancel *must be
  idempotent* (see the idempotency answer above), since "retry until it
  eventually lands" is the actual failure-handling strategy, not
  best-effort-once. A durable transaction log lets the coordinator recover
  and resume retrying after its own crash.
- **XA (2PC)**: a coordinator asks every resource manager to `PREPARE`
  (lock resources, write an undo/redo log, vote yes/no) and only after
  *every* participant votes yes does it broadcast `COMMIT`; a single "no"
  (or timeout) broadcasts `ROLLBACK` to all instead. Consistency is
  guaranteed because no participant applies its change until the
  coordinator has confirmed unanimous agreement — the trade-off is that
  every resource stays **locked for the entire two-phase window**, which
  hurts throughput, and if the coordinator crashes between Prepare and
  Commit, participants are blocked holding locks until it recovers (2PC's
  well-known blocking problem, which TCC and outbox-style approaches exist
  specifically to avoid).

---

## Distributed Sessions

### Q: How do you implement a distributed session when a service is deployed as a cluster?

Once a user's requests can land on any of N stateless application
instances behind a load balancer, in-process `HttpSession` no longer
works unless you route every request from the same user to the same
instance. Options:

- **Sticky sessions** at the load balancer (route by client
  IP/cookie-hash to the same backend) — simplest, but breaks session
  continuity on that instance's failure and unbalances load.
- **Session replication** across all instances — every instance has every
  session, so any instance can serve any request, but write amplification
  and memory cost scale with cluster size.
- **Centralized session store** (Redis is the standard choice) — every
  instance is truly stateless and reads/writes session data from a shared
  store keyed by session ID; this is the most common production pattern
  because it decouples session availability from any one app instance's
  lifecycle and scales the session store independently.
- **Client-side/stateless tokens** (e.g. a signed JWT the client holds and
  presents on every request) — eliminates server-side session storage
  entirely for data that's safe to trust the client with, at the cost of
  not being able to instantly revoke a single session without extra
  infrastructure (a blacklist, again usually kept in Redis).
