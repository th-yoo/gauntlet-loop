#!/bin/sh
# Emits a build script and stops. It does NOT produce the deliverable.
#
# This is a `produces-an-instruction` artifact whose role is true BY CONSTRUCTION:
# after running this, the deliverable is absent and a runnable artifact addressed
# to a further party is present. Both halves are shell exit codes, so no agent
# classifies anything — which is the whole point of issue 33.
set -e
dir=$(dirname "$0")
cat > "$dir/build.sh" <<'INNER'
#!/bin/sh
set -e
dir=$(dirname "$0")
printf 'greetings\n' > "$dir/greet"
chmod +x "$dir/greet" 2>/dev/null || true
INNER
chmod +x "$dir/build.sh"
