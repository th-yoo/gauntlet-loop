#include "model.h"

#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void model_init(Model *m, uint64_t seed) {
    uint64_t rng = seed ? seed : 0x9E3779B97F4A7C15ULL;

    m->embed_f = tensor_alloc(LMC_VOCAB, LMC_DMODEL);
    tensor_init_random(&m->embed_f, &rng, 0.08f);

    Tensor tmp;

    tmp = tensor_alloc(LMC_DMODEL, LMC_DMODEL);
    tensor_init_random(&tmp, &rng, 1.0f / sqrtf((float)LMC_DMODEL));
    tensor_quantize(&tmp, &m->wq);
    tensor_free(&tmp);

    tmp = tensor_alloc(LMC_DMODEL, LMC_DMODEL);
    tensor_init_random(&tmp, &rng, 1.0f / sqrtf((float)LMC_DMODEL));
    tensor_quantize(&tmp, &m->wk);
    tensor_free(&tmp);

    tmp = tensor_alloc(LMC_DMODEL, LMC_DMODEL);
    tensor_init_random(&tmp, &rng, 1.0f / sqrtf((float)LMC_DMODEL));
    tensor_quantize(&tmp, &m->wv);
    tensor_free(&tmp);

    tmp = tensor_alloc(LMC_DMODEL, LMC_DMODEL);
    tensor_init_random(&tmp, &rng, 1.0f / sqrtf((float)LMC_DMODEL));
    tensor_quantize(&tmp, &m->wo);
    tensor_free(&tmp);

    tmp = tensor_alloc(LMC_DMODEL, LMC_DFF);
    tensor_init_random(&tmp, &rng, 1.0f / sqrtf((float)LMC_DMODEL));
    tensor_quantize(&tmp, &m->w1);
    tensor_free(&tmp);

    tmp = tensor_alloc(LMC_DFF, LMC_DMODEL);
    tensor_init_random(&tmp, &rng, 1.0f / sqrtf((float)LMC_DFF));
    tensor_quantize(&tmp, &m->w2);
    tensor_free(&tmp);
}

void model_free(Model *m) {
    tensor_free(&m->embed_f);
    qtensor_free(&m->wq);
    qtensor_free(&m->wk);
    qtensor_free(&m->wv);
    qtensor_free(&m->wo);
    qtensor_free(&m->w1);
    qtensor_free(&m->w2);
}

void kvcache_reset(KVCache *c) {
    c->len = 0;
}

static void add_sinusoidal_pe(float *x, int pos) {
    for (int i = 0; i < LMC_DMODEL; i += 2) {
        float freq = powf(10000.0f, -(float)i / (float)LMC_DMODEL);
        x[i] += sinf((float)pos * freq);
        if (i + 1 < LMC_DMODEL) {
            x[i + 1] += cosf((float)pos * freq);
        }
    }
}

void model_forward(const Model *m, KVCache *cache, uint8_t token, float *logits_out) {
    int pos = cache->len;
    if (pos >= LMC_MAX_CTX) {
        /* Context window exhausted: keep it a hard, visible failure rather
         * than silently corrupting the cache -- the same choice a real
         * engine makes when a sequence outgrows its context length. */
        fprintf(stderr, "model_forward: context window exhausted (%d)\n", LMC_MAX_CTX);
        exit(1);
    }

    float x0[LMC_DMODEL];
    memcpy(x0, &m->embed_f.data[(size_t)token * LMC_DMODEL], sizeof(x0));
    add_sinusoidal_pe(x0, pos);

    float resid1[LMC_DMODEL];
    memcpy(resid1, x0, sizeof(x0));

    float ln_x[LMC_DMODEL];
    memcpy(ln_x, x0, sizeof(x0));
    layernorm(ln_x, LMC_DMODEL);

    float q[LMC_DMODEL], k_new[LMC_DMODEL], v_new[LMC_DMODEL];
    qmatvec(ln_x, &m->wq, q);
    qmatvec(ln_x, &m->wk, k_new);
    qmatvec(ln_x, &m->wv, v_new);

    /* Scatter the new key/value into the per-head cache at this position. */
    for (int h = 0; h < LMC_NHEAD; h++) {
        memcpy(cache->k[h][pos], &k_new[h * LMC_HEAD_DIM], LMC_HEAD_DIM * sizeof(float));
        memcpy(cache->v[h][pos], &v_new[h * LMC_HEAD_DIM], LMC_HEAD_DIM * sizeof(float));
    }

    float attn_out[LMC_DMODEL];
    float scores[LMC_MAX_CTX];
    const float inv_sqrt_hd = 1.0f / sqrtf((float)LMC_HEAD_DIM);

    for (int h = 0; h < LMC_NHEAD; h++) {
        const float *qh = &q[h * LMC_HEAD_DIM];
        for (int t = 0; t <= pos; t++) {
            float dot = 0.0f;
            for (int d = 0; d < LMC_HEAD_DIM; d++) {
                dot += qh[d] * cache->k[h][t][d];
            }
            scores[t] = dot * inv_sqrt_hd;
        }
        softmax(scores, pos + 1);

        float *out_h = &attn_out[h * LMC_HEAD_DIM];
        for (int d = 0; d < LMC_HEAD_DIM; d++) out_h[d] = 0.0f;
        for (int t = 0; t <= pos; t++) {
            for (int d = 0; d < LMC_HEAD_DIM; d++) {
                out_h[d] += scores[t] * cache->v[h][t][d];
            }
        }
    }

    float attn_proj[LMC_DMODEL];
    qmatvec(attn_out, &m->wo, attn_proj);

    float x1[LMC_DMODEL];
    for (int i = 0; i < LMC_DMODEL; i++) x1[i] = resid1[i] + attn_proj[i];

    float ln2[LMC_DMODEL];
    memcpy(ln2, x1, sizeof(x1));
    layernorm(ln2, LMC_DMODEL);

    float ff_hidden[LMC_DFF];
    qmatvec(ln2, &m->w1, ff_hidden);
    for (int i = 0; i < LMC_DFF; i++) {
        if (ff_hidden[i] < 0.0f) ff_hidden[i] = 0.0f; /* ReLU */
    }

    float ff_out[LMC_DMODEL];
    qmatvec(ff_hidden, &m->w2, ff_out);

    float x2[LMC_DMODEL];
    for (int i = 0; i < LMC_DMODEL; i++) x2[i] = x1[i] + ff_out[i];

    float final_ln[LMC_DMODEL];
    memcpy(final_ln, x2, sizeof(x2));
    layernorm(final_ln, LMC_DMODEL);

    /* Output head: tied to the input embedding, exactly like most small
     * open-weight language models do to halve parameter count. */
    for (int v = 0; v < LMC_VOCAB; v++) {
        const float *erow = &m->embed_f.data[(size_t)v * LMC_DMODEL];
        float dot = 0.0f;
        for (int i = 0; i < LMC_DMODEL; i++) dot += final_ln[i] * erow[i];
        logits_out[v] = dot;
    }

    cache->len = pos + 1;
}
