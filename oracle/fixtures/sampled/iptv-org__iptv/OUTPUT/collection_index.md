# IPTV Collection — Access Index (derived from README.md only)

Goal stated by the artifact: "Collection of publicly available IPTV (Internet
Protocol television) channels from all over the world."

This index organizes everything the README itself says about *how the
collection is reached and governed*. It does not enumerate individual
channels — the README does not list any channel names, countries, or stream
URLs directly; it only names the entry points where that data lives.

## 1. Single entry point for the whole collection

- Main playlist (all channels in the repository), one file:
  `https://iptv-org.github.io/iptv/index.m3u`
- Use: paste this link into any M3U-capable video player (e.g. VLC's Open
  Network Stream dialog) and press Open.

## 2. Finer-grained playlists

- The README states that links to other (presumably per-country / per-category)
  playlists are listed in `PLAYLISTS.md`, a sibling file not included in this
  artifact, so its contents cannot be reproduced here.

## 3. Program metadata (EPG)

- Electronic Program Guide data for most channels is produced by a separate
  tool published at `iptv-org/epg`, not by this repository directly.

## 4. Underlying channel data

- All channel data (the actual records: names, logos, categories, countries,
  stream URLs, etc.) is sourced from `iptv-org/database`, a separate
  repository. Corrections are filed there, not here.
- Consequence for this task: the raw channel list this collection is built
  from is not present in the README artifact and is out of scope to fetch
  (no network access permitted), so it cannot be reconstructed from this file
  alone.

## 5. Programmatic access

- An HTTP API is documented in a third separate repository, `iptv-org/api`.

## 6. Adjacent resources

- A curated list of other IPTV-related tools/apps lives in `iptv-org/awesome-iptv`
  (also referenced for player recommendations in section 1).
- Community Q&A / proposals: GitHub Discussions at `github.com/orgs/iptv-org/discussions`.
- Frequently asked questions: `FAQ.md` (sibling file, not included here).

## 7. Governance / legal posture of the collection

- No video files are stored in the repository; it only stores user-submitted
  links to streams that, to the maintainers' knowledge, were intentionally
  made public by their copyright holders.
- Copyright removal requests are handled via a specific GitHub issue template
  (`6_copyright-claim.yml`) on this repository, not via DMCA to GitHub itself,
  and not by contacting the maintainers about the destination content.
- License: CC0 (public domain dedication), per the `LICENSE` file referenced
  by the badge.

## What this artifact does NOT let us determine

- The number of channels, countries, or categories in the collection.
- Any actual stream URL, channel name, or logo.
- The contents of `PLAYLISTS.md`, `FAQ.md`, `CONTRIBUTING.md`, or `LICENSE` —
  these are referenced but not included in the sampled README.
- Anything from the three sibling repositories (`epg`, `database`, `api`,
  `awesome-iptv`) that the actual channel collection depends on.

These are structural gaps in the sampled artifact itself (it is an index/README,
not a data file), not omissions in this extraction.
