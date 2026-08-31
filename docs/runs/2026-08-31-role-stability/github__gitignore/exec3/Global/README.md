# Global (cross-cutting) templates

Templates in this folder are for editors, IDEs, general-purpose tools, and
operating systems — things that generate files worth ignoring no matter
what language or framework a particular project uses.

Typical candidates for this folder: an editor's swap/backup-file
conventions, an operating system's metadata files (thumbnail caches,
directory attribute files, and the like), and generic tool output that
isn't tied to any one project type.

Because these rules apply broadly rather than to one project, they're good
candidates to add to a personal, machine-wide ignore configuration instead
of (or in addition to) a single project's `.gitignore`. They're also safe
to merge into a project-specific template when a particular editor or OS
convention is relevant to that project.

No templates have been curated into this folder yet in this collection —
add one per editor, tool, or operating system as it's curated, following
the guidance in `CONTRIBUTING.md`.
