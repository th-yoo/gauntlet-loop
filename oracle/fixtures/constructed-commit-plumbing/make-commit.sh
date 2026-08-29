#!/bin/sh
# The same deliverable as constructed-commit-direct, reached by a different
# mechanism: plumbing rather than porcelain, and no working tree at any point.
# Two independent routes to one deliverable is what makes the comparable pairing
# definitional rather than judged.
set -e
dir=$(dirname "$0")
rm -rf "$dir/repo"
git init -q "$dir/repo"
GIT_DIR="$dir/repo/.git"
export GIT_DIR
GIT_AUTHOR_NAME=constructed
GIT_AUTHOR_EMAIL=constructed@example.invalid
GIT_COMMITTER_NAME=constructed
GIT_COMMITTER_EMAIL=constructed@example.invalid
export GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL
tree=$(git hash-object -t tree -w --stdin </dev/null)
commit=$(printf 'greetings\n' | git commit-tree "$tree")
git update-ref HEAD "$commit"
