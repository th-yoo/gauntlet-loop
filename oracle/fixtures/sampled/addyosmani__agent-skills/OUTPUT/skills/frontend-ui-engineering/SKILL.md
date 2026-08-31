---
name: frontend-ui-engineering
description: Component architecture, design systems, state management, responsive design, WCAG 2.1 AA accessibility. Use when building or modifying user-facing interfaces.
---

## Overview

UI code accumulates inconsistency fastest of any layer, because every screen
looks locally fine in isolation while diverging from every other screen's
conventions. This skill anchors UI work to a small set of standing decisions
— component boundaries, state ownership, accessibility level — so each new
screen is consistent by default rather than by review-time correction.

## When to Use

- Building a new user-facing component or screen.
- Modifying an existing interface's layout, state, or interaction model.
- A design system or component library decision is being made or revisited.

## Process

1. **Place new UI against the existing component architecture** before
   writing markup — is this a variant of an existing component, a new
   primitive, or a composition of both? A new one-off component where a
   variant would do is the seed of design-system drift.
2. **Decide state ownership explicitly**: local component state, shared
   application state, or server state — and don't let a component reach
   past its own boundary to mutate state it doesn't own.
3. **Design responsively from the start**, not as a pass afterward — check
   the layout at the smallest and largest supported breakpoints while
   building, not only at the end.
4. **Meet WCAG 2.1 AA as a floor**, not a stretch goal: semantic markup,
   keyboard operability, sufficient contrast, and labeled interactive
   elements. See `references/accessibility-checklist.md` for the full test
   list.
5. **Verify with real runtime data** (`browser-testing-with-devtools`) —
   rendered DOM, computed styles, actual keyboard traversal — not just a
   visual read of the code.

## Rationalizations

| Excuse | Rebuttal |
|---|---|
| "I'll make this a one-off component, the design system doesn't quite fit." | A one-off that almost fits an existing pattern is usually a missing variant of that pattern, not a reason to fork it. |
| "Accessibility can be a follow-up pass." | Retrofitting keyboard and screen-reader support after markup is finalized costs more restructuring than building it in the first pass. |
| "It looks right at the width I'm testing at." | One width is not responsive design; the smallest and largest supported breakpoints are the ones most likely to break. |

## Red Flags

- A new component duplicates most of an existing one's markup with small
  variations.
- Interactive elements have no visible focus state or aren't reachable by
  keyboard alone.
- State that other components need is owned locally by one component,
  forcing prop-drilling or duplicated fetches.

## Verification

- The component's placement in the design system (new primitive, variant,
  or composition) is stated and justified.
- Keyboard-only navigation and contrast were checked with real runtime data,
  against `references/accessibility-checklist.md`, not asserted from
  reading the markup.
