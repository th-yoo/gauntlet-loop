# Issue 19, re-run: stale in four places, live in a fifth nobody named

**Issue:** 19. **Date:** 2026-08-27.

## Re-running its evidence first

Issue 19 makes two kinds of claim. Checked against the tree before doing anything:

| claim | status |
|---|---|
| `loop.js` exits on ∃-one-favourable-round | **stale.** The exit arms on a win and requires a second win from a fresh critic, on the opposite side, against the unchanged artifact (`loop.js:1503`) |
| `SKILL.md:7` — "Models design good gauntlets" | **gone** |
| `SKILL.md` frontmatter equates *gauntlet* with *panel* | **gone** |
| `README.md:16` — "the one the plugin is named for" | **gone** |
| `plugin.json` — "an executable panel" | **gone** |
| "gauntlet" appears 0 times in Source 1 | **still true** |

Every overclaim the issue names has been removed. What remains of the word is
`Matt Shumer's Gauntlet Loop` used as a **proper name attributed to its author**, which
is what both sources support — Source 2's title is *"How to Run a Gauntlet Loop"*.

That is the fifth issue this session whose status changed on re-reading its own evidence.

## The live instance, in a place the issue could not have named

`loop.js`'s `not_enforced` list asserted:

> "k>1 is an ADDITION, not source fidelity. Both primary texts say one critic per piece,
> singular; the source gets width by decomposing the goal, **which this loop does not do**."

**The loop does decompose.** It dispatches `gauntlet-lead` (`loop.js:1071`), splits the goal
into pieces, and judges each on its own. Handed a decomposing lead, it judged **2 distinct
pieces in one run**. And the same verdict, forty lines earlier, describes that decomposition
at length — `THE SPLIT IS CHECKED ONE WAY ONLY`, `THE SPLIT IS NOT CHECKED`, `NOT
DECOMPOSED`. The file contradicted itself, and the false half was the one making the
source-fidelity claim.

That is issue 19's own complaint — the repository asserting something about its relationship
to the source that the source does not support — surviving in the one place the issue did not
look: the disclosure written to be honest about it.

## The correction, which is sharper than what it replaced

> "k>1 is an ADDITION, not source fidelity. Both primary texts say one critic per piece,
> SINGULAR, and get width by decomposing the goal — which this loop also does, when a lead
> returns a usable split. So k is a SECOND axis of width the source never describes: the
> source multiplies PIECES and holds judges at one, and k multiplies JUDGES within a piece.
> What k buys is a stronger reading of 'every judge satisfied' than one critic can give; what
> it is not is fidelity, and at the default k=1 that phrase quantifies over a set of one."

The last clause is issue 19's ∀/∃ point, stated accurately for the code as it now is: the
exit's universal quantifier ranges over one element at the default.

## The structural finding

That sentence was **pinned**. `LOOP_DISCLOSURES` holds it, `drift-guard` fails if it vanishes,
and `guard-sweep` (#3) breaks it and confirms drift-guard goes red *and names it*.

**All of that machinery was faithfully protecting a false statement.** A pin guards the words;
nothing checks the words are true — and that is worse than an unpinned false claim, because a
reader seeing a guarded disclosure reasonably concludes someone checked it.

Filed as **#54**. The same shape as #3 one level up: #3 was *the guard's coverage is a list
someone typed*; this is *the guard's subjects are sentences someone wrote, and their truth is
nobody's job*.

## What was built

`test/disclosure-truth.test.mjs` checks this claim against **behaviour**: run the loop, watch
it decompose, require that nothing shipped denies it. The denial is matched **by pattern**, so
rewording the same false claim does not evade it.

Three mutations caught: the original claim returned verbatim; the same claim reworded; and the
loop genuinely losing the ability to decompose — in which case the disclosure would be true and
the test reports that its own premise has changed, rather than passing quietly.

## What this does NOT establish

- **The other 18 disclosures.** Each is pinned for presence and none is verified true. Some are
  runnable (`A NARROW WIN STILL EXITS`, `THE BREAKER IS CHECKED AT ROUND BOUNDARIES`); others
  cannot be (`Nothing verifies that a harsh INSTRUCTION produced a harsh CRITIC`), and their
  truth rests on reading — exactly as this one's did. That is #54.
- **That the exit is now source-faithful.** It is not, and the corrected disclosure says so.
  The source stops when every sub-agent is wowed; this loop stops on two consecutive wins by a
  panel that is one critic wide by default. Whether that is the right terminator is #18 and #21,
  not this.

## Reproducing

    node test/disclosure-truth.test.mjs
    grep -c gauntlet <(sed -n '/^## Source 1/,/^---/p' skills/gauntlet-loop/references.md)
