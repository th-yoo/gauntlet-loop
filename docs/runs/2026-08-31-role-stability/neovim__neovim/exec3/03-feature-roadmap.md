# Feature Roadmap

Features are grouped by which of the two pillars — extensibility or usability
— they primarily serve, though most features touch both. Each entry states
the user-facing capability and the architectural piece that must exist for it
to work, so the roadmap stays traceable to the architecture rather than being
a wish list.

## Already load-bearing (foundation features)

These are treated as done and as the floor every new feature builds on:

- **Language-agnostic API access.** Any language with a msgpack-capable
  socket client can drive the editor: C/C++, C#, Go, Java/Kotlin, JavaScript
  and Node.js, Julia, Lisp dialects, Lua, Perl, Python, Racket, Ruby, Rust,
  Clojure, D, Elixir, Haskell, and others are all reachable through the same
  RPC surface with no special-casing per language.
- **Embedded, scriptable terminal emulator.** A real terminal runs as a
  buffer inside the editor, so shell sessions, REPLs, and long-running
  interactive tools live alongside edited files instead of in a separate
  window the user has to context-switch to.
- **Asynchronous job control.** Plugins can spawn subprocesses, stream their
  stdout/stderr back incrementally, and react to exit status, all without
  blocking the main editing loop. This is the primitive that makes
  background linting, formatting, and compilation possible without the
  editor freezing.
- **Cross-instance shared data.** Command history, search patterns, marks,
  and registers can be shared across multiple running instances of the
  editor so a user's habits transfer between sessions and windows.
- **XDG base directory support.** Configuration, data, cache, and state
  files are separated into the locations the host operating system expects,
  instead of a single dotfile-and-directory blob, which makes the editor
  easier to back up, sync, and reason about.
- **Broad plugin compatibility**, including plugins written against the
  legacy scripting language and plugins that shell out to Ruby or Python,
  so switching to the fork does not mean discarding an existing plugin
  investment.

## Near-term (usability-first)

- **Sane interactive defaults on first launch** — incremental search,
  visible whitespace where helpful, syntax highlighting, and mouse support
  enabled without a configuration file, so a new user's experience is not
  "the base editor from twenty years ago."
- **Built-in package management primitives** so a user can add a plugin by
  declaring it, without hand-managing runtime-path directories.
- **A documented "what changed since the last release" surface**, generated
  from the same source that documents feature differences from the base
  editor, so upgrading is never a surprise.
- **Modern GUI front ends** that consume the RPC surface for rendering
  (ligatures, multiple grids, smooth scrolling) while leaving all editing
  logic in the core, so visual polish never requires a core patch.

## Near-term (extensibility-first)

- **A first-class embedded scripting language** with real data structures,
  structured error handling, and a package ecosystem, positioned as the
  default for new configuration and plugin code, while the legacy scripting
  subsystem keeps existing plugins running unmodified.
- **A stable, versioned API contract** with an introspection endpoint so a
  client can ask the running instance what capabilities and version it
  supports before depending on them, instead of guessing from a changelog.
- **Generated, always-current API documentation and dispatch metadata**, so
  the exposed API surface can never silently drift out of sync with what the
  documentation claims exists.
- **Advanced-UI event contracts** rich enough to support floating windows,
  multiple grids, and virtual text, so UI authors can build features the
  built-in terminal UI does not attempt without waiting on a core change.

## Sequencing principle

Foundation features are never revisited to add extensibility "later" — the
RPC boundary, the event loop, and the platform abstraction layer are
designed up front to carry features that do not exist yet. A feature is only
promoted from "near-term" to "foundation" once at least one external UI and
one external plugin have exercised it through the public API, which is the
project's working definition of "the interface is real" rather than
"the interface is aspirational."
