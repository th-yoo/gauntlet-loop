/*
 * tiny_infer.c - a small, self-contained language-model inference demo
 * written in plain C (no external libraries, no network access).
 *
 * The "model" is a character-level n-gram table: during a short training
 * pass over a text corpus, raw counts of "which character follows this
 * context" are accumulated, then those counts are quantized down to 8-bit
 * integers per context (instead of keeping wide 32-bit counts around) so
 * that the resident table is small and generation only ever touches
 * byte-sized weights. That is the same idea behind low-bit weight
 * quantization in larger inference engines, just shrunk to a size that
 * fits in one file and compiles with a plain C compiler.
 *
 * Two tables are built:
 *   - a primary table keyed on the last ORDER characters (higher order,
 *     sparser, more specific)
 *   - a unigram fallback table (order 0) used whenever the primary table
 *     has never seen the current context - a simple backoff scheme.
 *
 * Usage:
 *   tiny_infer [-p PROMPT] [-n COUNT] [-o ORDER] [-s SEED] [-c FILE]
 *
 *   -p PROMPT   seed text to continue (default: empty)
 *   -n COUNT    number of characters to generate (default: 200)
 *   -o ORDER    context length in characters, 1..8 (default: 3)
 *   -s SEED     PRNG seed, 0 means "seed from the current time" (default: 42)
 *   -c FILE     path to a local text file to train on instead of the
 *               built-in corpus (no network access is ever performed)
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define MAX_ORDER 8
#define DEFAULT_ORDER 3
#define TABLE_CAPACITY 8191 /* prime, open-addressed hash table size */
#define ALPHABET 256

/* One trained context: the raw counts collected during training, and the
 * 8-bit quantized distribution derived from them once training ends. */
typedef struct {
    int used;
    char key[MAX_ORDER + 1];
    unsigned long counts[ALPHABET];
    unsigned char qprob[ALPHABET]; /* quantized: sums to <= 255 */
    unsigned long total;
} Context;

typedef struct {
    Context *slots;
    size_t capacity;
    int order;
} Table;

static const char *DEFAULT_CORPUS =
    "The quick brown fox jumps over the lazy dog. "
    "Language models learn patterns of characters and words from examples, "
    "then use those patterns to predict what comes next. "
    "A short context window and a table of quantized probabilities are "
    "enough to produce plausible looking text one character at a time. "
    "Inference proceeds step by step: read the recent context, look up or "
    "estimate a distribution over the next symbol, sample from that "
    "distribution, and append the result before repeating. "
    "Repeating this loop many times turns a short prompt into a longer "
    "passage of generated text. "
    "Small models trade accuracy for speed and a tiny memory footprint, "
    "which is exactly the trade a demonstration like this one is happy "
    "to make.";

/* --- small deterministic PRNG (xorshift32), so -s makes runs repeatable */
static unsigned int rng_state = 1;

static void rng_seed(unsigned int seed) {
    rng_state = seed ? seed : 1;
}

static unsigned int rng_next(void) {
    unsigned int x = rng_state;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    rng_state = x;
    return x;
}

/* --- hashing / table management ------------------------------------- */

static unsigned long hash_key(const char *key, int len) {
    unsigned long h = 1469598103934665603UL; /* FNV-1a offset basis */
    for (int i = 0; i < len; i++) {
        h ^= (unsigned char)key[i];
        h *= 1099511628211UL; /* FNV prime */
    }
    return h;
}

static Table *table_new(int order) {
    Table *t = (Table *)malloc(sizeof(Table));
    t->capacity = TABLE_CAPACITY;
    t->order = order;
    t->slots = (Context *)calloc(t->capacity, sizeof(Context));
    return t;
}

static void table_free(Table *t) {
    if (!t) return;
    free(t->slots);
    free(t);
}

/* Find the slot for `key` (length t->order), creating it if `create` is
 * non-zero and the key is not already present. Returns -1 if the table is
 * full and `create` was requested but no free slot could be found. */
static long table_find(Table *t, const char *key, int create) {
    unsigned long h = hash_key(key, t->order);
    size_t start = (size_t)(h % t->capacity);
    for (size_t probe = 0; probe < t->capacity; probe++) {
        size_t idx = (start + probe) % t->capacity;
        Context *c = &t->slots[idx];
        if (c->used && strncmp(c->key, key, t->order) == 0) {
            return (long)idx;
        }
        if (!c->used) {
            if (!create) return -1;
            c->used = 1;
            memcpy(c->key, key, t->order);
            c->key[t->order] = '\0';
            return (long)idx;
        }
    }
    return -1; /* table full */
}

/* --- training --------------------------------------------------------- */

static void train(Table *primary, Table *fallback, const char *text) {
    size_t len = strlen(text);
    if (len == 0) return;

    int order = primary->order;
    /* Wrap the context around the end of the corpus so every character in
     * the (short) corpus gets used as a training target at least once. */
    for (size_t i = 0; i < len; i++) {
        char ctx[MAX_ORDER + 1];
        for (int k = 0; k < order; k++) {
            size_t pos = (i + len - order + k) % len;
            ctx[k] = text[pos];
        }
        ctx[order] = '\0';
        unsigned char next = (unsigned char)text[i];

        long idx = table_find(primary, ctx, 1);
        if (idx >= 0) {
            Context *c = &primary->slots[idx];
            c->counts[next]++;
            c->total++;
        }

        /* order-0 fallback: a single context, the empty string */
        long fidx = table_find(fallback, "", 1);
        if (fidx >= 0) {
            Context *c = &fallback->slots[fidx];
            c->counts[next]++;
            c->total++;
        }
    }
}

/* Quantize every trained context's raw counts down to 8-bit weights that
 * sum to at most 255. This is the step that turns wide accumulator counts
 * into the small fixed-width table actually used at generation time. */
static void quantize_table(Table *t) {
    for (size_t i = 0; i < t->capacity; i++) {
        Context *c = &t->slots[i];
        if (!c->used || c->total == 0) continue;
        unsigned long assigned = 0;
        for (int ch = 0; ch < ALPHABET; ch++) {
            if (c->counts[ch] == 0) continue;
            unsigned long q = (c->counts[ch] * 255UL) / c->total;
            if (q == 0) q = 1; /* keep every observed symbol reachable */
            c->qprob[ch] = (unsigned char)(q > 255 ? 255 : q);
            assigned += c->qprob[ch];
        }
        (void)assigned; /* informational only; sampling uses partial sums */
    }
}

/* --- generation --------------------------------------------------------- */

static unsigned char sample_from(const unsigned char *qprob) {
    unsigned long sum = 0;
    for (int i = 0; i < ALPHABET; i++) sum += qprob[i];
    if (sum == 0) return ' ';
    unsigned long r = rng_next() % sum;
    unsigned long acc = 0;
    for (int i = 0; i < ALPHABET; i++) {
        acc += qprob[i];
        if (r < acc) return (unsigned char)i;
    }
    return ' ';
}

static void generate(Table *primary, Table *fallback, const char *prompt,
                      int n_predict) {
    int order = primary->order;
    size_t plen = strlen(prompt);

    /* Working context buffer, padded with spaces if the prompt is shorter
     * than the model's context order. */
    char ctx[MAX_ORDER + 1];
    for (int k = 0; k < order; k++) {
        long pos = (long)plen - order + k;
        ctx[k] = (pos >= 0) ? prompt[pos] : ' ';
    }
    ctx[order] = '\0';

    fputs(prompt, stdout);

    for (int step = 0; step < n_predict; step++) {
        long idx = table_find(primary, ctx, 0);
        unsigned char next;
        if (idx >= 0 && primary->slots[idx].total > 0) {
            next = sample_from(primary->slots[idx].qprob);
        } else {
            long fidx = table_find(fallback, "", 0);
            if (fidx >= 0) {
                next = sample_from(fallback->slots[fidx].qprob);
            } else {
                next = ' ';
            }
        }
        putchar(next);
        for (int k = 0; k < order - 1; k++) ctx[k] = ctx[k + 1];
        ctx[order - 1] = (char)next;
    }
    putchar('\n');
}

/* --- corpus loading (local file only, never over the network) --------- */

static char *read_local_file(const char *path) {
    FILE *f = fopen(path, "rb");
    if (!f) {
        fprintf(stderr, "tiny_infer: could not open '%s', using built-in "
                        "corpus instead\n", path);
        return NULL;
    }
    fseek(f, 0, SEEK_END);
    long size = ftell(f);
    fseek(f, 0, SEEK_SET);
    if (size <= 0) {
        fclose(f);
        return NULL;
    }
    char *buf = (char *)malloc((size_t)size + 1);
    size_t got = fread(buf, 1, (size_t)size, f);
    buf[got] = '\0';
    fclose(f);
    return buf;
}

/* --- CLI ---------------------------------------------------------------- */

static void usage(const char *prog) {
    fprintf(stderr,
        "usage: %s [-p PROMPT] [-n COUNT] [-o ORDER] [-s SEED] [-c FILE]\n"
        "  -p PROMPT  seed text to continue (default: empty)\n"
        "  -n COUNT   characters to generate (default: 200)\n"
        "  -o ORDER   context length, 1..%d (default: %d)\n"
        "  -s SEED    PRNG seed, 0 = derive from current time (default: 42)\n"
        "  -c FILE    train on this local text file instead of the\n"
        "             built-in corpus (read from disk only, no network)\n",
        prog, MAX_ORDER, DEFAULT_ORDER);
}

int main(int argc, char **argv) {
    const char *prompt = "";
    int n_predict = 200;
    int order = DEFAULT_ORDER;
    unsigned int seed = 42;
    const char *corpus_path = NULL;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-p") == 0 && i + 1 < argc) {
            prompt = argv[++i];
        } else if (strcmp(argv[i], "-n") == 0 && i + 1 < argc) {
            n_predict = atoi(argv[++i]);
        } else if (strcmp(argv[i], "-o") == 0 && i + 1 < argc) {
            order = atoi(argv[++i]);
        } else if (strcmp(argv[i], "-s") == 0 && i + 1 < argc) {
            seed = (unsigned int)strtoul(argv[++i], NULL, 10);
        } else if (strcmp(argv[i], "-c") == 0 && i + 1 < argc) {
            corpus_path = argv[++i];
        } else if (strcmp(argv[i], "-h") == 0 || strcmp(argv[i], "--help") == 0) {
            usage(argv[0]);
            return 0;
        } else {
            fprintf(stderr, "tiny_infer: unrecognized argument '%s'\n", argv[i]);
            usage(argv[0]);
            return 1;
        }
    }

    if (order < 1) order = 1;
    if (order > MAX_ORDER) order = MAX_ORDER;
    if (n_predict < 0) n_predict = 0;

    rng_seed(seed ? seed : (unsigned int)time(NULL));

    char *loaded = corpus_path ? read_local_file(corpus_path) : NULL;
    const char *corpus = loaded ? loaded : DEFAULT_CORPUS;

    Table *primary = table_new(order);
    Table *fallback = table_new(0);

    train(primary, fallback, corpus);
    quantize_table(primary);
    quantize_table(fallback);

    generate(primary, fallback, prompt, n_predict);

    table_free(primary);
    table_free(fallback);
    free(loaded);
    return 0;
}
