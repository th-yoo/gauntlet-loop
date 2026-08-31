# Vision and Goals

## Why this project exists

Vim is a mature, battle-tested editor, but its codebase has accumulated decades
of accretion that makes it hard for more than a handful of people to safely
modify the core at once. This project is a fork of Vim whose charter is to
aggressively refactor that core so the editor can keep the muscle memory and
modal-editing philosophy that made Vim popular while removing the barriers
that keep it from growing.

Four goals define the fork and every design decision traces back to one of
them:

1. **Simplify maintenance and lower the bar for contribution.** A contributor
   should be able to read a subsystem, understand its boundaries, and make a
   confident change without having read the entire codebase first.
2. **Split the work across many developers safely.** Subsystems should have
   narrow, well-defined interfaces so that two people can work on unrelated
   parts of the editor at the same time without stepping on each other.
3. **Enable advanced UIs without touching the core.** The editing engine and
   the presentation layer should be separated by a stable protocol, so a
   terminal UI, a GUI, and a browser-embedded UI can all drive the same core
   without the core knowing or caring which one is attached.
4. **Maximize extensibility.** Plugin authors and UI authors should be able to
   reach every editor capability through documented, versioned interfaces
   instead of monkey-patching internals.

## What "usability" means here

Usability is treated as a first-class, measurable property, not a slogan:

- **Zero-config improvements over the base editor.** Sensible defaults (syntax
  highlighting on, incremental search, sane backspace behavior, and similar
  quality-of-life settings) should ship out of the box so a new user's first
  five minutes are productive rather than confusing.
- **Discoverable extensibility.** A user should not need to read C source to
  add a feature; a scripting layer with a real standard library and package
  ecosystem takes priority over undocumented internal hooks.
- **Compatibility as a ramp, not a wall.** Existing muscle memory, most
  existing plugins written for the base editor, and existing configuration
  idioms should keep working, so switching costs stay low even as the
  internals change underneath.
- **Fast, asynchronous by default.** Long-running operations (linting,
  compilation, network calls) must never freeze the editing surface. If a
  plugin can be written to run a subprocess and stream its output back
  without blocking keystrokes, that plugin author should not have to fight
  the platform to get there.

## What "extensibility" means here

Extensibility is treated as an architectural constraint, not an add-on:

- **A real RPC boundary.** The editor core exposes its state and commands
  through a message-based protocol so that UIs and plugins in any language
  runtime can drive it, not only the language the core happens to be written
  in.
- **A first-class embedded scripting language** with proper data structures,
  error handling, and package management, positioned as the primary way to
  extend the editor going forward, while a compatibility layer keeps older
  scripts working.
- **An embedded, scriptable terminal** so that shell tools, REPLs, and
  external processes become editor citizens instead of context switches.
- **Cross-instance state sharing** (command history, search history, marks,
  registers) so that multiple concurrently running instances of the editor
  feel like one continuous session rather than isolated processes.
- **Standards-respecting configuration and data locations** so the editor is
  a good citizen of the host operating system and does not scatter files
  according to its own private convention.

## Non-goals

- This is not a rewrite from scratch. The fork's value comes from carrying
  forward the editing model, keybindings, and command language users already
  know while changing the engineering underneath.
- This is not a pursuit of maximal features for their own sake. Every feature
  is evaluated against whether it reduces friction for real editing and
  extension work, or just adds surface area to maintain.
- This is not a single-platform project. Anything that only works on one
  operating system is treated as a bug in the abstraction, not a shipped
  feature.
