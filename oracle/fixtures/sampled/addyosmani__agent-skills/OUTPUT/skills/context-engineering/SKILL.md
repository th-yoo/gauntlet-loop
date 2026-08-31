---
name: context-engineering
description: Feed agents the right information at the right time - rules files, context packing, MCP integrations. Use when starting a session, switching tasks, or when output quality drops.
---

## Overview

An agent's output quality tracks the relevance of what's in its context, not
just the total amount — a context window full of stale or tangential
material crowds out the few facts that actually matter for the current task.
This skill is about curating context deliberately rather than accumulating
it by default.

## When to Use

- Starting a new session, before loading any files.
- Switching from one task to a materially different one within a session.
- Output quality is visibly dropping — vague answers, contradicted earlier
  statements, or facts the agent should already have re-asked.

## Process

1. **Load a rules file first**, if one exists, before any task-specific
   content — shared conventions should anchor everything read after them,
   not compete with it for attention.
2. **Pack context for the task at hand, not for the project as a whole.**
   Read the files a task actually touches; don't pre-load the whole
   repository "to be safe."
3. **Prefer a live source (MCP, a re-read file, a re-run command) over a
   stale copy carried in context from earlier in the session** — context
   engineering is not the same as maximizing what's remembered.
4. **When switching tasks, explicitly drop what's no longer relevant**
   rather than letting the old task's context linger and bias the new one.
5. **When output quality drops, diagnose before reloading blindly**: is the
   context stale, irrelevant, or simply too large? Each has a different
   fix — re-read a changed file, drop an unrelated thread, or summarize and
   compact.

## Rationalizations

| Excuse | Rebuttal |
|---|---|
| "Loading everything up front is safer than missing something." | Context that crowds out the relevant fact with ten irrelevant ones doesn't just cost tokens, it costs accuracy on the fact that mattered. |
| "The file hasn't changed since I read it, no need to re-read." | That's an assumption, not a check — a live re-read is one call; a decision made on a stale copy can be wrong in a way that's expensive to trace back. |
| "I'll keep the old task's context in case it's needed again." | If it's needed again, it can be reloaded; carried by default, it competes with the current task for the model's attention now. |

## Red Flags

- The agent restates a fact from ten turns ago that's since become false.
- A task loads files far outside what it touches.
- Output quality dropped and the response was to add more context rather
  than diagnose which context is stale or irrelevant.

## Verification

- The context loaded for a task can be justified file-by-file against what
  the task actually needs.
- When a quality drop was diagnosed, the fix matches the diagnosis (a
  re-read for staleness, a drop for irrelevance, a compaction for size) —
  not a generic "load more."
