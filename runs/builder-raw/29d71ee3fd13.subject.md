# Build notes — raised, not decided

Per HANDOFF.md: "If anything above blocks you, raise it with the account manager
rather than making the call yourselves." The four items below are exactly that —
things this build could not resolve from the handoff alone, flagged rather than
guessed at.

## What's built

`index.html` is a single, static, JS-free page (no router, nothing behind a script
tag) with the approved copy verbatim, three feature sections, a header CTA and a
footer CTA. All styling is inline in `<head>` — no external stylesheet, no webfont
request — so there is nothing render-blocking and nothing that depends on JavaScript
anywhere on the page, including the CTAs. `assets/hero-calendar.svg` is the only
above-the-fold image, at ~3.4 KB, well inside the 120 KB hero budget. No cookie
banner is included, per the handoff's own scope note.

## Open items for the account manager

1. **Brand assets.** `cadence-lockup.svg`, the two-colour mark, and the product
   screenshots live on the shared drive (`Brand/Cadence/`, `Screens/`), which this
   build had no access to. `assets/cadence-lockup.svg`, `assets/favicon.svg`, and
   the three `assets/feature-*.svg` icons are stand-ins drawn in the same two-colour
   ink/accent treatment, not the real files. Swap them in once the drive is
   reachable; nothing else in `index.html` needs to change to accept the swap.
2. **Söhne.** The licence "is ours" but the seat/font files haven't arrived. Headings
   currently fall back to the system font stack (`--font-display` in `index.html`).
   Add an `@font-face` and point `--font-display` at it once the files land.
3. **Sign-up destination.** The handoff gives approved copy for both CTAs but no
   target URL for "Start scheduling — free." Both CTAs currently point at a
   placeholder relative path, `/get-started`. Needs the real signup/app URL before
   this goes anywhere near production.
4. **Staging URL.** This environment has no deploy access, so there is no staging
   URL to hand the account manager yet — `index.html` is static and dependency-free,
   so it should drop onto any static host as-is once one is available.

## Not touched

The approved copy in `index.html` is reproduced exactly as given in HANDOFF.md —
no rewrites.
