---
description: "Stop a running gauntlet loop at its next round boundary"
argument-hint: "[token-path]"
allowed-tools: ["Bash(ls:*)", "Bash(test:*)", "Bash(rm:*)", "Bash(cat:*)"]
hide-from-slash-command-tool: "true"
---

# Cancel the loop

Token path, if the operator gave one: `$ARGUMENTS`

The loop has no round cap. It runs until the candidate wins the blind A/B or
until you stop it, which is what this command does. Removing the run token is
the operator half of the source's stop rule — *"Keep looping until our output
wins or I stop the run."*

## Step 1 — find the token

If `$ARGUMENTS` names a path, use it. Otherwise list the default location:

```bash
ls -1t /tmp/gauntlet-loop/*.token 2>/dev/null
```

- **Nothing listed** → say "No active gauntlet loop token found." and stop. Do
  not go hunting; a loop started with a token elsewhere is one the operator
  knows the path to.
- **Exactly one** → that is the run.
- **More than one** → list them with their timestamps and ask which. Two loops
  can be running at once, and cancelling the wrong one wastes the other's work.

## Step 2 — read it before deleting it

```bash
cat <token-path>
```

The token records what the run was launched against — goal, candidate,
reference, start time. Report that back, so the operator can confirm this is the
run they meant to stop.

## Step 3 — remove it

```bash
rm <token-path>
```

## Step 4 — say what will actually happen

Be precise, because the stop is not instant:

> Cancelled. The loop checks the token before spawning each round's critic, so
> it will stop at the **next round boundary** and emit its normal verdict —
> `outcome.status: CANCELLED`, with `gaps_in_order` and the `enforced` /
> `not_enforced` lists intact. A critic or builder already in flight is **not**
> aborted; that round finishes first.
>
> To kill a round already running, stop the workflow itself instead (`/workflows`,
> or the `TaskStop` tool with the task id). That is faster and loses the verdict.

## What not to do

- **Do not re-create the token** to "resume". The loop reads it fresh each round
  and does not latch, so re-creating it mid-run silently un-cancels a run the
  operator stopped. Start a new run instead, which produces a new record.
- **Do not delete the whole token directory** — another loop may be using it.
