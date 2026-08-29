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

That is a fact about the METHOD, not an instruction to refuse the operator. When
no reference is supplied, `/gauntlet-loop:loop` proposes two or three and stops
for a pick; each must be Named, Fetchable and Comparable, and the run refuses on
the last two rather than judging a pairing that cannot produce a verdict.

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
| `candidate` | absolute path to your artifact. It must ALREADY EXIST — the loop has no filesystem and cannot create it, and an absent path is refused as `unreadable` before anything spawns. Write a first version, however rough: the method compares what you have against something better |
| `reference` | absolute path to the real thing it is judged against |
| `critics` | how many judges must ALL pick yours to end the run. Default 1 |
| `token` | the run token; its existence means "keep going" |
| `inspect` | optional — how to look at them: a command to run, a thing to open |
| `on_refusal` | optional — `refuse` (default) or `warn`. `warn` proceeds past the GENERATOR verdict and records that it did. Never downgrades an unopenable artifact |
| `goal_authored` | optional — `independently` if you wrote the goal before opening the candidate, `after-reading-candidate` if not. An attestation, never verified: the ordering leaves no trace the loop can reach, and `goal_coupling` reads wording rather than provenance. Omit it and the verdict says nobody was asked, which is not the same as an answer of yes |

## It splits the goal first

A lead agent looks at both artifacts and proposes the smallest pieces that can be
improved and judged **independently** — then each piece gets its own rounds, its
own builder and its own critic, dispatched as a graph — see below. The run ends when every
piece has beaten the reference.

**A piece is a piece only if the lead can name what would be inspected to judge it
alone** — a command to run, a file to open, an output to look at. Pieces that name
none are dropped in code, and if fewer than two survive the artifact runs whole.

**Refusing to split is a correct answer.** Prose, specs and decisions usually do
not decompose: their defects are properties of the whole — what is missing, what
order things come in — and no single section is wrong. The loop then runs the
artifact whole and says so.

**Pieces run as a graph, at maximum width.** Two different relations govern it,
and they are not the same thing:

- **dependency** — a piece that cannot be *judged* until another exists says so,
  and starts the moment that one wins. Not when a layer finishes.
- **coupling** — pieces editing the same file run one at a time, because two
  builders writing one path race and the loser's work vanishes.

Everything else runs at once. Coupling is read off the pieces rather than judged — two builders
writing one path race and the loser's work vanishes, while pieces in different
files cannot collide. The source ran "three rounds of six agents each owning one
directory"; its sequential pass was a later, targeted move on "coupled
concerns", not the mode it worked in.

Where pieces exist you rarely need `critics` above 1: width comes from the split,
which is where the source gets it.

**A split that wins is checked once more, whole.** After every piece has beaten
the reference, one more blind A/B judges the WHOLE candidate against the WHOLE
reference. If the parts all won and the whole loses, the split hid something —
a gap living between the pieces, in their ordering, or in a region no piece
claimed — and the run ends `SPLIT_UNSOUND` instead of `WON`.

**It only runs when the pieces edited the artifact it judges.** Pieces may name
their own candidate files, and then the builders never touched `args.candidate` —
judging that path would examine an untouched file and return a pass covering none
of the work, which is worse than not checking, because the verdict would report it
as verified. The loop has no filesystem, so it cannot tell whether separate files
*compose into* `args.candidate`, only whether they *are* it. Where they are not,
the check declines and the verdict names the paths the pieces actually edited.

The check is asymmetric on purpose. A loss is a positive detection. A win is
consistency and **not** proof the seam was correct, and the verdict says so. It
is also an addition: neither source text describes a whole-artifact round, and
runs that were never split do not pay for one.

## Before the first round: is the comparison even blind?

Staging the two files under neutral names handles the obvious tell. It does
nothing about what the files *say*. A critic holding `Bash` can resolve an
artifact's own citations against the working tree and establish which side
belongs to it — observed, not hypothesised: one critic ran `git branch`,
`git log --all` and read the project's run record, because one artifact cited
that project's source by line number.

So a probe reads both artifacts before any critic spawns and reports whether
either one says where it came from. **If either does, the run withholds its
blindness claim** rather than asserting a property it does not have — the same
thing already done when the two `ARTIFACT` lines render in different shapes.

The leak is measured, not prevented. Closing `Bash` on the critic would remove
the capability that makes it run test suites and resolve citations instead of
skimming. And a clean probe result is one prober finding nothing, not proof: the
check can withdraw the blindness claim, never strengthen it.

**It searches this disk, and two agents can reach the network.** The critic and
the builder both hold `WebSearch` and `WebFetch`. So `clean` means neither
artifact gives itself away *to a reader of this filesystem* — it says nothing
about a critic fetching a reference's published copy and diffing it, which
identifies the shipped side at once, or a builder retrieving a fix from the web
instead of composing one. That last is a live retrieval channel, distinct from
the model's own prior and from anything on disk. Neither agent needs the network
for its stated job; removing those two tools is a real narrowing and it is your
call, not the loop's.

## What a round does

1. **Budget, then the breaker.** A Bash-only agent reports whether the run token
   still exists. Removing it stops the run at the next round boundary, so a
   cancel costs one cheap probe and never a critic.
2. **A size probe.** The same Bash-only agent type measures the candidate's byte
   count and nothing else. It is diagnostic: a builder that answers every absence
   by appending grows the artifact while every individual round is locally
   correct, and `size_by_round` is the only thing that would show you. If it
   fails, the round continues without a measurement.
3. **One critic.** A fresh blind A/B: two artifacts, A and B, never told which is
   yours. It must pick one — a tie is a critic declining to look closely enough —
   and name the single largest gap.
4. **The rest of the line, only if that one let yours through.** A round yours
   loses cannot end the run, so the other critics could not have changed it and
   are never spawned. When they do run, positions are split across the line so
   half see yours as A.
5. **Exit only on unanimity.** Every critic picks yours, or the round is a loss
   and one gap goes back.
6. **The builder fixes that one gap.** In place, on the real artifact. It never
   learns the sides, the critics, or the run's history, and it never grades its
   own work.

## How a run ends

`outcome.status` is one of five, and only one of them is a failure of the loop
itself:

| status | what happened |
|---|---|
| `WON` | every critic in one round picked yours — and where the goal was split, every piece won *and* the whole artifact then beat the whole reference |
| `SPLIT_UNSOUND` | every piece beat the reference and the whole artifact did not. The seam hid a gap no piece could see, so the pieces' wins do not add up to a win |
| `CANCELLED` | you removed the token. The source stopped his own run this way and his bar was never reached; this is a normal ending, not a failure |
| `BUDGET` | the run hit the target you pre-committed in the launch message. Also a normal ending — a ceiling you chose rather than a round count the script chose |
| `ERROR` | an agent returned nothing or died: a critic with no verdict, a builder that built nothing, a piece whose run failed. The run stops rather than deciding a round on a short line |

Read `gaps_in_order` before any of them. A `CANCELLED` run whose gaps got smaller
and more specific taught you more than a `WON` run that never iterated.

## What the verdict carries

Beyond `outcome` and `history`, the fields worth knowing before you read one:

| field | what it tells you |
|---|---|
| `rounds` | how many rounds ran in total. In a split run this is the sum across pieces, not the round any one piece won at |
| `decomposition` | what the lead decided: the criterion it split on and the pieces it kept, or `refused` and why. Also how many proposed pieces were dropped for naming no observable. `refused` is set only when the lead ANSWERED and declined to split; a lead that returned nothing sets `no_plan_returned` instead, because running the artifact whole is also what a genuine refusal produces and the two must not read alike |
| `gaps_in_order` | every gap in the order it came back, each naming its piece. **Read this first.** Gaps getting smaller and more specific mean the loop is working; round 5 restating round 1 means it is not |
| `enforced` | properties this run could not lose — each one a tool restriction or a structural fact, not a promise someone remembered to keep |
| `not_enforced` | what it did **not** check, and what a clean result there does and does not mean. The most important field in the verdict |
| `goal_fairness` | whether the reference even attempts the goal. `partly` names the clauses it does not — verdicts on those measure your goal, not the work |
| `goal_authored` | what the OPERATOR said about when the goal was written, or `attested: null` when nobody was asked. `verified: false` always — the loop cannot check it, and null means unasked rather than independent. This is the fact `goal_coupling` cannot reach |
| `goal_coupling` | how much of the goal shares wording distinctive to the candidate. `coupled` means the candidate answers it by construction, so verdicts on the overlapping clauses measure the overlap and not the work. It does NOT say who wrote which first — that is not recoverable from two texts, and a trial of the old `fitted` verdict got the direction right 4 times in 8 while tracking overlap 8 times in 8 |
| `split_check` | the whole-artifact comparison after a split won, or why it did not run |
| `dependency_graph` | the edges the lead named, edges dropped as unknown, whether a cycle was broken, and every piece skipped with its reason |
| `stopped_by_silence` | set when a probe returning NOTHING stopped the run, and it says which of two events that was. The runtime gives a Workflow script the same value for "the agent ran and returned nothing" and "that agent type is not registered", so the loop derives the difference: once any call of a type has returned a result, that type is proven live and a later silence is the agent, not the type. Before that — the first breaker of a run is the first agent in it — the two are indistinguishable, and the run says so and takes the weaker reading |
| `comparability` | the pairing check, run before the lead spawns. Each artifact is asked ONE factual question on its own — handed only this, would an agent do the work or write an instruction for someone else — and the verdict is DERIVED from the two answers, never taken from a judge: `comparable`, `generator` when exactly one side writes instructions, `unreadable` when a path could not be opened. The last two REFUSE the run, and `sides` records what each artifact was found to be. Distinct from `goal_fairness`, which asks whether the reference attempts the goal and never sees the candidate — attempting is a property of one side, comparability is a property of the pair. A reference can attempt the goal and still be incomparable, which is how two runs spent 419k tokens returning `WON` at round 1 against a meta-prompt |
| `size_by_round` | the candidate's byte count each round, with the command that produced it. `size_note` fires when a piece grew every single round — usually a builder answering absence by appending |
| `size_unmeasured` | rounds where the probe RAN and reported it could not measure — a directory passed as the candidate, an unreadable path, a probe that threw. Kept out of `size_by_round` because these are not sizes, and reported here because a silent absence reads as "size was fine". When nothing was measurable at all, `size_note` says so outright |
| `position_balance` | how often yours was shown as A and as B, across every critic including the whole-artifact one. Position bias is measured here, not removed |
| `rounds_with_a_build` / `won_without_building` | whether anything was actually built. A run that won without building tested your judges, not your method |
| `stopped_by_evidence` | the literal probe output that ended a cancelled run — the proof the token was really gone, rather than an assertion about an agent |
| `reading_note` | how to read a `CANCELLED` or `BUDGET` ending, which is not failure |

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

## The goal is the part that goes wrong

Before anything is judged, **two agents check the goal from opposite sides, and
neither sees both artifacts.**

One is shown the goal and **the reference only** — never told what your candidate
is — and asked whether the reference *attempts* that goal at all. Not whether it
is good: whether it is in the game.

The other is shown the goal and **your candidate only** — never told what the
reference is — and asked whether the goal reads as a *need* stated independently
of any artifact, or as a *description* of what your artifact already does.

This exists because a blind A/B is a fair test only when both sides are trying to
do the same thing. A goal that describes what your artifact already does cannot
discriminate: the reference then loses on a dimension it never entered, every
critic can be careful and correct, and the verdict still measures nothing but
your choice of goal. The first live run of this loop failed exactly that way —
not because the reference was out of the game, but because the goal named two
properties the candidate had been rewritten to satisfy hours earlier.

The run warns and continues — judging something on a goal it never took on may be
what you intend — and the verdict says so, so a win under an unfair goal cannot
be read as a win.

**Write the goal as a need, before you look at what your artifact does well.**

## What the run tells you afterwards

Every run returns `enforced` and `not_enforced`, computed from that run rather
than written once. Read `not_enforced` first — it says what this particular run
did **not** guarantee. If the two artifact paths were not comparable, the
blindness claim is withheld and replaced by a disclosure that the A/B was not
blind at all.

**The artifact's size is measured every round**, by a probe that knows the path
and nothing else. If it grows every round the verdict says so: a builder that
answers every absence by appending can grow an artifact indefinitely while each
individual round is locally correct, and nothing else here would notice.

**A win where nothing was ever built is flagged.** If every piece wins its first
round, the builder never ran and the loop never looped — usually a sign the bar
was weak or the goal was fitted to the candidate. The verdict says
`won_without_building` rather than reporting it as ordinary success.

Read `gaps_in_order` before the verdict. If the gaps got smaller and more
specific, the loop was working. If the last round names the first round's gap, it
was not — and that is the signal, not the outcome.

## Testing the loop itself

To find out whether the loop can close a gap, plant one: remove something from a
copy of a real artifact and see whether a round puts it back. That measures
nothing if the removed text is still readable somewhere the builder can reach —
it will find the answer and copy it, which is what happened the first time this
was tried here.

```
node scripts/seed-loop-trial.mjs --artifact <file> --section "## Heading" --to <dir>
```

It writes the degraded copy and a sealed note, then searches the places a builder
plausibly looks for the text it just removed — and **refuses** if it finds any.
Move the original out of reach, or seed a different defect.

What it cannot close is the model's own prior. A conventional section is
reconstructible from training and no filesystem check touches that. Prefer
inverting a constraint that exists only in this artifact: the removed string
stays checkable while its correct form is underivable from anything else.

## What it does not do

- **The split is not checked.** A lead chooses what gets judged and nothing
  verifies the choice. Every piece can win while the artifact as a whole is worse
  than the reference, and no part of this run would notice.
- **No ratchet — regressions are measured, not undone.** The builder edits in place, so a
  bad round still stands. What changed is that it is no longer invisible: the builder copies
  the artifact first, one fresh critic says which version is closer to the goal, and the
  record carries `regression` and `regressed` with the path of what it lost to. Keeping the
  best version and restoring it would be a ratchet; this is not one.
- **Critics are not independent judgments.** They are the same model in fresh
  contexts. Requiring k of them to agree is not k independent opinions, and
  nothing here measures how much independence there actually is.
- **k>1 is an addition.** Both source texts say one critic per piece. Stacking
  judges on one piece is ours, because our artifacts do not decompose the way a
  game does.
