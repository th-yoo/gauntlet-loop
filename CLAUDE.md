# Method rules for this project

These extend the **Method rules** in the parent `CLAUDE.md`. They were induced here,
from bugs fixed here, and each is stated so it can be applied to a bug it was not
induced from — a rule that only fires on the incident that produced it is the 1:1
growth the parent file calls cheating.

- **Fix in this order: name root-cause candidates, BUILD a reproducible that fails,
  then attack it iteratively.** Reasoning about the fix before the reproducible exists
  produces confident claims the artifact then refutes. Every iteration after it is
  cheap, because the thing that decides is already built — the expensive part is
  building it, not running it again.

- **A check whose PASS condition is satisfied by the thing being broken measures
  nothing.** The parent rule says a check that cannot be wrong cannot be informative;
  this is the other way it goes wrong. A trial asking only `exit !== 0` reported CAUGHT
  against a script that did not parse, and returned the answer wanted. Assert the
  specific outcome — the refusal's own words — and report a crash as a crash.

- **To test whether an instrument measures what it CLAIMS, cross the claimed property
  against the confound it is probably measuring instead, and COMPUTE the key rather
  than assert it.** Arrange the cases so an instrument reading the confound scores at
  chance. Then the result is a measurement rather than a demonstration, and it can come
  back against you. A one-sided set of cases proves only that you can build cases.

- **Guards placed where something once broke leave every other derivable fact
  unguarded.** Ask what the guarded facts have in common: if the answer is "they
  already failed," the rule is missing, and the next defect is in whichever derivable
  fact is still stored. That question predicts where to look; an incident only says
  where you have been.

- **Prefer re-running to pinning.** A pin covers what you thought to enumerate; running
  the thing covers what it actually reads. Where the dependency set is unbounded or
  unrecorded, a pin cannot be made to match the claim and only re-execution can.

- **State the residual in the output, on every branch.** A limitation printed only when
  nothing is being asserted is printed exactly when it does not matter. If a verdict
  cannot establish something, the branch that carries the verdict is the branch that
  must say so.
