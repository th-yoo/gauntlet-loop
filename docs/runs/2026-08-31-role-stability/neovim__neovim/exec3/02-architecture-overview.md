# Architecture Overview

The architecture follows directly from the vision: the editing core is split
into subsystems with narrow interfaces, and everything a UI or a plugin needs
is reachable through a documented boundary rather than a direct memory
reference into the core.

## Subsystem map

The application source is organized so that each directory owns exactly one
concern, and no subsystem reaches into another's internals without going
through its public entry points:

- **api/** — the surface that RPC clients and the embedded scripting language
  call into. This is the single place where "what can an external program ask
  the editor to do" is defined. If a capability is not exposed here, no UI and
  no plugin can reach it, which keeps the boundary honest.
- **eval/** — the legacy scripting-language subsystem, kept alive so that the
  large body of existing scripts and plugins continues to run unmodified.
  New core features are not required to be exposed here; they are exposed
  through `api/` and, where a scripting hook is needed, through `lua/`.
- **event/** — the event loop. All I/O (keyboard input, timers, subprocess
  output, RPC messages) funnels through one non-blocking loop so that no
  single slow operation can freeze the whole editor. This is the subsystem
  that makes "asynchronous by default" possible rather than aspirational.
- **generators/** — pre-compilation code generation. Boilerplate that would
  otherwise be hand-written and drift out of sync with the API definitions
  (dispatch tables, metadata for the RPC layer, documentation stubs) is
  generated from a single source of truth at build time.
- **lib/** — generic, editor-agnostic data structures (dynamic arrays, hash
  maps, and similar primitives) shared by every other subsystem. Keeping
  these generic and dependency-free is what lets multiple subsystems evolve
  independently without duplicating basic infrastructure.
- **lua/** — the embedded scripting subsystem that is the primary path for
  new extensibility work. It gets first-class access to the API surface and
  is the intended home for configuration, plugins, and UI-side logic that
  needs to run close to the core.
- **msgpack_rpc/** — the wire protocol implementation. This is what turns the
  API surface into something reachable over a socket or a pipe from any
  language that can speak a simple, well-specified serialization format,
  which is the mechanism that makes "advanced UIs without core
  modification" concrete rather than aspirational.
- **os/** — the platform abstraction layer. Every difference between
  operating systems (file paths, process spawning, terminal handling) is
  contained here so the rest of the codebase can be written against one
  consistent interface.
- **tui/** — the built-in terminal UI, implemented as a client of the same
  API and RPC surface that any external UI would use. Keeping the built-in
  UI honest about using the public interface (rather than a private
  shortcut into the core) is what keeps that interface actually complete.

## How a UI attaches

1. A UI process (built-in terminal UI, a GUI, or a third-party front end)
   starts or connects to a running core process over a socket, pipe, or
   standard I/O stream.
2. It speaks the RPC wire protocol, which round-trips structured requests and
   notifications rather than raw bytes.
3. The core dispatches each request against the API surface, executes it, and
   streams a response and any resulting UI events (redraws, cursor moves,
   mode changes) back over the same channel.
4. Because the wire protocol and the API surface are the only contract, a UI
   never needs to link against the core's internals, and the core never needs
   to know how many UIs, or what kind, are attached.

## How a plugin attaches

Plugins reach the editor through the same API surface UIs use, either from
inside the embedded scripting subsystem (in-process, lowest latency) or from
an external process speaking the RPC protocol (any language, including
languages with no C bindings at all). This is a deliberate consequence of
having one API rather than one API for "built-in" callers and a different,
weaker one for external callers.

## Cross-instance shared state

A lightweight shared-data mechanism lets multiple running instances
exchange command history, search history, marks, and registers, so that
opening a second window of the editor feels like continuing the same session
rather than starting a disconnected one. This is implemented as a subsystem
that any instance can read from and write to on exit and startup, rather than
as a live-synchronization protocol between running processes.

## Build-time structure

The build system is declarative-first (a build-graph generator with a
convenience wrapper on top) so that:

- the full set of build targets can be listed and inspected without reading
  the build scripts by hand;
- the resolved configuration (compiler, paths, feature flags) is written out
  to a cache file that can be diffed across builds; and
- the exact compiler invocation for every translation unit is recorded, so
  that external tooling (linters, static analyzers, editor tooling for the
  project's own C code) can be pointed at ground truth instead of guessing
  flags.
