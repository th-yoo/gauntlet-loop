# 0005 — A measurement's reach is its ledger, and no rule over prose is added

**Status:** decided, 2026-08-31. **Decided by:** the operator (th-yoo), by instructing that
issue 50 be closed; the reasons are the evidence on file as read at that time.
**Settles:** the half of issue 50 its 2026-08-27 comment left explicitly untaken: *"whether
run documents should be required to emit a ledger is a decision rather than a patch, and I
have not taken it."*
**Records this rests on:** `scripts/capacity-check.mjs` (discovery over tracked `.jsonl`,
cohort analysis, adjudications priced by cost), `docs/runs/2026-08-26-pairing-stability.md`
(the run whose outcomes lived in prose), `docs/capacity-adjudications.jsonl`.

## The question

The pairing-stability run recorded its outcomes in a fenced block in prose, and
capacity-check could not reach it — until the scan learned that `oracle/results.jsonl`
carried the same draws, the run's central property (the probe could not have been wrong on
that set) was found by accident, not by instrument. Should a rule require every measurement
run to emit a machine-readable ledger?

## What was measured before deciding

- **The documentary version of this rule was already rejected once, for cause.** Issue 50's
  own first proposal — require a pre-registration to *state* why the falsifying result was
  available — would have passed the exact run it was raised about, which states "it could
  have" in its own prose. Requiring a sentence enforces nothing; the author's sentence is
  the thing under suspicion. A "this run emits no ledger because…" boilerplate line has the
  same shape.
- **What has teeth is already built, and it found the instance.** Ledgers are discovered
  (`git ls-files '*.jsonl'`), cohorts inside them are discovered, every constant must carry
  an adjudication that says what it costs, and the check found the pairing cohort's
  `correct: true` across all 48 rows — the issue's mechanism, mechanically, in the run it
  was raised about.
- **The tools that measure now emit ledgers by construction.** `oracle-draw` and
  `oracle-record` write `results.jsonl` rows; `split-ledger --ingest` derives trials from
  committed verdicts; the builder and detection arms write `runs/*.jsonl`. A prose-only
  measurement today would have to be made by hand, against the grain of every instrument.
  The pairing-stability run predates those tools.
- **The reach limit is printed and now pinned.** capacity-check states on every branch that
  it reads what was written down and that pre-run capacity is undecidable from a design
  description; those sentences are asserted verbatim by its gate and one is a sweep needle.

## The decision

**No rule over run prose.** The enforcement lives where it can be mechanical — discovered
ledgers, discovered cohorts, priced adjudications — and the limit of that reach is a pinned
residual, not a requirement that run documents recite compliance. A measurement whose
claims need checking lands rows in a tracked ledger because the tools that make
measurements write them; a run that bypasses the tools is out of reach, and the instrument
says so rather than pretending a sentence in the run doc would fix it.

Declined, with reasons:

- **Require every run document to emit or reference a ledger.** A documentary check of the
  kind issue 50 itself rejected: satisfied by boilerplate, audited by nothing, and
  retroactively red on a directory of historical failure reports whose value is prose.
- **Reconstruct ledgers from prose runs.** Considered and rejected in the 2026-08-27
  comment: the pairing-stability figures do not cleanly reconcile, and inventing structure
  to make a run checkable is manufacturing evidence.
- **Close the pre-run half with a stated-capacity requirement.** Undecidable from a
  description, and the author's statement is the suspect. Held as a pinned residual
  instead, per the sampling-frame rule in CLAUDE.md.

## What would reopen this

- A second prose-only measurement whose claims later needed checking. Then the cost of this
  decision has been realised twice, and the remedy is in the tools — make whatever produced
  it write rows, as oracle-draw already does — not in the prose.
- A way to decide pre-run capacity mechanically from something that is not the author's own
  description — a constructed counter-design, a second author, an adversarial draw. None is
  known; issue 50's falsifier stands with it.

## What this decision does not establish

That prose runs are harmless. The pairing-stability run's stability sentence was stronger
than its design could support, and only the ledger scan caught it — three days later, by
accident of a wider scan. The decision is that the fix belongs in instruments and reach
disclosures, not in a compliance sentence.
