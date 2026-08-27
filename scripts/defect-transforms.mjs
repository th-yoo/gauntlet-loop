// THE DEFECT TRANSFORMS, in one place because two instruments plant the same
// defects and a derivation with two copies is a derivation with two places for
// the next correction to miss. That is not a guess about what would go wrong: on
// 2026-08-27 the rule deciding whether a critic detected a defect existed in
// three files, all three carried the same defect, and the copy written to audit
// the other two agreed with them.
//
// scripts/detection-draw.mjs plants these to ask whether a CRITIC notices.
// scripts/builder-draw.mjs plants them to ask whether a BUILDER can repair one
// it cannot look up. Same plants, opposite questions, one definition.
//
// NOTHING HERE SPAWNS. Pure text in, damaged text plus an exact sealed record
// out — which is what lets both instruments be checked without running either.

// ---------------------------------------------------------------------------
// THE THREE TRANSFORMS. Each is deterministic given (text, n): the nth eligible
// site is damaged, so nothing here encodes a judgement about which damage is
// findable. Each returns the exact removed and inserted strings, which is what
// makes the sealed note checkable rather than descriptive.
// ---------------------------------------------------------------------------

export function sectionRemoval(text, n) {
  const lines = text.split('\n')
  const heads = lines.map((l, i) => (/^## +\S/.test(l) ? i : -1)).filter(i => i !== -1)
  if (heads.length < 2) return null
  const start = heads[n % (heads.length - 1)]
  const end = heads[(n % (heads.length - 1)) + 1]
  const removed = lines.slice(start, end).join('\n')
  if (removed.split('\n').length < 4) return null
  return {
    text: lines.slice(0, start).concat(lines.slice(end)).join('\n'),
    removed, inserted: '',
    where: `the section beginning "${lines[start].slice(0, 60)}"`,
  }
}

// A constraint flipped to its opposite. The document still reads as prose and
// still looks complete, which is the point: this is the class a reader most
// easily misses and the one a 22-line hole says nothing about.
export const FLIPS = [
  ['must not', 'must'], ['must', 'must not'],
  ['never', 'always'], ['always', 'never'],
  ['cannot', 'can'], ['is not', 'is'],
  ['no ', 'a '], ['without', 'with'],
]
export function invertedConstraint(text, n) {
  const lines = text.split('\n')
  const sites = []
  lines.forEach((l, i) => {
    if (l.trim().startsWith('//') || !l.trim()) return
    for (const [from, to] of FLIPS) if (l.includes(from)) { sites.push({ i, from, to }); break }
  })
  if (!sites.length) return null
  const s = sites[n % sites.length]
  const before = lines[s.i]
  const after = before.replace(s.from, s.to)
  if (after === before) return null
  const out = lines.slice()
  out[s.i] = after
  return { text: out.join('\n'), removed: before, inserted: after, where: `line ${s.i + 1}` }
}

// A number changed to another number. Nothing else moves, so a critic that
// detects this one is reading for correctness rather than for shape.
export function factualSubstitution(text, n) {
  const lines = text.split('\n')
  const sites = []
  lines.forEach((l, i) => { if (/\b\d{1,4}\b/.test(l) && !l.trim().startsWith('//')) sites.push(i) })
  if (!sites.length) return null
  const i = sites[n % sites.length]
  const before = lines[i]
  const after = before.replace(/\b(\d{1,4})\b/, (m, d) => String(Number(d) + 7))
  if (after === before) return null
  const out = lines.slice()
  out[i] = after
  return { text: out.join('\n'), removed: before, inserted: after, where: `line ${i + 1}` }
}

export const CLASSES = [
  ['section-removal', sectionRemoval],
  ['inverted-constraint', invertedConstraint],
  ['factual-substitution', factualSubstitution],
]

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

// ---------------------------------------------------------------------------
// WHAT SIZES THIS INSTRUMENT CAN PLANT AT ALL — the capacity question, asked of
// the transforms rather than of the draw.
//
// The residual under the size cut used to be a SENTENCE: "section removals are
// four-figure magnitudes and every other trial is a single-digit one, with
// nothing in between." True of the fifteen trials on disk, stored beside the
// artifact it was derivable from, and printed unconditionally — so it would have
// gone on being printed after a mid-sized transform was added, and nothing would
// have failed. That is issue 54's shape (a disclosure held for presence, never
// for truth) committed inside the fix for issue 29.
//
// So it is computed. Every transform is run at every eligible site of the real
// documents the trials were drawn from, and the magnitudes it can produce are
// read off the results. Add a transform tomorrow and this changes by itself.
//
// `limit` bounds the walk without being a picked number: the transforms index
// their sites modulo the site count, so after one line per site everything
// repeats, and a document cannot have more sites than it has lines.
export function achievableMagnitudes(text) {
  const limit = String(text).split('\n').length
  const out = new Map()
  for (const [name, fn] of CLASSES) {
    const seen = out.get(name) || new Set()
    for (let n = 0; n < limit; n++) {
      const r = fn(String(text), n)
      if (!r) break
      const m = defectMagnitude({ degraded_side: 'A', removed: r.removed, inserted: r.inserted })
      if (Number.isFinite(m)) seen.add(m)
    }
    if (seen.size) out.set(name, seen)
  }
  return out
}

// Merge what several documents can produce, and report which classes could ever
// be confused with which on size alone. Two classes whose achievable ranges
// OVERLAP can be told apart from size by some draw; two whose ranges are
// disjoint cannot, by any draw from these transforms.
export function magnitudeReach(perDoc) {
  const merged = new Map()
  for (const m of perDoc) for (const [k, s] of m) {
    if (!merged.has(k)) merged.set(k, new Set())
    for (const v of s) merged.get(k).add(v)
  }
  const ranges = [...merged.entries()]
    .map(([cls, s]) => ({ cls, min: Math.min(...s), max: Math.max(...s), distinct: s.size }))
    .sort((a, b) => a.min - b.min)
  const overlaps = []
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      if (ranges[i].max >= ranges[j].min && ranges[j].max >= ranges[i].min) overlaps.push([ranges[i].cls, ranges[j].cls])
    }
  }
  return { ranges, overlaps }
}
