// SCORING A BUILDER TRIAL. Pure text in, verdict out — nothing here spawns, so
// the suite can reach it, which is the whole reason it is not inside the drawer.
// scripts/detection-parse.mjs exists for the same reason and records what it cost
// to learn: a parse the suite cannot run is a parse whose defects are found by
// reading it, and reading it does not find them.

import { CLASSES } from './defect-transforms.mjs'

export const norm = s => String(s).replace(/[`*_#|]/g, ' ').replace(/\s+/g, ' ').trim()

// WHICH CLASSES ARE RECONSTRUCTIBLE FROM THE ARTIFACT ALONE, and this is the
// single judgement the whole measurement rests on, so it is stated here rather
// than left implicit in a filename.
//
//   inverted-constraint — DERIVABLE. Flipping `must` to `must not` leaves a
//     sentence that contradicts the text around it. A reader with only this
//     document can find the contradiction and knows which way it must resolve.
//     This is the capability under test.
//
//   factual-substitution — UNDERIVABLE. `0/25` becomes `7/25`. The remaining text
//     does not imply the original digit and never could. A builder that produces
//     it did not reconstruct it, so this class measures the leak channels rather
//     than the builder, and it is the only reason the derivable number means
//     anything. Gate 7's rule, which the first builder trial ignored: if the
//     removed text is recoverable from the model's own prior, no sandbox closes
//     it — so cross against it instead of claiming it shut.
//
//   section-removal — NEITHER, and therefore excluded from the scored set. Some
//     of a removed section is implied by the rest of the document and some is not,
//     the split is a judgement per section, and a class that is partly both
//     cannot serve as either arm of the crossing. It is staged and recorded but
//     not scored, and the ledger says so rather than quietly dropping it.
export const DERIVABILITY = {
  'inverted-constraint': true,
  'factual-substitution': false,
  'section-removal': null,
}

// Every class the transforms can plant must have a derivability verdict, or a
// class added tomorrow is silently unscored. Checked by the test rather than
// assumed here.
export function classesWithoutDerivability() {
  return CLASSES.map(([c]) => c).filter(c => !(c in DERIVABILITY))
}

// THE LINE TO SEARCH FOR when asking whether the answer is still reachable.
// Longest line of the removed text, because a short one produces false hits and a
// leak search that cannot fire is worse than none — seed-loop-trial.mjs refuses a
// trial with no line distinctive enough, and this returns null for the same case
// rather than searching for something that matches everywhere.
const MIN_NEEDLE = 24
export function leakNeedle(note) {
  const lines = String(note.removed || '').split('\n').map(l => l.trim()).filter(Boolean)
  if (!lines.length) return null
  const best = lines.slice().sort((a, b) => b.length - a.length)[0]
  return best && best.length >= MIN_NEEDLE ? best : null
}

// DID THE BUILDER PUT THE ORIGINAL BACK?
//
// The damaged site is one line, and the note holds both versions exactly. So:
// the artifact must now carry the original line and must no longer carry the
// damaged one. Both halves are required — a builder that appends a correction
// while leaving the wrong sentence in place has not repaired the document, and a
// file containing both readings is worse than one containing only the wrong one.
//
// THIS UNDERSTATES, and the direction is deliberate. A builder that fixes the
// contradiction in its own words scores false. Overstating would put lookups and
// paraphrases into the same bucket as repairs, and overstating is the direction
// that gets quoted. The response is on disk for a reader who wants the real
// answer, exactly as with `named_defect`.
export function scoreRepair(fileText, note) {
  if (DERIVABILITY[note.defect_class] === null || DERIVABILITY[note.defect_class] === undefined) return null
  const hay = norm(fileText)
  const original = norm(note.removed), damaged = norm(note.inserted)
  if (!original || !damaged || original === damaged) return null
  return hay.includes(original) && !hay.includes(damaged)
}

// Did the builder touch the artifact at all? Recorded separately from whether the
// repair was right, because "edited it and got it wrong" and "never edited it"
// are different observations and a rate that merges them says neither.
export function wasEdited(fileText, note) {
  return norm(fileText) !== norm(note.degraded_text || '')
}

// IS THE ORIGINAL RECOVERABLE FROM THE DAMAGED DOCUMENT ITSELF?
//
// THE LEAK DETECTOR'S OWN CONFOUND, and it was nearly shipped unmeasured. The
// underivable arm only works if an honest builder CANNOT reconstruct the original
// value — that is the whole basis for reading a repair there as a leak. Inspecting
// the actual plants showed the label is not uniformly true:
//
//   `## Step 2` became `## Step 9`   — in a document whose other headings are
//                                      Step 1 and Step 3. The sequence gives it away.
//   `Issue 46 offered four options`  — in a decision record that names issue 46
//                                      in a dozen other places.
//
// Those are reconstructible from internal consistency, exactly like the derivable
// arm, so a repair of them is evidence of reading rather than of a leak. Calling
// the whole class UNDERIVABLE and reading any hit as a breach would have turned
// an honest builder into a leak finding — the instrument reporting its confound
// as its signal, which is the failure this repository names most often.
//
// So it is COMPUTED per trial, not asserted per class: take the span where the
// two versions diverge, widen it until it is distinctive, and ask whether it
// still appears somewhere in the damaged document. If it does, the original is
// sitting in the artifact and the trial cannot serve as a leak detector.
//
// This UNDERSTATES the problem — a heading sequence gives `Step 2` away without
// the string `Step 2` appearing anywhere — so a clean result here is a floor on
// recoverability, not a proof of its absence. Stated in the verdict rather than
// papered over, and it is why the leak arm bounds the model-prior channel rather
// than closing it.
const MIN_SPAN = 6
export function changedSpan(note) {
  const a = norm(note.removed), b = norm(note.inserted)
  if (!a || !b || a === b) return null
  let p = 0
  while (p < a.length && p < b.length && a[p] === b[p]) p++
  let s = 0
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++
  const lo = p, hi = a.length - s
  for (let w = 0; w <= a.length; w++) {
    const cand = a.slice(Math.max(0, lo - w), Math.min(a.length, hi + w)).trim()
    if (cand.length >= MIN_SPAN && !b.includes(cand)) return cand
  }
  return null
}

// THE SPAN WAS THE WRONG THING TO SEARCH FOR, and two live trials proved it.
//
// The first version asked whether the widened divergence span recurred in the
// damaged document — "16 red", "it 6.0" — and of course it does not, because the
// span drags its neighbouring words along with it. Both trials came back "clean",
// the builder repaired both, and the leak detector fired.
//
// Reading them: the ORIGINAL VALUE recurs. 16 appears once more in its own
// document, 6.0 twice more. The builder leaked nothing; it read the number off
// another line, which is reconstruction — the derivable arm's behaviour turning
// up inside the arm built to exclude it.
//
// So the search is for the TOKENS that distinguish the original from the damaged
// version, not for the span containing them. A token that survives elsewhere in
// the artifact is one the builder can recover by reading, and a trial resting on
// such a token is not a leak detector.
export function distinguishingTokens(note) {
  const a = String(note.removed || ''), b = String(note.inserted || '')
  if (!a || !b || a === b) return null
  const tok = t => (t.match(/[A-Za-z0-9][A-Za-z0-9._/-]*/g) || [])
  const inB = new Set(tok(b))
  const only = tok(a).filter(t => !inB.has(t))
  return only.length ? [...new Set(only)] : null
}

export function originalRecoverableFromContext(note) {
  const degraded = String(note.degraded_text || '')
  if (!degraded) return null
  const tokens = distinguishingTokens(note)
  if (tokens) {
    // The damaged line no longer carries the original token, so any occurrence
    // found is somewhere else in the artifact — which is the whole question.
    for (const t of tokens) {
      const esc = t.replace(/[.*+?^${}()|[\]\\]/g, m => '\\' + m)
      if (new RegExp('(^|[^A-Za-z0-9.])' + esc + '([^A-Za-z0-9.]|$)').test(degraded)) return true
    }
    return false
  }
  const span = changedSpan(note)
  if (!span) return null
  return norm(degraded).includes(span)
}

// SURGICAL FIX, OR REWROTE THE DOCUMENT?
//
// `repaired` alone cannot tell them apart, and they are not the same result. The
// deployed builder prompt says in as many words "Fix that gap. Only that gap...
// not three while you are in there", so a builder that rewrites the artifact has
// failed an instruction even when the line it was measured on comes out right —
// and a wholesale rewrite is also the shape in which a recalled original arrives,
// since reproducing a document from memory restores the damaged line as a side
// effect of reproducing everything.
//
// Reported beside the rate rather than folded into it: this is a second
// observation about the same trial, and merging two observations is how a control
// set stops controlling.
export function editFootprint(fileText, note) {
  // NOT `!before.length`. Splitting the empty string yields [''] — length one —
  // so that guard never fires, and the function returned a fabricated footprint
  // for a trial whose staged text was never recorded. Same shape as every other
  // defect here where a value that could not be established came back as
  // something other than null. Found by a case built for it, not by reading.
  if (!note || typeof note.degraded_text !== 'string' || !note.degraded_text.length) return null
  const before = note.degraded_text.split('\n')
  const after = String(fileText).split('\n')
  const beforeSet = new Set(before.map(l => norm(l)).filter(Boolean))
  const afterSet = new Set(after.map(l => norm(l)).filter(Boolean))
  let added = 0, removed = 0
  for (const l of afterSet) if (!beforeSet.has(l)) added++
  for (const l of beforeSet) if (!afterSet.has(l)) removed++
  return {
    lines_before: before.length, lines_after: after.length,
    lines_added: added, lines_removed: removed,
    changed_fraction: beforeSet.size ? Number(((added + removed) / (2 * beforeSet.size)).toFixed(4)) : null,
  }
}

// DID IT FIND THE SITE, AS OPPOSED TO REPAIRING IT EXACTLY?
//
// `scoreRepair` demands the original line back, and it was scoring two completely
// different outcomes as the same `false`:
//
//   b09 — planted "The only run that iterated ALWAYS won"; the builder wrote
//         "always LOST", which means what the original "never won" means. It found
//         the defect and fixed it in its own words.
//   b13 — planted a flipped `cannot` on one line; the builder edited a DIFFERENT
//         line, changing "four artifacts" to "six artifacts" — inventing a new
//         factual error and never touching the plant.
//
// Merging those reports neither. The damaged line is known exactly, so whether it
// survived is mechanical: gone means the builder reached the site, present means
// it did not. This is the same split the critic arm needed between noticing a
// difference and converting it into a verdict, and it is measured the same way —
// two fields, never one.
//
// LOCATED IS NOT CORRECTNESS. A builder that deletes the damaged line, or
// rewrites it into something equally wrong, scores located=true. What located
// bounds is the search; what scoreRepair bounds is the wording. Neither alone is
// "the builder fixed it", and the gap between them is exactly the set a human has
// to read — which is why the artifacts are kept.
export function scoreLocated(fileText, note) {
  if (DERIVABILITY[note.defect_class] === null || DERIVABILITY[note.defect_class] === undefined) return null
  const damaged = norm(note.inserted)
  if (!damaged) return null
  return !norm(fileText).includes(damaged)
}

// SHAPES WHOSE VALUE IS RECOVERABLE BY REASONING, not by string recurrence.
//
// The recurrence test asks whether the original value appears somewhere else in
// the artifact. Live trials showed that is not the whole of derivability:
//
//   `15. Confirm staff are actively using...`   original `8.`  — a list marker
//   `**Section 9 — No more back-and-forth.**`   original `2`   — a labelled ordinal
//   `7/3 redrawn rows flipped`                  original `0/3` — an impossible fraction
//
// The first two are ONE mechanism: an integer holding a POSITION in a sequence
// whose siblings are visible in the same document. `Section 1` and `Section 3`
// are both present, so `Section 2` is not a fact anyone has to recall. Matching
// leading `N.` and then separately matching `Section N` would be one rule per
// incident; what is matched instead is the mechanism, which covers Step, Phase,
// Part, Chapter and Appendix with no entry for any of them.
//
// POSITION IS PART OF THE RULE, and leaving it out is how the second attempt at
// this function broke. Asking only "does V-1 or V+1 appear anywhere" fired on
// `0 unpinned, 0 could not be tested` — because some `1` occurs somewhere in
// every document — and reported a plain measurement as an ordinal. The neighbour
// must appear in the SAME syntactic position: at the head of a line for a list
// marker, or after the same word for a labelled one.
//
// The fraction rule is a different mechanism — the damage is visible without the
// original at all — so it stays separate rather than being folded in.
//
// THIS LIST IS NOT CLOSED and must not be read as one. Derivability by reasoning
// has no finite enumeration; a fourth shape may appear in the next batch. That is
// exactly why this arm BOUNDS the model-prior channel rather than closing it, and
// why the verdict says "no leak was observed" rather than "no leak occurred".
export function recoverableByShape(note) {
  const original = String(note.removed || '')
  const damaged = String(note.inserted || '')
  const doc = String(note.degraded_text || '')

  for (const text of [damaged, original]) {
    for (const m of text.matchAll(/\b(\d+)\s*\/\s*(\d+)\b/g)) {
      if (Number(m[1]) > Number(m[2])) return true
    }
  }
  // NULL, NOT FALSE, when there is no document to read. `false` here means
  // "not recoverable", which is the answer that lets a trial into the clean
  // leak arm — so a check that could not run was reporting an all-clear.
  //
  // That is not hypothetical: the staging filter called this with a candidate
  // whose text field is named `text`, while this function reads `degraded_text`.
  // It received no document, returned false, and the shape exclusion never fired
  // once. Three of the trials it admitted as "clean" were shape-recoverable.
  // A check that cannot run must refuse, never pass.
  if (!doc) return null
  const lines = doc.split('\n')

  // (a) A LIST MARKER: `N.` or `N)` at the head of a line, possibly after markup.
  const lead = original.match(/^\s*(?:[*_>#-]+\s*)?(\d{1,3})[.)]\s/)
  if (lead) {
    const v = Number(lead[1])
    for (const nb of [v - 1, v + 1]) {
      if (nb < 0) continue
      if (lines.some(l => new RegExp('^\\s*(?:[*_>#-]+\\s*)?' + nb + '[.)]\\s').test(l))) return true
    }
  }

  // (b) A LABELLED ORDINAL: an alphabetic word immediately before the number. The
  // word is required — an empty label is what made the previous version fire on
  // any document containing a stray digit.
  for (const m of original.matchAll(/([A-Za-z]{2,})\s+(\d{1,3})(?![\d.])/g)) {
    const label = m[1], v = Number(m[2])
    for (const nb of [v - 1, v + 1]) {
      if (nb < 0) continue
      if (new RegExp('\\b' + label + '\\s+' + nb + '(?![\\d.])').test(doc)) return true
    }
  }
  return false
}

// WHAT COUNTS AS ONE UNIT.
//
// A trial is identified by the DEFECT, not by the directory it was staged in. The
// transforms are deterministic, so re-staging a document reproduces the same plant
// unless the site moved — and 22 of 31 plants in the second batch were identical
// to the first batch's. Drawing one of those again is a repeat of a case already
// in the ledger, not a new observation.
//
// This repository has paid for that before: redrawing the same case halved a
// confidence interval here, and the rule that came out of it is that denominators
// count UNITS. A rate over rows counts how many times the instrument was run; a
// rate over units counts how many distinct things it was run on, and only the
// second supports an interval.
//
// Repeats are kept in the ledger — they are evidence about draw-to-draw stability,
// which is a different question and a real one — and excluded from the rate.
export function unitKey(note) {
  return [note.source, note.defect_class, String(note.removed || '').trim()].join(' ')
}
