# A Programmer's Guide to Cooking at Home

## Why this guide exists

Most recipes found online are written the way natural language is written:
loosely, with steps that assume experience the reader may not have, and with
ingredients that appear mid-instruction without ever being listed up front.
For someone used to reading formal, unambiguous specifications — a function
signature that declares every parameter before it is used, a config file that
enumerates every field it accepts — that style of recipe is actively hostile.
You cannot "run" a recipe that references an undeclared variable.

This guide collects recipes and cooking knowledge with that reader in mind:
every dish states its ingredients before its steps, quantities are given
explicitly rather than "to taste" wherever a real quantity is knowable, and
the steps are ordered and numbered like a procedure rather than narrated like
a story. The aim is not to make cooking feel like software — it's to remove
the ambiguity that makes home cooking harder than it needs to be for people
who already think in precise, structured terms.

It is meant to be a living, community-maintained reference rather than a
single author's notebook: anyone who finds a gap, an unclear step, or a
missing quantity is expected to fix it directly rather than work around it.

## How this guide is organized

- [Kitchen Setup & Fundamentals](01-kitchen-setup.md) — the environment you
  need before you touch a single recipe: tools, safety, and the core
  techniques (blanching, stir-frying, steaming, boiling, marinating, cold
  tossing) that recipes assume you already know.
- [Recipe Index](02-recipe-index.md) — every dish, grouped by category, so
  you can find something to cook by what you have on hand or what kind of
  meal you're making.
- [Advanced Techniques](03-advanced-techniques.md) — for once the basics are
  routine: auxiliary-ingredient technique, professional terminology, sugar
  caramelization, and judging oil temperature.
- [Running a Local Recipe Viewer](04-local-viewer-setup.md) — a self-hosted,
  browsable version of the recipe index, for anyone who would rather query a
  running service than read a document.
- [Contributing New Recipes](05-contributing.md) — the format every recipe
  should follow, and how to submit one.

## The core idea, restated as a principle

A recipe is a procedure with inputs (ingredients) and a sequence of
operations (steps) that transform those inputs into an output (the dish).
Treat missing or vague ingredient lists, unstated quantities, and steps that
introduce new inputs partway through as **bugs** — either in the recipe you're
reading, or, if you're the one writing it, in your own draft. A recipe that
can't be followed exactly, in order, from a complete ingredient list, is not
yet done.
