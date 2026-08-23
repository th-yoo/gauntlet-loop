# docs/

## What is here

`2026-08-01-gauntlet-adoption-loop.md` — the plan for the program that first adapted this
method, vendored **unedited** from the private repository this skill was detached from. It is
the authority `SKILL.md` cites for four properties: frozen bars, ≤2 rounds terminal,
fresh-context critics per round, builder never grades itself. It is a historical record and is
not maintained; do not edit it to reflect later decisions.

## What is deliberately not here

That plan's line 91 points at `docs/2026-08-01-gauntlet-adoption-ledger.md`. **That file is
intentionally not published**, so the reference does not resolve. This note exists so it
resolves to an explanation rather than to nothing.

The ledger is 840 lines recording the verdicts of that program. Roughly one of its eight
sections concerns the gauntlet; the rest is internals of the private research harness the
skill came from — source paths across four unrelated subsystems, activation logs, deploy
boundaries, model pins. Publishing it would disclose a great deal that has nothing to do with
this plugin, to explain a little that does.

What it contains that this repo relies on, stated here so the claim stands on something:
four mechanism transplants were evaluated by this method on 2026-08-01 and produced
**0 merges, 2 drops, 1 open, 2 deferred**. The primitives survived as process — fresh critics
caught real defects in both loops, and single-gap feedback made fixes surgical — while every
mechanism they judged was rejected by its own pre-registered bar. `README.md` cites those
numbers as the honest prior for this tooling: good at killing proposals, not yet shown to be
good at promoting them.

Treat that as a claim with a named, unpublished source rather than as a verified anchor. Under
this project's own rubric (`skills/gauntlet-loop/critic-prompt.md`) an anchor a reader cannot
open does not pass EXISTS, and this note does not change that — it only makes the gap legible
instead of silent. See issue #9.
