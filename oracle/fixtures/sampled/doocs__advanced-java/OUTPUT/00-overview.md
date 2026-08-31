# Core Interview Questions & Answers for Experienced Java (Backend) Developers

This guide collects and answers the interview questions an experienced Java
backend engineer is expected to handle, organized into the five knowledge
areas that come up most often in system-design and backend interviews:

1. **High-Concurrency Architecture** — message queues, search engines,
   caching, database sharding, read/write separation — see
   `01-high-concurrency.md`
2. **Distributed Systems** — RPC frameworks, distributed locks, distributed
   transactions, distributed sessions — see `02-distributed-systems.md`
3. **High-Availability Architecture** — circuit breaking, isolation,
   fallback, rate limiting — see `03-high-availability.md`
4. **Microservices Architecture** — service decomposition, service
   discovery, Spring Cloud — see `04-microservices.md`
5. **Massive-Data Processing** — external sorting, bitmaps, bloom filters,
   Top-K problems — see `05-big-data-processing.md`

Each file walks through a set of representative interview questions with a
full answer, written the way a senior candidate should actually explain it:
state the problem, name the mechanism, and call out the trade-offs — not
just the buzzword.

## How to use this guide

Interviewers rarely want a memorized definition; they want to see that you
have *operated* the system under discussion. For every answer below, be
ready to extend it with:

- **A concrete number.** "Redis is fast" is weak; "a single-threaded Redis
  instance driven by epoll can sustain on the order of 100k+ simple GET/SET
  ops/sec because there is no lock contention and no context-switch cost"
  is what a senior engineer says.
- **A failure mode.** Every mechanism below has a way it breaks (split
  brain, thundering herd, message duplication, hot partition). Naming it
  unprompted is what separates "read about it" from "operated it."
- **The trade-off you accepted.** Every one of these is a trade, not a free
  lunch — throughput for consistency, availability for latency, simplicity
  for control. Say which side you chose and why.
