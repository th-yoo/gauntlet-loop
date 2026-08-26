// THE PARSE, lifted out of the spawner so it can be tested at all.
//
// It lived inside scripts/detection-draw.mjs, which spawns a model — and
// test/containment.test.mjs forbids anything the suite runs from so much as
// NAMING a spawner, because that is how this repo reached depth 13. So the
// parse was unreachable from the suite and every one of its defects was found
// by reading it, which is the method this repo says does not work. Nothing here
// spawns anything; it is pure text in, verdict out.
//
// ---------------------------------------------------------------------------
// PARSING IS SEPARATE FROM SPAWNING, and that is the design rather than tidiness.
//
// Every response is written to runs/detection-raw/ BEFORE it is read, so the raw
// text is the evidence and the ledger is derived from it. A parser defect
// therefore costs a re-parse and never a re-spawn — which matters because this
// parser has now been wrong twice, and both times the response was fine.
//
//   1. The first version matched `winner` followed anywhere on the line by a
//      standalone `A`, and read "winner. Not tie-from-laziness — tie from
//      measurement…" as a pick for A on a control the critic had correctly
//      called identical.
//   2. The second read only the heading line, and the critic does not always put
//      the answer there: "## 1. WINNER" followed by a blank line and then
//      "**A** — but by declared coin-flip, not by merit" parsed as nothing.
//
// So it reads the heading AND the block under it, and anything it cannot read is
// left null for a human rather than guessed at.

export function parseWinner(text) {
  const lines = String(text).split('\n')
  const h = lines.findIndex(l => /^#{1,4}\s*\d*\.?\s*WINNER\b/i.test(l))
  if (h === -1) return null
  // The heading line minus the word WINNER, plus the next few lines, stopping at
  // the following heading so a later section cannot supply the answer.
  const block = [lines[h].replace(/^.*WINNER/i, '')]
  for (let i = h + 1; i < lines.length && block.length < 6; i++) {
    if (/^#{1,4}\s/.test(lines[i])) break
    block.push(lines[i])
  }
  const t = block.join(' ')
  if (/\bneither\b|\bno winner\b|\bnot a winner\b|\btie\b/i.test(t)) return 'neither'
  const a = /(^|[^A-Za-z])A([^A-Za-z]|$)/.test(t)
  const b = /(^|[^A-Za-z])B([^A-Za-z]|$)/.test(t)
  return a && !b ? 'A' : b && !a ? 'B' : null
}

export const norm = x => String(x).replace(/[`*#|]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()

// THE NEEDLE MUST BE TEXT ONE SIDE CARRIES, and getting that wrong is what this
// function was committed failing for. It took the first 60 characters of the
// changed line — so a substitution deeper than character 60 produced a needle
// that was IDENTICAL on both sides, and a critic that quoted the sentence while
// noticing nothing scored the same as one that found the number. Three of the
// fifteen degraded trials on disk have that shape.
//
// So the needle is built from where the two lines DIVERGE: the span between
// their common prefix and their common suffix, widened by context until it is
// long enough not to be an accident AND is absent from the other side's line.
// The narrowest such window is the one returned, because every wider window
// contains it — a response holding the wider one holds this one too, so the
// narrowest strictly dominates and a disjunction over widths would only add
// ways to say yes.
// TWELVE, AND THE NUMBER WAS MEASURED RATHER THAN PICKED. The floor decides
// whether the field says anything: with it at 4 the needles came out "nnot",
// "1. b", "0001", and a length-matched fragment from an UNTOUCHED line of the
// same file turned up in the critic's response 22% of the time — a quarter of
// the yeses were the critic quoting the artifact at all, not quoting the defect.
// Sweeping the floor against that placebo (test/detection-parse.test.mjs runs
// the same crossing):
//
//   floor   named   placebo
//     4      93%      22%
//     8      93%       7%
//    12      87%       4%     <- every trial still yields a needle
//    16      85%       4%     2 trials yield none
//    32      64%       1%     4 trials yield none
//
// Twelve is the knee: the placebo is down 5x from where it started, and no trial
// has yet lost its needle. Above it the field starts returning null, and a trial
// that drops out is worse than one scored strictly.
const MIN_NEEDLE = 12
function distinctiveNeedle(mine, theirs) {
  const a = norm(mine), b = norm(theirs)
  if (!a || a === b) return null
  let p = 0
  while (p < a.length && p < b.length && a[p] === b[p]) p++
  let s = 0
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++
  const lo = p, hi = a.length - s
  for (let w = 0; w <= a.length; w++) {
    const cand = a.slice(Math.max(0, lo - w), Math.min(a.length, hi + w)).trim()
    if (cand.length >= MIN_NEEDLE && !b.includes(cand)) return cand
  }
  return null
}

// DID IT NAME THE DEFECT, or merely land on the right side?
//
// Picking correctly is 50/50 luck on any single trial; quoting text that only
// one side carries is not. This is the leak-check shape the deleted gate 7 used
// in reverse — there, finding the sealed strings in a critic's output proved it
// had reached the original; here it is evidence the critic located the damage.
//
// STILL A HEURISTIC, and still one that UNDERSTATES: a critic that describes the
// defect in its own words without quoting scores false. What it must not do is
// overstate, because the direction that overstates is the one that gets quoted.
// Nothing gates on the field and the response is on disk for a reader who wants
// the real answer.
export function defectNeedles(note) {
  if (note.degraded_side === 'none') return null
  const candidates = []
  if (note.defect_class === 'section-removal') {
    // The heading of the removed section. It is distinctive by construction —
    // the degraded copy is the one that no longer contains it.
    const head = norm(String(note.removed).split('\n')[0].replace(/^#+\s*/, ''))
    if (head.length >= MIN_NEEDLE) candidates.push(head)
  } else {
    // Both directions: the critic may quote what is there or what is not.
    for (const [mine, theirs] of [[note.removed, note.inserted], [note.inserted, note.removed]]) {
      const n = distinctiveNeedle(mine, theirs)
      if (n) candidates.push(n)
    }
  }
  return candidates.length ? candidates : null
}

export function namedDefect(text, note) {
  const candidates = defectNeedles(note)
  if (!candidates) return null
  const h = norm(text)
  return candidates.some(c => h.includes(c))
}

// A control where the critic said the sides are identical, or picked one while
// disclaiming that the pick carries no signal, is NOT a false alarm — it is the
// difference-seeking confound scoring zero. Recorded separately from the pick,
// because "picked A" and "picked A and said so meaninglessly" are different
// observations and merging them is how a control set stops controlling.
export function declaredNoDifference(text) {
  return /byte-identical|identical byte|no dimension separates|carries zero signal|coin-flip|coin flip|\bidentical\b/i.test(String(text))
}

// ---------------------------------------------------------------------------
// WHICH DIRECTORY IS ON THE `ARTIFACT A` LINE — read from the prompt, never
// assumed from the argument order.
//
// THIS IS THE DEFECT THAT INVERTED THE #29 RATE. The runner staged the degraded
// copy under `a/` or `b/` and recorded that DIRECTORY letter as
// `degraded_side`. The critic answers in ARTIFACT letters, because that is what
// the prompt calls them. Those are two coordinate systems, and `loop.js`
// alternates the candidate's side by (round + critic index) parity — so on the
// round the runner captures, the path passed as `candidate` is rendered on the
// `ARTIFACT B` line. Every one of the twenty trials was judged under
//
//     ARTIFACT A: <trial>/b/subject.md
//     ARTIFACT B: <trial>/a/subject.md
//
// and `detected: picked !== degraded_side` compared a letter from one system
// against a letter from the other. It computed the exact complement of
// detection: 2/12 recorded, 10/12 actual.
//
// The general rule this file was missing, and the reason the fix is a DERIVATION
// rather than a flipped constant: the mapping is a fact about the prompt that
// was actually sent, so it must be read out of that prompt. A constant that says
// "A means b/" is right for the rounds where it is right and silently wrong the
// day the parity, the round index or `args.critics` changes — which is the same
// stored-derivable-fact shape as the three `trial_id`/`opaque` key bugs already
// recorded in the runner.
//
// Returns { A: 'a'|'b', B: 'a'|'b' } — the ARTIFACT letter mapped to the
// directory letter — or null when it cannot be read. NULL IS THE POINT: a run
// that cannot establish the mapping must refuse the trial, because the
// alternative is assuming it, and assuming it is what produced the inverted
// rate.
export function artifactSides(prompt, aPath, bPath) {
  if (!prompt || !aPath || !bPath || aPath === bPath) return null
  const out = {}
  for (const line of String(prompt).split('\n')) {
    const m = /^ARTIFACT ([AB]):\s*(.+?)\s*$/.exec(line)
    if (!m) continue
    // A second ARTIFACT line for the same letter means the prompt is not one
    // this can read — loop.js already refuses a path with a newline in it for
    // this reason, and reading the first of two would be guessing.
    if (out[m[1]] !== undefined) return null
    out[m[1]] = m[2] === aPath ? 'a' : m[2] === bPath ? 'b' : null
  }
  if (out.A === undefined || out.B === undefined) return null
  if (out.A === null || out.B === null) return null
  // Both letters pointing at the same directory is not a mapping.
  if (out.A === out.B) return null
  return { A: out.A, B: out.B }
}

// The ARTIFACT letter the degraded copy was rendered as, which is the only
// letter comparable with what the critic answered. `sides` comes from
// artifactSides; `degradedDir` is the sealed note's directory letter.
export function degradedArtifact(sides, degradedDir) {
  if (!sides || (degradedDir !== 'a' && degradedDir !== 'b' && degradedDir !== 'A' && degradedDir !== 'B')) return null
  const d = degradedDir.toLowerCase()
  return sides.A === d ? 'A' : sides.B === d ? 'B' : null
}

// ONE RULE FOR WHAT COUNTS AS A DETECTION, because it had been written three
// times — in the drawer, in the re-parser, and in a test that was meant to audit
// them — and all three copies carried the same defect. A derivation duplicated
// per call site is the 1:1 growth this project calls cheating: three copies
// means three places for the next correction to miss.
//
// `picked` and `degArtifact` are BOTH artifact letters. Passing a directory
// letter for the second is the original bug, and there is no signature that can
// stop that, so the argument is named for what it must be and the ledger records
// it under the same name.
//
//   null  — nothing was established: a control, an unreadable answer, a critic
//           that answered "neither", or a trial whose mapping could not be read.
//           NOT false. Recording an unestablished value as the negative answer
//           pushes a rate down using trials that never spoke, which this file's
//           header already records as a defect it has had.
export function scoreDetection(picked, degArtifact, degradedDir) {
  if (degradedDir === 'none' || degradedDir === undefined || degradedDir === null) return null
  if (picked === null || picked === undefined || picked === 'neither') return null
  if (degArtifact !== 'A' && degArtifact !== 'B') return null
  return picked !== degArtifact
}
