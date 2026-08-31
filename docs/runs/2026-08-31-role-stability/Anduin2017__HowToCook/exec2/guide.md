# A Programmer's Guide to Cooking at Home

## Why this guide exists

Most recipes written for a general audience are informal by convention: an
ingredient appears mid-method without ever being declared up front, a
quantity is "to taste" instead of a number, and a step assumes context that
was never stated. That style is fine for someone who already knows how to
cook. It is hostile to someone who thinks in terms of declared inputs,
explicit steps, and predictable side effects — which describes most
programmers most of the time.

This guide takes the opposite approach on purpose: treat a recipe like a
small program. State every ingredient before it is used. State quantities
as numbers, not adjectives. Write steps as an ordered, unambiguous
procedure. The goal is not to make cooking feel like software — it's to
strip out the ambiguity that makes home cooking feel harder than it needs
to be for someone used to precise specifications.

The guide is also written to be community-maintained rather than
authoritative: it collects proven, working preparations rather than
theory, and it expects to grow by people adding the dish they actually
cooked and got right, not by one person trying to cover every cuisine.

## Before you cook: set up your kitchen like you'd set up an environment

Just as you wouldn't start coding without your editor, interpreter, and
dependencies in place, don't start cooking without a working environment.
The setup material in this guide covers, in rough order of when you'll
need it:

- **Kitchen setup** — what a minimally-equipped home kitchen needs before
  you attempt anything on the recipe list: a knife that holds an edge, a
  pan that heats evenly, a way to measure quantities instead of guessing.
- **Dishwashing** — the unglamorous step most guides skip, covered here
  because skipping it in practice is what makes people stop cooking.
- **Deciding what to eat** — a lightweight decision procedure for the
  recurring "what do I even make tonight" problem, so choosing a recipe
  doesn't become its own chore.
- **Equipment-specific technique** — separate short guides for a pressure
  cooker and an air fryer, because both behave differently enough from
  a stovetop that using stovetop intuition on them produces bad results.
- **Food safety** — what actually matters (temperatures, storage,
  cross-contamination) versus what is folklore.
- **The microwave, properly used** — treated as a real cooking tool with
  its own rules, not just a reheating box.
- **Core technique primers**, each isolating one operation so you can
  practice it once and reuse it everywhere: blanching, stir-frying and
  pan-frying, cold-tossing (the no-heat salad-like technique), curing/
  marinating, steaming, and boiling/simmering.

Each of these is a small, independent module. Learn the technique once,
apply it across many recipes — the same "write it once, call it from
everywhere" instinct that makes a shared function worth extracting.

## How the recipe collection is organized

The recipes are grouped by category, and each category is a flat list of
independently runnable "programs" — no dish in one category depends on
you having made a dish from another category first. As of this guide,
the counts per category are:

| Category | What it covers | Count |
|---|---|---|
| Vegetable dishes | Vegetable- and tofu/egg-forward dishes, meatless | 63 |
| Meat dishes | Pork, beef, chicken, duck, lamb and other meat mains | 110 |
| Aquatic dishes | Fish, shrimp, crab, shellfish and other seafood | 28 |
| Breakfast | Quick morning dishes, eggs, sandwiches, congee-adjacent items | 25 |
| Staples | Rice, noodle, bread and other starch-based mains | 58 |
| Semi-finished / processed foods | Recipes that start from a pre-made or frozen base | 10 |
| Soups and congee | Soups, broths and rice/grain porridges | 23 |
| Drinks | Non-alcoholic and mixed drinks, teas, and cocktails | 23 |
| Condiments and other materials | Sauces, oils, syrups and other components used inside other recipes | 9 |
| Desserts | Baked and cold desserts | 31 |
| **Total** | | **380** |

Two things worth noting for anyone building on top of this structure:

1. The "condiments and other materials" category isn't meant to be cooked
   and eaten on its own — those entries are components (a sauce, a syrup,
   a flavored oil) meant to be referenced from other recipes, the same
   way you'd factor a repeated calculation into a helper function instead
   of inlining it everywhere.
2. The "semi-finished / processed foods" category exists for the case
   where the input isn't raw ingredients but something already
   partially prepared (frozen dumplings, a store-bought base) — the
   recipe only covers the remaining transformation, not the whole
   pipeline from scratch.

## A recipe's expected shape

Because the whole point is precision, a well-formed recipe in this
collection is expected to declare, before any step is described:

- the exact ingredients, each with a quantity (not "some" or "to taste")
- the equipment required
- roughly how long the whole thing takes

and then to lay out the method as a strict ordered sequence, with no step
that silently assumes an ingredient or action that wasn't declared
earlier. When you write or adapt a recipe for your own use, holding it to
that same standard is the single highest-leverage habit from this guide —
it is the difference between a recipe you can follow once and one you can
follow correctly at 7am while distracted.

## Running the collection locally

The guide's source material is designed to be browsed either as plain
text or through a small self-hosted web viewer, packaged as a container
image so it can be brought up with two commands (pull the image, then run
it publishing the service on a local port) rather than requiring a manual
install of a language runtime and its dependencies. On first start, the
viewer needs a short window to build its search index before browsing
feels complete — treat the first half hour after startup as a warm-up
period, not a malfunction. A default administrative login is provided for
local use and should be treated the same as any other default credential:
fine for a private machine, not something to expose on a network you
don't control.

## Once the basics are comfortable: going further

After a working set of the core recipes and techniques above, the
material that follows assumes you've internalized the basics and is
organized around sharpening judgment rather than following instructions:

- **Auxiliary-ingredient technique** — how supporting ingredients
  (aromatics, thickeners, garnishes) change a dish disproportionately to
  their quantity, and how to use that deliberately.
- **Professional vocabulary** — the terms used in the trade for
  techniques and textures, so recipe language (including terser
  professional recipes outside this guide) stops being opaque.
- **Caramelizing sugar for color and flavor** — a technique that shows up
  as a small step inside many braised dishes but is genuinely easy to get
  wrong, covered in isolation so it can be practiced deliberately.
- **Judging oil temperature by eye** — the skill that separates "the
  recipe said medium-high heat" from actually being able to tell when a
  pan is ready, taught without assuming a thermometer.

## Contributing back

The underlying project is explicitly community-maintained: if you find an
error, the expected response is to fix it directly and submit the
correction, not to file it and wait. If you're adding a new recipe rather
than fixing one, the expected practice is to start from an existing
recipe as a template and modify it, rather than inventing a new structure
from scratch — the same reason a codebase asks new contributors to follow
existing conventions instead of introducing a personal style. This keeps
every recipe in the same predictable shape described above, which is the
entire value proposition of the guide.

See `dish-index.md` in this directory for the full categorized list of
dish names referenced above.
