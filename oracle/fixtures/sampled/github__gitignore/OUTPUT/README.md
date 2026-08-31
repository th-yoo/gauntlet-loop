# Collection of `.gitignore` templates (as documented by the source README)

This collection is built strictly from the text of the source `README.md`
(GitHub's `.gitignore` templates repository README). No other repository,
network resource, or prior knowledge of the real `github/gitignore` contents
was consulted, so this collection reproduces only what that README states or
embeds directly — it is not a re-fetch of the actual root/Global/community
template files, which the README describes but does not include verbatim.

## Folder structure (as described by the source README)

- **root** — templates in common use, meant to help people get started with
  popular programming languages and technologies; each defines a meaningful
  set of rules so unimportant files are not committed. The source README does
  not embed the text of any root template, so none is reproduced here.
- **`Global/`** — templates for editors, tools, and operating systems that
  apply across different projects. Recommended either as a global git
  template or merged into project-specific templates. The source README does
  not embed the text of any Global template, so none is reproduced here.
- **`community/`** — specialized templates for other languages, tools, and
  projects that aren't in the mainstream root set, including superseded
  versions of versioned templates (see below). The source README embeds one
  concrete example under this directory, reproduced here at
  `community/DotNet/InforCRM.gitignore`.

## What's actually included in this OUTPUT

- `community/DotNet/InforCRM.gitignore` — the one complete template the
  source README quotes in full, as its worked example of a "specialized
  template" (for InforCRM, formerly SalesLogix). It is reproduced verbatim,
  including its header comment recommending it be paired with a
  `VisualStudio.gitignore` at the root (that root template itself is not
  available in the source artifact).

## Rules a contribution must follow, per the source README

- **Good template criteria**: a template must curate a small, meaningful set
  of rules for a specific language, framework, tool, or environment. If no
  small useful rule set can be curated, the template doesn't belong in this
  collection. A template that's mostly a list of files installed by one
  version of some software belongs under `community/`, not the root.
- **Versioned templates**: the root copy of a template must always be the
  current, "evergreen" version with no version number in its filename.
  Previous versions move to `community/` with the version embedded in the
  filename, so root always points users at the latest supported version
  while maintainers can still keep old versions around.
- **Specialized templates**: templates that aren't mainstream go in
  `community/<category>/`, with rules specific to that framework/tool, and
  any related/recommended templates noted in a header comment (as
  `InforCRM.gitignore` does above).
- **Licensing**: the collection is released under CC0-1.0, per the source
  README's License section.

## Known gap

This OUTPUT does not contain the standard language templates (e.g. for
common programming languages) or the `Global/` editor/OS templates, because
the source artifact — the README alone — describes their existence and
placement but does not include their contents. Reconstructing them would
require fetching the actual `github/gitignore` repository, which this task
was scoped to avoid.
