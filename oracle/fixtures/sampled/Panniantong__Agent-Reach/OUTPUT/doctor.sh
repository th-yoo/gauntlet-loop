#!/usr/bin/env bash
# Agent Reach — offline "doctor" (read-only transcription)
#
# Mirrors what the source README says `agent-reach doctor` reports: for each
# channel, which backend in its primary▸fallback list is currently reachable
# on this machine. This script is READ-ONLY:
#   - it does not install, download, or `pip install`/`npm install` anything
#   - it does not make any network request
#   - it only checks whether a command name already exists on PATH
#   - it never modifies the filesystem outside of nothing (no writes at all)
#
# It cannot verify login state, cookies, or MCP registration — only whether
# the underlying CLI binary is present. Where the source README says a
# platform has "no zero-config path" (Reddit) or needs a Chrome session
# (Facebook/Instagram/XiaoHongShu), presence of the binary is not sufficient
# and this script says so explicitly rather than claiming a channel is "up".

set -u

check() {
  local label="$1"; shift
  local found=""
  for cmd in "$@"; do
    if command -v "$cmd" >/dev/null 2>&1; then
      found="$cmd"
      break
    fi
  done
  if [ -n "$found" ]; then
    printf "  [present] %-16s -> found '%s' on PATH\n" "$label" "$found"
  else
    printf "  [missing] %-16s -> none of (%s) found on PATH\n" "$label" "$*"
  fi
}

echo "Agent Reach — offline channel probe (binary presence only, no network, no install)"
echo

echo "Zero-config channels:"
check "web"        curl
check "youtube"    yt-dlp
check "rss"        python3 python
check "github"     gh
check "bilibili"   bili bili-cli
echo

echo "Configure-to-unlock channels (primary ▸ fallback, per README):"
check "twitter"    twitter twitter-cli opencli bird
check "reddit"     opencli rdt-cli
check "facebook"   opencli
check "instagram"  opencli
check "xiaohongshu" opencli xhs-cli xiaohongshu-mcp
check "linkedin"   mcp-server-linkedin
check "exa_search" mcporter
echo

echo "Not checkable by this script (source README gives no CLI name / needs a live"
echo "browser session or an API key that cannot be probed without network access):"
echo "  - V2EX (no configuration needed, no dedicated CLI named in the README)"
echo "  - 雪球 (needs \"帮我配雪球\"; no CLI binary named)"
echo "  - 小宇宙播客 (needs Whisper key; no CLI binary named)"
echo
echo "Residual: presence of a binary on PATH does not mean the channel is usable —"
echo "Twitter still needs TWITTER_AUTH_TOKEN/TWITTER_CT0 set in-process, and"
echo "Reddit/Facebook/Instagram/XiaoHongShu via OpenCLI need an actual logged-in"
echo "desktop Chrome session, which this script cannot detect."
