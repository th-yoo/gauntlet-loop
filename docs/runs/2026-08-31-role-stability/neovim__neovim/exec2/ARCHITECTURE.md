# Architecture

The source tree is organized so that the pieces most relevant to
extensibility (the API, the event loop, the scripting subsystems) are kept
separate from the pieces most relevant to the default user experience (the
built-in terminal UI), and both are separate from build tooling. That
separation is the structural basis for the extensibility/usability split
described in `OVERVIEW.md`.

## Top-level layout

- **Build configuration** — CMake utility modules, CMake defines, and an
  optional subproject that fetches and builds third-party dependencies.
  Keeping dependency-fetching optional and isolated means the core build
  does not require network access or a specific dependency-management
  workflow to compile.
- **Runtime assets** — plugins and documentation that ship with the editor,
  separate from the compiled application. This lets user-facing behavior
  (help text, bundled plugins) evolve independently of the C source.
- **Application source** — the compiled core of the editor, itself broken
  into subsystems:
  - An **API subsystem**, the concrete implementation of the language-
    agnostic programmatic interface described under extensibility.
  - A **Vimscript subsystem**, which evaluates the original editor's
    scripting language — kept as its own module so scripting compatibility
    is a bounded, testable concern rather than something diffused through
    the whole codebase.
  - An **event-loop subsystem**, the shared mechanism underlying
    asynchronous job control, the RPC layer, and UI event dispatch.
  - A **code-generation step**, run before compilation, that produces
    generated source (for example, glue code for the API) rather than
    hand-maintaining it.
  - A **generic data-structures library**, shared low-level building blocks
    used across the other subsystems.
  - A **Lua subsystem**, a second, embeddable scripting language alongside
    Vimscript — part of how extensibility is delivered without displacing
    the scripting language existing users already rely on.
  - A **msgpack-RPC subsystem**, the wire protocol that lets external
    processes (UIs, plugins, tooling in any supported language) talk to a
    running editor instance.
  - **Low-level platform code**, isolating operating-system differences
    behind a common interface so the rest of the codebase does not need to
    special-case platforms.
  - A **built-in terminal UI**, one concrete UI client built on top of the
    same UI protocol that external, modern GUIs use — proof that the core
    imposes no special privilege on the default interface.
- **Tests** — a dedicated test tree covering the above, kept alongside
  rather than inside the application source.

## What this layout buys

- Any UI, including the one shipped by default, is a *client* of a public
  event/RPC protocol rather than something wired directly into the core —
  this is the mechanism behind "advanced UIs without modifications to the
  core."
- Two independent scripting subsystems (the original scripting language,
  plus an embeddable general-purpose language) coexist without one being
  layered awkwardly on top of the other, because each is its own module
  with its own boundary.
- Platform-specific code is contained in one place, so extensibility and
  usability work elsewhere in the tree does not have to be re-validated per
  platform.
