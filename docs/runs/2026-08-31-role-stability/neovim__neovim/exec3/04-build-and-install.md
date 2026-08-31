# Build and Install

## Installing a pre-built package

Most users should not need to build from source. Pre-built packages are
produced for Windows, macOS, and Linux and published alongside each release.
Distribution-maintained packages are also available through common system
package managers, so `apt`, `dnf`, `pacman`, `brew`, and similar tools can
install and update the editor the same way they manage everything else on the
system, without the user tracking releases manually.

## Building from source

The build is driven by a declarative build-graph description, with a
`Makefile` layered on top purely as a convenience wrapper for the common
case. Two things follow from that split:

- Anyone who wants fine-grained control (custom generators, cross-compiling,
  packaging for a distribution) can drop down to the underlying build tool
  directly.
- Anyone who just wants a working editor can ignore that entirely and run the
  convenience targets.

### Standard install

After installing the project's build and runtime dependencies:

```bash
make CMAKE_BUILD_TYPE=RelWithDebInfo
sudo make install
```

`RelWithDebInfo` is the recommended default build type for anyone who is not
actively debugging the editor's own source: it keeps optimizations on while
still producing debug symbols, so a crash report from a real user session is
still diagnosable.

### Installing to a custom location

Packagers, and anyone who does not want the editor touching system
directories, can redirect the install prefix:

```bash
make CMAKE_BUILD_TYPE=RelWithDebInfo CMAKE_INSTALL_PREFIX=/full/path/
make install
```

Because the install prefix is a build-system variable rather than something
hardcoded into the source, this requires no source changes and no special
build mode — it is the same build, pointed somewhere else.

## Inspecting the build

Three facts about a build should always be answerable without reading the
build scripts by hand, because opaque builds are exactly the kind of
maintenance burden this project exists to remove:

- **"What can I build?"** — the build tool can enumerate every target it
  knows about (library targets, test targets, documentation targets,
  packaging targets) on demand, so the discoverable surface is the same as
  the actual surface.
- **"What configuration did this build actually resolve to?"** — the
  resolved value of every build variable (compiler chosen, feature flags
  enabled or disabled, paths used) is written to a cache file inside the
  build directory that can be listed or diffed, rather than only being
  visible as command-line arguments someone has to remember they passed.
- **"What exact command compiled this file?"** — a compile-commands database
  is emitted covering every translation unit, so external tooling (linters,
  static analyzers, code-intelligence tools working on the project's own C
  source) can be pointed at the real invocation instead of an approximation.

## Platform support

Supported-platform status is tracked as a first-class piece of documentation,
not folklore. A platform is either actively supported (build failures on it
are treated as bugs) or explicitly marked otherwise, so a contributor never
has to guess whether "it doesn't build on my OS" is expected or a real
regression.
