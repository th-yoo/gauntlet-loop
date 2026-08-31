# Orchestration Patterns

How the skills, commands, and agent personas in this pack compose, and the
patterns that are explicitly out of bounds.

## The core rule: personas don't invoke personas

An agent persona (`agents/*.md`) applies one skill's process from one fixed
perspective. A persona may **recommend** that another skill or persona run
next; it does not reach into another persona's process and execute it under
its own name. If `code-reviewer` notices a security gap, its output names
`security-and-hardening` as the next step — it does not perform a security
audit itself and report it as a code review finding.

This keeps each persona's output attributable to the process it actually
ran, so a verification step can check "did the security audit actually
happen" against a real security-auditor pass, not against a code reviewer's
aside.

## Endorsed patterns

**Chain.** The default for the lifecycle: `/spec` → `/plan` → `/build` →
`/test` → `/review` → `/ship`, each command loading its skill, producing an
artifact the next command consumes. Use this whenever the sequence is known
in advance — which is most of the time.

**Router.** `using-agent-skills` is a router: one classification step
picks which single skill applies, rather than running all candidates
speculatively. Use a router when a request could plausibly match more than
one skill and only one actually should run.

**Map-reduce (fan-out review).** For a single change, `code-reviewer`,
`test-engineer`, and `security-auditor` can run independently over the same
diff (map), with their findings merged into one prioritized list by
severity (reduce). Use this when multiple independent perspectives on the
*same* artifact are needed and none depends on another's output.

**Orchestrator-worker.** `/build auto` is an orchestrator: it approves a
plan once, then runs `incremental-implementation` autonomously per task
(worker), pausing on failure or a risky step rather than running
unsupervised to the end. Use this only once the plan is fixed and each
worker step has its own verification gate — autonomy substitutes for a human
stepping between tasks, not for the verification itself.

## Anti-patterns

- **A persona re-deriving another skill's verdict from scratch** instead of
  invoking that skill, producing two different answers to the same question
  under two different names.
- **Fan-out with no reduce step** — three personas' findings never merged
  or prioritized, leaving the author to guess which of three conflicting
  severities to trust.
- **An orchestrator that doesn't pause on failure** — running every task to
  completion regardless of whether an earlier one's verification gate
  failed defeats the purpose of gating tasks individually.
- **A router that runs the unmatched candidates "just in case"** — that's
  not routing, it's running everything and calling the extra work
  redundancy.
