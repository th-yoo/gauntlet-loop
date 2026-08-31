# tiny_infer

A minimal, dependency-free demonstration of LLM-style text inference written
entirely in plain C.

## Quick start

Build with any standard C compiler and run immediately — no model download,
no network access, no package manager:

```sh
make
./tiny_infer -p "The " -n 200
```

or, without `make`:

```sh
cc -O2 -std=c11 -o tiny_infer tiny_infer.c
./tiny_infer -p "The " -n 200
```

## Description

`tiny_infer` builds a small character-level language model from a text
corpus and then performs autoregressive inference: it repeatedly looks at
the last few generated characters, samples a next character from a learned
distribution, appends it, and repeats. This is the same generate-one-token,
feed-it-back loop used by larger language model inference engines, scaled
down to something that fits in a single C file.

Two design choices keep the implementation small and fast:

- **8-bit quantized weights.** During training, raw per-context character
  counts are collected as wide integers, then quantized down to 8-bit
  values before generation starts. Only the small quantized table is kept
  around for inference, the same general idea (trading precision for a
  smaller, faster-to-scan model) used by low-bit weight quantization in
  larger inference stacks.
- **Order-N context with a fallback.** The primary model conditions on the
  last `N` characters (`-o`, default 3). Any context it never saw during
  training falls back to a simple order-0 (unigram) distribution, so
  generation never gets stuck.

Everything runs on the CPU with no external libraries: the whole program is
standard C (`stdio`, `stdlib`, `string`, `time`), which keeps it portable
across compilers and platforms with zero build configuration.

## Usage

```
tiny_infer [-p PROMPT] [-n COUNT] [-o ORDER] [-s SEED] [-c FILE]

  -p PROMPT  seed text to continue (default: empty)
  -n COUNT   number of characters to generate (default: 200)
  -o ORDER   context length in characters, 1..8 (default: 3)
  -s SEED    PRNG seed, 0 = derive from the current time (default: 42)
  -c FILE    train on this local text file instead of the built-in
             corpus (read from disk only — no network access is ever
             performed by this program)
```

Examples:

```sh
# Deterministic run using the built-in training text
./tiny_infer -p "Once upon a time" -n 150 -s 1

# Train on your own local text file instead of the built-in corpus
./tiny_infer -c notes.txt -p "Summary: " -n 80

# Widen the context for more coherent (but less varied) output
./tiny_infer -o 5 -n 200
```

## Notes and limitations

- The model is a character-level n-gram table, not a neural network — it is
  meant to illustrate the mechanics of the inference loop (context window,
  quantized weights, sampling, feedback) rather than to produce
  high-quality text.
- With the small built-in corpus, longer context orders (`-o 5` or higher)
  will frequently fall back to the unigram distribution once the generated
  text drifts away from phrases seen during training.
- The PRNG is a small deterministic xorshift generator seeded by `-s`, so
  the same seed and arguments always reproduce the same output.

## Files

- `tiny_infer.c` — the complete implementation (training, quantization,
  and generation).
- `Makefile` — `make` to build, `make run` for a quick demo, `make clean`
  to remove the built binary.
