# High-Concurrency Architecture

## Message Queues

### Q: Why use a message queue? What are the trade-offs of Kafka, ActiveMQ, RabbitMQ, and RocketMQ?

A message queue buys you three things at the cost of one:

- **Decoupling** — the producer no longer needs to know who consumes the
  event, or how many consumers exist.
- **Async processing** — the caller returns as soon as the message is
  durably enqueued instead of waiting for every downstream side effect.
- **Peak shaving (traffic shaping)** — a burst of 50k writes/sec can be
  buffered and drained by consumers at a steady 5k/sec instead of falling
  over the database.

The cost is **added operational complexity**: another cluster to run, a new
failure mode (message loss/duplication/reordering), and eventual rather than
immediate consistency between producer and consumer.

Comparing the four:

| | Throughput | Latency | HA model | Best for |
|---|---|---|---|---|
| **Kafka** | Very high (sequential disk I/O + zero-copy + batching) | Higher (batched) | Partition replication, ISR | Log aggregation, event streaming, high-throughput pipelines |
| **RocketMQ** | High | Low | Master-slave, DLedger | Transactional messages, ordered messages, financial workloads |
| **RabbitMQ** | Moderate | Very low | Mirrored queues | Complex routing, low-latency task queues, small-to-medium volume |
| **ActiveMQ** | Lower | Low | Master-slave | Legacy JMS integration; largely superseded today |

In practice: pick Kafka when the requirement is "durable, ordered-per-key,
very high volume log," pick RocketMQ when you need transactional/ordered
messages with lower ops overhead than Kafka, and pick RabbitMQ when routing
flexibility (topic/fanout/headers exchanges) matters more than raw
throughput.

### Q: How do you make a message queue highly available?

Replicate every partition/queue across brokers and only acknowledge a
producer write once it is durable on enough replicas to survive the
failures you're planning for:

- **Kafka**: each partition has a leader plus replicas that form the
  in-sync replica set (ISR). `acks=all` + `min.insync.replicas=2` means a
  write is only acknowledged once it exists on at least two brokers, so a
  single broker crash cannot lose it. `unclean.leader.election.enable=false`
  prevents an out-of-sync replica from silently becoming leader and losing
  data.
- **RabbitMQ**: mirrored queues (classic) or quorum queues (Raft-based,
  the modern recommendation) replicate the queue across nodes so a node
  failure doesn't drop in-flight messages.
- **RocketMQ**: master-slave replication, or DLedger for a Raft-based
  multi-replica group that survives master failure without manual failover.

The pattern is always the same: **replication + quorum acknowledgment +
leader election** — the same three ingredients as any other distributed
storage system.

### Q: How do you guarantee a message isn't processed twice (idempotent consumption)?

You generally *cannot* guarantee exactly-once delivery over a network —
what you can guarantee is **at-least-once delivery + idempotent
processing**, which is equivalent in outcome. Techniques, cheapest first:

1. **Natural idempotency** — if the operation is already idempotent (e.g.
   `UPDATE orders SET status='PAID' WHERE id=? AND status='PENDING'`),
   redelivery is harmless.
2. **Unique-key dedup** — attach a business/message ID and enforce a unique
   constraint (or a Redis `SETNX`) before applying the effect; a duplicate
   insert fails or short-circuits.
3. **Version/CAS check** — `UPDATE t SET v=v+1 WHERE id=? AND v=?` so a
   stale/duplicate update is rejected.
4. **Consume-then-record in one transaction** — record the processed
   message ID in the same local transaction as the business write, so a
   redelivery finds the ID already recorded and skips.

### Q: How do you guarantee reliable delivery (no message loss)?

Message loss can happen at three points, and each needs its own guard:

1. **Producer → broker**: use a synchronous send with an ack (`acks=all`
   in Kafka, publisher confirms in RabbitMQ) and retry on failure instead of
   fire-and-forget.
2. **Broker durability**: persist to disk (not memory-only queues) and
   replicate before acknowledging, per the HA answer above.
3. **Broker → consumer**: don't auto-ack before processing. Ack only after
   the business logic has committed, so a consumer crash mid-processing
   causes redelivery rather than silent loss (this reintroduces the
   duplicate-processing problem above, which is why idempotency and
   reliable delivery are always solved together).

### Q: How do you guarantee message ordering?

Ordering is only meaningful *within a partition/queue*, never globally
across a distributed set of consumers processing in parallel. The pattern:

- Route messages that must stay ordered relative to each other to the
  **same partition**, keyed by a business ID (e.g. all events for one
  order ID go to the same Kafka partition, using the order ID as the
  partition key).
- Use a **single consumer thread per partition** (or ensure any
  multi-threaded consumption inside a partition re-serializes by key
  before dispatch).
- Accept that ordering across partitions/keys is not preserved — and design
  around it (order per aggregate root, not global order) rather than
  serializing everything through one partition, which kills throughput.

### Q: How do you handle a backlog of millions of unconsumed messages, or messages that expired before being consumed?

- **Diagnose first**: is the producer's rate exceeding consumer capacity, or
  did a consumer outage stop draining?
- **Short-term drain**: temporarily scale out consumers (more instances /
  more partitions, since partition count bounds consumer parallelism), or
  spin up a throwaway consumer group that fans the backlog out to a
  temporary topic sharded across many more partitions, then multiple
  consumer fleets drain those in parallel.
- **Expired messages**: if a queue has a TTL and messages already expired
  (business impact = "these actions were supposed to happen and didn't"),
  you need a reconciliation job — replay from a durable source of truth
  (the DB, an audit table, or upstream event log) rather than the (now
  gone) messages themselves.
- **Root-cause fix**: this is a capacity-planning failure — provision
  consumer throughput with headroom above producer peak, and alert on
  consumer lag (e.g. Kafka consumer group lag) before it turns into a
  multi-hour backlog.

### Q: If you had to design a message queue from scratch, what's your architecture?

Walk through it as a distributed log:

1. **Storage**: append-only segment files per partition, sequential writes,
   memory-mapped or page-cache-backed reads — this is what makes Kafka's
   disk I/O fast despite being on disk.
2. **Partitioning**: topic split into N partitions for parallelism; each
   partition is the unit of ordering and replication.
3. **Replication**: each partition replicated to K brokers with leader
   election (Raft/ISR-style) so a broker failure doesn't lose data or
   availability.
4. **Producer**: batches + compresses records client-side, sends to the
   partition leader, waits for the configured ack level.
5. **Consumer**: tracks its own offset (in the broker or externally),
   pull-based (not push) so slow consumers don't get overwhelmed and one
   consumer group can be independently paced from another.
6. **Delivery semantics**: at-least-once by default; exactly-once only
   achievable end-to-end via idempotent producers + transactional writes +
   idempotent consumers, and it's expensive — be honest in an interview that
   "exactly-once" is a marketing simplification of "effectively-once."

---

## Search Engines (Elasticsearch)

### Q: How is Elasticsearch distributed?

An index is split into **shards** (the unit of parallelism and the unit
that must fit on one node), and each shard has zero or more **replicas**
(the unit of availability). A cluster is a set of nodes; one is elected
master and owns cluster state (which shards live where), but reads/writes
for a given document go directly to the node holding the relevant primary
shard, so data traffic doesn't bottleneck on the master. Document routing
is `hash(routing_value) % number_of_primary_shards`, which is why primary
shard count can't be changed after index creation without reindexing.

### Q: How does ES write and query data? What is Lucene, and what's an inverted index?

**Write path**: a document is first written to an in-memory buffer and an
append-only **translog** (for durability/crash recovery), then periodically
**refreshed** into a new, immutable, searchable Lucene segment (near-real-time
search — typically ~1s delay). Segments are periodically **merged** in the
background to bound their count, and **flushed** to disk with an fsync,
after which the translog can be trimmed.

**Lucene** is the underlying single-node full-text search library ES is
built on; ES adds distribution, replication, and a REST/query DSL layer on
top of it.

**Inverted index**: instead of "document → list of terms" (a forward
index), Lucene stores "term → list of documents (postings list)
containing it," plus positional/frequency data for relevance scoring
(BM25). A query for a term becomes an O(1) lookup into that map rather
than a scan of every document — this is the entire reason full-text search
engines are fast.

### Q: How do you keep query performance acceptable at billions of documents?

- **Shard sizing**: keep shards in the tens-of-GB range (not too many tiny
  shards — each has overhead; not one giant shard — it can't parallelize
  or move easily). Over-sharding is one of the most common ES production
  mistakes.
- **Filter vs query context**: use `filter` (cacheable, no scoring) for
  exact-match/range clauses and reserve `query`/scoring for the part that
  actually needs relevance ranking.
- **Field mapping discipline**: mark fields `keyword` vs `text`
  deliberately; don't index fields you never search/aggregate on
  (`"index": false`, `doc_values` off for fields only used for display).
- **Routing**: if queries are usually scoped to a tenant/customer, route
  documents by that key so a query only has to hit the shards that could
  possibly contain a match instead of fanning out to every shard.
- **Time-based indices + ILM**: for logs/metrics, roll indices daily and
  age old ones into cheaper storage tiers, so a query naturally excludes
  irrelevant time ranges by index name rather than scanning them.
- **Caching**: the filter cache and request cache absorb repeated
  identical queries; index in a way that maximizes cache hits (avoid
  `now`-relative ranges in tightly-cached queries).

### Q: What does a production ES cluster deployment look like?

Dedicated **master-eligible** nodes (small, stable, never hold data — this
prevents heavy indexing/query load from delaying cluster-state decisions
and causing split-brain-adjacent instability), separate **data nodes**
(the workhorses, sized by disk/RAM for the shard count they hold), and
optionally dedicated **coordinating/ingest nodes** to absorb fan-out query
overhead. Shard/replica counts and per-index sizing are capacity-planned
from expected document count and query pattern up front, since primary
shard count is fixed at index creation.

---

## Caching

### Q: How do you use caching in a real project, and what goes wrong if you use it carelessly?

Cache read-heavy, expensive-to-compute, or slow-to-fetch data in front of
the database, using **cache-aside** as the default pattern: read cache
first, on miss read the DB and populate the cache, write goes to the DB
and then invalidates (not updates) the cache entry.

Used carelessly it produces:
- **Cache avalanche** — a large batch of keys expiring together (or the
  cache node itself going down) sends the full load straight to the DB at
  once and takes it down.
- **Cache penetration** — queries for keys that don't exist in the DB never
  populate the cache, so every request for them hits the DB every time
  (this is exploitable as a DoS vector).
- **Cache breakdown (hotspot)** — one extremely hot key expires and
  thousands of concurrent requests all miss simultaneously and hammer the
  DB for the same row.
- **Stale/inconsistent data** — if writes update the cache in place instead
  of invalidating it, a race between two concurrent writes can leave the
  cache holding the *older* value indefinitely.

### Q: Redis vs Memcached — and why is single-threaded Redis faster than multi-threaded Memcached?

Memcached is a pure key-value byte-string cache, multi-threaded, and has no
persistence or built-in replication. Redis supports rich data structures
(strings, hashes, lists, sets, sorted sets, streams, etc.), offers
persistence (RDB/AOF) and replication, and its core command execution is
single-threaded.

Single-threaded Redis outperforms multi-threaded Memcached for typical
workloads because:
- **No lock contention** — every command runs to completion without
  needing mutexes around shared data structures.
- **No context-switch cost** — a single event loop driven by epoll/kqueue
  multiplexes many client connections without OS thread scheduling
  overhead.
- **In-memory + O(1)/O(log n) data structures** — the bottleneck was never
  CPU; it's memory access and the network round trip, and a single core
  saturates a network link long before it saturates a single CPU core for
  simple commands.

(Modern Redis does use background threads for slow operations like
`UNLINK`/lazy-freeing and I/O threading for network reads/writes, but the
command-execution engine itself remains single-threaded to preserve atomic
semantics.)

### Q: What data types does Redis have, and when do you use each?

| Type | Use case |
|---|---|
| **String** | Simple KV cache, counters (`INCR`), distributed lock value, session tokens |
| **Hash** | Object-like records (a user profile) where you want to read/write individual fields without ser/deserializing the whole blob |
| **List** | Simple FIFO queues, latest-N feeds (`LPUSH` + `LTRIM`) |
| **Set** | Deduplication, tag membership, set operations (intersection = mutual friends) |
| **Sorted Set (ZSet)** | Leaderboards, delayed-queue scheduling (score = execute-at timestamp), rate limiting windows |
| **Bitmap** | Compact boolean flags at scale (daily active user tracking, feature flags per user ID) |
| **HyperLogLog** | Approximate distinct-count at fixed ~12KB memory regardless of cardinality |
| **Stream** | Append-only event log with consumer groups — Redis's answer to a lightweight Kafka |

### Q: What eviction policies does Redis support, and how do you implement LRU by hand?

Policies: `noeviction`, `allkeys-lru`, `volatile-lru`, `allkeys-lfu`,
`volatile-lfu`, `allkeys-random`, `volatile-random`, `volatile-ttl`.
Production caches almost always use `allkeys-lru` or `allkeys-lfu` with a
`maxmemory` cap. (Redis actually implements an *approximated* LRU by
sampling a small set of keys and evicting the oldest-accessed among the
sample, not a fully precise LRU list, to avoid the cost of maintaining
exact global recency.)

A textbook exact LRU cache — the classic hand-written version — is a hash
map (key → node) plus a doubly linked list (recency order), giving O(1)
get/put:

```java
class LRUCache<K, V> {
    private final int capacity;
    private final Map<K, Node<K, V>> map = new HashMap<>();
    private final Node<K, V> head = new Node<>(null, null); // most recent
    private final Node<K, V> tail = new Node<>(null, null); // least recent

    LRUCache(int capacity) {
        this.capacity = capacity;
        head.next = tail;
        tail.prev = head;
    }

    synchronized V get(K key) {
        Node<K, V> n = map.get(key);
        if (n == null) return null;
        moveToFront(n);
        return n.value;
    }

    synchronized void put(K key, V value) {
        Node<K, V> n = map.get(key);
        if (n != null) {
            n.value = value;
            moveToFront(n);
            return;
        }
        if (map.size() >= capacity) {
            Node<K, V> lru = tail.prev;
            remove(lru);
            map.remove(lru.key);
        }
        Node<K, V> fresh = new Node<>(key, value);
        map.put(key, fresh);
        addToFront(fresh);
    }

    private void moveToFront(Node<K, V> n) { remove(n); addToFront(n); }
    private void remove(Node<K, V> n) { n.prev.next = n.next; n.next.prev = n.prev; }
    private void addToFront(Node<K, V> n) {
        n.next = head.next; n.prev = head;
        head.next.prev = n; head.next = n;
    }

    private static class Node<K, V> {
        K key; V value; Node<K, V> prev, next;
        Node(K k, V v) { key = k; value = v; }
    }
}
```

(`LinkedHashMap` with `accessOrder=true` and an overridden
`removeEldestEntry` gives the same behavior in a few lines, and is the
answer you give after showing you understand the underlying structure.)

### Q: How do you achieve high concurrency and high availability with Redis? Explain replication and Sentinel.

**Master-slave replication**: the slave issues `PSYNC`; on first connect it
gets a full RDB snapshot, then a continuous stream of the master's write
commands (the replication backlog) to stay incrementally in sync. Reads
scale out across slaves; writes still go to the single master.

**Sentinel** adds automatic failover on top of plain replication: a
quorum of Sentinel processes independently monitor the master via
heartbeats; when a majority agree the master is down (avoiding a single
Sentinel's false positive from triggering failover), they elect a leader
Sentinel that promotes the best-positioned slave to master and
reconfigures the rest to replicate from it, then publishes the new
topology so clients reconnect to the right node.

High concurrency comes from read scaling across replicas plus Redis's raw
single-instance throughput; high availability comes from Sentinel-driven
failover (or Redis Cluster's built-in failover for the sharded case).

### Q: Describe Redis persistence — RDB vs AOF, and how each works under the hood.

- **RDB**: point-in-time binary snapshot. `SAVE` blocks the main thread;
  `BGSAVE` forks a child process (copy-on-write pages) that writes the
  snapshot while the parent keeps serving traffic. Compact, fast to load
  on restart, but loses everything since the last snapshot on a crash.
- **AOF**: append every write command to a log. `appendfsync` controls
  durability vs performance: `always` (fsync every write — safest, slowest),
  `everysec` (fsync once per second — the common default trade-off, up to
  1s of loss), `no` (let the OS decide — fastest, least durable).
  Periodic **AOF rewrite** compacts the log to the minimal set of commands
  needed to reconstruct current state (also via fork + copy-on-write).
- **Combined (recommended)**: enable both — RDB for fast restarts/backups,
  AOF for tighter durability — Redis will prefer AOF for recovery if both
  are present since it's more complete.

### Q: How does Redis Cluster work? How is a key addressed, and how do you add/remove a node?

Redis Cluster splits the keyspace into **16384 hash slots**; a key's slot
is `CRC16(key) % 16384` (or the slot of the substring inside `{}` if the
key uses a hash tag, which is how you force related keys onto the same
node for multi-key operations). Each of the N master nodes owns a subset
of slots and knows the full slot→node mapping via gossip, so any node can
redirect a client to the right one (`MOVED`).

This is closer to **consistent hashing in spirit** (bounded, controlled
data movement on membership change) but implemented as fixed-size
slot ownership rather than a hash ring — the practical benefit is the same:
adding/removing a node only requires **migrating specific slots**, not
rehashing the whole keyspace. To add a node: bring it up empty, then
`CLUSTER SETSLOT ... IMPORTING/MIGRATING` a chosen set of slots from
existing nodes to it, moving the keys in each slot with `MIGRATE`. To
remove one, do the reverse — migrate its slots elsewhere before taking it
out of the cluster, never remove a node that still owns slots.

(True consistent hashing, for comparison, maps both nodes and keys onto a
hash ring and each key belongs to the next node clockwise — used e.g. in
Memcached client-side sharding — its main property is the same: a node
join/leave only remaps `~1/N` of the keyspace instead of all of it.)

### Q: What are cache avalanche, penetration, and breakdown, and how do you defend against each?

- **Avalanche** (many keys expire together / node dies → DB overload):
  add random jitter to TTLs so keys don't expire in lockstep; run cache in
  a highly-available cluster (Sentinel/Cluster) so a single node loss
  doesn't wipe the whole cache; add a circuit breaker + local fallback in
  front of the DB for when it does happen.
- **Penetration** (query for keys that don't exist, cache never
  populated): cache the *negative* result too (with a short TTL), and/or
  put a **Bloom filter** of all valid keys in front of the cache so a
  request for a key that provably doesn't exist never reaches the DB at
  all.
- **Breakdown** (one hot key expires under heavy concurrent load): use a
  mutex/single-flight so only one request rebuilds the cache while others
  wait or serve stale data (`double-checked` fetch under a lock), or never
  let genuinely hot keys expire at all (refresh-ahead in the background
  instead of expire-then-rebuild).

### Q: How do you keep the cache and database consistent under concurrent writes?

The standard pattern is **update the DB, then delete (not update) the
cache** — deletion is idempotent and the next read repopulates it, whereas
racing writers updating the cache directly can leave it holding a stale
value forever. Even with delete-based invalidation there's a known race:
a read misses cache → reads old DB value → a concurrent write updates DB
and deletes cache → the read's stale value gets written back to cache.
Mitigations:
- **Delayed double-delete**: delete the cache again a short delay after the
  write, to clear out any stale value a racing read wrote back.
- **Route cache invalidation through a queue keyed by the row**, so
  deletes for the same key are serialized and out-of-order writes can't
  leave a stale entry behind.
- Accept **eventual consistency with a bounded window** (a short TTL as a
  backstop) if strict consistency isn't actually a business requirement —
  strong cache/DB consistency generally isn't worth the complexity/latency
  it costs, and most systems are correct to not chase it.

### Q: What concurrency problems does Redis have, and how does the CAS-style transaction work?

Redis commands are individually atomic, but a **read-then-write sequence**
issued by an application (get a value, compute a new one, set it back) is
not atomic across the two round trips — two clients can race. `WATCH` +
`MULTI`/`EXEC` implements optimistic locking: `WATCH key` marks it for
change-detection, and `EXEC` aborts the whole queued transaction (returns
nil) if any watched key changed since the `WATCH`, so the application
retries — the same optimistic-concurrency pattern as a DB `WHERE version =
?` check, just Redis-native.

### Q: How is Redis typically deployed in production?

Never a single standalone instance for anything that matters: at minimum
master + replica(s) with Sentinel for automatic failover, or Redis Cluster
when the dataset outgrows a single node's memory and needs horizontal
sharding. Persistence (RDB + AOF) enabled for recoverability, monitoring
on memory usage/eviction rate/replication lag, and `maxmemory` +
an eviction policy always set explicitly rather than left to OOM the
process.

### Q: What happens during Redis rehashing?

Redis's internal hash table grows by doubling when its load factor crosses
a threshold. Rather than rehashing every key in one blocking pass (which
would stall the single-threaded server), Redis does **incremental
(progressive) rehashing**: it allocates a second, larger table and, on
every subsequent read/write operation, migrates one bucket from the old
table to the new one in addition to doing the requested work, until the
old table is empty — spreading the O(n) cost across many small operations
instead of paying it as one latency spike.

---

## Database Sharding

### Q: Why shard a database, and what are the trade-offs of the common sharding middleware?

A single MySQL instance runs out of headroom on two independent axes:
**write throughput** (single-primary write bottleneck) and **storage/row
count** (index depth, backup time, DDL time all degrade past tens of
millions of rows per table). Sharding splits load along one or both axes.

- **Vertical split**: separate tables by business domain onto different
  databases/instances (orders DB, users DB, ...) — reduces per-instance
  load and blast radius, but cross-domain joins now cross a network
  boundary.
- **Horizontal split (真正的分库分表)**: split one logical table's *rows*
  across N physical tables/instances by a shard key (hash or range) —
  scales both write throughput and storage, at the cost of losing
  cross-shard transactions, joins, and easy global sort/pagination.

Middleware options:
- **Client-side (e.g. Sharding-JDBC/ShardingSphere-JDBC)**: a JDBC driver
  wrapper — no extra network hop, no extra ops component, but the sharding
  logic is coupled into every application instance/language.
- **Proxy-layer (e.g. MyCat, ShardingSphere-Proxy)**: a standalone
  MySQL-protocol proxy — language-agnostic, centralizes routing logic and
  is easier to operate for polyglot environments, but adds a network hop
  and a new single point to scale/HA.

### Q: How do you migrate a running unsharded system to a sharded one without downtime?

Dual-write + backfill + cutover, the standard live-migration playbook:

1. Stand up the new sharded schema.
2. **Dual-write**: every write goes to both the old single DB and the new
   sharded cluster (via the application or a CDC pipeline off the binlog).
3. **Backfill**: bulk-copy historical data into the sharded cluster.
4. **Verify**: reconcile row counts/checksums between old and new until
   they agree.
5. **Cutover reads** to the new cluster gradually (percentage rollout /
   feature flag), keeping dual-write running so you can roll back
   instantly if reads disagree.
6. Once confidence is high, **stop writing to the old DB** and decommission
   it.

The core idea: never do a single big-bang cutover — every step must be
independently reversible.

### Q: How do you design sharding so it can scale (add/remove shards) dynamically without a painful re-migration?

- Prefer **consistent hashing** (or a slot-based scheme like Redis
  Cluster's) over plain `hash(key) % N` for the shard key, so
  adding/removing a shard only moves `~1/N` of the data instead of nearly
  all of it.
- Alternatively, **over-provision logical shards from day one** (e.g. 1024
  logical shards mapped many-to-one onto physical instances) so "scaling
  out" is just remapping which physical instance owns which logical
  shards (and migrating their data) — no application-level resharding
  math ever changes.
- Either way, physical data movement between shards has to go through the
  same dual-write-then-cutover pattern as the initial migration.

### Q: How do you generate primary keys once a table is sharded?

A per-table AUTO_INCREMENT no longer produces globally unique IDs once the
table is split across N physical tables. Common approaches:

- **Snowflake-style IDs**: `timestamp | worker/datacenter ID | sequence`
  packed into a 64-bit long — roughly time-sortable, globally unique, no
  coordination needed per ID (only the worker ID needs to be
  provisioned uniquely), used directly by Twitter's Snowflake and
  Meituan's Leaf-snowflake.
- **Segment/range allocation** (e.g. Leaf-segment): a central service hands
  out ID *ranges* (e.g. "you own 1000–1999") to each application node,
  which then increments locally in memory — one DB round trip per 1000
  IDs instead of per ID, and survives the central service being briefly
  unavailable.
- **UUID**: zero coordination, but not time-sortable and, as a clustered
  index key in something like InnoDB, causes damaging random-order page
  splits — usable for non-indexed identifiers, a poor choice as the
  primary/clustering key.
- **DB-based (auto-increment step)**: a small dedicated table/sequence per
  shard with a fixed step and offset per shard (shard *k* only ever
  produces IDs ≡ *k* mod *N*) — simple, but couples ID generation
  throughput to one small hot table.

---

## Read/Write Separation

### Q: How do you implement MySQL read/write separation? What's the replication mechanism, and how do you handle replication lag?

Writes go to the primary; reads are routed to one or more replicas
(via a proxy like ProxySQL/MyCat, or client-side routing).

**Replication mechanism**: the primary writes every change to its **binary
log (binlog)**; each replica's I/O thread pulls the binlog into its own
**relay log**, and the replica's SQL thread (or, in parallel replication,
multiple worker threads) applies those events to its own data — this is
asynchronous by default, meaning the primary doesn't wait for a replica to
apply before acknowledging a commit.

**Lag** happens because replay is inherently behind real-time and, in
older single-threaded replication, serialized. A write immediately
followed by a read routed to a lagging replica can see stale (or
missing) data. Mitigations:
- **Semi-synchronous replication**: the primary waits for at least one
  replica to *acknowledge receipt* of the binlog event before committing —
  bounds (but doesn't eliminate) lag and data-loss risk on failover, at
  some write-latency cost.
- **Parallel replication** (MySQL 5.7+, per-schema or logical-clock based)
  reduces lag by applying independent transactions concurrently on the
  replica instead of one at a time.
- **Read-your-writes routing**: send a user's own immediate post-write
  reads to the primary (or a replica known to have caught up) for a short
  window, and only route to arbitrary replicas afterward.
- **Monitor `Seconds_Behind_Master`** and remove a replica from the read
  pool if its lag exceeds an acceptable threshold, rather than serving
  stale reads silently.

---

## Designing a High-Concurrency System

### Q: How would you design a high-concurrency system overall?

Frame it as attacking every layer, not one trick:

1. **Front the system with a CDN/edge cache** for static and cacheable
   content so it never reaches the origin.
2. **Stateless application tier** behind a load balancer, horizontally
   scalable, with the LB doing health-check-based failover.
3. **Cache aggressively** (per the caching section above) to absorb read
   traffic before it reaches the database.
4. **Queue writes that don't need a synchronous response** (order
   placement confirmation vs. downstream fulfillment/notification) so the
   critical path is short and the rest is processed asynchronously,
   smoothing bursts.
5. **Shard/scale the database** once single-primary capacity is the
   binding constraint (per the sharding section above), and separate
   reads/writes.
6. **Rate-limit and degrade gracefully** at the edge so an overload event
   sheds the least-important load first instead of taking the whole system
   down (see the High-Availability document).
7. **Make every layer independently horizontally scalable** — the
   system's actual capacity is the capacity of its *smallest* unscalable
   component, so find and eliminate single-instance bottlenecks (a single
   DB primary, a single cache node, a single message-queue partition for a
   hot key) one at a time, in order of which one saturates first under
   load testing.
