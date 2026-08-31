#!/bin/sh
set -e
here="$(cd "$(dirname "$0")" && pwd)"
cat > "$here/guide.md" <<'DOC'
# Blanching

1. Boil salted water hard.
2. Green beans take 3 minutes; broccoli takes 2 minutes.
3. Ice bath for 1 minute, then drain.
DOC
