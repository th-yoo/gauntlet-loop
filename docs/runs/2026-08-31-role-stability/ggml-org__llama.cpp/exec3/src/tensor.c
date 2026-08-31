#include "tensor.h"

#include <math.h>
#include <stdlib.h>
#include <string.h>

uint64_t rng_next(uint64_t *state) {
    /* xorshift64* -- small, dependency-free, and good enough to seed a toy
     * model deterministically from an integer. */
    uint64_t x = *state;
    x ^= x >> 12;
    x ^= x << 25;
    x ^= x >> 27;
    *state = x;
    return x * 0x2545F4914F6CDD1DULL;
}

float rng_uniform(uint64_t *state) {
    return (float)((rng_next(state) >> 11) * (1.0 / 9007199254740992.0));
}

static float rng_signed(uint64_t *state) {
    return 2.0f * rng_uniform(state) - 1.0f;
}

Tensor tensor_alloc(int rows, int cols) {
    Tensor t;
    t.rows = rows;
    t.cols = cols;
    t.data = (float *)calloc((size_t)rows * (size_t)cols, sizeof(float));
    return t;
}

void tensor_free(Tensor *t) {
    free(t->data);
    t->data = NULL;
    t->rows = t->cols = 0;
}

void tensor_init_random(Tensor *t, uint64_t *rng_state, float scale) {
    size_t n = (size_t)t->rows * (size_t)t->cols;
    for (size_t i = 0; i < n; i++) {
        t->data[i] = rng_signed(rng_state) * scale;
    }
}

void tensor_quantize(const Tensor *src, QTensor *dst) {
    size_t n = (size_t)src->rows * (size_t)src->cols;
    float max_abs = 1e-8f;
    for (size_t i = 0; i < n; i++) {
        float a = fabsf(src->data[i]);
        if (a > max_abs) max_abs = a;
    }
    float scale = max_abs / 127.0f;
    dst->rows = src->rows;
    dst->cols = src->cols;
    dst->scale = scale;
    dst->data = (int8_t *)malloc(n * sizeof(int8_t));
    for (size_t i = 0; i < n; i++) {
        float q = src->data[i] / scale;
        if (q > 127.0f) q = 127.0f;
        if (q < -127.0f) q = -127.0f;
        dst->data[i] = (int8_t)lrintf(q);
    }
}

void qtensor_free(QTensor *t) {
    free(t->data);
    t->data = NULL;
    t->rows = t->cols = 0;
}

void qmatvec(const float *x, const QTensor *w, float *y) {
    for (int j = 0; j < w->cols; j++) {
        float acc = 0.0f;
        for (int i = 0; i < w->rows; i++) {
            float wij = (float)w->data[(size_t)i * w->cols + j] * w->scale;
            acc += x[i] * wij;
        }
        y[j] = acc;
    }
}

void layernorm(float *x, int n) {
    float mean = 0.0f;
    for (int i = 0; i < n; i++) mean += x[i];
    mean /= (float)n;

    float var = 0.0f;
    for (int i = 0; i < n; i++) {
        float d = x[i] - mean;
        var += d * d;
    }
    var /= (float)n;
    float inv_std = 1.0f / sqrtf(var + 1e-5f);

    for (int i = 0; i < n; i++) {
        x[i] = (x[i] - mean) * inv_std;
    }
}

void softmax(float *x, int n) {
    float max_val = x[0];
    for (int i = 1; i < n; i++) {
        if (x[i] > max_val) max_val = x[i];
    }
    float sum = 0.0f;
    for (int i = 0; i < n; i++) {
        x[i] = expf(x[i] - max_val);
        sum += x[i];
    }
    for (int i = 0; i < n; i++) {
        x[i] /= sum;
    }
}
