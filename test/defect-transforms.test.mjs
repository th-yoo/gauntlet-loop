// THE SHARED PLANT DERIVATIONS, and whether each of them can fail.
//
//   node test/defect-transforms.test.mjs
//
// scripts/defect-transforms.mjs holds what both instruments need to know about a
// PLANT: the transforms themselves, how big the damage is, which class the bytes
// are, and whether a sealed note is something the transforms could still
// produce. Two ledgers are now re-derived from their notes — so the note is the
// anchor, and this file is what keeps the anchor from being a stored fact one
// level down.
//
// WHY A RE-RUN AND NOT A REVERSAL. Undoing the damage by hand needs a second
// copy of what each transform does to whitespace, and the first attempt at that
// got section removals wrong on all five trials on disk: the splice drops the
// newline BETWEEN the removed block and the line after it, so replacing the
// removed string with nothing leaves a blank line and every hash misses. That is
// the repository's own rule — prefer re-running to pinning — with a receipt.
//
// NOTHING HERE SPAWNS, and nothing here reads the tracked ledgers: every case is
// a document built in this file, so each verdict can be produced on demand.

import { createHash } from 'node:crypto'
import {
  sectionRemoval, invertedConstraint, factualSubstitution, CLASSES,
  defectMagnitude, classifyNote, reproducePlant, verifyPlant, achievableMagnitudes, magnitudeReach,
} from '../scripts/defect-transforms.mjs'

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }
const eq = (got, want, m) => ok(got === want, `${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
const sha = t => `sha256:${createHash('sha256').update(t).digest('hex')}`

// A document with a site for every transform: a `## ` section of four lines, a
// constraint to flip, and a number to move.
const DOC = [
  '# A document',
  '',
  '## What this is',
  '',
  'A fixture. It must not be treated as a real artifact.',
  'It has 12 lines of body text.',
  '',
  '## What this is not',
  '',
  'It is not the corpus, and never was.',
  '',
].join('\n')

const noteFor = (cls, fn, n = 0) => {
  const r = fn(DOC, n)
  if (!r) throw new Error(`the fixture has no site for ${cls}`)
  return {
    trial_id: `fixture-${cls}`, source: 'fixture.md', defect_class: cls, degraded_side: 'A',
    removed: r.removed, inserted: r.inserted,
    original_hash: sha(DOC), degraded_hash: sha(r.text),
  }
}

console.log('defect-transforms: the fixture carries a site for every class')
{
  const missing = CLASSES.filter(([, fn]) => !fn(DOC, 0)).map(([c]) => c)
  ok(missing.length === 0,
     `the fixture has no site for ${missing.join(', ')} — every case below would then be about the classes that happen to fit, which is a set chosen by what passes`)
}

console.log('defect-transforms: a note the instrument really produced is reproduced')
for (const [cls, fn] of CLASSES) {
  const note = noteFor(cls, fn)
  const v = verifyPlant(note, DOC, sha)
  eq(v.status, 'reproduced', `${cls}: a note built by running the transform is not reproduced by re-running it`)
  eq(v.cls, cls, `${cls}: reproduced by the wrong transform`)
}

console.log('defect-transforms: section removal survives the newline the splice takes with it')
{
  // PINNED SEPARATELY because a reversal-based check gets exactly this wrong and
  // gets the other two right — so a battery without this case reports three
  // greens and a broken check.
  const note = noteFor('section-removal', sectionRemoval)
  const naive = DOC.replace(note.removed, '')
  ok(sha(naive) !== note.degraded_hash,
     'the naive string reversal happens to reproduce this section removal, so this case no longer pins anything — pick a fixture where the splice and the replacement differ')
  eq(verifyPlant(note, DOC, sha).status, 'reproduced', 'a section removal is not reproduced by re-running the transform')
}

console.log('defect-transforms: a forged note cannot be reproduced')
{
  const note = noteFor('inverted-constraint', invertedConstraint)

  const edited = { ...note, removed: note.removed + ' and something nobody planted' }
  eq(verifyPlant(edited, DOC, sha).status, 'unreachable',
     'a note whose removed text no transform produces was accepted — then a note edited to agree with a ledger row passes, which is the two-stored-copies defect one level down')

  // BOTH HALVES OF THE PLANT, because matching on the removed text alone is the
  // loose comparison a re-run invites: the damage is what was PUT THERE as much
  // as what was taken away, and a note claiming a different replacement is a
  // note about a different trial.
  const swapped = { ...note, inserted: note.inserted + ' (not what was planted)' }
  eq(verifyPlant(swapped, DOC, sha).status, 'unreachable',
     'a note whose INSERTED text no transform produces was accepted — then only half the plant is being checked')

  const rehashed = { ...note, degraded_hash: sha('something else entirely') }
  eq(verifyPlant(rehashed, DOC, sha).status, 'hash-mismatch',
     'a note whose recorded degraded_hash is not the hash of what the transform yields was accepted')

  const relabelled = { ...note, defect_class: 'section-removal' }
  eq(verifyPlant(relabelled, DOC, sha).status, 'class-mismatch',
     'a note reproduced by one transform and labelled as another was accepted — this is the third independent reading of defect_class and it must disagree here')
}

console.log('defect-transforms: a changed source is unverifiable, not wrong')
{
  const note = noteFor('factual-substitution', factualSubstitution)
  const drifted = DOC.replace('A fixture.', 'A fixture, since edited.')
  eq(verifyPlant(note, drifted, sha).status, 'drifted',
     'a note whose source has changed was reported as broken. A document is allowed to be edited; what that costs is the check, not the note')
  eq(verifyPlant(note, null, sha).status, 'drifted', 'a missing source was treated as something other than unverifiable')
  eq(verifyPlant({ degraded_side: 'none' }, DOC, sha).status, 'control', 'an undegraded control was verified as a plant')
}

console.log('defect-transforms: the class the bytes say, and the size of the damage')
{
  for (const [cls, fn] of CLASSES) {
    const note = noteFor(cls, fn)
    eq(classifyNote(note), cls, `${cls}: the bytes do not classify as their own transform`)
    ok(defectMagnitude(note) > 0, `${cls}: a plant measured no size at all`)
  }
  const removal = noteFor('section-removal', sectionRemoval)
  const single = noteFor('factual-substitution', factualSubstitution)
  ok(defectMagnitude(removal) > defectMagnitude(single),
     `a removed section (${defectMagnitude(removal)}B) did not measure larger than a digit swap (${defectMagnitude(single)}B) — then the size is not a size`)
  // A site index that runs past the sites wraps rather than inventing one, so a
  // walk over n cannot produce a plant the document does not carry.
  const r0 = invertedConstraint(DOC, 0), rWrap = invertedConstraint(DOC, 1000)
  ok(r0 && rWrap && DOC.includes(r0.removed) && DOC.includes(rWrap.removed),
     'a transform asked for a site past the end returned text the document does not contain')
}

console.log('defect-transforms: what sizes the transforms can reach is read off the transforms')
{
  const reach = magnitudeReach([achievableMagnitudes(DOC)])
  ok(reach.ranges.length >= 2, `only ${reach.ranges.length} class(es) reach any size on the fixture`)
  const removal = reach.ranges.find(r => r.cls === 'section-removal')
  const sub = reach.ranges.find(r => r.cls === 'factual-substitution')
  ok(removal && sub && removal.min > sub.max,
     `on this fixture the removal range (${JSON.stringify(removal)}) does not sit above the substitution range (${JSON.stringify(sub)}) — the gap the detection residual reports is read from exactly this computation`)
  ok(!reach.overlaps.some(([a, b]) => a === 'section-removal' || b === 'section-removal'),
     'section-removal was reported as overlapping another class in size, which is the reading that would license calling a class effect a size effect')
}

console.log('defect-transforms: reproducePlant reports the site, not just a yes')
{
  const note = noteFor('inverted-constraint', invertedConstraint, 1)
  const r = reproducePlant(note, DOC)
  ok(r && Number.isInteger(r.n), 'the reproducing site index was not reported — a verdict with no site cannot be re-checked by hand')
  eq(reproducePlant({ removed: 'nothing like this is in the document', inserted: '' }, DOC), null,
     'reproducePlant returned a site for bytes the document cannot produce')
}

if (failures) {
  console.error(`\ndefect-transforms: ${failures} failure(s) — the sealed notes are the anchor every re-derived ledger field hangs from.`)
  process.exit(1)
}
console.log('\ndefect-transforms: OK — notes are re-run rather than reversed, forgery is unreachable, a changed source is unverifiable rather than wrong.')
