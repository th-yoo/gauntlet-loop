# Building and Installing

Two installation paths are supported, matching the usability goal of not
forcing every user through a from-source build, and the extensibility goal
of keeping the build itself simple enough to modify.

## Installing a pre-built package

Pre-built packages are made available for the major desktop platforms
(Windows, macOS, and Linux) as part of each release, and the editor is also
packaged by several general-purpose package managers and Linux/BSD
distribution repositories. For most users this is the recommended path: it
requires no build toolchain and stays up to date through whatever package
manager they already use.

## Building from source

The build system is CMake-based; a Makefile is provided as a thin
convenience wrapper so that a source build reduces to two familiar steps
once dependencies are installed:

```bash
make CMAKE_BUILD_TYPE=RelWithDebInfo
sudo make install
```

To install to a non-default location instead of the system prefix:

```bash
make CMAKE_BUILD_TYPE=RelWithDebInfo CMAKE_INSTALL_PREFIX=/full/path/
make install
```

### Inspecting the build

Because the build is CMake-based underneath the Makefile wrapper, the
following give visibility into exactly what the build is doing, which
matters for anyone extending or packaging the editor:

- Listing all available build targets, rather than guessing from the
  Makefile wrapper alone.
- Inspecting the resolved value of every CMake variable actually used for a
  given configured build, rather than the defaults documented separately.
- Inspecting the full compiler invocation used for each translation unit,
  which is useful for reproducing a build outside the normal build system or
  feeding tooling (linters, static analyzers) that need the exact compiler
  flags.

This is a deliberate usability choice for contributors: the build is
introspectable through the same tool (CMake) that drives it, instead of
requiring separate documentation to stay in sync with build behavior.
