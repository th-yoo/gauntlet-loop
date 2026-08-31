# Definition of Done

A standing bar every change clears, regardless of what task it came from.
This is distinct from a task's **acceptance criteria** (from
`planning-and-task-breakdown`), which is what makes *this specific task*
correct. Definition of Done is what makes *any* change mergeable at all.

## The standing bar

- [ ] Spec or task traceability: the change traces to a spec section or a
      task with a written acceptance criterion — not implemented from an
      unwritten assumption.
- [ ] Tests: red-green-refactor evidence exists for new/changed behavior;
      the full suite passes; coverage roughly matches the test-pyramid
      shape for the layer touched.
- [ ] Review: five-axis review complete, all blocking findings resolved,
      no unlabeled findings left ambiguous.
- [ ] Security: any trust boundary touched has validation proportional to
      its tier; no secret appears anywhere in the diff.
- [ ] Performance: if a budget applies, it's measured before and after, not
      assumed.
- [ ] Documentation: any documented behavior the change alters is updated
      in the same change; any non-trivial decision has an ADR.
- [ ] Observability: RED metrics and structured logging exist for anything
      shipping to production; alerts map to user-visible symptoms.
- [ ] Commit hygiene: atomic commits, each buildable and tested on its own,
      messages state why.

## Per-task acceptance criteria vs. this bar

| | Acceptance criteria | Definition of Done |
|---|---|---|
| Scope | One task | Every change |
| Written by | `planning-and-task-breakdown`, per task | This document, once |
| Answers | "Is this task's specific behavior correct?" | "Is this change mergeable at all?" |
| Changes | Per task | Only when the standing bar itself changes |

A task can meet its acceptance criteria and still fail Definition of Done
(e.g., correct behavior with no test). Both must pass before merge.
