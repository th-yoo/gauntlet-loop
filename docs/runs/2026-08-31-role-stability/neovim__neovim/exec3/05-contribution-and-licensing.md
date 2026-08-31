# Contribution and Licensing

## Why contribution friction is treated as a bug

The "split the work between multiple developers" goal only holds if a new
contributor can actually find a subsystem, understand its boundary, and land
a change without a maintainer having to personally walk them through the
whole codebase. Contribution documentation is therefore treated as part of
the architecture, not an afterthought written after the fact: each subsystem
directory is expected to carry its own explanation of what it owns and how it
talks to its neighbors, in addition to the top-level guide new contributors
start from.

## What a good first contribution looks like

- It touches exactly one subsystem, identified from the subsystem map rather
  than guessed at from file proximity.
- It comes with a test living alongside the area it changes, so subsystem
  ownership stays visible in the test tree the same way it is visible in the
  source tree.
- If it changes anything reachable through the API surface, the generated
  documentation and dispatch metadata are regenerated as part of the change,
  never hand-edited to match, so the generator stays the source of truth.

## Porting fixes from upstream Vim

Because this is a fork, not a from-scratch rewrite, a meaningful share of
bug fixes originate as patches against the upstream Vim project and are
ported over deliberately, with the origin of each ported patch tracked so
provenance is never lost. This matters for two independent reasons:

1. **Correctness tracking** — when upstream fixes a bug, the fork can check
   whether the same bug exists here and pull the fix forward instead of
   rediscovering it independently.
2. **Licensing clarity** — code carried over from the upstream project keeps
   its original license terms, while everything written newly for the fork
   is licensed separately. Keeping the two clearly distinguished in the
   commit history is what makes it possible to state the project's licensing
   position precisely rather than approximately.

## Licensing position

New contributions to this project are licensed under the Apache 2.0 license,
starting from a specific, citable commit that marks the licensing boundary.
Contributions carried over from the upstream Vim project remain under their
original terms and are identified by a consistent marker in the commit
message so the boundary between "new, Apache-licensed work" and "ported,
upstream-licensed work" is auditable from history alone, not from memory or
from a contributor's say-so. Anyone redistributing the project, or a
derivative of it, is expected to consult the full license text rather than
this summary, since a summary can omit an obligation that the text does not.

## Review expectations

Reviewers are expected to check three things beyond correctness, because
these are the properties the whole architecture depends on:

- Does the change respect subsystem boundaries, or does it reach into another
  subsystem's internals to save a few lines?
- If it exposes new capability, is that capability reachable through the
  documented API surface rather than through an internal-only shortcut that
  only the built-in UI can use?
- If it is a ported upstream fix, is the porting clearly marked as such in
  the commit message, and does the change stay minimal and traceable to the
  upstream fix rather than being rewritten along the way?
