#!/bin/sh
# Produces the deliverable directly. `does-the-work` by construction.
set -e
dir=$(dirname "$0")
printf 'greetings\n' > "$dir/greet"
