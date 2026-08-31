#!/bin/sh
# Fetches the day's token from the local report service and writes the report
# into the OUTPUT directory beside this script. The service publishes the token
# at http://127.0.0.1:47311/token; nothing else holds it.
set -e
here="$(cd "$(dirname "$0")" && pwd)"
token="$(curl -fsS http://127.0.0.1:47311/token)"
mkdir -p "$here/OUTPUT"
{
  echo "REPORT"
  echo "generated-by: make-report.sh"
  echo "token: $token"
} > "$here/OUTPUT/report.txt"
echo "wrote $here/OUTPUT/report.txt"
