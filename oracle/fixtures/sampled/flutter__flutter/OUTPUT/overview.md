# Flutter — Overview (distilled from README.md)

Source: `oracle/fixtures/sampled/flutter__flutter/README.md` (this fixture only; no
other source was consulted).

## What it is

Flutter is Google's SDK for crafting beautiful, fast user experiences for mobile,
web, and desktop from a single codebase. It works with existing code, is used by
developers and organizations around the world, and is free and open source.

## Why it delivers "beautiful apps for mobile and beyond"

The README organizes its case for Flutter into four claims, reproduced here in
its own order and, where noted, its own words:

1. **Beautiful user experiences.** Flutter's layered architecture gives control
   over every pixel on the screen, with compositing capabilities for overlaying
   and animating graphics, video, text, and controls "without limitation." A
   full widget catalog delivers pixel-perfect experiences on iOS (Cupertino) or
   other platforms (Material), plus support for customizing or creating new
   visual components.
2. **Fast results.** Flutter is powered by hardware-accelerated 2D graphics
   libraries (Skia, which underpins Chrome and Android, and Impeller), built for
   "glitch-free, jank-free graphics at the native speed of your device." The Dart
   language compiles to 32-/64-bit ARM machine code for iOS and Android,
   JavaScript and WebAssembly for the web, and Intel x64/ARM for desktop.
3. **Productive development.** Stateful hot reload lets a developer change code
   and see results instantly, without restarting the app or losing its state.
4. **Extensible and open model.** Flutter works with any development tool (or
   none), ships editor plug-ins for Visual Studio Code and IntelliJ / Android
   Studio, and gives access to tens of thousands of packages. Native code is
   reachable via FFI (Android, iOS, macOS, Windows) and platform channels for
   platform-specific APIs. Flutter itself is fully open source and takes
   contributions.

## Platform reach ("mobile and beyond")

Per the README, Flutter targets: iOS, Android, web, Windows, macOS, Linux, and
embedding as the UI toolkit for a platform of the developer's choice — i.e.
"mobile" (iOS/Android) plus web and the three major desktop OSes.

## Where to go next (as listed in the README)

- Install: https://docs.flutter.dev/get-started
- Docs: https://docs.flutter.dev
- Development wiki: `./docs/README.md`
- Contributing: `CONTRIBUTING.md` / https://github.com/flutter/flutter/blob/main/CONTRIBUTING.md
- Announcements: https://groups.google.com/g/flutter-announce
- Breaking changes: https://docs.flutter.dev/release/breaking-changes

## Terms of service (as stated in the README)

The Flutter tool may occasionally download resources from Google servers.
Downloading or using the Flutter SDK means agreeing to the Google Terms of
Service (https://policies.google.com/terms). Concretely: when installed from
GitHub (rather than a prepackaged archive), the `flutter` tool downloads the
Dart SDK from Google servers on first run, and again on `flutter upgrade`.

## Scope note

This overview and the accompanying `index.html` / `links.json` in this directory
were built entirely from the text of the README fixture. No network fetch, no
package manager, and no other repository or source were used to produce them.
