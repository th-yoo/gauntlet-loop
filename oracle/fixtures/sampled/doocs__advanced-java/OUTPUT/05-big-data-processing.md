# Massive-Data Processing

The unifying constraint behind every question in this section is the
same: **the data does not fit in memory** (or on one machine), so the
techniques below are all variations on two moves — (1) shrink the
per-item memory footprint (bitmaps, hashing, approximation) so more of it
*does* fit, or (2) partition the data so each partition individually fits,
solve each partition in memory, and merge the partial answers. Naming
which of the two moves you're making, and why, is usually more valuable
in an interview than reciting the specific algorithm.

### Q: How do you find the URLs common to two huge files, too large to fit in memory?

**Partition-then-intersect.** Apply the same hash function to every URL
in both files and write each URL into one of N smaller files based on
`hash(url) % N` (choose N so each resulting shard fits in memory). Because
identical URLs hash identically, any URL common to both original files is
guaranteed to land in the *same* shard number in both partitioned sets —
so the intersection problem on two huge files reduces to N small
intersection problems (load shard *i* of file A into an in-memory hash
set, then stream shard *i* of file B checking membership), each solvable
independently and merged by simple concatenation of results.

### Q: How do you find the top-100 most frequent words across a huge dataset?

**Partition + local Top-K + merge.** Hash-partition the data into N files
small enough to fit in memory each (same reasoning as above — this also
guarantees all occurrences of the same word land in the same partition,
so counts aren't split across shards). For each shard, count word
frequencies in a hash map, then extract that shard's local top-100 using
a **min-heap of size 100** (push each candidate; if the heap is full and
the candidate beats the current minimum, pop the min and push the
candidate) rather than a full sort, since a bounded heap is O(n log 100)
instead of O(n log n). Finally, merge the N shards' local top-100 lists
(at most 100N candidates, small enough to hold in memory) with one more
pass through a size-100 min-heap to get the true global top-100.

### Q: How do you find the IP address with the most visits to a site on a given day?

Same partition + count + local-top-1 + merge pattern as above, specialized
to K=1: hash-partition raw log lines by IP into N files sized to fit in
memory, count per-IP visit frequency within each shard with a hash map,
track that shard's single most-frequent IP, then take the max across the
N shard winners. (If the answer only needs the single global max and not
a ranked list, you don't even need a heap — just track a running max
while counting.)

### Q: How do you find the integers that appear exactly once (no duplicates) among a huge collection of numbers?

If the value range is bounded and known (e.g., 32-bit non-negative
integers), a **bitmap** is the tool: this is a case where the shrink-the-footprint
move (not partitioning) applies, because a bitmap can represent
presence/absence for the *entire* range in a fixed, small memory budget
regardless of how many numbers there are.

Use **two bits per possible value** (four states: 00 = never seen, 01 =
seen once, 10 = seen ≥2 times) instead of one bit, because a single bit
can only tell you "seen or not," not "seen exactly once" — the extra
state is what makes distinguishing "unique" from "duplicate" possible
without a hash map. One pass sets/advances each value's 2-bit state as
it's read; a second pass over the bitmap emits every value whose state
is exactly `01`. For 32-bit integers this costs `2^32 * 2 bits = ~1GB`,
independent of how many numbers were actually in the input — a huge win
over a hash-map approach whose memory scales with input size instead of
value-range size. If the range is too large even for a bitmap, fall back
to hash-partitioning (as above) so each partition's numbers fit in a
plain in-memory hash-map-based duplicate check.

### Q: How do you check whether a given number exists within a huge dataset?

- If the value range is bounded, a plain **bitmap** (one bit per possible
  value, set on first sight) answers "does this exact value exist" with an
  O(1) bit check after one O(n) build pass — the simplest correct answer
  when memory for the full range is affordable.
- If the universe of possible values is far too large for even a 1-bit-per-value
  bitmap (e.g. arbitrary strings, 64-bit values), use a **Bloom
  filter**: a fixed-size bit array plus k independent hash functions; to
  test each element, hash it k ways and set those k bits; membership is
  tested by checking whether all k corresponding bits are set. A Bloom
  filter can have **false positives** (says "might exist" when it
  doesn't) but **never false negatives** (if it says "definitely does not
  exist," that's certain) — which is exactly why it's used as a
  pre-filter to avoid expensive lookups for keys that provably aren't
  present (the same mechanism named in the cache-penetration defense in
  the High-Concurrency document), not as a source of a definitive "yes."

### Q: How do you find the most popular search query strings out of a huge query log?

Same partition → local count → local top-K (min-heap) → merge pattern
used for top-100 words above, with one addition worth naming explicitly:
if the query distribution is heavily skewed (a small number of queries
account for a large share of traffic — realistic for search logs), a
naive hash partition can produce a **hot shard** where one partition ends
up far larger than the others because too many high-frequency queries
hashed together; a senior answer calls this out and mitigates it with a
combining/pre-aggregation pass (count locally in a small in-memory buffer
as the log streams by, flush aggregated counts rather than raw
occurrences into the partitioned files) so the partition step operates
on already-reduced data instead of the raw, skewed volume.

### Q: How do you count the number of distinct phone numbers in a huge dataset?

Phone numbers are a **bounded, enumerable range** (e.g., 11-digit numbers
span a known, finite space), so this is again the bitmap move: one bit
per possible phone number, set it on first sight during a single
streaming pass, and the final popcount (number of set bits) across the
bitmap is the distinct count — no need to ever hold the actual numbers in
memory, only presence flags for the whole space. If an approximate count
is acceptable and even the bitmap is too large, a **HyperLogLog**
sketch gives a distinct-count estimate (~1-2% error) in a fixed, tiny
memory footprint (a few KB) regardless of range size — the standard
trade when exactness isn't actually required.

### Q: How do you find the median of 500 million numbers that don't fit in memory?

**Bucket by range, then count into the bucket containing the median.**
Do one streaming pass to find the overall min/max (or, for numbers of a
known bounded type, use the type's known range) and split that range into
N equal-width buckets; a second streaming pass increments a per-bucket
counter (not storing the numbers, just counts) for whichever bucket each
number falls in. Since you know the total count (500M) and each bucket's
count, you can identify which bucket must contain the median (the bucket
where the cumulative count crosses the 250-millionth position) without
ever loading all 500M numbers into memory at once. If that bucket is
still too large, recursively re-bucket *just that bucket's* numbers on a
subsequent pass (narrowing the range each time) until the remaining
candidate set is small enough to load into memory and find the exact
median directly — this is essentially an external, counting-sort-flavored
version of quickselect, trading extra streaming passes for bounded
memory.

### Q: How do you sort query strings by their frequency counts?

This is "count frequencies, then sort by count" at a scale where the
counting itself is the hard part (already solved above via
partition + hash-map counting), and the sort is straightforward once
counts exist: since a shard's distinct-query count after aggregation is
typically far smaller than the raw log volume, an in-memory sort (by
count descending) per shard is usually sufficient; if the *global* fully
sorted list (not just a top-K) is genuinely required and the aggregated
counts still don't fit in one machine's memory, use an **external
merge sort**: sort each shard's (query, count) pairs on disk, then do a
K-way merge of the already-sorted shard files, reading one small buffered
chunk from each shard at a time — the standard external-sort pattern for
"data larger than memory, but any I bytes of it fit fine."

### Q: How do you find the top-500 largest numbers among a huge dataset?

If the full dataset fits in one machine's memory: a **min-heap of size
500** — push each number; once the heap holds 500 elements, for every
subsequent number compare it against the heap's minimum (its root) and
replace-and-re-heapify only if the new number is larger. This is O(n log
500) total, dramatically cheaper than sorting the entire dataset (O(n log
n)) just to read off the top 500. If the dataset doesn't fit in memory,
apply the same partition pattern as the earlier questions: find each
shard's local top-500 with a size-500 min-heap, then merge the (at most
500 × N) shard-local candidates with one more size-500 min-heap pass to
get the true global top-500 — a number that's globally in the top 500
must also be in its own shard's local top 500, which is exactly the
property that makes the partition-then-merge reduction correct here.

### Q: What's the general playbook for Top-K problems on massive data?

Every Top-K question above is one of two moves, chosen by whether the
data fits in memory:

1. **Fits in memory**: maintain a **min-heap of size K** (for "largest K")
   or a **max-heap of size K** (for "smallest K"/"least frequent K") while
   streaming through the data once — O(n log K), and K is normally tiny
   compared to n, so this beats a full sort badly at scale.
2. **Doesn't fit in memory**: **hash-partition** the data across N files
   so that every occurrence of the same key lands in the same partition
   (this step is what makes the reduction correct — otherwise a key's
   count/rank would be split across partitions and undercounted), solve
   the in-memory Top-K on each partition independently, then merge the
   (at most K × N) partition-level winners with one more size-K heap pass
   to get the true global Top-K.

Naming *why* each step is needed — the heap bound turns O(n log n) into
O(n log K), and the partition-by-hash step is what guarantees a key's
full count is visible in exactly one place — is what distinguishes an
answer that demonstrates understanding from one that's reciting a
memorized recipe.
