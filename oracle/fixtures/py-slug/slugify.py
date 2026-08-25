#!/usr/bin/env python3
"""Print a URL slug for each line of stdin."""
import re, sys

for line in sys.stdin:
    s = re.sub(r"[^a-z0-9]+", "-", line.strip().lower()).strip("-")
    if s:
        print(s)
