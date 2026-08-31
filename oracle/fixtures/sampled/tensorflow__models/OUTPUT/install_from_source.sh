#!/usr/bin/env bash
# Method 2: Clone the source and install from it.
#
# Usage: install_from_source.sh [destination-directory]
# Defaults to cloning into ./models under the current directory.
set -euo pipefail

DEST="${1:-./models}"

echo "1. Cloning the GitHub repository into: $DEST"
git clone https://github.com/tensorflow/models.git "$DEST"

echo "2. Add the top-level models folder to the Python path."
echo "   For bash/sh:"
echo "     export PYTHONPATH=\$PYTHONPATH:$(realpath "$DEST" 2>/dev/null || echo "$DEST")"
echo "   For Windows PowerShell:"
echo "     \$env:PYTHONPATH += \":\\path\\to\\models\""
echo "   For a Colab notebook (Python):"
echo "     import os"
echo "     os.environ['PYTHONPATH'] += \":/path/to/models\""

echo "3. Installing other dependencies from official/requirements.txt"
pip3 install --user -r "$DEST/official/requirements.txt"

echo "If you are using NLP packages, also install the nightly text package:"
echo "  pip3 install tensorflow-text-nightly"

echo "Source installation steps complete."
