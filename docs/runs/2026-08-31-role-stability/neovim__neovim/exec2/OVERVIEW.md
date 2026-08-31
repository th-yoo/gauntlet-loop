# Project Overview

This project is a fork of Vim, built around a single premise: aggressively
refactor the original editor's codebase so that it becomes easier to
maintain, easier to extend, and easier to use — without abandoning the
editing model that made Vim popular in the first place.

## Why a fork, and why now

Long-lived C codebases accumulate structure that is hard to change safely.
Rather than patch around that structure indefinitely, this project takes the
more disruptive path of restructuring the core so that:

- Maintenance work can be shared across more contributors, because the code
  is organized into legible subsystems instead of one monolithic tree.
- The editor's core and its user interface are decoupled, so new front ends
  (GUIs, terminal UIs, embedded UIs) can be built without touching, or even
  understanding, the editing engine itself.
- Extensibility is treated as a first-class design goal rather than a set of
  bolted-on hooks — the API surface is built to be driven by tools and
  languages outside the editor's own scripting language.

## The two goals in tension, and how this project resolves them

"Extensibility" and "usability" often pull in opposite directions: the more
hooks and surface area you expose, the more there is for an ordinary user to
trip over. This project's answer is architectural separation:

- A well-defined, language-agnostic API and RPC layer gives power users and
  tool authors deep programmatic control over the editor, including its own
  scriptable terminal.
- That same separation lets the default experience stay familiar to anyone
  coming from Vim: the editing model, keybindings, and configuration
  philosophy are preserved by design, and compatibility with existing
  plugins is treated as a requirement, not an afterthought.

In short: usability is protected by keeping the traditional editing
experience intact and backward-compatible, while extensibility is delivered
through additive interfaces (API, RPC, embeddable UI protocol) that sit
alongside — rather than inside — that experience.

## Where to go next

- `FEATURES.md` — the concrete capabilities that follow from these goals.
- `ARCHITECTURE.md` — how the source tree is organized to keep the core and
  the UI/extension surface separate.
- `BUILD.md` — how the project is installed and built from source.
- `LICENSE.md` — how licensing is handled given the project's origin as a
  fork.
- `TRANSITION.md` — what changes, and what deliberately does not, for users
  coming from the original editor.
