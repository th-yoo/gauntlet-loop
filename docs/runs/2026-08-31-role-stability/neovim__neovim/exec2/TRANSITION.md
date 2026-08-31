# Coming From the Original Editor

Usability, for this project, is measured largely against one audience: users
of the editor it forked from. The bar it sets for itself is not "usable in
the abstract" but "usable without relearning muscle memory."

## What is preserved

- The core editing model — modes, motions, the command language — is not
  reinvented. Someone fluent in the original editor should be able to sit
  down and work immediately.
- The bulk of the existing plugin ecosystem, including plugins written in
  languages other than the project's native scripting language, keeps
  working. Compatibility is treated as a constraint on new features, not a
  nice-to-have.
- Configuration philosophy carries over: users are not asked to abandon
  existing configuration in order to adopt the fork.

## What is different, and where to read about it

Rather than scatter migration notes across external pages, the differences
are documented as a help topic inside the editor itself — reachable the same
way any other built-in documentation is reachable, and versioned alongside
the software it describes rather than living in a separate, driftable
location. The same is true of the running list of user-visible changes
introduced in each release: it is shipped as in-editor documentation, so it
is available offline and stays paired with the exact version installed.

## Why this matters for the extensibility goal

A fork that breaks its own predecessor's habits pays an adoption cost every
time it adds a feature. By fencing off "what changed" into a single,
discoverable, versioned place, this project can keep extending its API and
architecture aggressively (see `ARCHITECTURE.md`) without that work leaking
into the day-to-day experience of users who never touch the new interfaces
at all.
