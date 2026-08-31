#!/bin/sh
set -e
here="$(cd "$(dirname "$0")" && pwd)"
printf 'REPORT\ngenerated-by: finish.sh\n' > "$here/report.txt"
