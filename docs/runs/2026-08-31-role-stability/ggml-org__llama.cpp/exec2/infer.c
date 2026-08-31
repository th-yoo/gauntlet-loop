/*
 * infer.c -- a small, dependency-free character-level language model
 * inference engine written in plain C (C99, standard library only).
 *
 * What it does:
 *   1. Trains an order-2 (trigram) character model with backoff to
 *      bigram, unigram and uniform distributions, on a short corpus
 *      that is embedded directly in this source file.
 *   2. Quantizes the resulting probability distribution at each
 *      generation step down to a configurable integer bit depth
 *      (1..8 bits), using a largest-remainder rounding scheme so the
 *      quantized weights sum exactly to 2^bits.
 *   3. Samples from the quantized, cumulative distribution to
 *      generate new text one character at a time, continuing from a
 *      user-supplied prompt.
 *
 * The point of the exercise is to show every stage of a minimal LLM
 * inference pipeline -- tokenize, build a probability table, quantize
 * it, sample from it -- as a single, portable, self-contained C
 * program with no third-party dependencies and no network access.
 *
 * Build:
 *   cc -std=c99 -O2 -Wall -Wextra -o infer infer.c
 *
 * Usage:
 *   ./infer [-p "prompt text"] [-n tokens] [-b bits] [-s seed]
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* ------------------------------------------------------------------ */
/* Embedded training corpus.                                          */
/*                                                                     */
/* This is original text written for this program; it is not copied   */
/* from any external document. It only needs to be long and varied    */
/* enough to give the toy trigram model something to learn from.       */
/* ------------------------------------------------------------------ */
static const char *CORPUS =
    "a small inference engine reads a sequence of symbols and predicts "
    "the symbol that is most likely to come next. the model keeps a "
    "table of counts for every pair of previous symbols it has seen, "
    "and it turns those counts into a probability for each possible "
    "next symbol. running the model on a plain central processing unit "
    "is possible because the arithmetic involved is simple addition, "
    "multiplication and comparison, not anything exotic. to make the "
    "model smaller and faster, the probabilities can be rounded down "
    "to a fixed number of integer levels before they are used, a "
    "process usually called quantization. fewer levels means less "
    "memory and less precision, more levels means more memory and "
    "closer behaviour to the original floating point numbers. good "
    "inference code keeps the training data, the counting step and the "
    "sampling step clearly separated so that each part can be tested "
    "on its own. sampling means picking one outcome at random, but "
    "weighted so that outcomes the model thinks are likely are picked "
    "more often than outcomes it thinks are unlikely. when the model "
    "has never seen the current context before, it falls back to a "
    "shorter context, and if that also fails it falls back further "
    "until it reaches a plain count of how often each symbol appears "
    "anywhere in the training data. this kind of fallback is called "
    "backoff. a small self contained program that trains, quantizes "
    "and samples in a few hundred lines of ordinary code is a useful "
    "way to see how a much larger language model behaves without "
    "needing any external library, network connection or installer.";

#define MAX_ALPHABET 128

typedef struct {
    int size;                    /* K: number of distinct symbols     */
    unsigned char symbols[MAX_ALPHABET];
    int char_to_idx[256];        /* -1 if the byte never occurs       */
} Alphabet;

static void alphabet_build(Alphabet *a, const char *text) {
    int seen[256];
    memset(seen, 0, sizeof(seen));
    for (int i = 0; i < 256; i++) a->char_to_idx[i] = -1;

    for (const unsigned char *p = (const unsigned char *)text; *p; p++)
        seen[*p] = 1;

    a->size = 0;
    for (int c = 0; c < 256; c++) {
        if (seen[c]) {
            if (a->size >= MAX_ALPHABET) {
                fprintf(stderr, "alphabet overflow\n");
                exit(1);
            }
            a->symbols[a->size] = (unsigned char)c;
            a->char_to_idx[c] = a->size;
            a->size++;
        }
    }
}

/* BOS_IDX (beginning-of-sequence) is one slot past the real alphabet,
 * used only as a context symbol, never as something we generate. */
static int bos_idx(const Alphabet *a) { return a->size; }

typedef struct {
    int K;                       /* alphabet size                     */
    unsigned long *unigram;      /* [K]                                */
    unsigned long *bigram;       /* [(K+1)*K]                          */
    unsigned long *trigram;      /* [(K+1)*(K+1)*K]                    */
} Model;

static unsigned long *bigram_row(Model *m, int ctx1) {
    return m->bigram + (size_t)ctx1 * m->K;
}
static unsigned long *trigram_row(Model *m, int ctx2, int ctx1) {
    size_t stride1 = (size_t)(m->K + 1) * m->K;
    return m->trigram + (size_t)ctx2 * stride1 + (size_t)ctx1 * m->K;
}

static void model_train(Model *m, const Alphabet *a, const char *text) {
    m->K = a->size;
    m->unigram  = calloc((size_t)m->K, sizeof(unsigned long));
    m->bigram   = calloc((size_t)(m->K + 1) * m->K, sizeof(unsigned long));
    m->trigram  = calloc((size_t)(m->K + 1) * (m->K + 1) * m->K,
                          sizeof(unsigned long));
    if (!m->unigram || !m->bigram || !m->trigram) {
        fprintf(stderr, "out of memory while training\n");
        exit(1);
    }

    int prev2 = bos_idx(a);
    int prev1 = bos_idx(a);

    for (const unsigned char *p = (const unsigned char *)text; *p; p++) {
        int cur = a->char_to_idx[*p];
        if (cur < 0) continue; /* cannot happen: alphabet built from text */

        m->unigram[cur]++;
        bigram_row(m, prev1)[cur]++;
        trigram_row(m, prev2, prev1)[cur]++;

        prev2 = prev1;
        prev1 = cur;
    }
}

/* Quantize a row of K non-negative counts into K non-negative integer
 * weights that sum exactly to (1 << bits), using largest-remainder
 * rounding. Returns the total mass placed (== 1 << bits) if the input
 * row had any positive counts, or 0 if the row was entirely zero. */
static unsigned long quantize_row(const unsigned long *counts, int K,
                                   int bits, unsigned long *qweights) {
    unsigned long sum = 0;
    for (int i = 0; i < K; i++) sum += counts[i];
    if (sum == 0) {
        for (int i = 0; i < K; i++) qweights[i] = 0;
        return 0;
    }

    unsigned long levels = 1UL << bits;
    double *frac = malloc(sizeof(double) * K);
    unsigned long placed = 0;

    for (int i = 0; i < K; i++) {
        double exact = (double)counts[i] * (double)levels / (double)sum;
        unsigned long floor_val = (unsigned long)exact;
        qweights[i] = floor_val;
        frac[i] = exact - (double)floor_val;
        placed += floor_val;
    }

    /* Hand out the remaining units to the largest fractional parts. */
    unsigned long remaining = levels - placed;
    while (remaining > 0) {
        int best = -1;
        double best_frac = -1.0;
        for (int i = 0; i < K; i++) {
            if (frac[i] > best_frac) {
                best_frac = frac[i];
                best = i;
            }
        }
        if (best < 0) break; /* should not happen */
        qweights[best]++;
        frac[best] = -1.0; /* do not pick the same slot twice per pass */
        remaining--;
        if (remaining > 0) {
            int any_left = 0;
            for (int i = 0; i < K; i++) if (frac[i] > -1.0) { any_left = 1; break; }
            if (!any_left) {
                /* reset for a second pass across all slots if we still
                 * owe more units than we have distinct fractions for */
                for (int i = 0; i < K; i++) {
                    double exact = (double)counts[i] * (double)levels / (double)sum;
                    frac[i] = exact - (double)qweights[i];
                }
            }
        }
    }

    free(frac);
    return levels;
}

/* Pick the row to sample from for the given context, applying
 * trigram -> bigram -> unigram -> uniform backoff. Writes K counts
 * into `row_out` and returns the backoff level used (3, 2, 1 or 0). */
static int select_row(Model *m, int ctx2, int ctx1, unsigned long *row_out) {
    unsigned long *tri = trigram_row(m, ctx2, ctx1);
    unsigned long sum = 0;
    for (int i = 0; i < m->K; i++) sum += tri[i];
    if (sum > 0) {
        memcpy(row_out, tri, sizeof(unsigned long) * m->K);
        return 3;
    }

    unsigned long *bi = bigram_row(m, ctx1);
    sum = 0;
    for (int i = 0; i < m->K; i++) sum += bi[i];
    if (sum > 0) {
        memcpy(row_out, bi, sizeof(unsigned long) * m->K);
        return 2;
    }

    sum = 0;
    for (int i = 0; i < m->K; i++) sum += m->unigram[i];
    if (sum > 0) {
        memcpy(row_out, m->unigram, sizeof(unsigned long) * m->K);
        return 1;
    }

    for (int i = 0; i < m->K; i++) row_out[i] = 1; /* uniform */
    return 0;
}

static int sample_index(const unsigned long *qweights, int K, unsigned long total) {
    if (total == 0) return rand() % K;
    unsigned long r = (unsigned long)rand() % total;
    unsigned long acc = 0;
    for (int i = 0; i < K; i++) {
        acc += qweights[i];
        if (r < acc) return i;
    }
    return K - 1; /* fallback for rounding edge cases */
}

static void usage(const char *prog) {
    fprintf(stderr,
        "usage: %s [-p prompt] [-n n_predict] [-b bits] [-s seed]\n"
        "  -p  prompt text to continue (default: \"the \")\n"
        "  -n  number of characters to generate (default: 300)\n"
        "  -b  quantization bit depth, 1..8 (default: 8)\n"
        "  -s  random seed (default: 42)\n",
        prog);
}

int main(int argc, char **argv) {
    const char *prompt = "the ";
    int n_predict = 300;
    int bits = 8;
    unsigned int seed = 42;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-p") == 0 && i + 1 < argc) {
            prompt = argv[++i];
        } else if (strcmp(argv[i], "-n") == 0 && i + 1 < argc) {
            n_predict = atoi(argv[++i]);
        } else if (strcmp(argv[i], "-b") == 0 && i + 1 < argc) {
            bits = atoi(argv[++i]);
        } else if (strcmp(argv[i], "-s") == 0 && i + 1 < argc) {
            seed = (unsigned int)strtoul(argv[++i], NULL, 10);
        } else if (strcmp(argv[i], "-h") == 0 || strcmp(argv[i], "--help") == 0) {
            usage(argv[0]);
            return 0;
        } else {
            fprintf(stderr, "unrecognized argument: %s\n", argv[i]);
            usage(argv[0]);
            return 1;
        }
    }

    if (bits < 1 || bits > 8) {
        fprintf(stderr, "bits must be between 1 and 8\n");
        return 1;
    }
    if (n_predict < 0) {
        fprintf(stderr, "n_predict must not be negative\n");
        return 1;
    }

    srand(seed);

    Alphabet alpha;
    alphabet_build(&alpha, CORPUS);

    Model model;
    model_train(&model, &alpha, CORPUS);

    fprintf(stderr,
        "[infer] alphabet=%d symbols, corpus=%zu chars, bits=%d, seed=%u\n",
        alpha.size, strlen(CORPUS), bits, seed);

    /* Seed the running context from the tail of the prompt, mapping any
     * byte outside the trained alphabet to beginning-of-sequence. */
    int ctx2 = bos_idx(&alpha);
    int ctx1 = bos_idx(&alpha);
    for (const unsigned char *p = (const unsigned char *)prompt; *p; p++) {
        int idx = alpha.char_to_idx[*p];
        ctx2 = ctx1;
        ctx1 = (idx >= 0) ? idx : bos_idx(&alpha);
    }

    fputs(prompt, stdout);

    unsigned long *row = malloc(sizeof(unsigned long) * alpha.size);
    unsigned long *qrow = malloc(sizeof(unsigned long) * alpha.size);
    int level_counts[4] = {0, 0, 0, 0};

    for (int step = 0; step < n_predict; step++) {
        int level = select_row(&model, ctx2, ctx1, row);
        level_counts[level]++;
        unsigned long total = quantize_row(row, alpha.size, bits, qrow);
        int idx = sample_index(qrow, alpha.size, total);
        putchar(alpha.symbols[idx]);

        ctx2 = ctx1;
        ctx1 = idx;
    }
    putchar('\n');

    fprintf(stderr,
        "[infer] backoff usage: trigram=%d bigram=%d unigram=%d uniform=%d\n",
        level_counts[3], level_counts[2], level_counts[1], level_counts[0]);

    free(row);
    free(qrow);
    free(model.unigram);
    free(model.bigram);
    free(model.trigram);
    return 0;
}
