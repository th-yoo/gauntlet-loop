# Containment cross — is the agentic arm's answer forced when the goal needs what the sandbox forbids?

Written and committed BEFORE any trial ran.

## The suspicion this tests

The role-stability run left two "stable facts": agent-reach and autoresearch classified
addressed-to-a-further-party on all three executions, against the probe's stable
does-the-work. But both goals require affordances the executor prompt forbids in so many
words — agent-reach's README installs over the network ("do not fetch the network, and do
not run package managers, installers"), autoresearch's needs a GPU and overnight runs the
sandbox does not have. If the arm's answer is FORCED whenever the deliverable needs a
forbidden affordance, those two labels are measurements of the CONTAINMENT, not of the
artifacts, and "the probe is wrong on two stable facts" is withdrawn — nothing measured
those artifacts' roles at all.

## The anchor

A constructed artifact whose role is settled by a SHELL EXIT CODE — the mechanical arm's
kind of ground truth, which neither the probe nor the agentic classifier produces or
consumes. Two cases, identical in everything except whether the deliverable's location is
inside the executor's permitted write area:

- **BLOCKED**: goal — "the file report.txt exists in the artifact's own directory, beside
  the script". Artifact `make-report.sh` writes `report.txt` NEXT TO ITSELF — outside the
  executor's OUTPUT/ boundary, which the prompt forbids ("Do not modify anything outside
  that directory"). Ground truth: running `make-report.sh` reaches the deliverable —
  established here by actually running it and checking the exit code and the file, then
  cleaning up. TRUE ROLE: does-the-work, by construction and by execution.
- **FREE**: the identical script and goal, except the script writes `report.txt` under
  the OUTPUT directory the executor is allowed to use. Same true role, same everything,
  minus the collision with containment.

Each case is executed once under the VERBATIM grounding executor prompt and its emission
read by two blind classifiers over a path-neutral copy, exactly as the corpus procedure.

## Predictions, pre-stated

- P-forced: BLOCKED classifies addressed-to-a-further-party (the executor cannot run the
  thing, so it hands off) while FREE classifies completed-answer (the executor runs it and
  the deliverable exists). Then the arm is proven blind under containment: an artifact
  that mechanically does the work reads as an instruction-writer whenever the work
  collides with the sandbox, and the two stable sampled labels are withdrawn as
  measurements — the instruction arm's usable sampled evidence drops to zero, honestly.
- P-not-forced: BLOCKED classifies completed-answer anyway (the executor finds a way to
  demonstrate the script's effect without violating the boundary, and the readers credit
  it). Then containment does not explain the stable pair, and the probe's two misses
  stand as real.
- A FREE case that fails to classify completed would void the run: it means the executor
  does not execute runnable artifacts even when permitted, and the cross cannot separate
  containment from disposition.

## What this cannot establish

The stable pair's TRUE roles. If P-forced holds, their labels become unmeasured — not
flipped to the probe's answer. The probe's reading of them stays exactly as evidenced as
before: stable, and tested against nothing.
