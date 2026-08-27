# Auditing the guard's own facts

**Issue:** 3. **Date:** 2026-08-27. **Instrument:** `scripts/guard-sweep.mjs`, gated by
`test/guard-sweep.test.mjs`, which the suite and CI already run.

## The result

**40 of 40 hand-written facts still bite.** Every entry, broken in its own subject, makes
`drift-guard` fail *and* name that entry. None survived, none went red without being named,
none was already dead, and none is redundant with another check.

| list | entries | caught | survived | redundant |
|---|---|---|---|---|
| `RUNTIME_FORBIDDEN` | 5 | 5 | 0 | 0 |
| `CAP_NAMES` | 5 | 5 | 0 | 0 |
| `LOOP_PINNED` | 9 | 9 | 0 | 0 |
| `LOOP_DISCLOSURES` | 19 | 19 | 0 | 0 |
| `COMPARER_CONTRACT` | 2 | 2 | 0 | 0 |

By issue 3's own falsification clause — *"a run of the mutation arm above in which every
entry bites"* — that closes it.

## What was built, and why it is not "add the missing entries"

Issue 3 was explicit that the fix must not be more list entries: that is one line per
incident, and a list still has no way to say what is not on it. Two things were built
instead, which are the two the issue named.

**1. A mutation arm.** `guard-sweep` breaks each fact's subject and requires `drift-guard`
to notice. This is what `coverage-sweep` already does to the test suite, applied to the
guard's own subjects.

**Two conditions, not one, and the second is the whole point.** A mutation counts as caught
only when `drift-guard` fails **and** a `FAIL` line names that entry. Asking only for a
non-zero exit is a check whose PASS is satisfied by the subject being broken in any way at
all — a crash, or a different entry tripping, would score CAUGHT. This repository has
shipped that mistake before: a trial asking only `exit !== 0` reported CAUGHT against a
script that did not parse.

**2. A stated residual, on every branch.** `drift-guard` now prints what it does not
establish, on the green branch as well as the red one, because a limitation printed only
when something is already wrong is printed exactly when it does not matter. Its count is
recomputed from the lists rather than typed beside them, and `test/guard-sweep.test.mjs`
fails if the two disagree — the standing rule that a derivable fact stored beside its source
must be recomputed and fail on disagreement.

The facts moved to `test/drift-facts.mjs` so both the guard and the instrument auditing the
guard read one copy. A second copy is how the detection scoring rule ended up with three,
all carrying the same defect, with the audit agreeing with what it audited.

## What the instrument corrected about itself

A sweep reporting 40 of 40 caught is exactly when to ask what would have to be true for it to
report anything else. Four things had to be fixed before the number meant anything, and each
was found by constructing the input that should have produced a different verdict.

1. **A crash was scored as caught.** `drift-guard` dying — a syntax error, a missing module —
   exits non-zero and prints no `FAIL` lines. Every comparison read that as a verdict. In the
   redundancy pass it inverted the answer outright: a malformed entry removal broke the facts
   module, the guard crashed, and the entry was reported load-bearing *precisely when the
   measurement had failed to happen*.
2. **Attribution was too loose.** The first version searched the guard's whole output for the
   entry's text. `drift-guard` prints each check as it runs and names every list in its
   closing summary, so three `RUNTIME_FORBIDDEN` entries scored CAUGHT under a mutation that
   had removed their names from the failure message. Attribution is now to `FAIL` lines only.
3. **The entry removal deleted whole lines.** Correct for the disclosure lists, one entry per
   line — and catastrophic for `CAP_NAMES` and `RUNTIME_FORBIDDEN`, which are single-line
   arrays, where it deleted the entire export. Every entry came back "redundancy unmeasured".
   It splices the array element now.
4. **A heuristic stood in for a decidable question.** The check that a removal left a
   parseable module counted brackets — including the ones inside string literals and regexes,
   which every disclosure and `/\btie\b/i` contain — so it declared every removal malformed.
   It runs `node --check` now.

Only after those did the sweep demonstrably report each of its verdicts:

| constructed input | verdict produced |
|---|---|
| the `RUNTIME_FORBIDDEN` check disabled in `drift-guard` | 5 SURVIVED |
| the disclosure check disabled | 18 SURVIVED, 1 RED-BUT-UNNAMED |
| the failure message stripped of the entry's name | 2 RED-BUT-UNNAMED |
| an entry duplicated in its list | both copies REDUNDANT |

## One thing the sweep found about the guard

With the disclosure check disabled, eighteen of nineteen entries survived — and one did not:
**`THE BLINDNESS PROBE MODELS THE FILESYSTEM ONLY`** still made the guard go red, without
naming it. A second check covers that property. That is not a defect, but it is worth
knowing: if the disclosure check were ever removed, that one failure would still fire and
would be untraceable to the disclosure it is actually about.

## What this does NOT establish

- **That the lists are COMPLETE**, which is the half of issue 3 no instrument here can close.
  Every entry biting says nothing about the entry nobody wrote. A property that was never
  pinned produces no failure to notice, and the file surface being discovered does not help —
  discovery finds new *files*, not new *claims*.
- **That an entry pins the RIGHT property.** The sweep shows the guard notices when an entry
  is broken; never that the entry was worth pinning in the first place.
- **That SURVIVED is reachable by adding a bad entry.** It is not, and that is a property of
  the design rather than a gap: the mutation is derived from the entry itself, so any
  syntactically valid entry yields a subject that can be broken. SURVIVED arises when a
  CHECK weakens, which is the realistic failure and is demonstrated above.
- **Anything about `ALLOWLIST` or the discovered file surface.** Those were already covered
  by discovery and are not what issue 3 was about.

## Reproducing

    node scripts/guard-sweep.mjs            # the sweep, 40 entries, ~4s
    node scripts/guard-sweep.mjs --only LOOP_DISCLOSURES
    node test/guard-sweep.test.mjs          # the gate; also runs inside test/run-all.mjs

Nothing is mutated in the working tree: every mutation is applied to a copy of the working
tree under the system temp directory, and `drift-guard` is run from inside that copy so its
own `ROOT` resolves there. The copy is taken from `git ls-files --cached --others` rather
than from a list of files this script believes the guard reads — a pin covers what someone
thought to enumerate, and the guard's read set is the thing under test.
