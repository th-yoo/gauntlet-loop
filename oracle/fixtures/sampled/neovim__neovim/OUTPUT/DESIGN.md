# Design Notes: Vim-fork focused on extensibility and usability

Source: the project's own README (this repository's `README.md`). Everything
below restates or organizes claims already made there; nothing is invented.

## Stated goals (from the README's opening)

The project is framed as an aggressive refactor of Vim, undertaken to:

1. **Simplify maintenance** and encourage outside contributions.
2. **Split the work** between multiple developers (a maintainability/scaling
   goal, not a feature).
3. **Enable advanced UIs** without requiring modifications to the editor core.
4. **Maximize extensibility**, specifically via a documented API
   (`api-ui-events`).

Two of these four goals (3 and 4) map directly onto "extensibility"; the other
two (1 and 2) are the maintenance-side precondition that makes sustained
extensibility work possible — a codebase that is hard to maintain cannot stay
extensible for long, so the README treats them as one package rather than as
separate concerns.

## How "extensibility" is operationalized

The README does not leave "extensibility" abstract. It points at one concrete
mechanism: an API that lets external, out-of-process UIs and tools drive the
editor without patching its core. Consequences called out explicitly:

- The API is language-agnostic: client bindings exist "from any language
  including C/C++, C#, Clojure, D, Elixir, Go, Haskell, Java/Kotlin,
  JavaScript/Node.js, Julia, Lisp, Lua, Perl, Python, Racket, Ruby, Rust."
  Breadth of language support, not depth in any one language, is the
  extensibility axis the README chooses to advertise first.
- The API supports building "Modern GUIs" — i.e., the UI layer is meant to be
  swappable/replaceable rather than fixed to one built-in frontend.
- An embedded, scriptable terminal emulator and asynchronous job control are
  named as features that follow from the same event-loop/API architecture,
  not as unrelated add-ons.
- A built-in Lua subsystem (`src/nvim/lua/`) is called out in the project
  layout as a first-class subsystem alongside the legacy Vimscript
  (`eval/`) subsystem — i.e., extensibility is offered through two
  scripting surfaces, not one.

## How "usability" is operationalized

The README's usability claims are narrower and more conservative than its
extensibility claims:

- **Backward compatibility is explicit, not implied**: "Compatible with most
  Vim plugins, including Ruby and Python plugins." Usability here means
  *not breaking the existing Vim ecosystem* while extending it, rather than
  designing a new interaction model from scratch.
- **Cross-instance continuity**: shared data (`shada`) lets multiple editor
  instances share state, which is a usability property (less friction moving
  between sessions) built on the same "no core modification needed" API
  philosophy.
- **Standards conformance**: XDG base directories support is a usability
  claim aimed at reducing friction with the host OS's own conventions rather
  than inventing bespoke config-file locations.
- **Migration path for existing users**: a dedicated `:help nvim-from-vim`
  pointer exists specifically to lower the switching cost from Vim, which is
  a usability concern distinct from any single feature.

## Non-goals implied by omission

The README does not claim new default keybindings, a new modal-editing
model, or a departure from Vim's editing semantics. The "aggressive refactor"
language in the opening paragraph is scoped to *implementation* (maintenance,
work-splitting, UI decoupling, API surface) — it is not framed as a rewrite of
Vim's editing behavior. Any design building on this artifact should preserve
that scope: refactor the machinery that provides extensibility/usability,
don't redesign the editing model the README never says changed.

## Architectural seams named in the README

The "Project layout" section is the only place the README describes internal
structure, and it doubles as an implicit dependency/seam map:

- `src/nvim/api/` — the extensibility surface (API subsystem).
- `src/nvim/event/` — the event-loop subsystem the API and job control sit on.
- `src/nvim/msgpack_rpc/` — the RPC transport the API is delivered over.
- `src/nvim/eval/` and `src/nvim/lua/` — the two scripting/extensibility
  entry points available to plugin authors.
- `src/nvim/tui/` — one concrete UI built on top of the API, proving the
  "advanced UIs without core modification" claim is realizable.
- `src/nvim/os/` — platform code kept separate, which is what makes "Windows,
  macOS, and Linux" pre-built packages (see Install section) possible without
  the extensibility-facing subsystems needing to know about the platform.

See `PROJECT_LAYOUT/` in this OUTPUT directory for a scaffold mirroring this
tree, and `FEATURES.md` for the feature list organized against the
extensibility/usability split above.
