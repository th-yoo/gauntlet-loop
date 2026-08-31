# Skill Anatomy

Every `SKILL.md` in this pack follows the same shape, so an agent (and a
human reviewing a new skill) always knows where to look for a given kind of
information.

```
┌─────────────────────────────────────────────────┐
│  SKILL.md                                        │
│                                                   │
│  ┌─ Frontmatter ─────────────────────────────┐   │
│  │ name: lowercase-hyphen-name               │   │
│  │ description: Guides agents through [task].│   │
│  │              Use when…                    │   │
│  └───────────────────────────────────────────┘   │
│  Overview         → What this skill does         │
│  When to Use      → Triggering conditions        │
│  Process          → Step-by-step workflow        │
│  Rationalizations → Excuses + rebuttals           │
│  Red Flags        → Signs something's wrong      │
│  Verification     → Evidence requirements        │
└─────────────────────────────────────────────────┘
```

## Sections, in order

1. **Frontmatter.** YAML with at minimum `name` (matches the directory,
   lowercase-hyphen) and `description` (one sentence stating the task the
   skill guides, one clause on when to trigger it — this is what a router
   matches against to decide which skill applies before any content loads).
2. **Overview.** Two or three sentences: what problem this skill solves and
   why it exists as a discrete skill rather than a paragraph in another one.
3. **When to Use.** A short bulleted list of triggering conditions, phrased
   so an agent (or a router skill) can pattern-match them against a request
   without having read the rest of the file.
4. **Process.** The workflow itself, as numbered steps. Each step is an
   instruction to *do* something and, where relevant, a check that the step
   actually happened — not a description of the ideal end state.
5. **Rationalizations.** A two-column table: excuse an agent under time
   pressure will reach for, and the counter-argument that closes it. This is
   the section that keeps a skill from being silently skipped when it is
   inconvenient.
6. **Red Flags.** Observable signs — in a diff, a conversation, a test run —
   that the process is being shortcut even though no explicit excuse was
   made.
7. **Verification.** What evidence closes this skill out: a command's exit
   code, a specific file that must exist, a specific claim that must be
   quoted back. Never "it looks right" — always something a second party
   could check without re-doing the work.

## Design choices this format encodes

- **Process, not prose.** A skill is a workflow an agent follows, not a
  reference document it reads once and paraphrases. Steps have checkpoints
  and exit criteria.
- **Anti-rationalization by construction.** Every skill enumerates the
  excuses that skip it, because a skill that only states the ideal process
  and never names the shortcut around it gets skipped exactly when it
  matters most.
- **Verification is non-negotiable.** Every skill ends with evidence
  requirements. "Seems right" is never an accepted closing statement for any
  step in any skill.
- **Progressive disclosure.** `SKILL.md` is the entry point and should be
  readable in one pass. Anything longer than a short checklist — a full
  security matrix, a full accessibility test plan — belongs in
  `references/` and is linked from the relevant step, not inlined.

## Writing a new skill

A new skill should be **specific** (name the actual steps, not "review the
code carefully"), **verifiable** (state what evidence closes it), and
**minimal** (if a step never changes an agent's behavior, cut it). Put the
file at `skills/<name>/SKILL.md`, add it to the routing table in
`skills/using-agent-skills/SKILL.md`, and add a row to the top-level
`README.md` skills table under the lifecycle phase it belongs to.
