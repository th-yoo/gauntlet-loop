---
name: browser-testing-with-devtools
description: Chrome DevTools MCP for live runtime data - DOM inspection, console logs, network traces, performance profiling. Use when building or debugging anything that runs in a browser.
---

## Overview

Reading UI code tells you what should happen; it doesn't tell you what the
browser actually rendered, logged, or fetched. This skill requires checking
against live runtime data before declaring browser-facing work correct.

## When to Use

- Building or modifying anything that runs in a browser.
- A UI bug is reported and the code "looks" correct.
- A performance or network concern needs actual measurement rather than a
  guess from the source.

## Process

1. **Load the actual page** through the DevTools connection rather than
   reasoning from source alone.
2. **Inspect the rendered DOM**, not the authored markup — check that what
   was written actually produced the intended structure once the framework,
   CSS, and any client-side logic have run.
3. **Read the console for errors and warnings.** A clean visual render with
   console errors underneath is not a passing state.
4. **Trace the network requests** relevant to the change — check status
   codes, payload shapes, and timing, not just that a request happened.
5. **Profile performance when performance is in scope** — real trace data
   (see `references/performance-checklist.md`), not an assumption that a
   change is "probably fine" because it's small.
6. **Record what was actually observed** (DOM snapshot, console output,
   network trace) as the evidence for the verification step, not a
   description of expected behavior.

## Rationalizations

| Excuse | Rebuttal |
|---|---|
| "The code is correct, so the page will render correctly." | Frameworks, CSS cascade, and runtime data can all diverge from what the source implies — that gap is exactly what this skill checks. |
| "No console errors were mentioned, so there probably aren't any." | "Probably" is a guess; the console is one read away from being a fact. |
| "This is a small change, DevTools verification is overkill." | Small changes are exactly the ones skipped through to a regression that looked safe on paper. |

## Red Flags

- A UI change is declared done with no DOM, console, or network evidence
  attached.
- Console errors are present but were not addressed or explained.
- A performance claim is made with no trace data behind it.

## Verification

- The rendered DOM, console output, and (where relevant) network trace for
  the change are captured and match the intended behavior.
- Any console error or warning present is either resolved or explicitly
  justified as expected and unrelated.
