---
description: "Run the gauntlet loop — builder and a fresh blind critic per round, one gap back each time, no round cap"
argument-hint: "<goal> --candidate <abs-path> --reference <abs-path> [--inspect \"how to look at them\"]"
allowed-tools: ["Bash(mkdir:*)", "Bash(date:*)", "Bash(ls:*)", "Bash(test:*)", "Bash(cat:*)", "Bash(tee:*)", "Read", "Workflow"]
---

# Run the loop

Arguments: `$ARGUMENTS`

This is the method the plugin is named after, and the only instrument here.

## Step 1 — the precondition, which cannot be manufactured

**You need a reference exemplar: a real, inspectable thing that is currently
better than what you have.** Not criteria, not a rubric, not a description of
quality. The whole mechanism is a forced blind choice between two objects — a
criteria bar makes the critic invent a threshold, and an invented threshold
approves everything.

If you do not have one, say so and stop. A loop with no bar is a builder.

Two shapes to check before spending anything:

- **Both paths absolute, both real files.** The loop renders them as two
  `ARTIFACT` lines; if one is a URL or a paragraph and the other is a path, the
  critic can tell which is which from the formatting alone and the A/B is not
  blind. The script detects this and downgrades its own claim, but it is cheaper
  to fix here.
- **Neither path names its own role.** Stage them under neutral names in one
  directory (`doc-1.md`, `doc-2.md`), not `mine.md` and `reference.md`.

Known limit, stated once: this is *formatting* blindness only. A critic that
greps the filesystem can still work out which side is yours from content —
observed on a real run, where it `diff`ed one side against a shipped copy. The
loop does not de-identify content.

## Step 2 — the cost decision, which is yours

There is **no round cap**. The loop runs until the candidate wins the blind A/B
or until you stop it. That is the source's design — *"Do not tell it to do three
rounds and stop… there should be no arbitrary final round"* — and it means the
stop is your responsibility, not the script's.

Decide now which you want, and say which:

- **A budget target.** Add a `+400k`-style directive to the message that
  launches this. The loop then also stops on the budget, which is a ceiling you
  pre-committed rather than a round count.
- **Attended, no budget.** You watch and cancel. Fine, and it is what the source
  describes. Do not walk away from it.

Each round costs one builder, one cheap breaker probe, and between one and
`critics` critics — the line is only bought when the first critic lets the
candidate through, since a round the candidate loses could not have ended
whatever the rest said.

## Step 3 — create the run token

The token is the circuit breaker. Its existence means "keep looping"; removing
it stops the run at the next round boundary.

```bash
mkdir -p /tmp/gauntlet-loop
TOKEN="/tmp/gauntlet-loop/$(date +%s).token"
printf 'goal: %s\ncandidate: %s\nreference: %s\nstarted: %s\n' \
  "<goal>" "<candidate>" "<reference>" "$(date -Is)" | tee "$TOKEN"
```

Report the token path to the operator in the same turn. They cannot cancel a run
whose token they were never told about.

## Step 4 — run it

Call the `Workflow` tool:

- `scriptPath`: `${CLAUDE_PLUGIN_ROOT}/skills/gauntlet-loop/loop.js`
- `args`:
  ```json
  {
    "goal":      "<what you are trying to produce, in your words — the NEED, not your solution>",
    "candidate": "<absolute path; built if absent>",
    "reference": "<absolute path to the exemplar>",
    "inspect":   "<optional: how to look at them — a command to run, a thing to open>",
    "token":     "<the token path from step 3>",
    "critics":   1
  }
  ```

**Choose `critics` deliberately — it is the exit rule, not a knob.** The
candidate must get past every one of them in a single round, so k sets how
demanding the standard is. Ask the operator if they have a preference; decide
yourself if they do not, and say which you chose and why in the same turn.

- **1** — the literal reading of "a separate sub-agent", and the default. It
  also means the source's stop condition ("until EACH sub-agent is utterly
  wowed") is satisfied by one judge on one round, which is vacuous. Choose it
  when the run is cheap, exploratory, or you want the old behaviour exactly.
- **2** — the cheapest non-vacuous standard, and the natural default for real
  work. A losing round still costs one critic; only a round that could end
  costs two.
- **4** — for an artifact you would be embarrassed to ship on a single
  favourable verdict. Even numbers split positions evenly across the line.
- **More than 4** — only with a reason you can state. Unanimity over a long
  line can fail to converge if one critic slot objects for a structural reason
  rather than a variable one, and it fails by never stopping rather than by
  stopping wrongly.

Odd values are allowed and buy nothing: the exit is unanimity, not a majority,
so there is no tie to break — and an odd line leaves one position unbalanced.

**Write the goal as a need, not as an answer.** The critic judges against it, so
a goal that names your intended solution grades the artifact on whether it did
what you already decided. "An operator can pick the right instrument and run it"
is a need; "documents the two scripts and adds a command file" is an answer key.

## Step 5 — while it runs, and when it ends

Watch with `/workflows`. Stop it with `/gauntlet-loop:cancel-loop`.

Read `gaps_in_order` before the verdict. Gaps that get smaller and more specific
mean the loop is working; the same gap restated in round 5 as in round 1 means
it is not, and that is worth stopping for. A run that ends `CANCELLED` has not
failed — Shumer stopped his own "while it was still improving", and his bar was
never reached.
