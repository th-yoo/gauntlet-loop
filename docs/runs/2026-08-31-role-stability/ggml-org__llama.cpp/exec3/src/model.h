/* model.h -- a byte-level, single-block, multi-head self-attention language
 * model, small enough to run inference for on a laptop CPU with no backend
 * other than plain scalar C loops. This is the engine's whole "architecture
 * support matrix": one target, the CPU, exercised directly instead of
 * dispatched through a backend abstraction.
 */
#ifndef LMC_MODEL_H
#define LMC_MODEL_H

#include <stdint.h>

#include "tensor.h"

#define LMC_VOCAB 256   /* byte-level tokenizer: every uint8_t is a token */
#define LMC_DMODEL 32
#define LMC_NHEAD 4
#define LMC_HEAD_DIM (LMC_DMODEL / LMC_NHEAD)
#define LMC_DFF 64
#define LMC_MAX_CTX 512

typedef struct {
    Tensor embed_f;   /* LMC_VOCAB  x LMC_DMODEL, kept in float for lookup */
    QTensor wq, wk, wv, wo;   /* LMC_DMODEL x LMC_DMODEL, quantized */
    QTensor w1;               /* LMC_DMODEL x LMC_DFF, quantized */
    QTensor w2;               /* LMC_DFF x LMC_DMODEL, quantized */
} Model;

/* Deterministically synthesizes a model from `seed` (no weight file is
 * read or written -- the whole point is that this program has zero
 * external dependencies, data files included). */
void model_init(Model *m, uint64_t seed);
void model_free(Model *m);

/* Running per-layer key/value cache for causal attention, one entry per
 * head, one slot per context position. */
typedef struct {
    float k[LMC_NHEAD][LMC_MAX_CTX][LMC_HEAD_DIM];
    float v[LMC_NHEAD][LMC_MAX_CTX][LMC_HEAD_DIM];
    int len;
} KVCache;

void kvcache_reset(KVCache *c);

/* Runs one token through the block, appends its K/V to the cache, and
 * writes LMC_VOCAB logits for the *next* token into `logits_out`. */
void model_forward(const Model *m, KVCache *cache, uint8_t token, float *logits_out);

#endif /* LMC_MODEL_H */
