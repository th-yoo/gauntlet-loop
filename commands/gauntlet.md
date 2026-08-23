---
description: "Run the gauntlet panel over an artifact — blind bar, seeded-defect calibration, lens critics, grounding verifier, terminal cross-check"
argument-hint: "<path-to-artifact> [--lenses 2..4] [--need \"restated need\"] [--reference <path-to-exemplar>]"
allowed-tools: ["Bash(mkdir:*)", "Bash(rm:*)", "Read", "Workflow"]
---

# Run the gauntlet

Artifact and options: `$ARGUMENTS`

This command runs **gate 2 onward**. Gates 0, 1 and 4 are yours and are not
automated, because only you know what being wrong costs. Answer them in this turn,
out loud, before invoking anything.

## Step 1 — the three gates the script will not run for you

State each answer explicitly. If any fails, say which and stop; the operator may
overrule, and an overruled gate is then **settled** — do not re-derive that refusal
later, and do not smuggle it into a subagent's prompt.

**Gate 0 — can a few tool calls settle it?**
Read the call sites, run it, grep for the mechanism that may already exist. A panel
that a single file read would have pre-empted is the most expensive way to be told
what the code says. This is the only gate that refuses to *zero* agents.

**Gate 1 — one agent is the default.**
A panel is the exception, and taking it means naming what one agent *cannot* do.
"It governs a safety invariant" and "three prior designs died here" are facts about
the artifact, not reasons one careful reviewer fails. Rewrite your reason in this
form or you do not have one:

> *one agent would miss X, because one agent Y*

Refusing gate 1 does **not** mean zero agents. It means a run at width 1 — blind
bar, one critic, one grounding verifier, no cross-check, roughly 3 spawns — with the
verdict carrying `N-1 lenses uncalibrated`. Conflating gate 1 with gate 0 is how a
run gets talked out of existing.

**Gate 4 — cost ceiling, as a number.**
The cost of being *wrong*, never the size of the diff. A full run is roughly 9–13
spawns. If the gates themselves would exceed this number, run fewer and say which.

## Step 2 — make a scratch directory for the seeded copy

It must be empty, unique to this run, and must not sit inside the artifact's own
tree. A fixed or reused path collides across runs — the seeder's isolation
guarantee is only as good as the directory it writes into, and a leftover file
from a prior run is indistinguishable from a leak through a sibling file. Derive
the path from the artifact's own name plus a shell-generated unique suffix, and
let `mkdir` create it fresh rather than clearing an old one:

```bash
mkdir -pv "/tmp/gauntlet-$(basename "<path-to-artifact>")-$(date +%s)-$$-$RANDOM"
```

Use the path it prints, verbatim, as `args.scratch` in Step 3.

## Step 3 — run it

Call the `Workflow` tool:

- `scriptPath`: `${CLAUDE_PLUGIN_ROOT}/skills/gauntlet-loop/gauntlet.js`
- `args`: `{ "artifact": "<absolute path>", "scratch": "<path printed in Step 2>", "control_scratch": "<optional, absolute path unrelated to scratch>", "lenses": <2-4>, "need": "<optional operator restatement>", "reference": "<optional absolute path to a reference exemplar>" }`

Supplying `need` yourself is stronger than letting gate 2 derive it: gate 2 has read
the artifact, and anything it writes risks carrying the artifact's own framing into
a bar that is supposed to be independent of it.

`control_scratch` is optional hardening, not boilerplate to fill in. Left unset,
gate 7's control copy is written under `scratch` itself, one hop from the seeded
critic's own copy; supply a directory genuinely unrelated to `scratch` — a
different branch of the filesystem — only if that extra distance is worth an
extra directory.

Where a reference exemplar exists, supply `reference`: it opens the compare lane,
a blind A/B against the exemplar, which `SKILL.md` and `README.md` both call
stronger evidence than a criteria bar. Most specs have no exemplar — leave it out
when none exists.

## Step 4 — read the verdict honestly

- **`NO VERDICT`** is a designed outcome, not a crash. Two VOIDs means the
  measurement never happened; two misses means the critic you were about to deploy
  demonstrably cannot catch a planted defect in its own lane. Either way the panel
  does not spawn.
- A halted run's **blind artifacts survive it**. The returned `bar` and `need` were
  written by an agent that never saw the artifact and are still blind tomorrow.
  Carry them into the rerun rather than paying gate 5 twice.
- **Zero surviving findings is not a clean sheet** until you have read the refutation
  bodies. Report it as:
  `PASS — no critic broke it under <framing>. Untested shared belief: <the premise every critic assumed>.`
- Append the `calibration.caveat` verbatim if it is present. One calibrated critic
  licenses one critic — not a verdict computed from all of them.
- Report `not_enforced` as written. Do not claim independence the run did not buy.
