# A Collection of Useful .gitignore Templates

This directory holds a small, curated collection of `.gitignore` templates,
organized so it can grow the same way larger collections of this kind grow:
a common tier for everyday languages and tools, a tier for editors/operating
systems/utility programs that cut across many projects, and a tier for more
specialized or narrowly-scoped templates that aren't yet mainstream enough
to sit at the top level.

If you are new to `.gitignore` files, the short version is: each line in a
`.gitignore` file is a pattern; Git will not track files that match a
pattern in a `.gitignore` file that applies to them. Patterns can name exact
files, use wildcards, or negate an earlier pattern with a leading `!` to
re-include something that would otherwise be excluded.

## Folder structure

- **`root/`** — templates for popular programming languages and technologies
  that people reach for when starting a new project. Each one aims to define
  a meaningful, curated set of rules so that a new repository doesn't
  accidentally end up tracking build artifacts, dependency caches, or local
  configuration.
- **`Global/`** — templates for editors, other developer tools, and
  operating systems, meant to apply across many different projects rather
  than to one language or framework. These are good candidates to merge
  into a personal global ignore configuration, or to fold into a
  project-specific template when they're relevant to that project.
- **`community/`** — templates for languages, tools, and project types that
  are useful but not yet common enough to justify a place in the top-level
  set, plus templates that track a specific, versioned tool where the
  ignore rules genuinely differ from version to version.

## What makes a good template

A good template is a small, curated set of rules that helps a Git
repository work cleanly with one specific language, framework, tool, or
environment — not an exhaustive listing of every file a piece of software
could ever produce. If a useful, small set of rules can't be curated for a
situation, that situation probably isn't a good fit for a template here.

A template that is really just an enumeration of the files installed by one
particular version of some piece of software is better suited to a
specialized, versioned template than to the common tier — see below.

The aim of this collection is coverage of the most common and helpful
cases, not universal coverage of every tool that exists. Leaving a
particular tool out is not a judgment on that tool; it's a reflection of
how broadly it's used relative to everything else that could be included.

## Versioned templates

Some tools change their generated-file conventions substantially between
versions. For those, the convention used here is:

- the template that lives at the common tier represents the current,
  actively supported version, and its filename does not encode a version
  number (it is meant to stay "evergreen" as the tool evolves);
- older, superseded versions of a template move into the specialized tier;
- a specialized template for an older version does encode the version in
  its filename, so it stays identifiable and useful to people still working
  with that older version.

This way, anyone picking a template from the common tier automatically gets
the most current guidance, while people who are stuck on an older release
of a tool can still find rules that match what they're actually running.

## Specialized templates

A template doesn't have to be mainstream to be worth keeping. If it applies
to a narrower audience, it belongs under the specialized tier, filed under
a folder that best describes where it fits (by ecosystem, by framework
family, or similar).

The rules in a specialized template should stay focused on the tool or
framework it targets. If a specialized template is meant to be layered on
top of another template, the top of the file should say so in a comment,
including a recommendation of which other template to combine it with.

### Example

A specialized template for a customer-relationship-management platform
built on a particular application framework might look like this. Notice
how the header comment identifies the tool, links to more information, and
names the more general template it's meant to be paired with:

```gitignore
# gitignore template for InforCRM (formerly SalesLogix)
# website: https://www.infor.com/product-summary/cx/infor-crm/
#
# Recommended: VisualStudio.gitignore

# Ignore model files that are auto-generated
ModelIndex.xml
ExportedFiles.xml

# Ignore deployment files
[Mm]odel/[Dd]eployment

# Force include portal SupportFiles
!Model/Portal/*/SupportFiles/[Bb]in/
!Model/Portal/PortalTemplates/*/SupportFiles/[Bb]in
```

This is a good illustration of a well-shaped specialized template: it's
short, it explains itself, it points at a companion template rather than
duplicating that template's rules, and every line earns its place.

## Contributing

See `CONTRIBUTING.md` in this directory for the guidelines a new or updated
template should follow, and for the recommended workflow for proposing a
change.

## Layout of this collection

- `root/` — common-tier templates (populate one file per language/tool as
  they're curated).
- `Global/` — cross-cutting editor/OS/tool templates.
- `community/` — specialized and versioned templates, organized by folder.
  - `community/DotNet/InforCRM.gitignore` — the specialized template shown
    above, kept here as a real, working example of the specialized tier.
