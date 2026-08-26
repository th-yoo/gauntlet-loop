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

---

## The adversarial pass, and where it stopped

The list was built in waves, and the yield per wave is the only convergence evidence
available: **7 suspects, then 5, then 1, then 0.**

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
