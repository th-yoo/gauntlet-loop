# Engineering Skills Pack

**Production-grade engineering skills for AI coding agents.**

This pack encodes the workflows, quality gates, and best practices that senior
engineers use when building software, as a set of structured skill files an
agent can load and follow step by step. It covers the full lifecycle — define,
plan, build, verify, review, ship — as nine slash commands, twenty-five
skills, four review personas, and seven reference checklists.

```
  DEFINE          PLAN           BUILD          VERIFY         REVIEW          SHIP
 ┌──────┐      ┌──────┐      ┌──────┐      ┌──────┐      ┌──────┐      ┌──────┐
 │ Idea │ ───▶ │ Spec │ ───▶ │ Code │ ───▶ │ Test │ ───▶ │  QA  │ ───▶ │  Go  │
 │Refine│      │  PRD │      │ Impl │      │Debug │      │ Gate │      │ Live │
 └──────┘      └──────┘      └──────┘      └──────┘      └──────┘      └──────┘
  /spec          /plan          /build        /test         /review       /ship
```

## Commands

| What you're doing | Command | Key principle |
|-------------------|---------|---------------|
| Define what to build | `/spec` | Spec before code |
| Plan how to build it | `/plan` | Small, atomic tasks |
| Build incrementally | `/build` | One slice at a time |
| Prove it works | `/test` | Tests are proof |
| Set the quality bar | `/constraints` | Decide it once, enforce it everywhere |
| Review before merge | `/review` | Improve code health |
| Audit web performance | `/webperf` | Measure before you optimize |
| Simplify the code | `/code-simplify` | Clarity over cleverness |
| Ship to production | `/ship` | Faster is safer |

`/build auto` generates the plan and implements every task in a single
approved pass: you approve the plan once, then it runs autonomously. It
removes the human stepping *between* tasks, not the verification — every task
is still test-driven and committed individually, and it pauses on failures or
risky steps.

Skills also activate automatically based on what an agent is doing: designing
an API triggers `api-and-interface-design`, building UI triggers
`frontend-ui-engineering`, and so on. See
[skills/using-agent-skills/SKILL.md](skills/using-agent-skills/SKILL.md) for
the routing table.

## All 25 Skills

Each skill is a structured workflow with steps, verification gates, and an
anti-rationalization table — a process an agent follows, not a reference doc
it reads once. See [docs/skill-anatomy.md](docs/skill-anatomy.md) for the
format every skill file follows.

### Meta

| Skill | What It Does | Use When |
|-------|-------------|----------|
| [using-agent-skills](skills/using-agent-skills/SKILL.md) | Maps incoming work to the right skill workflow and defines shared operating rules | Starting a session or deciding which skill applies |

### Define — Clarify what to build

| Skill | What It Does | Use When |
|-------|-------------|----------|
| [interview-me](skills/interview-me/SKILL.md) | One-question-at-a-time interview that extracts what is actually wanted, until high confidence | The ask is underspecified |
| [idea-refine](skills/idea-refine/SKILL.md) | Structured divergent/convergent thinking to turn a vague idea into a concrete proposal | A rough concept needs exploration |
| [spec-driven-development](skills/spec-driven-development/SKILL.md) | Write a PRD covering objectives, structure, code style, testing, and boundaries before any code | Starting a new project, feature, or significant change |
| [constraint-driven-development](skills/constraint-driven-development/SKILL.md) | Interview for a quality bar with sane default thresholds, write CONSTRAINTS.md, place each check by cost | No standards are written down, or an agent's output is more than anyone reads |

### Plan — Break it down

| Skill | What It Does | Use When |
|-------|-------------|----------|
| [planning-and-task-breakdown](skills/planning-and-task-breakdown/SKILL.md) | Decompose specs into small, verifiable tasks with acceptance criteria and dependency ordering | A spec exists and needs implementable units |

### Build — Write the code

| Skill | What It Does | Use When |
|-------|-------------|----------|
| [incremental-implementation](skills/incremental-implementation/SKILL.md) | Thin vertical slices — implement, test, verify, commit | Any change touching more than one file |
| [test-driven-development](skills/test-driven-development/SKILL.md) | Red-Green-Refactor, test pyramid, test sizes, DAMP over DRY, the Beyonce Rule | Implementing logic, fixing bugs, or changing behavior |
| [context-engineering](skills/context-engineering/SKILL.md) | Feed agents the right information at the right time | Starting a session, switching tasks, or output quality drops |
| [source-driven-development](skills/source-driven-development/SKILL.md) | Ground every framework decision in authoritative documentation, cite sources, flag the unverified | You want source-cited code for a framework or library |
| [doubt-driven-development](skills/doubt-driven-development/SKILL.md) | Adversarial fresh-context review of every non-trivial decision in-flight | Stakes are high, or a confident output is cheaper to verify now than debug later |
| [frontend-ui-engineering](skills/frontend-ui-engineering/SKILL.md) | Component architecture, design systems, state management, WCAG 2.1 AA | Building or modifying user-facing interfaces |
| [api-and-interface-design](skills/api-and-interface-design/SKILL.md) | Contract-first design, Hyrum's Law, error semantics, boundary validation | Designing APIs, module boundaries, or public interfaces |

### Verify — Prove it works

| Skill | What It Does | Use When |
|-------|-------------|----------|
| [browser-testing-with-devtools](skills/browser-testing-with-devtools/SKILL.md) | Live runtime data — DOM inspection, console logs, network traces, performance profiling | Building or debugging anything that runs in a browser |
| [debugging-and-error-recovery](skills/debugging-and-error-recovery/SKILL.md) | Five-step triage: reproduce, localize, reduce, fix, guard | Tests fail, builds break, or behavior is unexpected |

### Review — Quality gates before merge

| Skill | What It Does | Use When |
|-------|-------------|----------|
| [code-review-and-quality](skills/code-review-and-quality/SKILL.md) | Five-axis review, change sizing, severity labels | Before merging any change |
| [code-simplification](skills/code-simplification/SKILL.md) | Chesterton's Fence, reduce complexity while preserving exact behavior | Code works but is harder to read than it should be |
| [security-and-hardening](skills/security-and-hardening/SKILL.md) | OWASP Top 10 prevention, auth patterns, secrets management | Handling user input, auth, data storage, or external integrations |
| [performance-optimization](skills/performance-optimization/SKILL.md) | Measure-first approach, Core Web Vitals targets, profiling workflows | Performance requirements exist or a regression is suspected |

### Ship — Deploy with confidence

| Skill | What It Does | Use When |
|-------|-------------|----------|
| [git-workflow-and-versioning](skills/git-workflow-and-versioning/SKILL.md) | Trunk-based development, atomic commits, commit-as-save-point | Making any code change |
| [ci-cd-and-automation](skills/ci-cd-and-automation/SKILL.md) | Shift Left, feature flags, quality gate pipelines | Setting up or modifying build and deploy pipelines |
| [deprecation-and-migration](skills/deprecation-and-migration/SKILL.md) | Code-as-liability mindset, compulsory vs advisory deprecation | Removing old systems, migrating users, sunsetting features |
| [documentation-and-adrs](skills/documentation-and-adrs/SKILL.md) | Architecture Decision Records, API docs, document the *why* | Making architectural decisions, changing APIs, or shipping features |
| [observability-and-instrumentation](skills/observability-and-instrumentation/SKILL.md) | Structured logging, RED metrics, tracing, symptom-based alerting | Adding telemetry, or shipping anything that runs in production |
| [shipping-and-launch](skills/shipping-and-launch/SKILL.md) | Pre-launch checklists, feature flag lifecycle, staged rollouts, rollback | Preparing to deploy to production |

## Agent Personas

| Agent | Role | Perspective |
|-------|------|-------------|
| [code-reviewer](agents/code-reviewer.md) | Senior Staff Engineer | Five-axis review with "would a staff engineer approve this?" |
| [test-engineer](agents/test-engineer.md) | QA Specialist | Test strategy, coverage analysis, the Prove-It pattern |
| [security-auditor](agents/security-auditor.md) | Security Engineer | Vulnerability detection, threat modeling, OWASP assessment |
| [web-performance-auditor](agents/web-performance-auditor.md) | Web Performance Engineer | Core Web Vitals audit, Quick/Deep modes, metric-honesty rule |

## Reference Checklists

| Reference | Covers |
|-----------|--------|
| [definition-of-done.md](references/definition-of-done.md) | Standing bar every change clears, contrasted with per-task acceptance criteria |
| [testing-patterns.md](references/testing-patterns.md) | Test structure, naming, mocking, anti-patterns |
| [security-checklist.md](references/security-checklist.md) | Pre-commit checks, auth, input validation, headers, CORS, OWASP Top 10 |
| [performance-checklist.md](references/performance-checklist.md) | Core Web Vitals targets, frontend/backend checklists, measurement commands |
| [accessibility-checklist.md](references/accessibility-checklist.md) | Keyboard nav, screen readers, visual design, ARIA, testing tools |
| [observability-checklist.md](references/observability-checklist.md) | On-call questions, structured logging, RED/USE metrics, tracing, pre-launch gate |
| [orchestration-patterns.md](references/orchestration-patterns.md) | Multi-persona orchestration patterns, anti-patterns |

## How Skills Work

Every skill follows the same anatomy — frontmatter, Overview, When to Use,
Process, Rationalizations, Red Flags, Verification — documented in
[docs/skill-anatomy.md](docs/skill-anatomy.md). Skills are workflows an agent
follows, not prose it summarizes; every one ends in evidence requirements,
because "seems right" is never sufficient.

## Project Structure

```
skills/                                # 25 skills (24 lifecycle + 1 meta)
├── interview-me/
├── idea-refine/
├── spec-driven-development/
├── constraint-driven-development/
├── planning-and-task-breakdown/
├── incremental-implementation/
├── context-engineering/
├── source-driven-development/
├── doubt-driven-development/
├── frontend-ui-engineering/
├── test-driven-development/
├── api-and-interface-design/
├── browser-testing-with-devtools/
├── debugging-and-error-recovery/
├── code-review-and-quality/
├── code-simplification/
├── security-and-hardening/
├── performance-optimization/
├── git-workflow-and-versioning/
├── ci-cd-and-automation/
├── deprecation-and-migration/
├── documentation-and-adrs/
├── observability-and-instrumentation/
├── shipping-and-launch/
└── using-agent-skills/
agents/                                # 4 specialist review personas
references/                            # 7 supplementary checklists
.claude/commands/                      # 9 slash commands
docs/                                  # format specification
```

## Why This Pack Exists

AI coding agents default to the shortest path — which often means skipping
specs, tests, security reviews, and the practices that make software
reliable. This pack gives agents structured workflows that enforce the same
discipline senior engineers bring to production code: *when* to write a spec,
*what* to test, *how* to review, and *when* to ship. These are opinionated,
process-driven workflows, not generic prompts — each one encodes a judgment
call and the check that catches an agent skipping it.

## Contributing

Skills should be **specific** (actionable steps, not vague advice),
**verifiable** (clear exit criteria with evidence requirements),
**battle-tested** (based on real workflows), and **minimal** (only what's
needed to guide the agent). See [docs/skill-anatomy.md](docs/skill-anatomy.md)
for the format every new skill must follow.

## License

MIT — use these skills in your projects, teams, and tools.
