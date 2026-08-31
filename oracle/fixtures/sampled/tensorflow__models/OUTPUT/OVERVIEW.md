# Model Garden for TensorFlow — Overview

The TensorFlow Model Garden is a repository with a number of different
implementations of state-of-the-art (SOTA) models and modeling solutions for
TensorFlow users. It aims to demonstrate best practices for modeling so that
TensorFlow users can take full advantage of TensorFlow for their research and
product development.

To improve transparency and reproducibility, training logs on TensorBoard.dev
are also provided for models to the extent possible, though not all models
are suitable for this.

## Directory layout

| Directory | Description |
|-----------|-------------|
| `official` | A collection of example implementations for SOTA models using the latest TensorFlow 2 high-level APIs. Officially maintained, supported, and kept up to date with the latest TensorFlow 2 APIs. Reasonably optimized for fast performance while still being easy to read. |
| `research` | A collection of research model implementations in TensorFlow 1 or 2 by researchers. Maintained and supported by researchers. |
| `community` | A curated list of GitHub repositories with machine learning models and implementations powered by TensorFlow 2. |
| `orbit` | A flexible and lightweight library that users can easily use or fork when writing customized training loop code in TensorFlow 2.x. It integrates with `tf.distribute` and supports running on different device types (CPU, GPU, and TPU). |

## Installation

Two installation paths are supported:

1. **Pip package** — install the stable `tf-models-official` package (or the
   nightly `tf-models-nightly` package for the latest master-branch changes).
   See `install_pip.sh` in this directory.
2. **Clone the source** — clone the repository, add the top-level `models`
   folder to `PYTHONPATH`, and install the dependencies listed in
   `official/requirements.txt`. See `install_from_source.sh` in this
   directory.

## License

Apache License 2.0.

## Citation

If this software is used in research, cite the TensorFlow Model Garden
repository (see `CITATION.bib` in this directory).
