---
name: gauntlet-loop
description: Use when you have something you want to be as good as a specific real thing that already exists — a document, a page, a design, a program — and you want to keep improving it until a blind judge picks yours over that thing. Also for "make this better than X", "iterate until it beats", "build toward this reference", "loop until it wins".
---

# Gauntlet Loop

Matt Shumer's method, implemented from the primary source. Build, judge blind
against a real thing, take back one gap, repeat. Do not stop on a round count.

> "You should /loop on each item and have a separate sub-agent check it visually
> to ensure it looks triple A. That separate sub-agent should be a really harsh
> critic, and if it doesn't look triple A, it should keep going."
>
> "Don't stop until each sub-agent is utterly wowed with the quality when
> compared with the actual Call of Duty game. It should literally compare them
> side by side blind and say which one looks better."

Both source prompts are quoted in full in `references.md`, with the sentence
behind every claim made here. Nothing in this file paraphrases where it can
quote.

## The bar is the load-bearing part

The loop needs **a concrete thing that is currently better than yours** — a real
artifact someone else made, that a judge can open. Not criteria, not a rubric, not
a description of quality. Without one the judge invents its own standard and
approves everything.

Practitioners report the same limit independently: the method works where an
existing product can be compared against, and breaks down where nothing
comparable exists. If you have no reference artifact, you do not have a gauntlet
loop — you have a builder.

A hard bar does not have to be reachable. Shumer's own run never beat Call of
Duty; he stopped it while it was still improving. That is a normal ending.

## Running it

```
/gauntlet-loop:loop
```

It asks for the goal, the candidate path, the reference path and how many critics,
mints a run token, and calls the `Workflow` tool on
`${CLAUDE_PLUGIN_ROOT}/skills/gauntlet-loop/loop.js`. To stop a run:
`/gauntlet-loop:cancel-loop`.

Arguments the script takes:

| arg | |
|---|---|
| `goal` | what you are trying to produce, as a NEED — not your intended solution |
| `candidate` | absolute path to your artifact; built from nothing if absent |
| `reference` | absolute path to the real thing it is judged against |
| `critics` | how many judges must ALL pick yours to end the run. Default 1 |
| `token` | the run token; its existence means "keep going" |
| `inspect` | optional — how to look at them: a command to run, a thing to open |

## What a round does

1. **Budget, then the breaker.** A Bash-only agent reports whether the run token
   still exists. Removing it stops the run at the next round boundary, so a
   cancel costs one cheap probe and never a critic.
2. **One critic.** A fresh blind A/B: two artifacts, A and B, never told which is
   yours. It must pick one — a tie is a critic declining to look closely enough —
   and name the single largest gap.
3. **The rest of the line, only if that one let yours through.** A round yours
   loses cannot end the run, so the other critics could not have changed it and
   are never spawned. When they do run, positions are split across the line so
   half see yours as A.
4. **Exit only on unanimity.** Every critic picks yours, or the round is a loss
   and one gap goes back.
5. **The builder fixes that one gap.** In place, on the real artifact. It never
   learns the sides, the critics, or the run's history, and it never grades its
   own work.

## Choosing the line length

`critics` is the exit rule, not a ceiling. The source names no number — "a
separate sub-agent", singular — so this is your call, not his.

- **1** — the literal reading, and the default. It also makes the stop condition
  vacuous: "every judge is satisfied" is satisfied by one judge on one round.
- **2** — the cheapest non-vacuous standard. A losing round still costs one critic.
- **4** — for something you would not want to ship on one favourable verdict.
  Even numbers split positions evenly.
- **more** — only with a stated reason. A long line can fail by never converging,
  which is a failure that does not announce itself.

## What stops it

**Won** — every critic picked yours in one round. **Cancelled** — you removed the
run token. **Budget** — a target you set at launch ran out. **Error** — an agent
returned nothing.

There is no round cap, deliberately: the source names a fixed round count as a
failure mode, and a test fails the build if one reappears. If you set no budget,
nothing but you will stop it.

## What the run tells you afterwards

Every run returns `enforced` and `not_enforced`, computed from that run rather
than written once. Read `not_enforced` first — it says what this particular run
did **not** guarantee. If the two artifact paths were not comparable, the
blindness claim is withheld and replaced by a disclosure that the A/B was not
blind at all.

Read `gaps_in_order` before the verdict. If the gaps got smaller and more
specific, the loop was working. If the last round names the first round's gap, it
was not — and that is the signal, not the outcome.

## What it does not do

- **No decomposition.** Shumer's width comes from splitting the goal into pieces
  and giving each its own builder and critic. This runs one artifact whole.
- **No ratchet.** The builder edits in place; a bad round is permanent, and the
  loop holds no prior version to compare against.
- **Critics are not independent judgments.** They are the same model in fresh
  contexts. Requiring k of them to agree is not k independent opinions, and
  nothing here measures how much independence there actually is.
- **k>1 is an addition.** Both source texts say one critic per piece. Stacking
  judges on one piece is ours, because our artifacts do not decompose the way a
  game does.
