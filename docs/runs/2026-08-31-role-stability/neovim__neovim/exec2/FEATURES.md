# Features

Features are grouped below by which of the two stated goals — extensibility
or usability — they primarily serve. Several features serve both; they are
placed under the goal they most directly advance.

## Extensibility

- **A programmatic API usable from many languages.** Editor state and
  behavior are reachable through an API designed to be called from outside
  the editor's own scripting language, so tooling can be written in
  whichever language a team already uses (C/C++, C#, Clojure, D, Elixir, Go,
  Haskell, Java/Kotlin, JavaScript/Node.js, Julia, Lisp, Lua, Perl, Python,
  Racket, Ruby, or Rust).
- **A UI protocol decoupled from the core.** Front ends — including modern
  graphical UIs — talk to the editor over a defined event/RPC interface,
  instead of being compiled into the editor itself. This is what makes it
  possible to build new UIs "without modifications to the core."
- **Asynchronous job control.** Long-running external processes can be
  started, monitored, and communicated with from the editor without
  blocking the interface, which is a prerequisite for most non-trivial
  plugins and integrations.
- **An embedded, scriptable terminal emulator.** The terminal is a first-
  class editable/scriptable object inside the editor rather than a
  bolted-on shell-out, which extends what plugins and users can automate.
- **Shared session data across instances.** Multiple running instances of
  the editor can share data (registers, marks, history, and similar state),
  which supports workflows that span several concurrent sessions.
- **Standard system directory conventions (XDG base directories).** Config,
  data, cache, and state files land in predictable, override-able locations,
  which makes the editor easier to script, package, and integrate with the
  rest of a user's environment.

## Usability

- **Compatibility with the existing plugin ecosystem.** Most plugins written
  for the original editor, including those written in Ruby and Python,
  continue to work — extensibility additions are designed not to break the
  installed base of user customizations.
- **Familiar installation paths.** The editor is distributed through the
  package managers and repositories users already have configured, so
  adoption does not require learning a new distribution mechanism.
- **A conventional, CMake-based build** with a Makefile convenience wrapper,
  so building from source follows patterns already familiar to most
  developers, with straightforward support for custom install locations.
- **Documented, discoverable feature and change lists.** The full feature
  set and the noteworthy changes in each release are available from inside
  the editor's own help system, so users are not required to consult
  external sources to learn what changed.
- **An explicit, documented transition path.** Users coming from the
  original editor have a dedicated help topic covering what is different,
  reducing the friction of switching.
