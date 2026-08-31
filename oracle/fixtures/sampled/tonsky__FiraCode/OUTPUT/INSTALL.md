# Fira Code — quickstart

Distilled from `README.md` (this fixture's only source). Every link and
version number below is copied verbatim from that file.

## 1. Download

Release zip named in the README:
[Fira_Code_v6.2.zip](https://github.com/tonsky/FiraCode/releases/download/6.2/Fira_Code_v6.2.zip)
(December 6, 2021, 2.5 MB).

Further guides linked from the README:

- [How to Install](https://github.com/tonsky/FiraCode/wiki)
- [Troubleshooting](https://github.com/tonsky/FiraCode/wiki#troubleshooting)
- [News & Updates](https://twitter.com/FiraCode)

## 2. Use on the web (no local install)

See `fira-code.css` in this directory — copied from the README's "Browser
support" section. Supported per the README: Firefox, Safari,
Chromium-based browsers, ACE, CodeMirror (with
`font-variant-ligatures: contextual;`), and IE 10+/Edge Legacy (with
`font-feature-settings: "calt";`).

## 3. Check editor/terminal support first

Before installing, confirm your tool is listed as working. This fixture's
`editor-compatibility.json` and `terminal-compatibility.json` are extracted
directly from the README's two compatibility tables (works / doesn't work),
so they can be queried without re-reading the markdown tables by eye.

Per the README, notable non-support includes: Alacritty, PuTTY, rxvt,
xterm, Windows Console, and (for editors) Adobe Dreamweaver, Delphi IDE,
IDLE, KDevelop 4.

## 4. Building from source (optional, macOS or Docker)

The README documents two build paths:

```bash
# macOS, using the repo's own scripts
./script/bootstrap_macos.sh
./script/build.sh
cp distr/otf/*.otf ~/Library/Fonts
```

```bash
# Docker, no local toolchain
make
make package
```

The build script accepts `-f/--features` (stylistic sets / character
variants, comma-separated, default none), `-n/--family-name` (default
"Fira Code"), and `-w/--weights` (default
"Light,Regular,Retina,Medium,SemiBold,Bold"), per the README.

## 5. If Fira Code doesn't fit

The README's own "Alternatives" section lists other free options — see
`alternatives.json` in this directory for the extracted list (8 free, 2
paid).
