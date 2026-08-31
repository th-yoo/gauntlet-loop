# Microservices Architecture

### Q: What is a microservice, and how do microservices communicate with each other?

A microservice is a small, independently deployable service owning one
bounded piece of business capability and its own data, exposing a
well-defined API to the rest of the system rather than sharing a database
or an in-process call with other services. This is the same
decomposition motivation covered in the Distributed Systems document
(independent scaling, deployment, and failure isolation), applied at
finer granularity than a typical Dubbo-style service split.

Communication is either:
- **Synchronous** — REST/HTTP+JSON (simple, universal, human-debuggable)
  or an RPC protocol like gRPC/Dubbo (faster, typed, but requires shared
  IDL/stubs) — used when the caller needs an immediate response.
- **Asynchronous** — via a message broker (Kafka/RabbitMQ/RocketMQ, as
  covered in High-Concurrency) — used for events, notifications, and any
  interaction where the caller doesn't need to block on the result,
  which also decouples the two services' availability from each other.

### Q: What's the difference between Spring Cloud and Dubbo?

Dubbo is fundamentally an **RPC framework** with service
discovery/load-balancing bolted on around it; Spring Cloud is a
**full microservices ecosystem** — service discovery (Eureka/Consul/Nacos),
client-side load balancing, an API gateway (Spring Cloud Gateway/Zuul),
distributed configuration (Spring Cloud Config), circuit breaking
(historically Hystrix, now Resilience4j), and distributed tracing —
built as a set of composable Spring Boot libraries, with HTTP/REST as the
default inter-service protocol rather than a proprietary binary RPC
protocol. In short: Dubbo answers "how do two services call each other
efficiently"; Spring Cloud answers "how do I assemble the entire set of
cross-cutting concerns a microservices architecture needs," of which RPC
is only one piece — which is also why Dubbo is often used *underneath*
a Spring Cloud-managed system rather than as a competing choice.

### Q: What's the difference between Spring Boot and Spring Cloud?

**Spring Boot** solves single-application concerns: auto-configuration,
embedded server, convention-over-configuration setup, "get one service
running with minimal boilerplate." **Spring Cloud** is built on top of
Spring Boot and solves *cross-service* concerns for a whole fleet of
those Spring Boot applications: how they find each other, how they
route traffic, how they share configuration, how they stay resilient to
each other's failures. A single-service application needs only Spring
Boot; the moment there's more than one service that needs to discover,
call, and stay resilient against each other, that's the point Spring
Cloud becomes relevant.

### Q: What is service circuit breaking, and what is service degradation, in the microservices context?

These are exactly the mechanisms covered in the High-Availability
document, applied at the service-mesh/microservice-fabric level rather
than only inside one application: **circuit breaking** stops a caller
from continuing to hit a dependency that's failing past a threshold, so
its own resources aren't wasted on calls likely to fail and the failing
dependency gets relief from load. **Degradation** is the deliberate,
often broader decision to disable or simplify a whole feature (not just
one failing call) to protect the system's critical path, typically
driven by a feature-flag/config-center push rather than purely by
per-call error-rate detection.

### Q: What are the pros and cons of microservices? What pitfalls have teams actually hit in production?

**Pros**: independent scaling and deployment per service, smaller
codebases that individual teams can own end-to-end, technology choice
per service, and failure isolation (one service's crash doesn't
necessarily take down the rest, if the isolation patterns above are
actually in place).

**Cons and real pitfalls**:
- **Operational complexity explosion** — what was one deployable is now
  N deployables, each needing its own monitoring, logging, alerting,
  on-call ownership, and CI/CD pipeline.
- **Distributed transactions and data consistency** — a "simple" business
  operation that used to be one local DB transaction is now a
  multi-service saga/TCC flow (see Distributed Systems), and teams that
  didn't design for this discover eventual-consistency bugs in
  production.
- **Network latency and reliability become part of business logic** —
  every service-to-service call that used to be a function call is now a
  network call that can be slow, fail, or duplicate; teams that skip
  timeout/retry/idempotency discipline get cascading failures (see
  High-Availability) or, worse, silent duplicate side effects.
- **Cross-cutting debugging is much harder** — a single user request can
  now fan out across a dozen services; without distributed tracing
  (correlation IDs propagated end-to-end) and centralized logging,
  "why did this request fail" becomes a multi-team archaeology exercise.
- **Over-decomposition** — splitting too early or too finely, before a
  team actually feels the pain that split would solve, multiplies
  operational cost for services that would have been fine as one for
  years. The pragmatic answer here is: split when a concrete scaling,
  deployment-cadence, or team-ownership pain shows up, not preemptively
  because "microservices are the modern way to do it."

### Q: What's in a typical microservices technology stack?

- **Service discovery/registration**: Eureka, Consul, Nacos, Zookeeper.
- **RPC/inter-service communication**: REST, gRPC, Dubbo, Feign
  (declarative REST client).
- **API gateway**: Spring Cloud Gateway, Zuul, Kong, Nginx — routing,
  auth, rate limiting at the edge before requests fan out internally.
- **Configuration management**: Spring Cloud Config, Nacos, Apollo.
- **Circuit breaking/resilience**: Resilience4j, Sentinel, (historically)
  Hystrix.
- **Messaging/event bus**: Kafka, RocketMQ, RabbitMQ.
- **Distributed tracing**: Sleuth+Zipkin, SkyWalking, Jaeger.
- **Containerization/orchestration**: Docker, Kubernetes — the deployment
  substrate almost all of the above assumes today.
- **Centralized logging/monitoring**: ELK stack, Prometheus + Grafana.

### Q: What is microservice governance strategy?

Governance is the set of policies applied consistently across every
service in the fleet, not left to each team to reinvent: consistent
service-discovery and naming conventions, uniform circuit-breaking and
timeout defaults, centralized API gateway policies (auth, rate limiting,
versioning), mandatory distributed tracing/correlation-ID propagation,
canary/gray-release traffic-shifting rules, and a config-center as the
single source of runtime configuration rather than baked-in properties
files per service. The point of governance is that a fleet of dozens or
hundreds of services only stays operable if the cross-cutting concerns
(the same ones listed in the tech-stack answer above) are enforced
uniformly — otherwise every service ends up with its own
slightly-different, under-tested version of resilience/discovery logic.

### Q: Eureka and Zookeeper can both do service registration/discovery — what's the difference?

This is a direct instance of the **CAP trade-off** discussed in the
Distributed Systems document: **Zookeeper is CP** — it requires a quorum
to serve writes (and, in its default configuration, even reads go through
a consistency-preserving path), so during a network partition the
minority side stops serving rather than risk returning stale/divergent
registry data. **Eureka is AP** — every Eureka node keeps serving its
locally-known registry data even if it's cut off from its peers, on the
principle that "a possibly-stale list of service instances is much more
useful to callers than no list at all" — service discovery specifically
tends to prefer availability, because acting on a slightly-stale instance
list (and letting client-side retry/circuit-breaking handle the rare
dead-instance case) is a much smaller problem than every caller in the
system losing the ability to discover services at all during a partition.

### Q: Describe Eureka's service discovery and registration process.

1. **Register**: on startup, a service instance sends its metadata
   (host, port, health-check URL) to a Eureka server, which stores it in
   an in-memory registry.
2. **Renew (heartbeat)**: the instance sends a periodic heartbeat to
   prove it's still alive; Eureka expects one within a configured
   interval or the instance is eventually evicted from the registry.
3. **Peer replication**: Eureka servers gossip registry state to each
   other (eventually consistent, per the AP choice above), so any Eureka
   node can answer a discovery query even about instances that registered
   with a different node.
4. **Fetch registry**: clients (via Eureka Client) periodically pull the
   full registry (or a delta) and cache it locally, so a client can keep
   picking providers even if it briefly can't reach any Eureka server —
   the same "consumers hold a locally cached provider list" pattern
   already seen in the Dubbo answer in the Distributed Systems document.
5. **Cancel**: on graceful shutdown, an instance explicitly deregisters;
   on ungraceful crash, the heartbeat-timeout eviction above is what
   eventually removes it — with a deliberate lag, which is the concrete
   cost of choosing availability over consistency here.
