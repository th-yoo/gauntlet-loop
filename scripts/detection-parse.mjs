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

// THE ITEM LABELS COME FROM THE PROMPT, not from a catalogue of markdown shapes.
//
// #53: three of fifteen degraded trials were recorded `picked: null` because the
// critic wrote `**1. WINNER — B**` and this parser demanded a `#` heading. The
// prompt never asks for `#`. It states a numbered template —
//
//     1. WINNER — A or B. You must choose. ...
//     2. WHY — what actually separates them. Concrete.
//
// — so the thing to look for is a line carrying one of THOSE labels, whatever
// decoration surrounds it. Widening the regex to accept `**N. LABEL**` because
// three responses used that form would be one pattern per incident; deriving the
// labels from the template covers the form nobody has emitted yet, and follows
// the prompt if the prompt is rewritten.
export const DEPLOYED_LABELS = ['WINNER', 'WHY', 'GAP', 'INSPECTED']

// Read the numbered items out of a prompt. A pin covers what someone thought to
// enumerate; test/winner-parse.test.mjs crosses DEPLOYED_LABELS against this on
// every run, so the fallback cannot go stale in silence.
export function templateLabels(prompt) {
  const out = []
  for (const line of String(prompt).split('\n')) {
    const m = /^\s*(\d+)\.\s+([A-Z][A-Z ]{1,})\b/.exec(line)
    if (m) { const l = m[2].trim(); if (l.length >= 2 && !out.includes(l)) out.push(l) }
  }
  return out
}

// Decoration a critic may wrap a label in. NOT part of the answer either way:
// stripped from the front, and what remains has to START with the label, which
// is what keeps the word "winner" inside a sentence from being an item.
const DECOR = /^[\s#*_>`\-–—]+/

function sectionLabelAt(line, labels) {
  let t = String(line).replace(DECOR, '')
  t = t.replace(/^\(?\d+[.):]\s*/, '')   // an optional item number
  t = t.replace(/^[\s*_`]+/, '')         // and decoration between number and label
  for (const L of labels) {
    if (!t.startsWith(L)) continue
    const rest = t.slice(L.length)
    // A boundary is required so WINNERS, WHYEVER and GAPS are not items.
    if (rest === '' || /^[^A-Za-z]/.test(rest)) return { label: L, rest }
  }
  return null
}

// THE ANSWER IS THE VALUE THAT FOLLOWS THE LABEL. The template reads
// `1. WINNER — A or B`, so within the item the first answer token is the answer;
// everything after it is the critic continuing to talk. Scanning the whole item
// for `neither` instead reads
//
//     **1. WINNER — A** (b/subject.md, 63 lines). Narrow win. Neither meets goal.
//
// (unbackticked deliberately: that path is inside a trial tree that no longer
// exists, and drift-guard is right that a backticked path here would be a
// citation a reader could follow to nothing.)
//
// as a refusal to pick, when it is a pick for A followed by a remark that neither
// artifact is good enough. Those are different observations and merging them is
// how a control set stops controlling: a critic that picks a side while saying
// the pick carries no signal is recorded by `declaredNoDifference`, which is a
// separate field for exactly this reason.
function answerIn(t) {
  const pats = [
    ['neither', /(^|[^A-Za-z])(neither|none|no winner|not a winner|tie)([^A-Za-z]|$)/i],
    ['A', /(^|[^A-Za-z])A([^A-Za-z]|$)/],
    ['B', /(^|[^A-Za-z])B([^A-Za-z]|$)/],
  ]
  let best = null, bestIdx = Infinity
  for (const [val, re] of pats) {
    const m = re.exec(t)
    if (!m) continue
    const idx = m.index + (m[1] ? m[1].length : 0)
    if (idx < bestIdx) { bestIdx = idx; best = val }
  }
  return best
}

// WHAT THIS HAS BEEN WRONG ABOUT BEFORE, kept because the next version will be
// graded against it:
//
//   1. It matched `winner` followed anywhere on the line by a standalone `A`, and
//      read "winner. Not tie-from-laziness — tie from measurement…" as a pick for
//      A on a control the critic had correctly called identical.
//   2. It read only the heading line, and the critic does not always put the
//      answer there: "## 1. WINNER", a blank line, then "**A** — but by declared
//      coin-flip, not by merit" parsed as nothing.
//   3. It required a `#` heading and dropped three responses that answered in the
//      prompt's own numbered form (#53).
//   4. It scanned the whole block for `neither`, so a pick followed by "Neither
//      meets goal" was recorded as a refusal to pick.
//
// Anything it cannot read is left null for a human rather than guessed at, and
// the drop rate is reported by the test rather than left to be discovered.
export function parseWinner(text, labels = DEPLOYED_LABELS) {
  const lines = String(text).split('\n')
  const first = labels[0]
  let start = -1, head = ''
  for (let i = 0; i < lines.length; i++) {
    const s = sectionLabelAt(lines[i], labels)
    if (s && s.label === first) { start = i; head = s.rest; break }
  }
  if (start === -1) return null
  const block = [head]
  for (let i = start + 1; i < lines.length; i++) {
    if (sectionLabelAt(lines[i], labels)) break
    block.push(lines[i])
  }
  return answerIn(block.join('\n'))
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

// WHERE TWO STRINGS DIVERGE — the span left once the common prefix and the
// common suffix are removed. One copy, because three things now want it: the
// needle (below), the defect's MAGNITUDE, and the class recomputation. Two of
// those were written after the needle, and a second hand-rolled copy of a
// prefix/suffix walk is the shape this module's own header records as the way
// the scoring rule came to exist three times.
export function divergence(a, b) {
  a = String(a); b = String(b)
  let p = 0
  while (p < a.length && p < b.length && a[p] === b[p]) p++
  let s = 0
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++
  return { p, s, out: a.slice(p, a.length - s), in: b.slice(p, b.length - s) }
}

function distinctiveNeedle(mine, theirs) {
  const a = norm(mine), b = norm(theirs)
  if (!a || a === b) return null
  const d = divergence(a, b)
  const lo = d.p, hi = a.length - d.s
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

// ---------------------------------------------------------------------------
// HOW BIG THE PLANTED DEFECT IS, and WHICH CLASS THE BYTES SAY IT IS.
//
// #29 asked three questions of this instrument. Two were built into the set —
// crossed sides, undegraded controls, three defect classes — and the third was
// not: "a high rate on large removals and a low one on small edits would tell us
// what size of defect this instrument can see, which is the number an operator
// actually needs." Nothing computed a size, so the verdict reported per-CLASS
// rates and left every size reading to the reader's guess about what a class
// implies.
//
// Both quantities below are DERIVED from the sealed note's own bytes. That is
// the point rather than a convenience: `defect_class` is stored twice — on the
// ledger row and in the note — and two stored copies of a derivable fact agree
// with each other by construction. A ledger with one trial relabelled in both
// places passed every gate in this repository, per-class table and all.
// ---------------------------------------------------------------------------

import { FLIPS } from './defect-transforms.mjs'

// The size of the damage, in bytes, measured where the two texts actually
// differ. NOT the length of the changed line: a digit swapped at column 80 of a
// 90-character line is a two-byte defect, and calling it 90 would make every
// single-line edit look like the same size as every other. Un-normalised on
// purpose — norm() folds case and strips markdown, and a defect that is only a
// case change is still a defect the critic either saw or did not.
export function defectMagnitude(note) {
  if (!note || note.degraded_side === 'none') return null
  const d = divergence(String(note.removed ?? ''), String(note.inserted ?? ''))
  const mag = d.out.length + d.in.length
  return mag > 0 ? mag : null
}

// WHAT THE BYTES SAY THE CLASS IS. Each transform leaves a signature in what it
// removed and inserted, and the signature is checked against the note rather
// than against the label beside it:
//
//   section-removal       nothing inserted, and what left was a whole `## `
//                         section of four lines or more
//   factual-substitution  one line, and the two sides differ only in digits
//   inverted-constraint   one line, and one FLIPS pair rewrites the removed
//                         line into exactly the inserted one
//
// FLIPS is imported rather than restated. A private copy of the flip table here
// would be a second place for the next correction to miss, which is the defect
// this module's header already records at three copies.
//
// AMBIGUITY RETURNS NULL, and null is not a failure — it is this function
// declining to guess, the same way artifactSides() refuses a mapping it cannot
// read. A caller that treats null as "wrong class" would turn a transform nobody
// has written yet into a test failure.
export function classifyNote(note) {
  if (!note || note.degraded_side === 'none') return null
  const removed = String(note.removed ?? ''), inserted = String(note.inserted ?? '')
  if (!removed && !inserted) return null
  const hits = []

  if (inserted === '' && removed.split('\n').length >= 4 && /^## +\S/.test(removed.split('\n')[0])) {
    hits.push('section-removal')
  }
  if (!removed.includes('\n') && !inserted.includes('\n') && removed && inserted) {
    const d = divergence(removed, inserted)
    if (d.out && d.in && /^\d+$/.test(d.out) && /^\d+$/.test(d.in)) hits.push('factual-substitution')
    for (const [from, to] of FLIPS) {
      if (removed.includes(from) && removed.replace(from, to) === inserted) { hits.push('inverted-constraint'); break }
    }
  }
  // Two signatures matching is as unreadable as none. Returning the first would
  // be picking, and picking is what this function exists to stop.
  return hits.length === 1 ? hits[0] : null
}

// ---------------------------------------------------------------------------
// THE SIZE CUT — #29's third question, and the one the set was not built for.
//
// The issue asked for three things. Crossed sides and undegraded controls were
// built in; three defect classes were built in; "what size of defect this
// instrument can see" was not, and the verdict reported per-CLASS rates in its
// place. Those are not the same cut, and on the ledger as drawn they are not
// even separable: every section-removal is a four-figure magnitude and every
// single-line edit is a single-digit one, with nothing in between, so "big
// defects are easy" and "removal-shaped defects are easy" predict the identical
// table.
//
// So the cut is computed WITH the confound rather than instead of it: the same
// statistic is reported over all trials and again with the removals dropped,
// and the second one is the one that is about size at all.
//
// THE THRESHOLD IS READ OFF THE MISSES, which makes the p-value post-hoc and
// NOT a test. It is the probability that every miss would land at or below the
// largest missed magnitude if detection were assigned at random — reported so
// that a suggestive separation cannot be quoted as an established one. A
// pre-registered threshold would need a set drawn to pin it, which is what the
// residual below asks for.
export function sizeCut(trials) {
  const t = trials.filter(x => Number.isFinite(x.mag) && typeof x.detected === 'boolean')
  const n = t.length
  const misses = t.filter(x => !x.detected)
  const out = {
    n, detected: t.filter(x => x.detected).length, misses: misses.length,
    magnitudes: [...new Set(t.map(x => x.mag))].sort((a, b) => a - b),
    maxMissMag: null, below: null, above: null, p: null,
  }
  if (!n || !misses.length || misses.length === n) return out
  const thr = Math.max(...misses.map(x => x.mag))
  const lo = t.filter(x => x.mag <= thr), hi = t.filter(x => x.mag > thr)
  out.maxMissMag = thr
  out.below = { n: lo.length, detected: lo.filter(x => x.detected).length }
  out.above = { n: hi.length, detected: hi.filter(x => x.detected).length }
  // C(k,m)/C(n,m), computed as a product so nothing overflows and nothing needs
  // a factorial table.
  const k = lo.length, m = misses.length
  let p = 1
  for (let i = 0; i < m; i++) p *= (k - i) / (n - i)
  out.p = p
  return out
}

// Which classes carry more than one distinct magnitude. WITHOUT this there is no
// size contrast anywhere that is not also a class contrast, and no size question
// can be asked of the set at all — the same argument the per-class floor already
// makes one level down ("a rate averaged over one kind of damage is a rate about
// that kind").
export function magnitudeSpread(trials) {
  const by = new Map()
  for (const x of trials) {
    if (!Number.isFinite(x.mag)) continue
    if (!by.has(x.cls)) by.set(x.cls, new Set())
    by.get(x.cls).add(x.mag)
  }
  return [...by.entries()].map(([cls, mags]) => ({ cls, distinct: mags.size, min: Math.min(...mags), max: Math.max(...mags) }))
}

// THE CLASS AUDIT, as one function rather than as three assertions inside a
// loop. The scoring rule in this module was written three times and all three
// copies carried the same defect; a comparison spread across a test file is the
// same shape starting over. Here it can also be handed constructed rows, which
// is the only way to watch it fail.
//
// Returns the recomputed class (null when the bytes match no signature) and the
// disagreements found, in the subject's own terms.
export function classAudit(row, note) {
  if (!note || note.degraded_side === 'none') return { cls: null, applies: false, disagreements: [] }
  const cls = classifyNote(note)
  const d = []
  if (cls !== null && cls !== note.defect_class) {
    d.push(`the sealed note says defect_class=${JSON.stringify(note.defect_class)}, its own removed/inserted bytes are a ${cls}`)
  }
  if (cls !== null && cls !== row.defect_class) {
    d.push(`the ledger row says defect_class=${JSON.stringify(row.defect_class)}, the sealed bytes are a ${cls} — the per-class rates in the verdict are computed from that field`)
  }
  if (row.defect_class !== note.defect_class) {
    d.push(`row says ${JSON.stringify(row.defect_class)}, sealed note says ${JSON.stringify(note.defect_class)} — the two stored copies disagree, and they agree with each other by construction whenever both are edited`)
  }
  return { cls, applies: true, disagreements: d }
}
