#!/bin/sh
# Cadence landing page — brief generation.
#
# Usage: sh emit-brief.sh
set -eu

HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
OUT="$HERE/run"
BRAND="Cadence"
TAGLINE="scheduling that keeps time with your team"

mkdir -p "$OUT"

cat > "$OUT/design-brief.md" <<BRIEF
# Design brief — $BRAND landing page

**Prepared for:** the studio taking this on.
**Prepared by:** this script. Nothing here has been built.

## What we need

A single landing page for **$BRAND**, our new scheduling product.

- Above the fold: product name, the tagline "$TAGLINE", one call to action.
- Three feature blocks. Copy for these is not written yet; write it from the notes below.
- A footer with contact and legal links, per the brand sheet you already hold.

## Notes for whoever builds it

- Brand colours and type are in the brand sheet; this brief does not restate them.
- Mobile first. We have no breakpoint requirements beyond that.
- Ship to the staging host we use for launches, then send the link for sign-off.

## What is out of scope for this brief

Everything after this document. No markup, no copy, no assets are produced here.
The page does not exist until the studio builds it from this brief.
BRIEF

printf 'wrote %s\n' "$OUT/design-brief.md"
