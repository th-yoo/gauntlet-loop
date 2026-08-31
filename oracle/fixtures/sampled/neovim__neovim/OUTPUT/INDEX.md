# OUTPUT index

Goal: Vim-fork focused on extensibility and usability. Source material: the
one artifact at `oracle/fixtures/sampled/neovim__neovim/README.md`. No other
source was consulted.

- `DESIGN.md` — what the README's own text commits to under "extensibility"
  and "usability," and the architectural seams it names.
- `FEATURES.md` — every feature the README states, sorted onto the
  extensibility/usability split (or "both," where it's a maintenance
  precondition for either).
- `BUILD_NOTES.md` — the install/build instructions the README gives,
  transcribed (not executed) and tied back to the goal.
- `LICENSE_NOTE.md` — the license split the README states, and why it binds
  anything built on the scaffold below.
- `PROJECT_LAYOUT/` — a directory scaffold mirroring the README's "Project
  layout" tree; each folder holds a `README.md` stub carrying only the
  purpose annotation the source gave that folder.
