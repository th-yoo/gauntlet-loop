#!/usr/bin/env bash
# Method 1: Install the TensorFlow Model Garden pip package.
#
# tf-models-official is the stable Model Garden package. Check the releases
# page of the source repository to see which modules are available.
# pip3 will install all models and dependencies automatically.
set -euo pipefail

echo "Installing stable package: tf-models-official"
pip3 install tf-models-official

# Note: tf-models-official may not include the latest changes on the master
# branch. To include the latest changes, install the nightly package instead
# (uncomment the line below):
# echo "Installing nightly package: tf-models-nightly"
# pip3 install tf-models-nightly

echo "Done. See the basic library import and NLP model building examples"
echo "referenced in OVERVIEW.md to learn how to use the pip package."
