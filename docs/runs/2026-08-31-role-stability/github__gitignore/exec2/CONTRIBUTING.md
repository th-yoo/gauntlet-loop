# Contributing a template

Thanks for considering adding a `.gitignore` template to this collection.
Before opening a pull request, please read through the guidance below.

## Where does a new template belong?

- If you can curate a small, meaningful set of rules for a widely-used
  programming language, framework, or tool, it belongs at the root of the
  collection.
- If your template is really a list of files produced by one specific
  version of a piece of software, it belongs under `community/` instead,
  named with the version embedded in the filename (see "Versioned
  templates" below).
- If your rule set is small, or covers a technology that isn't yet in wide
  use, but you still think it would help others, it belongs under
  `community/`, in a subfolder that best matches where it fits.

Please don't expect every tool that has ever existed to be included at the
root. The goal is a focused set of the most common and helpful templates,
not exhaustive coverage — a technology being left out doesn't mean it isn't
worthwhile.

## Versioned templates

If the thing your template supports changes significantly between versions:

1. The template at the root should always represent the current, supported
   version, and its filename should not include a version number.
2. Previous versions should be moved to `community/`, with the version
   number embedded in the filename so they stay distinguishable and
   readable.

This keeps the root template "evergreen" for newcomers, while still letting
maintainers support people who are stuck on an older version.

## Specialized templates

When you add a specialized template under `community/`, put it in whichever
subfolder best matches the framework or tool it targets, and make sure the
rules inside are specific to that framework or tool — not generic filler.

If your template is meant to be used alongside another template already in
the collection, say so in a comment at the top of the file. For example:

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

That header tells a reader what the template covers and which companion
template to pair it with, without requiring them to read any further
documentation.

## Opening a pull request

If you believe your template is important and broadly visible, say so in
your pull request description. It may not be accepted into the root
immediately, but a template that starts in `community/` can later be
promoted to the root based on demonstrated interest.

## Suggested workflow

1. Fork this collection to your own account.
2. Create a branch for the change you intend to make.
3. Make your changes on that branch.
4. Send a pull request from your branch back to the main branch.

Using a web-based editing interface is fine too — it will fork the project
and open the pull request for you automatically.
