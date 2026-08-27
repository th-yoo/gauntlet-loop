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
TMPROOT="${TMPDIR:-${TMP:-${TEMP:-/tmp}}}"
ls -1t "$TMPROOT"/gauntlet-loop/*.token 2>/dev/null
```

**A token does not mean a run is alive.** Only *cancelling* removes one: a run
that WINS, errors, or stops on budget leaves its token on disk. So this list is
"runs that were started and not cancelled", which includes every run that
finished normally. Observed directly — three tokens from won runs sat in this
directory at once.

- **Nothing listed** → say "No gauntlet loop token found." and stop. Do not go
  hunting; a loop started with a token elsewhere is one the operator knows the
  path to.
- **Exactly one** → that is the token. Whether its run is still going is a
  separate question, answered below.
- **More than one** → list them with their timestamps and ask which. Do not
  present them as concurrent live runs; most stale tokens are just finished ones.

**Confirm the run is actually running before claiming to stop it.** This command
cannot tell from the filesystem — check `/workflows` for a live run whose args
name the same candidate as the token, or ask the operator. Say which you did.

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

Be precise, because the stop is not instant — and because it may not be a stop
at all.

If the run was **not** confirmed live, removing a stale token changes nothing,
and reporting a cancel that did not happen is worse than admitting you could not
tell:

> Removed the token. I could not confirm a running loop for it — a finished run
> leaves its token behind, so this may have been a stale one and nothing was
> stopped. Check `/workflows` if you expected a run to be in progress.

When the run **is** live:

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
