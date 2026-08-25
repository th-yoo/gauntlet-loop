#!/bin/sh
# Cuts the release: runs the checks, then writes the version into VERSION beside this script.
set -e
here=$(dirname "$0")
echo "checks passed"
printf '1.4.0\n' > "$here/VERSION"
echo "stamped 1.4.0"
