// AN ADJUDICATION THAT EXCUSES NOTHING, and the three files that accepted one.
//
// Three instruments here use the same shape: the check enumerates something it
// cannot settle alone, and requires a recorded human reading with a REASON —
// capacity-check for a field that never varied, disclosure-audit for a
// disclosure no test drives, builder-rate for an underivable defect the builder
// repaired anyway. Each rejects a reason that is a shrug.
//
// None of the three checked the other direction. Appending a row that names a
// ledger, a disclosure key or a trial that exists NOWHERE left all three green:
//
//   {"ledger":"runs/no-such-ledger.jsonl","field":"invented_field", ...}   accepted
//   {"key":"NO_SUCH_DISCLOSURE_KEY", ...}                                 accepted
//   {"trial_id":"b99-nonexistent-trial", ...}                             accepted
//
// (The disclosure probe appeared to be caught at first. It was rejected for the
// LENGTH of its reason — the rubber-stamp floor firing on a short probe string —
// and with a full-length reason it passed like the others. A check that rejects
// for the wrong reason reads exactly like one that works, which is why the probe
// was rewritten rather than believed.)
//
// The cost is not hypothetical. These files ARE the accounting: "0 unexplained
// constants" and "7 adjudicated" are quoted as the state of the audit, and a row
// that matches nothing inflates how much looking has been done while excusing
// nothing at all. That is issue 54's shape — a record held for presence, never
// for truth — in the files whose whole job is the record.
//
// WHAT MAKES THIS CHECKABLE WITHOUT A REGISTRY: the consumer already looks each
// key up. So the lookup is what counts. Every key the run consults is marked, and
// whatever is left over at the end is an adjudication for something this run
// never found — reported with the row, so the remedy is to delete it or to fix
// the key. Nothing here enumerates what a valid key looks like; a new key shape
// is covered the day a consumer starts looking it up.

export function adjudicationLedger(text, keyOf) {
  const rows = new Map()
  const malformed = []
  for (const line of String(text ?? '').split('\n')) {
    if (!line.trim()) continue
    let a
    try { a = JSON.parse(line) } catch { malformed.push(line.trim().slice(0, 80)); continue }
    const k = keyOf(a)
    // A row whose key cannot be read is MALFORMED, not absent. Dropping it in
    // silence is how a typo'd field name becomes an adjudication nobody can find
    // and nobody is told about — the same disappearance the JSON.parse catch used
    // to perform on a truncated line.
    if (k === null || k === undefined || k === '') { malformed.push(JSON.stringify(a).slice(0, 80)); continue }
    rows.set(k, a)
  }
  const consulted = new Set()
  return {
    size: rows.size,
    malformed,
    get(key) { consulted.add(key); return rows.get(key) },
    has(key) { consulted.add(key); return rows.has(key) },
    values() { return [...rows.values()] },
    // Adjudications this run never looked up. NOT "invalid" — the subject may
    // have been renamed, may have started varying, or may have been deleted, and
    // all three mean the row now explains nothing.
    unspent() { return [...rows.entries()].filter(([k]) => !consulted.has(k)).map(([key, row]) => ({ key, row })) },
  }
}

// The same sentence in all three places, because the remedy is the same and a
// reader who has seen it once should recognise it.
export function unspentMessage(what, unspent, malformed = []) {
  const lines = []
  for (const u of unspent) {
    lines.push(`  UNSPENT ADJUDICATION  ${u.key} — nothing in this run consulted it. The ${what} it excuses was not found: it has been renamed, deleted, or it no longer holds. Delete the row or fix its key; a row that matches nothing counts as accounting that did not happen.`)
  }
  for (const m of malformed) {
    lines.push(`  UNREADABLE ADJUDICATION  ${m} — a row with no readable key excuses nothing and is invisible to every lookup.`)
  }
  return lines
}
