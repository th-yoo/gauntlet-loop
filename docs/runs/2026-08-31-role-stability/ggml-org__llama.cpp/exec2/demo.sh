#!/bin/sh
# Builds the inference engine and runs it a few times with different
# quantization bit depths, so the effect of coarser quantization on
# the sampled text is visible side by side.
set -e
cd "$(dirname "$0")"

cc -std=c99 -O2 -Wall -Wextra -o infer infer.c

for bits in 8 4 2 1; do
    echo "=== bits=$bits ==="
    ./infer -p "the model " -n 160 -b "$bits" -s 7
    echo
done
