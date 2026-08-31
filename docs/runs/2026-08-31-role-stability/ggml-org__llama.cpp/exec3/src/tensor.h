/* tensor.h -- minimal dense-vector/matrix helpers plus int8 quantization.
 *
 * No external dependencies: only the C standard library is used, so the
 * whole engine builds with a single `cc` invocation on any platform that
 * ships a C99 compiler.
 */
#ifndef LMC_TENSOR_H
#define LMC_TENSOR_H

#include <stddef.h>
#include <stdint.h>

/* A row-major float matrix. */
typedef struct {
    int rows;
    int cols;
    float *data; /* rows * cols */
} Tensor;

/* An int8-quantized row-major matrix with a single per-tensor scale.
 * Real value = data[i] * scale. Storing weights this way cuts resident
 * memory by 4x relative to float32, at the cost of a multiply per element
 * when the weight is used -- the same trade every integer-quantized
 * inference format makes. */
typedef struct {
    int rows;
    int cols;
    int8_t *data;
    float scale;
} QTensor;

Tensor tensor_alloc(int rows, int cols);
void tensor_free(Tensor *t);

/* Fill a tensor with values drawn from a small deterministic PRNG, scaled
 * for a roughly unit-variance forward pass (Xavier-ish). `seed` makes the
 * whole model reproducible without shipping a weights file. */
void tensor_init_random(Tensor *t, uint64_t *rng_state, float scale);

/* Quantize `src` into a freshly allocated int8 tensor `dst`. */
void tensor_quantize(const Tensor *src, QTensor *dst);
void qtensor_free(QTensor *t);

/* y (1 x n) = x (1 x m) @ W (m x n), W given as an int8-quantized matrix.
 * Dequantizes each weight on the fly: this is the actual "inference"
 * arithmetic -- every generated token walks through calls like this one. */
void qmatvec(const float *x, const QTensor *w, float *y);

/* In-place layer norm of a length-n vector (mean 0, unit variance, no
 * learned affine -- kept out to keep the tensor count small). */
void layernorm(float *x, int n);

/* In-place softmax of a length-n vector. */
void softmax(float *x, int n);

uint64_t rng_next(uint64_t *state);
float rng_uniform(uint64_t *state); /* in [0, 1) */

#endif /* LMC_TENSOR_H */
