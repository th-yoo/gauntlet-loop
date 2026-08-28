// A DISCLOSURE THAT STATES A FIGURE MUST SAY WHERE THE FIGURE COMES FROM.
//
// Issue #56. `loop.js` emitted, into every run's own `not_enforced` list:
//
//     "revert would hand rollback authority to an evaluator whose detection rate
//      is n=1 (#29)"
//
// The rate is 12/15. The sentence outlived the fact by a day and shipped in the
// artifact rather than in the docs.
//
// WHY EVERY EXISTING CHECK PASSED, measured by mutation rather than reasoned
// about — each of these was applied and the full suite, drift-guard and
// disclosure-audit all run:
//
//   n=1 -> n=99                                          NOT CAUGHT
//   n=1 -> "80% and amply proven"                        NOT CAUGHT
//   "Nothing is rolled back" -> "Everything is rolled back"   NOT CAUGHT
//   the 62-character pinned prefix changed               CAUGHT
//   the rest replaced with "Bananas are a berry"         NOT CAUGHT
//
// The emitted disclosure is 1205 characters. `test/drift-facts.mjs` pins 62 of
// them and `scripts/disclosure-audit.mjs` keys on 40, so the strongest check in
// the repository reaches 5% of the sentence and every probe above lives in the
// other 95%.
//
// TWO KINDS OF CLAIM IN ONE STRING, and only one is testable by execution.
// "Nothing is rolled back" is behaviour: drive the loop and watch it not revert,
// which `test/disclosure-behaviour.test.mjs` does and passes correctly. "the
// detection rate is n=1" is a claim about a MEASUREMENT, and no execution of
// loop.js can test it. They are one atom, so the true half carried the false half
// through every check that existed.
//
// THE RULE, and it needs no registry of claims. A disclosure may state a figure
// only if the same sentence cites a repository path that exists AND that file
// contains the figure. No mapping from claim to quantity, no list of what a valid
// figure means: the check is "is this number written down where you said it is".
// A figure with nowhere to point is either wrong or unrecorded, and both are
// findings.
//
// WHAT COUNTS AS A FIGURE is deliberately narrow — a rate, a ratio, an `n=`, a
// percentage. `k=1` in "at the default k=1" describes the run that is speaking
// and is not a measurement; "five spawns" is a word. Widening this to every digit
// would make the rule fire on the loop describing its own configuration, which is
// the opposite of what it is for.
//
// AND WHERE A FIGURE HAS NO RECORD, it is adjudicated rather than deleted. One
// exists: a 3-2 judge split from a run that predates the ledger discipline, whose
// evidence is prose that #50 already refused to reconstruct. Recording that is
// the honest answer; silently dropping the number would remove the disclosure's
// reason for existing.

// A rate, a ratio, an `n=`, or a percentage. Not every digit — see above.
const FIGURE = /\bn\s*=\s*\d+\b|\b\d+\s*[-–—/]\s*\d+\b|\b\d+(?:\.\d+)?\s*%/g

// Repository-relative paths with a file extension this project actually uses. A
// bare word with a dot in it is not a citation.
const PATH = /\b(?:[\w.-]+\/)+[\w.-]+\.(?:mjs|js|md|jsonl|json|yml|yaml)\b/g

// Spacing is not part of a figure: `12 / 15` in a table and `12/15` in a sentence
// are the same number, and a rule that missed one of them would be satisfied by
// reformatting.
export const canon = s => String(s)
  .replace(/[–—]/g, '-')                      // an en-dash and a hyphen are one number written twice
  .replace(/\s*([-/=%])\s*/g, '$1')
  .toLowerCase()

export function figureTokens(text) {
  return [...new Set((String(text).match(FIGURE) || []).map(canon))]
}

export function citedPaths(text) {
  return [...new Set(String(text).match(PATH) || [])]
}

// Returns the problems with one disclosure, in the subject's own terms. An empty
// array means the disclosure states no figure, or states figures that are all
// written down where it says they are.
//
// `exists` and `read` are supplied by the caller so nothing here touches a
// filesystem: the same function is driven with constructed text in the tests,
// which is the only way to know it can fail.
export function auditFigures(text, { exists, read }) {
  const figures = figureTokens(text)
  const paths = citedPaths(text)
  const problems = []

  // A path that does not exist is a finding whether or not a figure rides on it:
  // a citation nobody can follow reads as sourcing and is not.
  const live = []
  for (const p of paths) {
    if (exists(p)) live.push(p)
    else problems.push({ kind: 'missing-path', path: p })
  }
  if (!figures.length) return problems

  if (!live.length) {
    problems.push({ kind: 'unsourced', figures })
    return problems
  }
  for (const f of figures) {
    const found = live.some(p => canon(read(p)).includes(f))
    if (!found) problems.push({ kind: 'not-in-source', figure: f, paths: live })
  }
  return problems
}

export function describeProblem(p, where) {
  if (p.kind === 'missing-path') {
    return `${where} cites ${p.path}, which does not exist. A citation nobody can follow reads as sourcing and is not.`
  }
  if (p.kind === 'unsourced') {
    return `${where} states ${p.figures.join(', ')} and cites no file that exists. A figure with nowhere to point is either wrong or unrecorded — issue #56 shipped "detection rate is n=1" for a day after the rate was measured at 12/15, and every check in this repository passed on it. Cite the evidence, or adjudicate the figure.`
  }
  return `${where} states ${p.figure}, and none of the files it cites (${p.paths.join(', ')}) contains that number. Either the disclosure is stale or the citation is the wrong file.`
}
