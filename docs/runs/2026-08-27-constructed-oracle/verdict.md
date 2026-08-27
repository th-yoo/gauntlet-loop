# A pairing set whose answers nobody wrote

**Issue:** 33 (sub-issue of 28, root cause 5). **Date:** 2026-08-27.
**Instrument:** `scripts/constructed-verify.mjs`, gated by
`test/constructed-oracle.test.mjs`, which `run-all` and CI already run.

## What was wrong, measured before building

Of the 22 rows in `oracle/corpus.jsonl`:

| role / grounding | rows |
|---|---|
| `does-the-work` / mechanical | 13 |
| `produces-an-instruction` / **agentic** | **7** |
| `could-not-open` / absence | 2 |
| `produces-an-instruction` / **mechanical** | **0** |

**Every generator verdict this repository has ever recorded was settled by an agent
classifying an emission** — the same kind of judgement the comparability probe is under
suspicion for. A ground truth produced by the kind of judgement under test cannot audit that
judgement, which is `oracle/README.md`'s own rule, and the generator arm had never satisfied it.

## What was built

Four artifacts and three pairings whose relationship follows from what they **are**.

The one that did not exist before is a **mechanically-grounded generator**. The repository's
classification rule is unchanged — *does executing this artifact terminate in the goal's
deliverable, or in a request addressed to a further party?* — and the second branch is now a
shell observation rather than an agent's reading:

> Run it, and the deliverable is **not** there. But a runnable artifact **is**, and running
> **that** reaches the deliverable.

Two exit codes. The "further party" is whoever runs the emission, and the emission is on disk.

    constructed-scaffold   produces-an-instruction   emits build.sh, builds nothing itself
    constructed-direct     does-the-work             reaches the deliverable in one step
    constructed-make       does-the-work             same deliverable, different mechanism
    constructed-absent     could-not-open            the path is not there

    constructed-generator-pair    produces-an-instruction + does-the-work  =>  generator
    constructed-comparable-pair   does-the-work + does-the-work            =>  comparable
    constructed-absent-pair       could-not-open + does-the-work           =>  unreadable

All three composed verdicts are constructible, so the set can serve as ground truth for any
of them rather than only for the easy one.

## The role is derived, never read

`constructed-verify` **executes** each artifact and observes the filesystem, then compares
the result against what the manifest declares. A manifest that stored the answer and a
checker that read it back would be the answer key this issue is about, one file along.

The gate demonstrates the difference: it hands the verifier a manifest claiming the scaffold
*does the work*, and requires the run to fail with `DISAGREES`. A deriver that echoed its
input would pass everything else in this file.

Four more cases exist only to make the deriver refuse:

- an artifact that reaches nothing and emits nothing is a **failure, not an instruction** —
  without this, anything broken would be classed as a generator;
- an emission that does not itself reach the deliverable is **not** a request addressed to a
  further party, because the chain never terminates in the goal;
- a probe whose command names a model is **refused unrun**, the same rule `oracle-add.mjs`
  applies to acceptance commands, and the reason this set exists at all;
- a path *declared* absent that actually exists is refused — the filesystem decides.

Eight mutations of the deriver are caught against a passing baseline.

## One mutation survived, and what it was worth

Deleting the check that an emission is *declared* left every test green. Investigated rather
than patched: with the guard gone the verdict is unchanged — an undeclared emission still
derives `null` — so the guard is not load-bearing for the answer. It is load-bearing for the
**message**. Without it, a probe author who forgot half their probe is told their *artifact
failed*, which sends them to debug the wrong thing. A case now pins the message, and the
mutation is caught.

## Deliberately NOT pooled with the corpus

These rows live in `oracle/constructed.jsonl`, not `oracle/corpus.jsonl`. They are
constructed, not sampled; mixing frames would move every rate `oracle-report` computes over a
corpus that already has no sampling frame (#38). A different frame belongs in a different file.

## What this does NOT establish

- **Anything about the probe.** Nothing here runs it. This builds the ruler; measuring the
  probe against it needs live agents and is the next step.
- **That these artifacts resemble what the probe meets.** They are built to make one
  relationship definitional, which is exactly what makes them ground truth and exactly what
  makes them unrepresentative. They bound whether the probe can be **right where the answer is
  knowable**; they say nothing about the corpus it is used on.
- **The rest of #33's table.** A JSON Schema and a document that validates against it, an
  OpenAPI spec and a served response — those are relationships of a different shape, where
  neither side *executes* into the other. The rule this repository classifies by is about
  execution, so those pairs need either a different rule or a different reading, and inventing
  one to fill a table would be fitting.
- **#28.** This closes its root cause 5. Its root causes 1–4 are elsewhere, and three of its
  four sub-issues are already closed.

## Reproducing

    node scripts/constructed-verify.mjs
    node scripts/constructed-verify.mjs --json
    node test/constructed-oracle.test.mjs      # the gate; also runs inside test/run-all.mjs

`CONSTRUCTED_MANIFEST` and `CONSTRUCTED_PAIRINGS` point the verifier at other files, which is
how the gate feeds it a deliberately mislabelled manifest.
