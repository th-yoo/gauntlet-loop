# Project layout scaffold

This directory reproduces the tree given under "Project layout" in the
source README, one directory per entry, each holding a stub `README.md`
whose only content is the purpose annotation the source README gave that
entry. This is a scaffold for where extensibility- and usability-facing
work would live, not an implementation.

```
├─ cmake/           CMake utils
├─ cmake.config/    CMake defines
├─ cmake.deps/      subproject to fetch and build dependencies (optional)
├─ runtime/         plugins and docs
├─ src/nvim/        application source code (see src/nvim/README.md)
│  ├─ api/          API subsystem
│  ├─ eval/         Vimscript subsystem
│  ├─ event/        event-loop subsystem
│  ├─ generators/   code generation (pre-compilation)
│  ├─ lib/          generic data structures
│  ├─ lua/          Lua subsystem
│  ├─ msgpack_rpc/  RPC subsystem
│  ├─ os/           low-level platform code
│  └─ tui/          built-in UI
└─ test/            tests (see test/README.md)
```

Of these, `src/nvim/api/`, `src/nvim/event/`, `src/nvim/msgpack_rpc/`,
`src/nvim/eval/`, and `src/nvim/lua/` are the subsystems `DESIGN.md` (in the
parent OUTPUT directory) identifies as carrying the extensibility half of the
goal; `src/nvim/tui/` and `src/nvim/os/` carry the usability/portability half.
