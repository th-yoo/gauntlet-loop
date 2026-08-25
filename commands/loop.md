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

**If the operator has not supplied one, propose two or three and stop for their
pick.** Do not invent a rubric and do not run without a bar — but refusing outright
is worse than it looks. Five runs in this repo's own record were pointed at bars
that could not lose, and at no point did the instrument help find a better one. A
loop with no bar is a builder; a loop whose operator was left to guess at the bar
is a builder with extra steps.

Every candidate you propose must pass three tests, and say in one sentence why
each one clears them:

- **Named.** A specific thing, not a category. "Stripe's pricing page" works;
  "well-designed SaaS sites" does not.
- **Fetchable.** You can actually obtain it — open the file, fetch the page, run
  the binary, read the post. A bar nobody can reach is one the critic hallucinates,
  and the run refuses outright if a path cannot be opened.
- **Comparable.** The same kind of object as the candidate, at the same level, so
  that preferring one is a meaningful statement. A recipe for the thing is not the
  thing. The loop probes this before the lead spawns and REFUSES the run when it
  fails, so a proposal that cannot pass costs the operator a spawn and a stop.

Prefer the hardest bar you can genuinely reach. A bar cleared on round 1 taught
nothing, and the verdict says so in `won_without_building` — which has fired on
five of this repo's runs.

(The three tests are `robonuggets/gauntlet-loop`'s, adopted after its skill,
handed no reference, proposed a real fetchable comparable bar in one shot where
this instrument would have refused. Its bars-by-goal-type table is deliberately
NOT adopted: one row per domain is a registry, and a registry does not transfer.)

Two shapes to check before spending anything:

- **Both paths absolute, both real files.** The loop renders them as two
  `ARTIFACT` lines; if one is a URL or a paragraph and the other is a path, the
  critic can tell which is which from the formatting alone and the A/B is not
  blind. The script detects this and downgrades its own claim, but it is cheaper
  to fix here.
- **Neither path names its own role.** Stage them under neutral names in one
  directory (`doc-1.md`, `doc-2.md`), not `mine.md` and `reference.md`.

Known limit, stated once: staging handles *formatting* blindness only. A critic
that greps the filesystem can still work out which side is yours from content —
observed on real runs, where one `diff`ed a side against a shipped copy and
another resolved an artifact's citations against this working tree.

The loop does not de-identify content and cannot: closing `Bash` on the critic
would remove the capability that makes it inspect rather than skim. The probe
also searches this disk only, while the critic and builder both hold `WebSearch`
and `WebFetch` — so a reference with a published copy can be fetched and compared
however neutrally you stage the files. What it does
instead is **measure** the leak. A probe reads both artifacts before any critic
spawns and reports whether either one says where it came from; if either does,
the run withholds its blindness claim rather than asserting a property it does
not have. So prefer artifacts that do not cite the tree you are running in — and
when that is impossible, read `not_enforced` before believing the verdict.

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

**What a run actually spends**, since there is no round cap and you are the stop:

- **Before round 1: four agents.** Three cheap probes (does the reference attempt
  the goal, is the goal fitted to the candidate, does either artifact give away
  which side it is) and one lead to decide the split. Round 1's breaker probe runs
  before them and is counted below — it is round 1's, hoisted, not an extra.
- **Each round: three agents plus the line.** A breaker probe, a size probe, and
  one to `critics` critics — the rest of the line is only bought when the first
  critic lets the candidate through, since a round the candidate loses could not
  have ended the run whatever the others said. A round the candidate loses also
  pays a builder, so a losing round at `critics: 2` is four agents, not two.
- **Decomposed runs: one more critic at the very end**, judging the whole
  candidate against the whole reference once every piece has won.
- **Pieces multiply the per-round cost.** Each piece runs its own rounds with its
  own builder and critics, and independent pieces run at the same time.
- **A budget reserves for the rounds already running, not just the next one.** The
  pool is shared and pieces run concurrently, so a per-round check each piece made
  on its own would let every one of them clear the same last round's worth and all
  spend it. With three pieces in flight the loop needs three rounds' headroom to
  start a fourth — so a budgeted run with a wide split stops earlier than "budget
  divided by round cost" predicts. That is the ceiling working, not misfiring.

**One thing it refuses after a single cheap probe, before the lead spawns.** The
pairing itself. A blind A/B only means something when a preference between the two
sides is a meaningful statement rather than a category error, and the commonest way
that fails is a reference that is a *recipe for* the thing rather than the thing — a
meta-prompt, a template, a spec, a schema. That does not fail loudly: it returns
`WON` at round 1 with no build round, which reads exactly like success. It cost 419k
tokens twice before the check existed. When the probe reports `generator` it names
which side to execute, because executing that side once usually makes the same two
sources comparable — which is what the source method does when it judges rendered
frames against real frames rather than a prompt against a design document.

**Four things it refuses before spawning anything at all**, because none of them can
produce a verdict worth reading:

- a `candidate` and `reference` that are the same file — a file cannot beat itself
- either path containing a line break, which would write extra `ARTIFACT` lines
  into the critic's prompt and have it judge a comparison you did not set up
- a round-cap argument (`maxRounds` and friends). There is no cap by design; being
  silently ignored would leave you believing the run was bounded and walking away
- a missing goal, candidate, reference, or token

## Step 3 — create the run token

The token is the circuit breaker. Its existence means "keep looping"; removing
it stops the run at the next round boundary.

The temp root is resolved, not assumed. `/tmp` is not writable everywhere and is
not where a Windows shell puts scratch files, and the same chain has to appear in
`/gauntlet-loop:cancel-loop` and in `scripts/seed-loop-trial.mjs` — a token written
somewhere the cancel command does not look is a circuit breaker that silently does
nothing. A drift-guard scan pins the three together.

```bash
TMPROOT="${TMPDIR:-${TMP:-${TEMP:-/tmp}}}"
mkdir -p "$TMPROOT/gauntlet-loop"
TOKEN="$TMPROOT/gauntlet-loop/$(date +%s).token"
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

A lead agent splits the goal first, and the loop dispatches the pieces as a graph —
pieces that edit the same file run one at a time, everything else runs at once — until
every piece has beaten the reference. Where it refuses to split — which is the
right answer for most prose, specs and decisions — the artifact runs whole. You
do not configure this; the lead decides and the run reports what it decided.

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
