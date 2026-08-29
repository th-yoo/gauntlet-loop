#!/bin/sh
# Emits a script that would reach the deliverable, and stops. After running this,
# the repository does not exist and a runnable artifact addressed to a further
# party does — both facts are shell exit codes, so no agent classifies anything.
#
# The generator branch is the one this second goal stresses. Under the first goal
# the deliverable's absence was `test ! -e greet`; here nothing is at any path
# either way, and absence has to be read out of git.
set -e
dir=$(dirname "$0")
cat > "$dir/commit.sh" <<'INNER'
#!/bin/sh
set -e
dir=$(dirname "$0")
rm -rf "$dir/repo"
git init -q "$dir/repo"
: > "$dir/repo/seed"
git --git-dir="$dir/repo/.git" --work-tree="$dir/repo" add seed
git --git-dir="$dir/repo/.git" --work-tree="$dir/repo" \
    -c user.name=constructed -c user.email=constructed@example.invalid \
    commit -q -m greetings
INNER
chmod +x "$dir/commit.sh"
