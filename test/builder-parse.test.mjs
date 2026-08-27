// The scorer for builder trials, and whether each of its checks can fail.
//
//   node test/builder-parse.test.mjs
//
// Split from test/builder-rate.test.mjs the way detection-parse is split from
// detection-rate: that file asks whether the SET can carry a rate, this one asks
// whether the function that produces each row can be wrong. Both are needed and
// neither substitutes — on 2026-08-27 a scoring rule with three copies was
// audited by one of its own copies and the audit agreed with the defect.
//
// NOTHING HERE SPAWNS.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { scoreRepair, wasEdited, leakNeedle, DERIVABILITY, classesWithoutDerivability, norm, editFootprint, originalRecoverableFromContext, changedSpan, scoreLocated, recoverableByShape, unitKey, distinguishingTokens } from '../scripts/builder-parse.mjs'
import { classAudit, verifyPlant } from '../scripts/defect-transforms.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }
const eq = (got, want, m) => ok(got === want, `${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)

// A real inverted-constraint plant: the transform flips `is not` to `is`.
const INV = {
  defect_class: 'inverted-constraint',
  removed: 'A stored answer key is not a check.',
  inserted: 'A stored answer key is a check.',
}
const SUB = {
  defect_class: 'factual-substitution',
  removed: 'It currently reads `0/25` on the live dashboard.',
  inserted: 'It currently reads `7/25` on the live dashboard.',
}

console.log('builder-parse: every class the transforms can plant has a derivability verdict')
{
  const missing = classesWithoutDerivability()
  ok(missing.length === 0,
     `defect class(es) ${missing.join(', ')} can be planted and have no entry in DERIVABILITY, so a trial of that class is scored by a rule nobody wrote. Add the verdict, or the class is silently unscored.`)
  console.log(`          ${Object.entries(DERIVABILITY).map(([k, v]) => `${k}=${v === null ? 'unscored' : v ? 'derivable' : 'UNDERIVABLE'}`).join(' · ')}`)
}

console.log('builder-parse: a repair requires the original back AND the damaged text gone')
{
  eq(scoreRepair('intro\nA stored answer key is not a check.\noutro', INV), true, 'the original line restored')
  eq(scoreRepair('intro\nA stored answer key is a check.\noutro', INV), false, 'the damaged line untouched')
  // THE CASE THAT MAKES BOTH HALVES NECESSARY. A builder that appends the
  // correction without removing the wrong sentence leaves a document asserting
  // both, which is not a repair.
  eq(scoreRepair('A stored answer key is a check.\n\nCorrection: A stored answer key is not a check.', INV), false,
     'both readings present at once is not a repair')
  eq(scoreRepair('the document was rewritten entirely and says nothing about answer keys', INV), false,
     'the damaged text gone but the original never restored')
}

console.log('builder-parse: markdown decoration does not decide a repair')
{
  eq(scoreRepair('A stored **answer key** is not a check.', INV), true, 'bolding inside the restored line')
  eq(scoreRepair('- A stored answer key is not   a check.', INV), true, 'a list marker and collapsed whitespace')
}

console.log('builder-parse: an unscorable class returns null rather than false')
{
  // NULL, NOT FALSE, and this is the defect this repository has had twice: a
  // value that could not be established recorded as the negative answer, which
  // pushes a rate down using trials that never spoke.
  eq(scoreRepair('anything', { defect_class: 'section-removal', removed: 'x', inserted: 'y' }), null,
     'section-removal is staged but not scored')
  eq(scoreRepair('anything', { defect_class: 'inverted-constraint', removed: 'same', inserted: 'same' }), null,
     'a note whose two versions are identical scores nothing')
  eq(scoreRepair('anything', { defect_class: 'inverted-constraint', removed: '', inserted: 'y' }), null,
     'a note with no original scores nothing')
}

console.log('builder-parse: the underivable class is the leak detector, and is marked as such')
{
  eq(DERIVABILITY['factual-substitution'], false,
     'factual-substitution must be UNDERIVABLE — nothing in the artifact implies which digit was there, so a repair of it is evidence of a leak rather than of reconstruction')
  eq(DERIVABILITY['inverted-constraint'], true,
     'inverted-constraint must be derivable — the flip contradicts the surrounding text, which is the capability under test')
  eq(scoreRepair('It currently reads `0/25` on the live dashboard.', SUB), true,
     'the leak detector still scores, because a hit is the observation it exists to make')
}

console.log('builder-parse: the leak needle is long enough to fire on the right thing')
{
  ok(leakNeedle({ removed: 'A stored answer key is not a check.' }), 'a real line yields a needle')
  eq(leakNeedle({ removed: 'ok' }), null, 'a short line yields none rather than a needle that matches everywhere')
  eq(leakNeedle({ removed: '' }), null, 'no removed text yields no needle')
  const n = leakNeedle({ removed: 'short\nA stored answer key is not a check, and never was.\ntiny' })
  eq(n, 'A stored answer key is not a check, and never was.', 'the longest line is chosen, not the first')
}

console.log('builder-parse: an untouched artifact is distinguishable from a wrong repair')
{
  const note = { ...INV, degraded_text: 'intro\nA stored answer key is a check.\noutro' }
  eq(wasEdited('intro\nA stored answer key is a check.\noutro', note), false, 'byte-identical to what it was handed')
  eq(wasEdited('intro\nA stored answer key is not a check.\noutro', note), true, 'changed')
}

console.log('builder-parse: a surgical fix is distinguishable from a rewrite')
{
  // The two are not the same result and `repaired` cannot separate them. A
  // wholesale rewrite is also the shape a RECALLED original arrives in, since
  // reproducing the document from memory restores the damaged line as a side
  // effect of reproducing everything.
  const base = { degraded_text: ['alpha', 'beta is a check.', 'gamma', 'delta', 'epsilon'].join('\n') }
  const surgical = editFootprint(['alpha', 'beta is not a check.', 'gamma', 'delta', 'epsilon'].join('\n'), base)
  const rewrite = editFootprint(['one', 'two', 'three', 'four', 'five'].join('\n'), base)
  const untouched = editFootprint(base.degraded_text, base)
  eq(untouched.changed_fraction, 0, "an untouched artifact has no footprint")
  ok(surgical.changed_fraction > 0 && surgical.changed_fraction <= 0.25,
     `a one-line fix should be a small footprint, got ${surgical.changed_fraction}`)
  ok(rewrite.changed_fraction >= 0.9,
     `a full rewrite should be a large footprint, got ${rewrite.changed_fraction}`)
  ok(rewrite.changed_fraction > surgical.changed_fraction * 3,
     "a rewrite and a one-line fix must not land at comparable footprints, or the measure separates nothing")
  eq(editFootprint("anything", {}), null, "no staged text yields no footprint rather than a fabricated one")
}

console.log('builder-parse: locating the site is separate from restoring the wording')
{
  // Built from the two real trials that forced this field to exist.
  const b09 = { defect_class: 'inverted-constraint',
    removed: 'The only run that iterated never won; the only run that', inserted: 'The only run that iterated always won; the only run that' }
  const fixedDifferently = 'The only run that iterated always lost; the only run that'
  eq(scoreLocated(fixedDifferently, b09), true, "a correct fix in different words still LOCATED the defect")
  eq(scoreRepair(fixedDifferently, b09), false, "and scoreRepair still calls it false, which is why one field cannot carry both")
  eq(scoreLocated(b09.inserted, b09), false, "the damaged line untouched means the site was never reached")
  eq(scoreLocated(b09.removed, b09), true, "an exact restoration located it too")
  eq(scoreLocated('x', { defect_class: 'section-removal', removed: 'a', inserted: 'b' }), null, 'an unscorable class locates nothing')
  eq(scoreLocated('x', { defect_class: 'inverted-constraint', removed: 'a', inserted: '' }), null, 'no damaged text means no judgement')
}

console.log('builder-parse: a value its own SHAPE gives away is not a leak detector')
{
  // Every case below is a live trial, or the false positive that a live trial
  // exposed. The leak arm is only meaningful for plants whose original really
  // cannot be recovered, and three of the six firings were recoverable by shape.
  const listDoc = ["7. Check the invoices", "8. Confirm staff are actively using the system", "9. Hand over the keys"].join("\n")
  eq(recoverableByShape({ removed: "8. Confirm staff are actively using the system",
                          inserted: "15. Confirm staff are actively using the system",
                          degraded_text: listDoc.replace("8. Confirm", "15. Confirm") }), true,
     "a list marker whose neighbours 7. and 9. are at the head of other lines")

  const secDoc = ["**Section 1 — Share one link.**", "**Section 9 — No more back-and-forth.**", "**Section 3 — Built for teams.**"].join("\n")
  eq(recoverableByShape({ removed: "**Section 2 — No more back-and-forth.**",
                          inserted: "**Section 9 — No more back-and-forth.**",
                          degraded_text: secDoc }), true,
     "a labelled ordinal whose siblings Section 1 and Section 3 are present")

  eq(recoverableByShape({ removed: "0/3 redrawn rows flipped", inserted: "7/3 redrawn rows flipped" }), true,
     "a numerator larger than its denominator announces the damage without the original")

  // THE FALSE POSITIVE THAT FORCED POSITION INTO THE RULE. Asking only whether
  // V-1 or V+1 appears ANYWHERE fired on this, because some "1" occurs in almost
  // any document — and it reported a plain measurement as an ordinal.
  const measDoc = ["first-failure short-circuit 13.0 min 117 properties — 0 unpinned, 0 could not be tested",
                   "the run took 1 attempt and 2 retries"].join("\n")
  eq(recoverableByShape({ removed: "first-failure short-circuit 6.0 min 117 properties — 0 unpinned, 0 could not be tested",
                          inserted: "first-failure short-circuit 13.0 min 117 properties — 0 unpinned, 0 could not be tested",
                          degraded_text: measDoc }), false,
     "a measurement is not an ordinal just because some neighbouring integer exists somewhere in the document")

  eq(recoverableByShape({ removed: "1 of 3 rows flipped", inserted: "2 of 3 rows flipped", degraded_text: "1 of 3 rows flipped" }), false,
     "a possible fraction is not self-announcing")
  // THE LABEL IS LOAD-BEARING, and without this case it can be deleted from the
  // neighbour search with every other test still passing. Here the neighbours 4
  // and 6 DO appear in the document — just not after the word "Widget" — so a
  // search that ignores the label calls a plain value an ordinal.
  eq(recoverableByShape({ removed: "Widget 5 is the default",
                          inserted: "Widget 9 is the default",
                          degraded_text: "Widget 9 is the default\nthere were 4 retries and 6 failures" }), false,
     "a neighbouring integer elsewhere in the document is not a sibling ordinal unless it sits under the same label")
  eq(recoverableByShape({ removed: "Widget 5 is the default",
                          inserted: "Widget 9 is the default",
                          degraded_text: "Widget 4 ships first\nWidget 9 is the default" }), true,
     "and it IS an ordinal when the neighbour does sit under that label")

  // NULL, NOT FALSE. `false` means "not recoverable", which is the answer that
  // admits a trial into the clean leak arm — so a check that could not run would
  // be reporting an all-clear. The staging filter called this with the wrong field
  // name, got no document, and the shape exclusion never fired once.
  eq(recoverableByShape({ removed: "8. Confirm staff", inserted: "15. Confirm staff", degraded_text: "" }), null,
     "with no document the check REFUSES rather than reporting the value unrecoverable")
  eq(recoverableByShape({ removed: "0/3 rows", inserted: "7/3 rows", degraded_text: "" }), true,
     "except where the damage is visible without any document at all")
}
console.log('builder-parse: a unit is the defect, not the directory it was staged in')
{
  const a = { source: "docs/README.md", defect_class: "inverted-constraint", removed: "x is not y" }
  const b = { source: "docs/README.md", defect_class: "inverted-constraint", removed: "x is not y" }
  const c = { source: "docs/README.md", defect_class: "inverted-constraint", removed: "p is not q" }
  ok(unitKey(a) === unitKey(b), "the same plant in the same document is one unit however it was staged")
  ok(unitKey(a) !== unitKey(c), "a different plant in the same document is a different unit")
  // TWO TRANSFORMS CAN DAMAGE THE SAME LINE — a sentence carrying both a flip
  // candidate and a number is eligible for either — so the class is part of the
  // identity. Without this case, dropping defect_class from the key changes
  // nothing and the mutation survives.
  const sameLineFlip = { source: "docs/README.md", defect_class: "inverted-constraint", removed: "no 3 rows must match" }
  const sameLineNum  = { source: "docs/README.md", defect_class: "factual-substitution", removed: "no 3 rows must match" }
  ok(unitKey(sameLineFlip) !== unitKey(sameLineNum),
     "the same line damaged by two different transforms is two units, not one")
}

console.log('builder-parse: the recurrence check falls back when no token distinguishes the versions')
{
  // THE FALLBACK PATH, which no other case reaches. When the two versions carry
  // the same tokens — a reordering, or punctuation — distinguishingTokens returns
  // null and the check must still answer from the changed span. Without a case
  // here, that whole branch can be replaced by `return false` and every test passes.
  const reordered = {
    removed: "the sweep is bounded and repeatable and cheap",
    inserted: "the sweep is repeatable and bounded and cheap",
    degraded_text: "intro line\nthe sweep is repeatable and bounded and cheap\ntail line",
  }
  eq(distinguishingTokens(reordered), null, "a reordering leaves no token unique to either version")
  eq(originalRecoverableFromContext(reordered), false,
     "and the fallback answers from the span rather than defaulting to clean")
  const echoed = {
    removed: "the sweep is bounded and repeatable and cheap",
    inserted: "the sweep is repeatable and bounded and cheap",
    degraded_text: "the sweep is bounded and repeatable and cheap\nrestated verbatim above",
  }
  eq(originalRecoverableFromContext(echoed), true,
     "and reports RECOVERABLE when the original span really is sitting in the document")
}

// --------------------------------------------------------------------------
// EVERY DERIVED FIELD IN THE BUILDER LEDGER IS RE-DERIVED HERE.
//
// COMMITTED FAILING, and the failure was BUILT rather than argued for. Two
// mutations of runs/builder.jsonl passed `node test/run-all.mjs` with exit 0:
//
//   1. `repaired` false -> true on one row. That moves the published figure from
//      8/12 to 9/12 — the number #25 was closed on.
//   2. `defect_class` relabelled in the row AND in the sealed note.
//
// Neither test on this arm read runs/builder-raw/ or runs/builder-sealed/ at
// all: the responses and the artifacts the builder actually edited were on disk
// and nothing compared the ledger against them. The detection arm got this two
// commits ago, for the identical reason, and CLAUDE.md's rule says what the
// guarded facts have in common — they had already failed. These had not.
//
// The anchors are the ones the ledger does not use: the artifact file the
// builder left behind, the sealed note's own bytes, and hashes recomputed from
// both. A stale ledger is a FAILURE here rather than a silent inconsistency —
// change a scorer and the trials on disk disagree until the ledger is rebuilt.
// --------------------------------------------------------------------------
console.log('builder-parse: the ledger on disk is what these scorers produce from the artifacts and the notes')
{
  const LEDGER = process.env.BUILDER_LEDGER || join(ROOT, 'runs', 'builder.jsonl')
  const SEALED = process.env.BUILDER_SEALED || join(ROOT, 'runs', 'builder-sealed')
  const sha = t => `sha256:${createHash('sha256').update(t).digest('hex')}`
  if (!existsSync(LEDGER) || !existsSync(SEALED)) {
    console.log('          no ledger on disk — nothing to re-derive (the trials are run by a separate script)')
    console.log('          NOT VERIFIED on this branch: every scored field in the builder ledger. With no')
    console.log('          ledger and no notes, the repair and leak figures rest on whoever wrote them.')
  } else {
    const rows = readFileSync(LEDGER, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l))
    let checked = 0, noArtifact = 0, classUnreadable = 0
    for (const row of rows) {
      const notePath = join(SEALED, `${row.opaque}.json`)
      if (!existsSync(notePath)) { noArtifact++; continue }
      const note = JSON.parse(readFileSync(notePath, 'utf8'))

      // THE CLASS, from the note's own bytes rather than from the label beside
      // them. Same function the detection ledger uses; the plants are the same
      // plants, and a second copy of the signatures here would be the duplication
      // this repository keeps paying for.
      const audit = classAudit(row, note)
      if (audit.applies) {
        if (audit.cls === null) classUnreadable++
        for (const d of audit.disagreements) fail(`${row.trial_id}: ${d}`)
        if (audit.cls !== null) {
          eq(row.derivable, DERIVABILITY[audit.cls],
             `${row.trial_id}: derivable is what the class implies, and the class is what the bytes say`)
        }
      }
      // The two stored copies of the source, which decide which document a
      // trial's unit key names.
      eq(row.source, note.source, `${row.trial_id}: the row and the sealed note name the same source document`)

      // THE DEGRADED TEXT the builder was handed. Its hash is recorded twice and
      // recomputes from the note's own copy of the text.
      if (typeof note.degraded_text === 'string' && note.degraded_text.length) {
        eq(note.degraded_hash, sha(note.degraded_text), `${row.trial_id}: the sealed note's degraded_hash is the hash of the text beside it`)
        if (row.degraded_hash) eq(row.degraded_hash, note.degraded_hash, `${row.trial_id}: the row's degraded_hash matches the note's`)
      }

      const afterRel = row.artifact_after
      if (!afterRel || !existsSync(join(ROOT, afterRel))) { noArtifact++; continue }
      const after = readFileSync(join(ROOT, afterRel), 'utf8')

      // THE ARTIFACT THE BUILDER LEFT. Every scored field below is recomputed
      // from it, so a row cannot claim an outcome the file does not show.
      if (row.after_hash) eq(row.after_hash, sha(after), `${row.trial_id}: after_hash is the hash of the artifact on disk — a row whose recorded hash is not the file's is a row about a different file`)
      eq(row.repaired, scoreRepair(after, note), `${row.trial_id}: repaired, recomputed from the artifact the builder left`)
      eq(row.edited, wasEdited(after, note), `${row.trial_id}: edited, recomputed from the artifact the builder left`)
      eq(row.located, scoreLocated(after, note), `${row.trial_id}: located, recomputed from the artifact the builder left`)
      eq(row.recoverable_from_context, originalRecoverableFromContext(note), `${row.trial_id}: recoverable_from_context, recomputed from the sealed note`)
      eq(row.recoverable_by_shape, recoverableByShape(note), `${row.trial_id}: recoverable_by_shape, recomputed from the sealed note`)
      eq(row.unit_key, unitKey(note), `${row.trial_id}: unit_key, recomputed from the sealed note — the key a rate's denominator is counted over`)
      const fp = editFootprint(after, note)
      ok(JSON.stringify(row.footprint) === JSON.stringify(fp),
         `${row.trial_id}: footprint recorded ${JSON.stringify(row.footprint)}, the artifact yields ${JSON.stringify(fp)}`)
      checked++
    }
    console.log(`          ${checked} trial(s) re-derived from the artifact on disk and the sealed note`)
    ok(checked > 0, 'no builder trial could be re-derived — the ledger and the notes exist but nothing paired, so this check examined nothing')
    if (noArtifact) console.log(`          ${noArtifact} row(s) carry no artifact to re-derive from (void trials keep no edited file); their scored fields are null and their class is still crossed against the bytes`)
    if (classUnreadable) console.log(`          NOT VERIFIED: ${classUnreadable} note(s) match no transform signature — their class rests on the drawer alone`)
    console.log('          NOT RE-DERIVABLE from anything on disk: isolation_hits, void, why_void and')
    console.log('          spawn_status. Those are facts about a trial directory that no longer exists, so')
    console.log('          the leak arm rests on the drawer having recorded them honestly.')
  }
}


// --------------------------------------------------------------------------
// AND THE SEALED NOTES THEMSELVES ARE RE-RUN, because every field above is now
// anchored on them. A note whose `removed` and `inserted` were edited to agree
// with a ledger row is exactly as invisible as the two stored copies of
// `defect_class` were before this file crossed them — one level down.
//
// The instrument is run again on the live source document: every class at every
// site, until one produces the note's exact bytes. That also derives the class a
// THIRD time, from the transform that can actually make them.
//
// A source that has since changed cannot check anything, and is counted rather
// than failed — a document is allowed to be edited. What is not allowed is a
// note that the instrument could not have produced from a document it CAN still
// read.
// --------------------------------------------------------------------------
console.log('builder-parse: every sealed note is something the transforms can still produce from its source')
{
  const SEALED_DIR = process.env.BUILDER_SEALED || join(ROOT, 'runs', 'builder-sealed')
  const sha = t => `sha256:${createHash('sha256').update(t).digest('hex')}`
  if (!existsSync(SEALED_DIR)) {
    console.log('          no sealed notes on disk — the notes every field above rests on are UNVERIFIED here')
  } else {
    const counts = {}
    const bad = []
    for (const f of readdirSync(SEALED_DIR).filter(f => f.endsWith('.json'))) {
      const note = JSON.parse(readFileSync(join(SEALED_DIR, f), 'utf8'))
      const src = note.source ? join(ROOT, note.source) : null
      const text = src && existsSync(src) ? readFileSync(src, 'utf8') : null
      const v = verifyPlant(note, text, sha)
      counts[v.status] = (counts[v.status] || 0) + 1
      if (v.status === 'unreachable' || v.status === 'hash-mismatch' || v.status === 'class-mismatch') bad.push([note.trial_id, v, JSON.stringify(note.source)])
    }
    for (const [id, v, src] of bad) {
      fail(`${id}: the sealed note is ${v.status} — re-running every transform at every site of ${src} does not yield these bytes${v.cls ? ` (a ${v.cls} at site ${v.n} comes closest)` : ''}. Every scored field above is derived from this note.`)
    }
    console.log(`          ${Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(' · ')}`)
    ok((counts.reproduced || 0) > 0,
       'not one sealed note could be re-run against its source — every source has drifted or is missing, so the notes the whole ledger rests on are unverified and this check confirmed nothing')
    if (counts.drifted) console.log(`          NOT VERIFIABLE: ${counts.drifted} note(s) whose source document has changed since the trial. A note is not wrong for having an edited source, and it is not checked either.`)
  }
}


if (failures) {
  console.error(`\nbuilder-parse: ${failures} failure(s).`)
  process.exit(1)
}
console.log('\nbuilder-parse: OK — repair needs both halves, unscorable is null, the leak detector is marked.')
