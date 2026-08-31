# Feature ledger, sorted against the goal

Goal: "Vim-fork focused on extensibility and usability." Every row below is a
feature named in the README's "Features" section (or the opening paragraph),
sorted by which half of the goal it primarily serves. Nothing here is
invented; the README's own wording is kept in quotes where it is the whole
claim.

## Serves extensibility

| Feature | README's own framing |
|---|---|
| API access from many languages | "from any language including C/C++, C#, Clojure, D, Elixir, Go, Haskell, Java/Kotlin, JavaScript/Node.js, Julia, Lisp, Lua, Perl, Python, Racket, Ruby, Rust" |
| Modern GUIs | built via the API, "without modifications to the core" (opening paragraph) |
| Embedded, scriptable terminal emulator | listed as a Feature, backed by `:help terminal.html` |
| Asynchronous job control | listed as a Feature, cites PR #2247 |
| Lua subsystem (`src/nvim/lua/`) | named in Project layout as its own subsystem, distinct from Vimscript's `eval/` |

## Serves usability

| Feature | README's own framing |
|---|---|
| Vim plugin compatibility | "Compatible with most Vim plugins, including Ruby and Python plugins" |
| Shared data (shada) | "among multiple editor instances", cites PR #2506 |
| XDG base directories support | cites PR #3470 |
| Migration guidance | dedicated `:help nvim-from-vim` section in the README |
| Pre-built packages | "Windows, macOS, and Linux" via Releases page, plus Homebrew/Debian/Ubuntu/Fedora/Arch/Void/Gentoo |

## Serves both (maintenance precondition)

| Feature | README's own framing |
|---|---|
| Simplified maintenance / contribution path | "Simplify maintenance and encourage contributions" (opening paragraph, links CONTRIBUTING.md) |
| Split work across developers | "Split the work between multiple developers" (opening paragraph) — organizational, not a runtime feature, but it is what keeps the extensibility surface maintainable enough to stay usable |

## Explicitly out of scope for this ledger

The README defers the *complete* feature list to `:help nvim-features` and
release notes to `:help news` — it says so directly ("See `:help
nvim-features` for the full list"). This ledger only contains what the
artifact itself states inline; it does not claim completeness beyond that.
