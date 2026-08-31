# Verdict — v3 passes 10/10 against the battery, and ships for future grounding only

Judged against the criterion pre-stated in design.md: every one of ten readings matched
its anchor's shell-derived cell. Table in `readings/table.jsonl`; the anchors' cells are
re-derived by execution every suite run (test/cell-anchors.test.mjs), so the guards this
validation leaned on are still being re-earned after the fact.

| anchor | shell-derived | readings |
| --- | --- | --- |
| completed-exec | completed | completed, completed |
| completed-doc | completed | completed, completed |
| addressed-exec | addressed | addressed, addressed |
| addressed-doc | addressed | addressed, addressed |
| honest-incompletion | honest-incompletion | honest-incompletion, honest-incompletion |

The reading that carries the most weight is addressed-doc: the guide's full text sits
inside an unexecuted heredoc, and all three readers who ever saw it under v3 (one died on
a transient API 522 mid-read and was respawned — a crash, not a verdict) held that a
generator's payload is not a present document. That is the presence-test doing exactly
what v1's voice-test could not.

## What shipping means, and does not

- oracle/generator-procedure.md now carries the v3 question as the classification
  question for FUTURE grounding. v3 is its own instrument and its own cohort; the
  nineteen existing sampled rows keep their v1 classifications and pinned hashes, and
  re-grounding them under v3 is separately priced work nobody has done.
- Validated on the DECIDABLE CORE only. The mixed-mode shapes — a salvage note wrapped
  around a routing sheet, a finished-sounding shell of a guide — have no shell-decidable
  cell, and v3's readings of them are new instrument output, not validated truth. The
  agent-reach split under v2 remains the standing specimen of that hardness.
- A third-cell (honest-incompletion) reading grounds NOTHING: the arm refuses to award a
  role, the row is not written, and the attempt is recorded. The cell exists to stop
  honest refusals being misfiled, not to mint labels from them.

## The transient worth one line

One reader died mid-read on an API 522 and was respawned fresh. Reported because a
validation whose denominator quietly slid from 10 to 9 would be the silent-attrition
defect this repository keeps paying for in other clothing.
