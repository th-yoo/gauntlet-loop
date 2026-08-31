#!/bin/sh
# Writes report.txt BESIDE THIS SCRIPT — that placement is the whole point of this case.
set -e
here="$(cd "$(dirname "$0")" && pwd)"
{
  echo "REPORT"
  echo "generated-by: make-report.sh"
  echo "files-beside-me: $(ls "$here" | wc -l | tr -d ' ')"
} > "$here/report.txt"
echo "wrote $here/report.txt"
