# The comparability probe's blindness residual, measured

**Issue:** 35 — the probe holds Bash, reads this repository, and demonstrably recognised
its own tree once (P6). Mitigate-and-measure, not solve: the measurement is whether the
verdict CHANGES when the artifact stops being reachable in the tree.
**Date:** 2026-08-31. **Instrument:** `gauntlet-goal-check` as `loop.js` prompts it, drawn
by `scripts/oracle-draw.mjs`.

## Design

Six constructed artifacts — every executable row of `oracle/constructed.jsonl`, three
`does-the-work`, two `produces-an-instruction`, both goals — drawn in two stagings of the
same bytes:

- **in-tree**: the tracked path under `oracle/fixtures/`, reachable by any grep of the
  repository. These are the 18 draws already on `oracle/constructed-results.jsonl` from
  the 2026-08-30 run.
- **outside**: byte-identical copies under a neutral `mktemp` path (`/tmp/stage-*/item-*`)
  that names neither this repository nor the fixture, drawn twice each — 12 fresh spawns.
  Corpus and ledger for that arm are beside this file (`outside-corpus.jsonl`,
  `outside-results.jsonl`); raw responses under `oracle/raw/constructed-*-outside-*`.

If reachability changes answers, verdicts differ between arms. If it does not, one
comparison found nothing — which is not proof.

## Result

| row | in-tree verdicts | outside verdicts | |
|---|---|---|---|
| constructed-scaffold | produces-an-instruction (2) | produces-an-instruction (2) | same |
| constructed-direct | does-the-work (6) | does-the-work (2) | same |
| constructed-make | does-the-work (2) | does-the-work (2) | same |
| constructed-commit-scaffold | produces-an-instruction (2) | produces-an-instruction (2) | same |
| constructed-commit-direct | does-the-work (4) | does-the-work (2) | same |
| constructed-commit-plumbing | does-the-work (2) | does-the-work (2) | same |

**6/6 rows, 30 draws, no verdict moved between stagings and none flipped within one.**

## What this establishes, and what it cannot

- One comparison finding nothing, not proof — the same hedge the run's blindness claim
  carries. Six artifacts, one model family, draws minutes apart, and every artifact
  constructed: nothing here samples what the probe usually meets.
- **The path-shape confound runs WITH detection, not against the arms being comparable:**
  the prompt interpolates the artifact path, so the outside arm's prompts differ in the
  path string as well as in reachability. A probe keying on the path would produce a
  between-arm difference; none appeared.
- **What staging cannot remove:** a probe that recognises CONTENT from its training or
  from having read this repository in the same session does not need the tree. Moving the
  bytes measures the grep channel only. The network channel (WebSearch/WebFetch) is
  likewise untouched, and is already disclosed.
- The issue's suggestion that the constructed set is leak-free "by construction" was wrong
  in one particular: the fixtures are tracked files of this repository. That is exactly
  why they could serve as the in-tree arm.

## Reproducing

    # comparison, from the ledgers on disk:
    python3 - <<'PY'
    import json,collections
    a=collections.defaultdict(set); b=collections.defaultdict(set)
    for l in open('oracle/constructed-results.jsonl'): r=json.loads(l); a[r['row']].add(r['predicted_role'])
    for l in open('docs/runs/2026-08-31-blindness-residual/outside-results.jsonl'): r=json.loads(l); b[r['row'].replace('-outside','')].add(r['predicted_role'])
    for k in sorted(b): print(k, a[k]==b[k])
    PY
