# Contributing Guidelines

Thank you for considering adding to or improving this collection of
`.gitignore` templates. These guidelines describe what a good contribution
looks like and how to propose one.

## Before you write a template, ask

1. Can the rules for this language/tool/framework be curated down to a
   small, meaningful set? If the only honest answer is "list every file
   this software could ever produce," this collection is probably not the
   right place for it — consider a specialized, versioned template instead
   (see below).
2. Is this tool or language common enough that most users of it would
   benefit from a shared starting point? If it's useful but narrow, it
   belongs in the specialized tier rather than the common tier.
3. Does a similar template already exist that yours should extend or be
   layered on top of, rather than duplicate?

## Where a new template goes

- **Common tier** — for languages, frameworks, and tools broad enough that
  many new repositories will want this exact set of rules by default.
- **Cross-cutting tier** — for editors, IDEs, operating systems, and
  general-purpose tools whose ignore rules apply regardless of what
  language a project is written in.
- **Specialized tier** — for everything else that's still useful: narrower
  tools, less common frameworks, and any tool whose ignore rules are tied
  to a specific version.

## Versioned tools

If the tool you're writing a template for changes its generated-file
conventions across versions:

- put the current, actively-maintained version's template in the common
  tier, with no version number in the filename;
- put earlier versions in the specialized tier, with the version number
  included in the filename so it's clear which release the rules match.

This keeps the common tier "evergreen" (always the latest guidance) while
still letting people on an older version of a tool find rules that
actually match what they're running.

## Writing a specialized template

- Keep the rules focused on the specific tool or framework — resist the
  urge to also re-include rules that belong in a more general template.
- Add a header comment naming the tool, linking to more information about
  it if useful, and — if the template is meant to be combined with a more
  general template — naming that companion template so users know to pair
  the two.
- File it under a folder that best reflects the ecosystem or framework
  family it belongs to.

## Submitting a change

1. Fork this collection.
2. Create a branch for the change you intend to make.
3. Make your changes on that branch.
4. Open a pull request from your branch back to the main branch, describing
   why the template or change is useful and, if it's a new template, which
   tier it belongs in and why.

Using a web-based editing interface instead of a local clone is fine too —
it will typically fork the project and open the pull request for you
automatically.

## What happens after you submit

Not every contribution can be accepted immediately, especially larger or
more visible templates — those may need more discussion before they're
promoted to the common tier. That said, a well-scoped, well-explained
template is much more likely to be accepted quickly, and specialized
templates are usually a lower bar to clear than common-tier ones.

The aim of this collection is to cover the most common and helpful cases
well, not to enumerate every tool that exists. If a particular language,
tool, or project isn't included yet, that isn't a comment on it — it's
just a reflection of curation priorities at any given time.
