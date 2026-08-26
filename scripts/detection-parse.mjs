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

// DID IT NAME THE DEFECT, or merely land on the right side?
//
// Picking correctly is 50/50 luck on any single trial; quoting the planted text
// is not. This is the leak-check shape the deleted gate 7 used in reverse — there,
// finding the sealed strings in a critic's output proved it had reached the
// original; here it is evidence the critic actually located the damage.
//
// HEURISTIC, AND RECORDED AS ONE. It looks for a distinctive fragment of the
// changed line, or the removed section's heading. A critic that describes the
// defect in its own words without quoting scores false here, so this UNDERSTATES.
// It is a separate field, nothing gates on it, and the response is on disk for a
// reader who wants the real answer.
export function namedDefect(text, note) {
  if (note.degraded_side === 'none') return null
  const hay = String(text)
  const candidates = []
  if (note.defect_class === 'section-removal') {
    const head = String(note.removed).split('\n')[0].replace(/^#+\s*/, '').trim()
    if (head.length >= 8) candidates.push(head)
  } else {
    // The changed line, minus markup, in fragments long enough not to match by
    // chance. Both directions: the critic may quote what is there or what is not.
    for (const line of [note.removed, note.inserted]) {
      const t = String(line).replace(/[`*#|]/g, ' ').replace(/\s+/g, ' ').trim()
      if (t.length >= 24) candidates.push(t.slice(0, 60))
    }
  }
  if (!candidates.length) return null
  const norm = x => x.replace(/[`*#|]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  const h = norm(hay)
  return candidates.some(c => h.includes(norm(c)))
}

// A control where the critic said the sides are identical, or picked one while
// disclaiming that the pick carries no signal, is NOT a false alarm — it is the
// difference-seeking confound scoring zero. Recorded separately from the pick,
// because "picked A" and "picked A and said so meaninglessly" are different
// observations and merging them is how a control set stops controlling.
export function declaredNoDifference(text) {
  return /byte-identical|identical byte|no dimension separates|carries zero signal|coin-flip|coin flip|\bidentical\b/i.test(String(text))
}
