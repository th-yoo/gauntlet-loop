/* main.c -- command-line driver for a from-scratch, dependency-free
 * byte-level language model.
 *
 * Usage:
 *   lmc-infer [--seed N] [--tokens N] [--temp F] [--greedy] [PROMPT]
 *
 * Everything the program needs -- the tokenizer (raw bytes), the weights
 * (synthesized from --seed), and the math -- lives in this repository;
 * there is no model file to download and no network call to make. That is
 * also why the generated text is structured noise rather than prose: the
 * weights were never trained on anything, only shaped so the forward pass
 * is numerically well-behaved. The point of this program is the inference
 * *engine*, exercised end to end, not the fluency of an untrained model.
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "model.h"
#include "tensor.h"

static void print_usage(const char *prog) {
    fprintf(stderr,
            "usage: %s [--seed N] [--tokens N] [--temp F] [--greedy] [PROMPT]\n"
            "  --seed N     deterministic weight seed (default: 1234)\n"
            "  --tokens N   number of tokens to generate (default: 64)\n"
            "  --temp F     sampling temperature, ignored with --greedy (default: 0.8)\n"
            "  --greedy     always take the highest-probability token\n"
            "  PROMPT       bytes to prime the context with (default: \"llama\")\n",
            prog);
}

static int sample_from(const float *probs, int n, uint64_t *rng) {
    float r = rng_uniform(rng);
    float cum = 0.0f;
    for (int i = 0; i < n; i++) {
        cum += probs[i];
        if (r <= cum) return i;
    }
    return n - 1; /* floating point slop */
}

static int argmax(const float *x, int n) {
    int best = 0;
    for (int i = 1; i < n; i++) {
        if (x[i] > x[best]) best = i;
    }
    return best;
}

int main(int argc, char **argv) {
    uint64_t seed = 1234;
    int n_tokens = 64;
    float temp = 0.8f;
    int greedy = 0;
    const char *prompt = "llama";

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--seed") == 0 && i + 1 < argc) {
            seed = strtoull(argv[++i], NULL, 10);
        } else if (strcmp(argv[i], "--tokens") == 0 && i + 1 < argc) {
            n_tokens = atoi(argv[++i]);
        } else if (strcmp(argv[i], "--temp") == 0 && i + 1 < argc) {
            temp = strtof(argv[++i], NULL);
        } else if (strcmp(argv[i], "--greedy") == 0) {
            greedy = 1;
        } else if (strcmp(argv[i], "-h") == 0 || strcmp(argv[i], "--help") == 0) {
            print_usage(argv[0]);
            return 0;
        } else {
            prompt = argv[i];
        }
    }

    if (n_tokens < 0 || n_tokens > LMC_MAX_CTX) {
        fprintf(stderr, "--tokens must be between 0 and %d\n", LMC_MAX_CTX);
        return 1;
    }
    size_t prompt_len = strlen(prompt);
    if ((int)prompt_len >= LMC_MAX_CTX) {
        fprintf(stderr, "prompt longer than the %d-token context window\n", LMC_MAX_CTX);
        return 1;
    }
    if ((int)prompt_len + n_tokens > LMC_MAX_CTX) {
        fprintf(stderr,
                "prompt (%zu) + tokens (%d) exceeds the %d-token context window\n",
                prompt_len, n_tokens, LMC_MAX_CTX);
        return 1;
    }

    Model model;
    model_init(&model, seed);

    KVCache cache;
    kvcache_reset(&cache);

    uint64_t sample_rng = seed * 0x9E3779B97F4A7C15ULL ^ 0xD1B54A32D192ED03ULL;

    float logits[LMC_VOCAB];
    uint8_t next_token = 0;

    fwrite(prompt, 1, prompt_len, stdout);

    /* Prefill: run every prompt byte through the model so the KV cache
     * holds the whole prompt's context before generation starts. */
    for (size_t i = 0; i < prompt_len; i++) {
        model_forward(&model, &cache, (uint8_t)prompt[i], logits);
        next_token = (uint8_t)argmax(logits, LMC_VOCAB);
    }

    for (int t = 0; t < n_tokens; t++) {
        if (!greedy) {
            for (int v = 0; v < LMC_VOCAB; v++) logits[v] /= temp;
            softmax(logits, LMC_VOCAB);
            next_token = (uint8_t)sample_from(logits, LMC_VOCAB, &sample_rng);
        }
        /* Bytes outside the printable ASCII range are shown as '.' so the
         * terminal is never left in a broken state by raw control bytes. */
        unsigned char c = next_token;
        putchar((c >= 32 && c < 127) ? c : '.');
        fflush(stdout);

        model_forward(&model, &cache, next_token, logits);
        if (greedy) {
            next_token = (uint8_t)argmax(logits, LMC_VOCAB);
        }
    }
    putchar('\n');

    model_free(&model);
    return 0;
}
