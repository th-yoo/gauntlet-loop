// THE FACTS drift-guard checks, lifted out of it so something can ENUMERATE them.
//
// Issue 3: the guard's file surface is discovered, but its FACTS are five
// hand-written lists — 40 entries — and nothing measures what they miss or
// whether any given entry still bites. A list has no way to say what is not on
// it, and an entry that has stopped firing looks exactly like one that never
// needed to.
//
// The lists stay hand-written, and two of them SHOULD be: "which sentences must
// be present" is a statement of intent, exactly as coverage-sweep's property list
// is. What was missing is an instrument. scripts/guard-sweep.mjs breaks each
// entry's subject and requires drift-guard to go red AND to name that entry;
// anything that survives is decoration, and the sweep says which.
//
// NOTHING HERE EXECUTES A CHECK. Pure data, so both the guard and the instrument
// that audits the guard read one copy — a second copy is how the detection
// scoring rule ended up with three, all carrying the same defect.

export const RUNTIME_FORBIDDEN = ['import ', 'require(', 'Date.now', 'Math.random', 'new Date()']

export const CAP_NAMES = ['maxRounds', 'MAX_ROUNDS', 'HARD_CAP', 'ROUND_CAP', 'maxIterations']

export const LOOP_PINNED = [
  { loop: 'BE A REALLY HARSH CRITIC', agent: 'gauntlet-ab-critic', needle: 'really harsh critic',
    what: "the source's one requirement on the judge (\"That separate sub-agent should be a really harsh critic\")" },
  { loop: 'a tie is a critic declining to look closely enough', agent: 'gauntlet-ab-critic', needle: 'critic declining to look closely enough',
    what: 'the forced binary — no "they are comparable" exit' },
  { loop: 'the single largest thing', agent: 'gauntlet-ab-critic', needle: 'the single largest thing',
    what: 'ONE gap comes back, and it is the largest' },
  { loop: 'matte plastic under the same light', agent: 'gauntlet-ab-critic', needle: 'matte plastic under the same light',
    what: 'the concrete-enough-to-act-on example that defines what a gap must look like' },
  { loop: 'the next verdict uninterpretable', agent: 'gauntlet-builder', needle: 'the next verdict uninterpretable',
    what: 'the builder fixes exactly one gap, because a five-change round cannot be read' },
  { loop: 'Do not assess your own work', agent: 'gauntlet-builder', needle: 'grade your own work',
    what: 'the builder never judges what it just made — a fresh critic decides next round, and a builder that grades itself is the loop marking its own homework' },
  { loop: 'what would be inspected to judge it alone', agent: 'gauntlet-lead', needle: 'inspected to judge it',
    what: 'what makes a piece a piece — a named observable. Without it a "split" is topical, every piece can win, and the artifact as a whole is unjudged' },
  { loop: 'SPLIT_UNSOUND', agent: 'gauntlet-lead', needle: 'SPLIT_UNSOUND',
    what: "the one check standing behind the lead's judgement. The lead is told a bad split still gets through and that this catches only one shape of it — if the check goes and the prompt does not, the lead is being reassured about something that no longer runs" },
  { loop: 'breaker that cannot be read', agent: 'gauntlet-breaker', needle: 'breaker that cannot be read',
    what: 'the circuit breaker fails SAFE — an unreadable probe stops the run rather than continuing it' },
]

export const LOOP_DISCLOSURES = [
  'Nothing verifies that a harsh INSTRUCTION produced a harsh CRITIC',
  // THE FOUR WAYS A CONFIRMED EXIT CAN STILL BE WRONG (#18's second half).
  // The exit got stricter — one win arms, a second from a fresh critic on the
  // opposite side fires — and every one of these is a limit that strictness does
  // NOT buy. A stricter mechanism is exactly the kind that gets quoted past its
  // limits, so the limits are pinned rather than trusted to survive an edit.
  'BOTH CRITICS SHARE A MODEL FAMILY',
  'A NARROW WIN NO LONGER EXITS',
  'THE CONFIRMATION MEASURES JUDGE REPRODUCIBILITY, NOT ARTIFACT IMPROVEMENT',
  'A RUN CANCELLED WHILE ARMED STOPPED WITH ONE UNCONFIRMED WIN, WHICH IS NOT A WIN',
  // REPOINTED when the regression check landed, and again when it was renamed off
  // "ratchet". The claim moved from "there is no ratchet" to "there is no ratchet AND
  // regressions are measured", and a pin that does not move with a claim guards a
  // sentence nobody ships.
  'THERE IS NO RATCHET; REGRESSIONS ARE MEASURED AND NOT REVERTED',
  // Issue #41: three branches, one per state of the attestation. Pinned
  // separately because "not asked" and "answered no" are different facts, and a
  // pin covering one would let the other be deleted.
  'NOBODY WAS ASKED WHETHER THE GOAL WAS WRITTEN BEFORE THE CANDIDATE WAS OPENED',
  'THE GOAL IS ATTESTED AS WRITTEN BEFORE THE CANDIDATE WAS OPENED',
  'THE GOAL WAS WRITTEN AFTER THE CANDIDATE WAS READ',
  // k>1 is ours, not the source's. Both primary texts say one critic per piece.
  // If this line goes, the verdict starts implying a precedent that does not
  // exist — which is the exact class this tracker files most.
  'ADDITION, not source fidelity',
  // The ADDITION line settles provenance and stops there. These two say why k>1
  // exists at all and how the choice could stop being an argument. Pinned apart
  // because the provenance claim can survive while the reason for the parameter
  // disappears, which leaves a knob nobody has grounds to turn.
  'THE EXIT IS A SINGLE JUDGEMENT',
  'THE SPLIT LEDGER IS FED BY HAND OR NOT AT ALL',
  // Deleting the panel deleted the only calibration mechanism. If this line goes,
  // the plugin stops telling anyone that nothing checks its critics.
  'NO CALIBRATION ANYWHERE',
  // A builder that answers every absence by appending grows the artifact while
  // every round is locally correct. If this goes, nothing reports it. Pinned on
  // the stable half: the message names WHICH piece grew once a run is split, so
  // it can no longer say "THE ARTIFACT" — but the detector going away must still
  // fail here.
  'GREW EVERY ROUND',
  // The lead chooses what gets judged. A split that WON is now checked once more
  // against the whole artifact, and one that did not is still unverified — both
  // branches must survive, so both phrases are pinned.
  'THE SPLIT IS NOT CHECKED',
  'THE SPLIT IS CHECKED ONE WAY ONLY',
  // Content blindness: the run withholds its blindness claim when an artifact
  // gives away its origin. If this goes, a leaking run silently claims blindness.
  'NOT blind on content',
  // The blindness probe's criterion is the whole check. If this goes, the probe
  // silently reverts to pattern-matching for repo names and misses every other
  // way one artifact can stand apart from the other.
  'DIFFERENT relationship to this machine',
  'FIND THOSE ORIGINALS AND DIFF BOTH',
  // A goal fitted to the candidate cannot discriminate, and the first live run of
  // this build was decided by exactly that. Both halves of the residual are
  // pinned: the reference-side finding, and the candidate-side hole nothing checks.
  // Both goal probes read TEXT. Neither can see when the goal was written or by
  // whom, which is the failure that actually decided the first live run.
  'can see when the goal was written or by whom',
  'not independent judgments',
  // The judge and the judged are the same model. This is the deepest limitation
  // the method has — a critic cannot be counted on to catch the mistakes it would
  // make itself — and it is disclosed nowhere else.
  'Critic and builder share a model family',
  // Cancellation is the operator's only control in a loop with no round cap, so
  // what it does NOT do has to survive: removing the token stops the run at the
  // next round boundary, it does not abort an agent already in flight.
  'The breaker is checked at ROUND BOUNDARIES, not continuously',
  // The blindness probe searches this disk; two agents can reach the network. If
  // that disclosure goes while the tools remain, a `clean` probe result reads as
  // broader than it is — see the tool-grant check below, which pins the pair.
  'THE BLINDNESS PROBE MODELS THE FILESYSTEM ONLY',
  // #35's residual: measured once, cannot be closed. If this goes, the one measurement
  // of the goal-check probe's tree access stops being reported and gets re-discovered.
  'THE PAIRING CHECK READS THIS DISK TOO',
]

// ONE CONTRACT, PINNED ACROSS EVERY SURFACE THAT STATES IT. Four files told the
// operator the candidate was "built from nothing if absent" and the loop refuses
// exactly that, because it runs with no filesystem and cannot create anything
// (#62). The four copies were written apart and drifted together; nothing related
// them, so correcting one would have left three.
//
// PRESENCE, not absence. A rule forbidding the old phrase fails on the comments
// that now quote it to explain the defect — a check tripped by its own history.
// What must hold is that each surface SAYS the artifact has to exist already.
export const CONTRACT_STATED = [
  { file: 'skills/gauntlet-loop/SKILL.md', needle: 'It must ALREADY EXIST',
    what: "SKILL.md's candidate row states the artifact must already exist" },
  { file: 'skills/gauntlet-loop/loop.js', needle: 'It must ALREADY EXIST',
    what: "loop.js's own args contract states the artifact must already exist" },
  { file: 'commands/loop.md', needle: 'ALREADY EXISTS',
    what: 'the command doc\'s args block states the artifact must already exist' },
  { file: 'skills/gauntlet-loop/loop.js', needle: 'this loop cannot create it',
    what: 'the unreadable refusal names the remedy when the missing side is the candidate' },
]

export const COMPARER_CONTRACT = [
  { test: /provenance/i, what: 'tells its comparer not to reason about provenance — without it the blind A/B is blind in name only' },
  { test: /\btie\b/i, what: 'forces the choice, with no tie available — a tie is the "seems fine" exit this comparison exists to refuse' },
]

