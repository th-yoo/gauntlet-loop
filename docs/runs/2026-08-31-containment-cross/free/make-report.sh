#!/bin/sh
# Writes report.txt into the OUTPUT directory beside this script.
set -e
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$here/OUTPUT"
{
  echo "REPORT"
  echo "generated-by: make-report.sh"
  echo "files-beside-me: $(ls "$here" | wc -l | tr -d ' ')"
} > "$here/OUTPUT/report.txt"
echo "wrote $here/OUTPUT/report.txt"
