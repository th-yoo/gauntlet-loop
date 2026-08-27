// THE REPRODUCIBLE for the "named the defect" field: it can be satisfied by text
// that is present on BOTH sides.
//
//   node test/detection-parse.test.mjs
//
// COMMITTED FAILING.
//
// `named_defect` exists to separate a lucky pick from a located defect. Picking
// correctly is 50/50 on any single trial; quoting the planted text is not. The
// verdict for #29 leans on it — "1 of the 2 detections quoted the planted text"
// — so what it counts has to be text that only one side carries.
//
// It is not. The check builds its needle from the first 60 characters of the
// changed line, and a factual substitution deeper than character 60 leaves those
// 60 characters IDENTICAL on both sides:
//
//   removed : "  that is not recoverable here and is not claimed. It currently reads `0/25` on the live"
//   inserted: "  that is not recoverable here and is not claimed. It currently reads `7/25` on the live"
//
// Three of the fifteen degraded trials on disk have that shape. A critic that
// quotes the sentence and notices nothing scores the same as one that spotted
// `0/25` against `7/25`. That is this repository's most-named defect wearing a
// new hat: A CHECK WHOSE PASS CONDITION IS SATISFIED BY THE THING BEING BROKEN.
// The field understating was declared and accepted; overstating was not, and
// overstating is the direction that gets quoted.
//
// WHY THE PARSE IS ITS OWN MODULE. It used to live inside the spawner, and
// test/containment.test.mjs forbids anything the suite runs from NAMING a
// spawner — so the parse was unreachable from the suite, and every defect it has
// had (three now, all recorded in its own header) was found by reading it. This
// file exists so the next one is found by running it.
//
// NOTHING HERE SPAWNS. Pure text in, verdict out.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createHash } from 'node:crypto'
import { parseWinner, namedDefect, declaredNoDifference, defectNeedles, norm, scoreDetection, sizeCut, magnitudeSpread } from '../scripts/detection-parse.mjs'
import { classifyNote, defectMagnitude, classAudit, verifyPlant } from '../scripts/defect-transforms.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }

// The real shape, from runs/detection-sealed/66d74805a1fc.json (t09).
const SHARED = '  that is not recoverable here and is not claimed. It currently reads '
const SUB = {
  defect_class: 'factual-substitution',
  degraded_side: 'A',
  removed: `${SHARED}\`0/25\` on the live`,
  inserted: `${SHARED}\`7/25\` on the live`,
}

console.log('detection-parse: quoting text that is on BOTH sides is not naming the defect')
{
  // A critic that reproduces the sentence and says nothing about the number. Every
  // character of this is in the pristine copy AND in the degraded one.
  const blind = `## 1. WINNER\n\nA\n\nBoth documents state that ${SHARED}the value on the live dashboard. Nothing separates them.`
  ok(namedDefect(blind, SUB) === false,
     `namedDefect scored a response that quotes only text common to both sides. It cannot then be evidence the critic located the damage, and the verdict for #29 cites it as exactly that. The needle must be a fragment ONE side carries.`)
}

console.log('detection-parse: and it can still say yes — the check is able to pass')
{
  // Quoted WITH ITS CONTEXT, which is how the fifteen responses on disk quote:
  // the needle is the divergent span widened to MIN_NEEDLE characters, so a
  // response citing the bare number and nothing around it scores false. That is
  // the declared understatement, and it is the direction that is safe.
  const found = `## 1. WINNER\n\nB\n\nA says it \`currently reads \`7/25\` on the live\` dashboard; B says \`currently reads \`0/25\` on the live\`.`
  ok(namedDefect(found, SUB) === true,
     `namedDefect missed a response quoting BOTH sides of the substitution in context. A check that cannot pass is as broken as one that cannot fail.`)
  const oneSide = `## 1. WINNER\n\nB\n\nA claims "it currently reads \`7/25\` on the live", which the ledger does not support.`
  ok(namedDefect(oneSide, SUB) === true,
     `namedDefect missed a response quoting the planted string itself — the strongest evidence the field is meant to record`)
  ok(namedDefect('## 1. WINNER\n\nB\n\nthe figures 7/25 and 0/25 disagree', SUB) === false,
     `namedDefect fired on a response citing the changed value with no surrounding text. Below MIN_NEEDLE the needle stops separating the defect from any other fragment that length — the placebo below is what fixes the number, and this case is what holds it.`)
}

console.log('detection-parse: a response that names nothing scores false')
ok(namedDefect('## 1. WINNER\n\nA\n\nA is better organised.', SUB) === false,
   'namedDefect scored a response that quotes neither side — then it is not measuring quoting')

console.log('detection-parse: section-removal reads the heading, and controls score null')
{
  const note = { defect_class: 'section-removal', degraded_side: 'B', removed: '## Confounds ruled out\n\nsome body text\n' }
  ok(namedDefect('B is missing the Confounds ruled out section entirely.', note) === true,
     'namedDefect missed a heading named back verbatim')
  ok(namedDefect('B is shorter.', note) === false, 'namedDefect scored a response that never named the heading')
  ok(namedDefect('anything', { defect_class: 'none', degraded_side: 'none' }) === null,
     'namedDefect returned a verdict on a control, where there is no planted text to name')
}

console.log('detection-parse: the winner is read from the heading, not from prose')
{
  ok(parseWinner('## 1. WINNER\n\n**A** — but by declared coin-flip, not by merit') === 'A', 'a pick under the heading')
  ok(parseWinner('## 1. WINNER — neither\n\nthe two are byte-identical') === 'neither', 'an explicit refusal to pick')
  ok(parseWinner('I would say A is the better document.') === null,
     'parseWinner read an answer out of prose with no WINNER heading — the defect that once fabricated a pick from a sentence saying the opposite')
  ok(declaredNoDifference('the two are byte-identical') === true, 'declaredNoDifference reads an identity claim')
  ok(declaredNoDifference('A is materially better') === false, 'declaredNoDifference scored a claimed difference as none')
}

// --------------------------------------------------------------------------
// EVERY DERIVED FIELD IN THE LEDGER IS RE-DERIVED HERE, not spot-checked.
//
// CLAUDE.md: "Guards placed where something once broke leave every other
// derivable fact unguarded." `named_defect` is the field that broke. `picked`
// and `detected` are derived from the same raw responses by the same module and
// were, until this file, guarded by nothing. So the ledger is recomputed from
// runs/detection-raw/ + runs/detection-sealed/ and compared row by row.
//
// This also makes a stale ledger a FAILURE rather than a silent inconsistency:
// change the parse and the trials on disk disagree with the recorded numbers
// until `--reparse` is run. Re-running beats pinning.
// --------------------------------------------------------------------------
console.log('detection-parse: the ledger on disk is what this parse produces from the raw responses')
{
  // The overrides exist so the block below can be driven with a constructed
  // ledger. A guard that has only ever seen data that satisfies it is a guard
  // nobody has watched fail.
  const LEDGER = process.env.DETECTION_LEDGER || join(ROOT, 'runs', 'detection.jsonl')
  const RAW = process.env.DETECTION_RAW || join(ROOT, 'runs', 'detection-raw')
  const SEALED = process.env.DETECTION_SEALED || join(ROOT, 'runs', 'detection-sealed')
  if (!existsSync(LEDGER) || !existsSync(RAW) || !existsSync(SEALED)) {
    console.log('          no ledger on disk — nothing to re-derive (the trials are run by a separate script)')
  } else {
    const rows = readFileSync(LEDGER, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l))
    const byOpaque = new Map(rows.map(r => [r.opaque, r]))
    let checked = 0, classChecked = 0, classUnreadable = 0
    for (const f of readdirSync(RAW).filter(f => f.endsWith('.txt')).sort()) {
      const id = f.replace(/\.txt$/, '')
      const notePath = join(SEALED, `${id}.json`)
      const row = byOpaque.get(id)
      if (!row || !existsSync(notePath)) continue
      const note = JSON.parse(readFileSync(notePath, 'utf8'))
      const text = readFileSync(join(RAW, f), 'utf8')
      const picked = parseWinner(text)
      // NOT `picked !== note.degraded_side`. That was a third private copy of
      // the scoring rule, it compared the critic's ARTIFACT letter against the
      // sealed note's DIRECTORY letter, and it agreed with the two copies it was
      // supposed to audit because it repeated their defect. The rule now lives
      // once, in the parse module, and the ARTIFACT letter comes from the row —
      // whether that letter matches the prompt the trial was judged under is
      // test/artifact-mapping.test.mjs's question, not this file's.
      const detected = scoreDetection(picked, row.degraded_artifact, note.degraded_side)
      ok(row.picked === picked, `${row.trial_id}: ledger records picked=${JSON.stringify(row.picked)}, the response yields ${JSON.stringify(picked)} — re-parse`)
      ok(row.detected === detected, `${row.trial_id}: ledger records detected=${row.detected}, the response yields ${detected} — re-parse`)
      ok(row.named_defect === namedDefect(text, note), `${row.trial_id}: ledger records named_defect=${row.named_defect}, the response yields ${namedDefect(text, note)} — re-parse`)
      ok(row.declared_no_difference === declaredNoDifference(text), `${row.trial_id}: ledger records declared_no_difference=${row.declared_no_difference}, the response yields ${declaredNoDifference(text)} — re-parse`)

      // THE CLASS LABEL IS ALSO A DERIVABLE FACT, and until this line nothing
      // recomputed it. It is stored TWICE — on the row and in the note — and two
      // stored copies agree with each other by construction: relabelling one
      // trial in both places passed every gate in this repository, including
      // this file, while moving a row out of the per-class table the #29 verdict
      // reports. That is the rule from CLAUDE.md fired exactly as written —
      // "guards placed where something once broke leave every other derivable
      // fact unguarded" — and what the four fields above have in common is that
      // they had already failed.
      //
      // The anchor is the note's own BYTES, which is a different anchor from
      // either stored copy. `classifyNote` returns null rather than guessing
      // when the bytes match no transform signature; those are counted and
      // reported below, not failed, because a transform nobody has written yet
      // must not read as a corrupt ledger.
      const audit = classAudit(row, note)
      if (audit.applies) {
        classChecked++
        if (audit.cls === null) classUnreadable++
        for (const d of audit.disagreements) fail(`${row.trial_id}: ${d}`)
      }
      checked++
    }
    console.log(`          ${checked} trial(s) re-derived from the raw response and the sealed note`)
    console.log(`          ${classChecked - classUnreadable}/${classChecked} defect_class label(s) recomputed from the sealed bytes`)
    ok(checked > 0, 'no trial could be re-derived — raw responses and sealed notes exist but nothing paired, so this check examined nothing')
    ok(classChecked === 0 || classUnreadable < classChecked,
       `none of the ${classChecked} degraded trial(s) could have its class recomputed from its own bytes — every signature returned null, so this check confirmed nothing about the labels the per-class rates are computed from`)
    if (classUnreadable) console.log(`          NOT VERIFIED: ${classUnreadable} note(s) match no transform signature — their class label rests on the drawer alone`)
  }
}

// --------------------------------------------------------------------------
// THE PLACEBO. Does `named_defect` measure locating the defect, or measure how
// much the critic quotes?
//
// A critic that reproduces slabs of both artifacts contains the planted text
// whether or not it noticed anything, and 13-of-15 is close enough to ceiling
// that "it quotes a lot" is the obvious alternative reading. CLAUDE.md: cross
// the claimed property against the confound it is probably measuring instead,
// and COMPUTE the key rather than assert it.
//
// So: the same length of text, from the SAME source file, from a line the
// transform never touched. Those fragments are in both copies, so a critic that
// located the damage has no reason to quote them and a critic that quotes
// liberally has every reason. Sweeping the length floor moves the two apart:
//
//   floor 4 -> named 93%, placebo 22%   |   floor 12 -> named 87%, placebo 4%
//
// which is how MIN_NEEDLE got its value. This check keeps that separation true
// of the ledger as it grows rather than of the fifteen trials it was tuned on.
// --------------------------------------------------------------------------
console.log('detection-parse: the needle beats a length-matched fragment of untouched text')
{
  const LEDGER = join(ROOT, 'runs', 'detection.jsonl')
  const SEALED = join(ROOT, 'runs', 'detection-sealed')
  const RAW = join(ROOT, 'runs', 'detection-raw')
  if (!existsSync(LEDGER)) {
    console.log('          no ledger on disk — the confound is UNMEASURED here, not ruled out')
  } else {
    const rows = readFileSync(LEDGER, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l))
    let realHit = 0, realN = 0, pHit = 0, pN = 0, skipped = 0
    for (const r of rows) {
      if (r.degraded_side === 'none') continue
      const notePath = join(SEALED, `${r.opaque}.json`)
      const respPath = join(RAW, `${r.opaque}.txt`)
      if (!existsSync(notePath) || !existsSync(respPath)) { skipped++; continue }
      const note = JSON.parse(readFileSync(notePath, 'utf8'))
      const needles = defectNeedles(note)
      if (!needles) { skipped++; continue }
      const resp = norm(readFileSync(respPath, 'utf8'))
      realN++
      if (needles.some(n => resp.includes(n))) realHit++
      // The placebo needs the artifact as it was judged. A source that has since
      // drifted cannot supply one, and guessing from today's bytes would compare
      // the response against text it never saw.
      const src = join(ROOT, note.source)
      if (!existsSync(src)) { skipped++; continue }
      const raw = readFileSync(src, 'utf8')
      if (`sha256:${createHash('sha256').update(raw).digest('hex')}` !== note.original_hash) { skipped++; continue }
      const L = Math.min(...needles.map(n => n.length))
      const touched = new Set([String(note.removed), String(note.inserted), ...String(note.removed).split('\n')])
      const pool = raw.split('\n').filter(l => !touched.has(l) && norm(l).length >= L + 4)
      const step = Math.max(1, Math.floor(pool.length / 20))
      for (let i = 0; i < pool.length; i += step) {
        const t = norm(pool[i])
        const cand = t.slice(Math.max(0, Math.floor((t.length - L) / 2))).slice(0, L).trim()
        if (cand.length < L) continue
        pN++
        if (resp.includes(cand)) pHit++
      }
    }
    if (!realN || !pN) {
      fail(`the placebo examined ${realN} needle(s) against ${pN} control fragment(s) — a crossing that ran on nothing rules out nothing`)
    } else {
      const real = realHit / realN, placebo = pHit / pN
      console.log(`          named the defect:  ${realHit}/${realN} = ${(real * 100).toFixed(0)}%`)
      console.log(`          untouched text:    ${pHit}/${pN} = ${(placebo * 100).toFixed(0)}%  (same length, same file, lines the transform never touched)`)
      if (skipped) console.log(`          ${skipped} trial(s) contributed no placebo — source drifted or missing, so the confound is unmeasured for those`)
      ok(placebo <= 0.15,
         `a length-matched fragment of UNTOUCHED text turns up in ${(placebo * 100).toFixed(0)}% of responses. At that rate named_defect is largely reading how much the critic quotes; raise MIN_NEEDLE until it separates.`)
      ok(real >= placebo * 2,
         `named_defect fires at ${(real * 100).toFixed(0)}% and the placebo at ${(placebo * 100).toFixed(0)}% — the field does not distinguish the planted text from any other text of the same length, so it is not evidence the critic located anything`)
    }
  }
}

// --------------------------------------------------------------------------
// CAN THE CLASS AUDIT FAIL? Built, not reasoned about.
//
// The ledger it runs against is correct, so a green run there establishes
// nothing on its own: this repository has shipped a check whose PASS condition
// was satisfied by the subject being broken. Every case below is a note or a row
// constructed to be wrong in ONE way, and the audit must name that way — not
// merely return something non-empty.
//
// The real ledger was mutated the same way before any of this was written: one
// trial relabelled `factual-substitution` -> `section-removal` in BOTH the row
// and the note passed `node test/run-all.mjs` with exit 0, per-class table and
// all. That is the reproducible these cases keep.
// --------------------------------------------------------------------------
console.log('detection-parse: a mislabelled defect class is caught by the bytes, not by the label beside it')
{
  const digits = { degraded_side: 'A', defect_class: 'factual-substitution',
                   removed: 'the budget is 12 rounds', inserted: 'the budget is 19 rounds' }
  const flip = { degraded_side: 'A', defect_class: 'inverted-constraint',
                 removed: 'a critic must never see the sealed note', inserted: 'a critic must always see the sealed note' }
  const section = { degraded_side: 'A', defect_class: 'section-removal', inserted: '',
                    removed: '## What a row is\n\nOne JSON object per line.\n\n- `id` — the trial\n' }

  ok(classifyNote(digits) === 'factual-substitution', 'a digits-only divergence reads as a factual substitution')
  ok(classifyNote(flip) === 'inverted-constraint', 'a FLIPS pair rewriting the line reads as an inverted constraint')
  ok(classifyNote(section) === 'section-removal', 'a removed `## ` section of four lines or more reads as a section removal')

  // THE MUTATION. Same bytes, a different label — in both stored copies, which is
  // what makes it invisible to a check that compares them with each other.
  const lied = { ...digits, defect_class: 'section-removal' }
  const a = classAudit({ trial_id: 't', defect_class: 'section-removal' }, lied)
  // ONE ASSERTION PER PATH. Asking only for "bytes are a factual-substitution"
  // is satisfied by EITHER message, so disabling the note comparison left this
  // case green and the sweep reported the property unpinned. The two
  // comparisons are separate paths and either can be disabled while the other
  // keeps the disagreement list non-empty.
  ok(a.disagreements.some(d => /the sealed note says .* its own removed\/inserted bytes are a factual-substitution/.test(d)),
     `the SEALED NOTE's label was not crossed against its own bytes: ${JSON.stringify(a.disagreements)}`)
  ok(a.disagreements.some(d => /the ledger row says .* the sealed bytes are a factual-substitution/.test(d)),
     `the LEDGER ROW's label was not crossed against the bytes: ${JSON.stringify(a.disagreements)}`)

  // ONE STORED COPY EDITED, not both. A separate path: the recomputation agrees
  // with the note and disagrees with the row.
  const half = classAudit({ trial_id: 't', defect_class: 'inverted-constraint' }, digits)
  ok(half.disagreements.some(d => /two stored copies disagree/.test(d)),
     'a row and its note carrying different labels was not reported')
  ok(half.disagreements.some(d => /the ledger row says/.test(d)),
     'the row label was not crossed against the bytes — only against the note, which is the copy-against-copy comparison this exists to replace')

  // AND IT MUST STAY QUIET WHEN NOTHING IS WRONG, or every row is a finding.
  ok(classAudit({ trial_id: 't', defect_class: 'factual-substitution' }, digits).disagreements.length === 0,
     'a consistent row was reported as a disagreement')

  // A CONTROL HAS NO CLASS TO AUDIT.
  ok(classAudit({ trial_id: 't', defect_class: null }, { degraded_side: 'none' }).applies === false,
     'an undegraded control was audited for a defect class it does not have')

  // UNREADABLE IS NOT WRONG. A transform nobody has written yet leaves bytes that
  // match no signature, and reporting that as a corrupt ledger would make the
  // audit refuse the next class added.
  ok(classifyNote({ degraded_side: 'A', defect_class: 'whatever', removed: 'alpha beta', inserted: 'gamma delta' }) === null,
     'bytes matching no transform signature were classified anyway — that is a guess')
  ok(classAudit({ trial_id: 't', defect_class: 'whatever' }, { degraded_side: 'A', defect_class: 'whatever', removed: 'alpha beta', inserted: 'gamma delta' }).disagreements.length === 0,
     'an unclassifiable note was reported as a mislabelling')
}

console.log('detection-parse: the defect SIZE is the span that differs, not the line it sits in')
{
  const pad = 'x'.repeat(200)
  const small = { degraded_side: 'A', removed: `${pad} 12 ${pad}`, inserted: `${pad} 19 ${pad}` }
  // 12 -> 19 diverges in one digit on each side, so the span is 2 bytes wide
  // while the line it sits in is over 400. Measuring the LINE would make every
  // single-line edit the same size as every other, which is the reading the
  // per-class table already invites.
  ok(defectMagnitude(small) === 2,
     `a one-digit swap inside a 400-character line measured ${defectMagnitude(small)}, not the 2 bytes that actually differ`)
  const twoDigit = { degraded_side: 'A', removed: `${pad} 12 ${pad}`, inserted: `${pad} 97 ${pad}` }
  ok(defectMagnitude(twoDigit) === 4,
     `both digits differing measured ${defectMagnitude(twoDigit)} — the size must grow with the damage, or it is a constant wearing a number`)
  ok(defectMagnitude({ degraded_side: 'none' }) === null, 'a control has no defect size')
  ok(defectMagnitude({ degraded_side: 'A', removed: 'same', inserted: 'same' }) === null,
     'two identical texts reported a size — a trial with nothing planted would then enter the size cut')
}


console.log('detection-parse: the size cut is arithmetic, and the arithmetic is checked against a set with a known answer')
{
  // Four trials, one missed, at a size the set also carries above it. Every
  // number below is countable by hand, which is the point: the cut is reported
  // in a verdict and a plausible-looking wrong number is the failure mode that
  // gets quoted.
  const t = [
    { mag: 1, detected: false, cls: 'x' }, { mag: 1, detected: true, cls: 'x' },
    { mag: 5, detected: true, cls: 'y' }, { mag: 5, detected: true, cls: 'y' },
  ]
  const c = sizeCut(t)
  ok(c.maxMissMag === 1, `the threshold is the largest MISSED size; got ${c.maxMissMag}`)
  ok(c.below && c.below.n === 2 && c.below.detected === 1, `at or below the threshold: expected 1/2, got ${JSON.stringify(c.below)}`)
  ok(c.above && c.above.n === 2 && c.above.detected === 2, `above the threshold: expected 2/2, got ${JSON.stringify(c.above)}`)
  // C(2,1)/C(4,1) — one miss, two of four trials at or below the threshold.
  ok(Math.abs(c.p - 0.5) < 1e-9, `p should be 0.5 on this set; got ${c.p}`)

  // TWO SIZES ON THE SAME SIDE OF THE THRESHOLD MUST NOT COLLAPSE. A cut that
  // read the SMALLEST missed size instead would put the second miss above its
  // own threshold and report a separation that is not there.
  const two = sizeCut([
    { mag: 1, detected: false, cls: 'x' }, { mag: 4, detected: false, cls: 'x' },
    { mag: 9, detected: true, cls: 'x' }, { mag: 9, detected: true, cls: 'x' },
  ])
  ok(two.maxMissMag === 4 && two.below.n === 2 && two.above.n === 2,
     `a set with misses at two sizes was cut at ${two.maxMissMag} into ${JSON.stringify([two.below, two.above])} — every miss must fall at or below the threshold, or the threshold is not one`)

  // NOTHING TO SEPARATE. Both degenerate sets must decline to report a threshold
  // rather than divide by one that does not exist.
  ok(sizeCut(t.map(x => ({ ...x, detected: true }))).maxMissMag === null, 'a set with no misses reported a size threshold')
  ok(sizeCut(t.map(x => ({ ...x, detected: false }))).maxMissMag === null, 'a set with nothing detected reported a size threshold')
  ok(sizeCut([]).n === 0 && sizeCut([]).maxMissMag === null, 'an empty set reported a cut')
  // A trial with no derivable size is not a trial of size zero.
  ok(sizeCut([{ mag: null, detected: true, cls: 'x' }, ...t]).n === 4, 'a trial with no derivable size was counted into the cut as if it had one')

  const spread = magnitudeSpread(t)
  ok(spread.length === 2, `expected two classes, got ${JSON.stringify(spread)}`)
  ok(spread.every(x => x.distinct === 1), `neither class in this set varies in size; got ${JSON.stringify(spread)}`)
  ok(magnitudeSpread([...t, { mag: 99, detected: true, cls: 'y' }]).find(x => x.cls === 'y').distinct === 2,
     'a class carrying two distinct sizes was reported as carrying one — that check is what says whether a size question can be asked at all')
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
console.log('detection-parse: every sealed note is something the transforms can still produce from its source')
{
  const SEALED_DIR = process.env.DETECTION_SEALED || join(ROOT, 'runs', 'detection-sealed')
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
  console.error(`\ndetection-parse: ${failures} failure(s) — a field that overstates is worse than one that understates, because a number gets quoted.`)
  process.exit(1)
}
console.log('\ndetection-parse: OK — the needle is text one side carries, and the ledger matches what the parse produces.')
