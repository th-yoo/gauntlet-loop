# Accessibility Checklist

Supplementary detail for `skills/frontend-ui-engineering/SKILL.md`. Floor is
WCAG 2.1 AA.

## Keyboard navigation

- [ ] Every interactive element is reachable via Tab, in a logical order
      matching visual layout.
- [ ] A visible focus indicator exists for every focusable element (never
      `outline: none` with no replacement).
- [ ] No keyboard trap — focus can always move away from any component,
      including modals (Escape closes, focus returns to the trigger).
- [ ] Custom interactive components (dropdowns, tabs, sliders) support the
      keyboard interaction pattern users expect for that widget type.

## Screen readers

- [ ] Images convey their meaning via `alt` text (empty `alt=""` for
      purely decorative images).
- [ ] Form fields have programmatically associated labels, not just
      visual proximity.
- [ ] Dynamic content updates (toasts, live validation errors) use an
      appropriate ARIA live region so they're announced.
- [ ] Headings form a logical hierarchy (no skipped levels used purely for
      visual sizing).

## Visual design

- [ ] Text contrast meets 4.5:1 (normal text) or 3:1 (large text) against
      its background.
- [ ] Color is never the only signal for state (error, success, required)
      — pair it with text or an icon.
- [ ] Content reflows without loss of function at 200% zoom.
- [ ] Motion/animation respects `prefers-reduced-motion`.

## ARIA

- [ ] ARIA roles/attributes are used only where native HTML semantics
      don't already provide them — a native `<button>` needs no `role`.
- [ ] Every `aria-*` attribute used is valid for the element it's on (an
      invalid ARIA attribute is worse than none, per the "no ARIA is
      better than bad ARIA" rule).

## Testing tools

- Automated: axe-core / Lighthouse accessibility audit as a baseline pass
  (catches roughly a third of issues — not sufficient alone).
- Manual: full keyboard-only pass; screen reader pass (VoiceOver, NVDA, or
  equivalent) reading the actual flow, not just spot-checking labels.
- Real runtime verification per `browser-testing-with-devtools` — computed
  accessibility tree, not just source markup.
