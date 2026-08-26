# RC5 of #46 — the suspect ledger

**The question.** #46's remaining root cause: whether a coverage-sweep finding ever reaches
a person. The issue frames it as "nobody has decided", and closes with four options. This
file is the investigation of what actually causes the residual, one suspect per section,
each driven to evidence or marked as not established.

Written during the 2026-08-26 session, after RC1, RC3 and RC4 were fixed. Every "verified"
line below was produced by running the command shown, not by reading and reasoning.

---

## S1 — nobody has decided. VERIFIED, and it is the issue's own framing

No decision record exists: `docs/decisions/` does not exist, and nothing in the tree records
a decision about who reads a sweep result. The premise holds by inspection.

## S2 — the verdict was uninformative, so a reader would have carried a false all-clear. VERIFIED, FIXED at `3709cef`

`test/sweep-needles.test.mjs` required every mutation needle to appear in its target file;
`run-all` discovers it; `mutate` replaces exactly that text and reads any non-zero exit as
CAUGHT. So the gate failed because of the mutation and the sweep reported CAUGHT for every
needle occurring once — 113 of 117 — whether or not anything else tested the property.

Confirmed in a clean clone at `0aee825` before changing anything: apply one property's
mutation by hand, `sweep-needles` goes from exit 0 to exit 1.

**Consequence for RC5:** every coded option on #46's menu takes the sweep's verdict as
input. Until this was fixed, all of them would have transported a false all-clear — which is
the parent rule, *a quantity derived downstream of the decision under test cannot audit that
decision*.

## S3 — the sweep is out of band only because of its cost, and the tree's cost figures disagree. PARTLY VERIFIED

Three figures, three different numbers:

| where | says | status |
|---|---|---|
| `.github/workflows/coverage.yml` header | "114 of them at ~28s each, roughly 50 minutes" | count stale (117 now), and ~28s is the extrapolation `coverage-cadence.test.mjs` documents as wrong by 4x |
| `test/coverage-cadence.test.mjs` `OBSERVED` | ~14 min for 117 on ubuntu-latest (run 32900618692) | a real run, but before 2026-08-26 |
| local run, this session | ~16s/property, ~31 min projected | measured |

`test/mutate.test.mjs` is now the most expensive suite in the repo at **8.46 s** — because
of two cases added on 2026-08-26 (a 5s signal case and a 2×2.5s race case). The sweep runs
the whole suite once per property, so those cases added roughly **16 minutes to every future
sweep**.

Per-suite profile, clean copy at HEAD:

```
mutate.test.mjs   8.46 s     oracle.test.mjs  4.49 s     pairing.test.mjs 3.79 s
everything else  <0.5 s each (drift-guard 0.04 s)
```

**Why this bears on RC5:** cost is the ONLY reason the sweep is out of band, and the gate it
is kept out of — `.githooks/pre-push`, `ci.yml` — already refuses without needing a reader.
If the cost is wrong, the reader question is answering a constraint that does not exist.

`scripts/mutate.mjs` runs the WHOLE suite per property even when the first suite already
failed. Since `mutate` reads any non-zero exit as CAUGHT, stopping at the first failing suite
must give the same verdict sooner. MEASURED over the whole list rather than a sample,
because the discredited figure in this table came from multiplying a sample:

```
full suite per property   32 min    117 properties — 0 unpinned, 0 could not be tested
first-failure short-circuit 6.0 min 117 properties — 0 unpinned, 0 could not be tested
```

**Identical verdict, 5.3x faster.** A sample of 8 run both ways also agreed 8/8 on the
verdict, per property 17.9s -> 4.4s.

So the constraint that puts the sweep out of band, and therefore creates the reader problem,
is a six-minute job — not the fifty minutes the workflow header claims, and not the
thirty-two the current implementation actually costs. **This does not by itself decide RC5**,
but it changes what is being decided: whether a reader is needed at all, rather than which
reader to build.

## S4 — the channel has no addressee. VERIFIED

`coverage.yml` renders the summary and does nothing else: no issue is filed, no notification
is configured, `permissions: contents: read`. The finding reaches a run page and stops.

## S5 — the local gate is inactive on this machine. VERIFIED

`git config core.hooksPath` is empty, so `.githooks/pre-push` does not run here. Whatever it
gates is not gated locally. (It runs `run-all`, not the sweep.)

## S6 — push-triggered sweeps are cancelled by the next push, so most commits get no verdict of their own. VERIFIED, partly fixed at `b7ad571`

6 of the 10 sweep runs on 2026-08-26 concluded `cancelled`: `aaac379`, `6119d30`, `996975f`,
`a8fda84`, `b7ad571`, `1d3e9b1`. Those six commits have no sweep verdict of their own, ever.

Quantified, which is the part worth carrying: a regression introduced at `6119d30` (00:38)
would first be covered by `be5ab0d`'s run completing at 01:39 — an hour later, and only
because a later push happened to finish. A commit whose sweep is cancelled and which is
never followed by a completed run is never swept at all.

This was nearly filed as a separate suspect, "detection latency". It is not one — it is this
mechanism seen from the other end, and splitting it would grow the list without adding a
cause. That is the registry growth this project calls cheating.

## S7 — findings may already be waiting, unseen. VERIFIED — none were

The first sweep whose verdict can mean anything, run locally at `3709cef`:

```
117 properties — 0 unpinned, 0 could not be tested        (12:56 -> 13:28, 32 min)
```

Nothing was masked. Every property is pinned by a real test. Before the S2 fix that verdict
was guaranteed and therefore worthless; it is now earned.

## S8 — the exit code cannot distinguish two findings needing opposite repairs. VERIFIED

```js
process.exit(missed || refused ? 1 : 0)
```

`NOT CAUGHT` means code is unprotected. `COULD NOT RUN` means a needle went stale — someone
renamed a symbol. A badge or an email carries only this exit code, so the two cheapest reader
options on #46's menu transmit a signal that cannot tell those apart. Today's red sweep was
the second kind. The rendered summary does name which; the exit code does not.

## S9 — nothing points a reader at it. VERIFIED

`README.md` names `coverage-sweep` once, in a list of scripts. There is no badge, no
pointer, and no statement of when it last ran or against which commit.

## S10 — the RC1 summary fix covers CI only. VERIFIED

```js
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
```

Run locally — which is how the sweep was actually run twice on 2026-08-26 — the summary
renders nowhere. The fix shipped this morning addresses the CI channel and not the one in
use.

## S12 — a red sweep gates nothing. VERIFIED

```
.githooks/pre-push   -> node test/run-all.mjs
ci.yml               -> node test/run-all.mjs
coverage.yml         -> node scripts/coverage-sweep.mjs
```

Nothing depends on the sweep's conclusion, so a red sweep blocks no push and no merge.
Blocking is the one form of "reaching a person" that does not depend on attention.

## S11 — a finding does not persist anywhere the repository controls. VERIFIED

```
does docs/runs/ hold any sweep result?   0
```

Every sweep verdict that has ever existed lives only on a GitHub run page. The repository
keeps no artifact, no committed summary, and no record of when the sweep last ran or against
which commit. Run-page logs expire on GitHub's retention schedule, so an unread finding
eventually stops existing — and so does the evidence that it existed.

`retention_days` is not exposed on the repository object (`gh api repos/th-yoo/gauntlet-loop`
returns `null`), so the exact window is GitHub's default rather than something measured here.
The conclusion does not depend on the number: nothing in the tree holds a copy at all.

**What it changes about the options.** A badge reflects only the newest run. An auto-filed
issue is the only option on #46's menu that puts a finding somewhere this repository owns.

---

## The shape of the enumeration, and what it is worth

These are not a list of incidents. They are the stages a finding passes through on its way
from production to a person, walked in order, each with the failure that lives there:

| stage | failure | suspect |
|---|---|---|
| produce | the run never completes, or never happens here | S6, S3, S5 |
| measure | the verdict says nothing | S2 (fixed `3709cef`) |
| render | the finding is not expressed where it ran | S10, S8 |
| transport | it never leaves the run page | S4, S9 |
| persist | it stops existing | S11 |
| compel | nothing forces attention | S12 |
| decide | nobody chose | S1 |

A list can always grow by one and give no account of itself. A pipeline can be walked to its
end, and it predicts where an unfound suspect would have to live — which is the only
closure argument available here, since exhaustiveness cannot be proved. `persist` was missing
from the first version of this table and was found by walking it rather than by an incident.

## S15 — a transport that leaves the repository cannot be verified by anything the repository runs. VERIFIED

Found by trying to verify RC1's own fix rather than by reasoning about it.

What is proven: the sweep writes the summary when the variable is set — 147 bytes, correct
content, `GITHUB_STEP_SUMMARY=<file> node scripts/coverage-sweep.mjs "a disputed row"`.

What could not be proven, and how each attempt failed:

```
check-run output for the sweep job    {"summary_head": "", "title": null}   (empty)
REST API for job summaries            none exists
fetching the public run page          a JavaScript shell, no summary in the HTML
```

So RC1's fix is established exactly to the boundary this repository controls and no further.
That generalises: **the only part of a sweep result that survives outside the run page is
the run's conclusion** — one bit, queryable with `gh run list`.

**And that bit is the one S8 shows cannot distinguish a coverage regression from a rename.**
The two findings that need opposite repairs collapse into the same queryable signal, and
everything that could tell them apart lives where nothing can check it.

This ranks #46's options on an axis the issue never considered. An auto-filed issue is
queryable with `gh`; a committed record is a file. A badge, an e-mail, and a run-page summary
are not verifiable by any check this repository can run.

A cheap partial remedy, not built: have the sweep echo the byte count it wrote to stdout, so
the write itself becomes visible in the log and through the API. That verifies the write, not
the display.

## The cadence #45 delivered has never produced a run. VERIFIED

#46's title is "the sweep has a cadence but no reader", and its four options are written for
the scheduled run. That run has never happened:

```
every sweep run ever, by trigger:   push: 13    schedule: 0
cron:                               0 6 * * 1   (Mondays 06:00 UTC)
the schedule landed:                b97f224, 2026-08-25 UTC — after the last Monday
today:                              Wednesday 2026-08-26
```

Node is pinned in `coverage.yml` (line 79), checked rather than assumed.

**Both recorded instances of the reader problem were push-triggered runs** — run
`32900618692` concluding success with two defects in its log, and `843b3ac` standing red for
three commits. So gating the sweep in `ci.yml` is not a partial remedy that leaves the cron
uncovered: it covers **every instance of RC5 that has ever occurred**, and the case it does
not cover has never occurred once.

What the cron would still catch, given the repo has no dependencies and pins its runtime:
runner image changes, node 22 patch releases, and GitHub's own behaviour. Narrow, real, and
so far entirely hypothetical.

## The base rate — how findings have actually travelled

Three recorded instances, and the mechanism each time:

| finding | how it reached a person |
|---|---|
| run `32900618692` green, two defects in its log | a human opened the log once, at the end of a long session |
| `843b3ac` red, stood through three commits | the operator asked about it mid-session |
| 113 of 117 verdicts meaningless | an agent arguing an unrelated question found it |

**Zero reached a person by any mechanism.** All three were ad-hoc curiosity. That is stronger
evidence than "nobody has decided": every transport that exists today has a measured success
rate of zero, on three trials.

## S17 — the sweep is destructive to the tree it checks, which is a SECOND reason it is out of band. VERIFIED

Found by attacking S3's own conclusion. S3 says cost is the ONLY reason the sweep is out of
band. That is wrong.

`scripts/mutate.mjs` writes each mutation into the file **in place** and restores it
afterwards. In CI the checkout is ephemeral and nobody is looking at it. In
`.githooks/pre-push` it is the developer's own working tree, mutated for the duration of
every push, and a crash leaves the mutation behind — observed on 2026-08-26, when
`skills/gauntlet-loop/loop.js` was found at zero bytes after concurrent sweeps.

A third reason, from the same session: the per-file lock added at `0aee825` makes two
concurrent mutations of one file refuse. A locally gated sweep racing a background sweep
would fail the push for a reason that is not a finding.

**So the remedy S3 points at is asymmetric, and the ledger said "the gate" as though it were
one thing.** Gating in `ci.yml` is safe. Gating in `.githooks/pre-push` is not.

## The short-circuit's cost profile, measured on the verdict that matters

The 117-property agreement was all `CAUGHT`. The verdict that matters is the other one, and
it was never tested — a saving measured only on the case that ends early says nothing about
the case that cannot.

Built: clone the repo, neuter `oracle.test.mjs` so one property becomes genuinely unpinned,
run that property both ways.

```
full suite       NOT CAUGHT   14 s
short-circuit    NOT CAUGHT   14 s
```

Both agree, and the short-circuit saves **nothing** when nothing fails — by construction, a
NOT CAUGHT has to run every suite to establish itself. So the six-minute figure holds only
while the sweep is clean, and each real finding costs full suite time. At today's numbers a
sweep with ten findings would be about eight minutes rather than six.

Also machine-specific: 32 min full locally against 41 min on the runner, so the ratio
transfers better than the absolute. Short-circuited on CI is likely nearer eight minutes than
six.

**And the remedy has a lifespan.** The list is hand-written and grows; at roughly 20
properties per minute short-circuited, a list of 500 is 25 minutes and the cost premise
returns.

---

## THE ROOT CAUSE, and the hypothesis it replaced

The method that found it: ask whether the disease is specific or structural — do this
repository's other finding-producers have readers?

**First hypothesis, REFUTED.** "The repo gates cheap checks and leaves expensive ones
unread, so several reporters are unread." Checked, and it is false. `oracle.test.mjs:516`
runs `oracle-report` against the **tracked** ledger with the real environment and asserts
exit 0 — "It runs against the TRACKED ledger on purpose — that is the only ledger anyone
quotes". `staleness-trial` and `rowmodel-trial` are spawned by `oracle.test.mjs`;
`fitted-trial` by `loop.test.mjs`. All of them are inside `run-all`, and therefore inside
`.githooks/pre-push` and `ci.yml`.

**What survives is narrower and stronger:**

> Every finding-producer in this repository is gated except the sweep. Being gated is what
> being read consists of here — a gate refuses, and a refusal cannot be ignored. The sweep is
> the single exception, and it is the exception for two reasons: it was too expensive to gate
> (S3, now false by measurement for CI), and it is destructive to the tree it checks (S17,
> still true, and it is what makes the remedy CI-only).

| producer | gated by | read? |
|---|---|---|
| `oracle-report` | `oracle.test.mjs` -> `run-all` | yes, on every push |
| `staleness-trial` | `oracle.test.mjs` | yes |
| `rowmodel-trial` | `oracle.test.mjs` | yes |
| `fitted-trial` | `loop.test.mjs` | yes |
| `coverage-sweep` | nothing | **no** |

**And the premise is now false by measurement.** S3: the sweep is 6.0 minutes with a
first-failure short-circuit, identical verdict, measured over all 117 properties. `ci.yml`'s
suite job costs 24-35 seconds today.

This is the compression the whole ledger was looking for. It explains every other suspect
rather than sitting beside them: S4, S8, S9, S10, S11, S12 and S15 are all consequences of
being out of band — a finding needs a channel, a persister, an addressee and a reader only
because nothing refuses at the moment it is produced. Gate the sweep and the `compel` stage
is covered, which is the only stage whose failure does not depend on anyone's attention.

It also predicts where the remaining risk sits, which a list cannot do: whatever is NOT
covered by gating — the weekly cron run on a tree nobody pushed to — still needs a reader,
and that run is exactly the one #46's four options were written for.

---

## THE ORIGIN — the decision that created RC5, and the step in it that was never checked

Found by consulting the repository's own prior art, which is a method the earlier passes
never used. RC5 is not a new problem. It is the fifth link in one chain:

```
#42  every guard here is hand-triggered
#43  no pre-push gate runs run-all          -> add one
#44  nothing runs the suite on a second machine -> add CI
#45  the sweep is too slow for a push gate  -> give it a cadence
#46  it has a cadence but no reader         -> (this)
```

Each fix moved the same defect one step: *a guard exists and nothing compels it.* #46 is
where that walk currently stands.

**And #45 contains the step that was never checked.** Its body:

> It runs a suite per entry. Putting it in a **pre-push hook** makes every push cost >10
> minutes, and a gate that slow gets bypassed — which converts a guard into a `--no-verify`
> habit and leaves the repo worse than an honestly absent one.

That reasoning is sound about a pre-push hook, and S17 shows the hook is doubly wrong for
this tool anyway, because the sweep mutates the tree it checks. But:

| | |
|---|---|
| mentions of `ci.yml` / Actions / workflow in #45's body | **0** |
| CI landed | `07b8e92`, 01:32 |
| the sweep sent to a schedule | `b97f224`, 06:17 — 4h45m later |
| that commit's own words | "give the coverage sweep a schedule, **since it cannot have a gate**" |

**"Too slow for a pre-push hook" was generalised to "cannot have a gate", and the gate that
had landed four hours earlier was never evaluated.** Everything downstream follows from that
one unexamined step: the cadence, the missing reader, #46's four options, and every suspect
in this ledger.

That is not where the chain terminates. It goes one layer further, and the layer below
explains why the generalisation felt safe.

## THE BOTTOM — two correct designs, composed

`#45`'s reasoning takes the sweep's cost as a fixed property of the sweep. So does `#42`'s
table, which tags it "by hand, **and it takes >10 min**" — the cost is the distinguishing
feature of that row. Neither asked whether the cost was reducible, and nor did `#46`:

```
mentions of making the sweep cheaper, in #42, #45, #46:   0, 0, 0
"short-circuit" / "stop at the first" anywhere in the tree: only in unrelated trial docs
```

It is reducible, by 5.3x, with an identical verdict. The reason sits at an interface:

```js
// test/run-all.mjs:31
if (r.status !== 0) { console.error(`FAILED: ${s}`); failed++ }   // continues, by design
```

`run-all` reports EVERY failing suite, which is right for a human reading test output — you
want the whole list, not the first line of it. `mutate` needs only the FIRST non-zero exit,
because any non-zero means CAUGHT and nothing downstream reads which suite it was. Each
design is correct for its own purpose. Composed, the sweep pays for thirteen suites it does
not need on every property it catches early.

**A composition has no owner.** Neither file is wrong, so neither file has a defect to
report, and no reproducible can be built that fails — which is exactly the trigger this
project's method requires. `CLAUDE.md` says: *name root-cause candidates, BUILD a
reproducible that fails, then attack it iteratively.* A five-fold cost produces nothing that
fails. The sweep worked; it was merely slow.

So the honest bottom of this investigation is a limit of the method that produced everything
else in this repository: **defect-driven inquiry cannot see an inefficiency, and this one
cost five issues and a reader problem.** It was found here only because RC5's investigation
asked what the out-of-band placement rested on, rather than what had broken.

The full chain, then:

```
run-all reports all failures (correct)  +  mutate needs only the first (correct)
   -> the sweep costs 5x what it needs to
   -> #42 tags it "by hand, and it takes >10 min"
   -> #45 "too slow for a pre-push hook" generalised to "cannot have a gate"
   -> a schedule instead of a gate
   -> #46 a cadence with no reader
   -> the eleven suspects in this ledger
```

The suspects are not eleven independent causes. They are what one unexamined interface cost,
itemised.

## The transfer test — does the blind spot predict a case it was not induced from

This project's standard for a mechanism is that it survives a case it was not built on. If
defect-driven inquiry is blind to inefficiency, there should be another instance nobody
flagged. There is, and it was created during this same session:

`test/mutate.test.mjs` became the most expensive suite in the repo at **8.44 s**, almost
entirely `setTimeout` waiting — 5 s in the signal case, 2 x 2.5 s in the race case. Correct
test design in isolation. Run by `run-all` on every push and by the sweep once per property.
Nothing failed, so nothing flagged it.

Claimed reducible, then TESTED rather than asserted, because asserting it would have been the
disease being described:

```
8.44 s -> 3.62 s   both cases still pass
```

And passing is not the check. Each case was re-verified by removing the fix it pins:

```
mutate's signal handlers removed  -> the kill case FAILS, as it must
the per-file lock removed         -> the race case FAILS, as it must
```

So the shortened cases still measure what they exist for. Applied. The saving is 4.8 s on
every push, and up to nine minutes on a full-suite sweep.

That is the transfer: the same question — *what does this cost rest on?* — found a second
instance in a different file, with a different author's intent, and the instance was fixable
by measurement rather than by argument.

---

## The adversarial pass, and where it stopped

The list was built in waves, and the yield per wave is the only convergence evidence
available: **7 suspects, then 5, then 1, then 0 — and then 1 more (S15), found only because
the loop refused an early claim of completion and sent me back to verify a fix I had
asserted rather than tested.** The lesson is recorded rather than smoothed over: my search
terminated early twice, both times when I stopped building and started reasoning.

The final pass deliberately tried to break the pipeline model rather than extend the list.
It produced two candidates, and neither survived as an independent suspect:

- **detection latency** — folded into S6, because it is the same mechanism measured from the
  other end.
- **an unlisted property is never swept** — real, and OUT OF SCOPE. `coverage-sweep`'s list
  is hand-written and the file argues that this is not the usual sin ("there is nothing to
  derive it from"). A property nobody listed produces no finding, so it cannot be a cause of
  a finding failing to reach a person. It is named here so the next reader does not
  rediscover it as an RC5 cause. It belongs to a different question: what the sweep covers,
  not who reads what it says.

Nothing else survived. That is not proof of exhaustiveness — a universal negative is not
available — but the enumeration is closed under the mechanism that predicts where a suspect
would have to live, and the last pass added none.

## What follows, for whoever decides RC5

The decision #46 asks for is "which reader". The measurement in S3 changes the question,
because the gate the sweep is kept out of already refuses without a reader:

```
ci.yml suite job today          24-35 s   (measured over 5 runs)
short-circuited sweep           6.0 min   (measured over all 117 properties)
```

A six-minute sweep in `ci.yml` covers the `compel` stage outright, and `compel` is the only
stage whose failure does not depend on anyone's attention. It does not cover `persist`
(S11) or the exit-code conflation (S8), both of which remain whichever option is chosen.

---

## What this ledger does not establish

Whether the maintainer is notified by e-mail when a push-triggered workflow fails. That is a
property of GitHub's notification settings for this account, not of this repository, and
nothing here can measure it. #46's body asserts scheduled failures are e-mailed; that
assertion has not been tested and no conclusion above rests on it.
