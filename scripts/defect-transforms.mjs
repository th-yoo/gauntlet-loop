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
