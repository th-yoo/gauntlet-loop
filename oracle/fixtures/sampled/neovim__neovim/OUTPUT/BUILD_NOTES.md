# Build notes (distilled from the source README)

These are not run by this task (no package managers, installers, or
system-changing commands were executed to produce this OUTPUT). They are a
transcription of what the source README states, kept here so the
extensibility/usability design docs in this directory can cite them as a
prerequisite for anyone building on this scaffold.

## From package

Pre-built packages for Windows, macOS, and Linux: see the project's
Releases page. Managed packages are additionally listed for Homebrew,
Debian, Ubuntu, Fedora, Arch Linux, Void Linux, and Gentoo.

## From source

- Full instructions and supported platforms: `BUILD.md` and
  `:help support.html#supported-platforms` (both referenced, neither
  reproduced here — this OUTPUT does not have network access to fetch them).
- Build system: CMake-based; a Makefile wrapper is provided for convenience.

```bash
make CMAKE_BUILD_TYPE=RelWithDebInfo
sudo make install
```

To install to a non-default location:

```bash
make CMAKE_BUILD_TYPE=RelWithDebInfo CMAKE_INSTALL_PREFIX=/full/path/
make install
```

Hints for inspecting an existing build, as given:

- `cmake --build build --target help` lists all build targets.
- `build/CMakeCache.txt` (or `cmake -LAH build/`) holds the resolved values
  of all CMake variables.
- `build/compile_commands.json` holds the full compiler invocation for each
  translation unit.

## Relevance to the extensibility/usability goal

The two-tier install story (pre-built packages *and* a documented from-source
path with introspection hints) is itself a usability decision: it lowers the
barrier for end users (package install) while keeping the barrier low for
contributors extending the API/event-loop/RPC subsystems (from-source build
with target/variable/compile-command introspection). See `DESIGN.md` for how
those subsystems map to the extensibility half of the goal.
