#!/bin/sh
# Produces the deliverable directly. `does-the-work` by construction, under a
# goal whose deliverable is NOT a file: no path holds a commit, so the check has
# to ask git rather than the filesystem. That is the whole point of this second
# goal — issue 33's capacity adjudication recorded that the first four rows all
# sat under one goal whose deliverable was a file, and that nothing there showed
# the role derivation survives a goal where it is not.
set -e
dir=$(dirname "$0")
rm -rf "$dir/repo"
git init -q "$dir/repo"
: > "$dir/repo/seed"
git --git-dir="$dir/repo/.git" --work-tree="$dir/repo" add seed
git --git-dir="$dir/repo/.git" --work-tree="$dir/repo" \
    -c user.name=constructed -c user.email=constructed@example.invalid \
    commit -q -m greetings
