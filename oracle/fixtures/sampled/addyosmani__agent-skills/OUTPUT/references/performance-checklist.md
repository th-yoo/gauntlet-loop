# Performance Checklist

Supplementary detail for `skills/performance-optimization/SKILL.md` and the
`web-performance-auditor` persona.

## Core Web Vitals targets

| Metric | Good | Needs Improvement | Poor |
|---|---|---|---|
| LCP (Largest Contentful Paint) | ≤ 2.5s | ≤ 4.0s | > 4.0s |
| INP (Interaction to Next Paint) | ≤ 200ms | ≤ 500ms | > 500ms |
| CLS (Cumulative Layout Shift) | ≤ 0.1 | ≤ 0.25 | > 0.25 |

Report the measured number and its conditions (device profile, network
throttle, page state), not just which band it falls in — the
metric-honesty rule in `agents/web-performance-auditor.md`.

## Frontend checklist

- [ ] Largest above-the-fold image/text block identified and confirmed not
      blocked by render-blocking resources.
- [ ] JavaScript bundle size measured for this change specifically (not
      just "the whole app is fine"), and any new dependency's cost stated.
- [ ] Layout-shifting elements (ads, late-loading images, injected
      banners) have reserved space before content loads.
- [ ] Long tasks on the main thread (> 50ms) identified via a trace, not
      assumed absent.
- [ ] Fonts and above-the-fold images use appropriate loading priority
      hints.

## Backend checklist

- [ ] Database queries on the hot path checked for N+1 patterns.
- [ ] Response time measured under realistic load, not just a single local
      request.
- [ ] Caching applied where data is read far more often than it changes,
      with an explicit invalidation strategy — not caching added and never
      revisited.

## Measurement commands (adapt to your stack)

```bash
# Lighthouse, headless, for a quick Core Web Vitals pass
npx lighthouse <url> --output=json --quiet --chrome-flags="--headless"

# Bundle size delta for a JS project
npx bundlesize
# or: compare `du -sh dist/` before and after the change

# Local load test for a backend endpoint
npx autocannon -c 50 -d 20 <url>
```

## Anti-patterns

- Optimizing a function that wasn't shown to be the bottleneck by a
  profile.
- Reporting an improvement on one metric with no mention of a regression
  it introduced elsewhere (e.g., faster render, larger bundle).
- Caching without an invalidation plan, discovered only when stale data
  ships.
- Measuring performance once, locally, and generalizing to production
  conditions without noting the difference.
