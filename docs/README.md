# docs/

## What is here

- `runs/` — a record per live run: what was compared, what the verdict was, and
  what it does *not* establish. Written after the fact, from the run's own output.
  Also holds INCIDENTS — things that went wrong while building, recorded for the same
  reason and to the same standard. `2026-08-25-oracle-fork-bomb/` is one: a mutation
  test disabled a guard, the suite's canary for that guard was a live agent, and it
  spawned to depth 13. The account was written by one of the bomb's own processes.
- `decisions/` — decisions that no check can carry, each with the evidence it rested on
  and what would reopen it. A decision belongs here when the question is genuinely the
  operator's rather than a defect: `0001-who-reads-the-sweep.md` records who reads the
  coverage sweep's output, which was issue 46's fifth root cause and its own option 4.
  These are not designs; a design that can be checked belongs in a test.
- `superpowers/plans/` — **historical.** The implementation plan for the first
  gauntlet run, from 2026-08-23. It plans work that partly no longer exists: the
  gate sequence and `test/orchestration.test.mjs` were deleted on branch
  `drop-judge-lane`. Kept because a plan is evidence of what was intended at the
  time, which is exactly what a later reader cannot reconstruct.
- this note.

## What used to be here

`2026-08-01-gauntlet-adoption-loop.md` — the plan for the program that first adapted this
method, vendored unedited from the private repository this skill was detached from. Removed,
because it is not relevant to the method this plugin implements. Its topology is one builder
against one critic on an adopt/drop decision; it is not the Gauntlet Loop, and it was never
Shumer's. Carrying it as a cited authority put a document from a different lineage in the
position the primary source should hold — `skills/gauntlet-loop/references.md` now holds that
position, with both of Shumer's prompts verbatim.

The four properties `SKILL.md` used to cite it for — frozen bars, ≤2 rounds terminal,
fresh-context critics per round, the author never grading its own artifact — are now stated and
owned in `SKILL.md` directly. They stand on their own; nothing depended on the removed file
except the citation.

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

Treat that as a claim with a named, unpublished source rather than as a verified anchor. The
rubric it fails was `skills/gauntlet-loop/critic-prompt.md`, which required that an anchor a
reader cannot open does not pass EXISTS — **that file was deleted on branch
`drop-judge-lane`**, so this paragraph now cites a rule the repo no longer carries. The gap it
describes is unchanged either way: the numbers still have no openable source. This note only
makes that legible instead of silent. See issue #9.
