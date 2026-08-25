#!/bin/sh
# Writes inventory.csv beside this script: one row per .md file in ../docs, with its line count.
set -e
here=$(dirname "$0")
out="$here/inventory.csv"
printf 'file,lines\n' > "$out"
for f in "$here"/../docs/*.md; do
  printf '%s,%s\n' "$(basename "$f")" "$(wc -l < "$f" | tr -d ' ')" >> "$out"
done
