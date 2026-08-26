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
import { parseWinner, namedDefect, declaredNoDifference, defectNeedles, norm } from '../scripts/detection-parse.mjs'

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
  const LEDGER = join(ROOT, 'runs', 'detection.jsonl')
  const RAW = join(ROOT, 'runs', 'detection-raw')
  const SEALED = join(ROOT, 'runs', 'detection-sealed')
  if (!existsSync(LEDGER) || !existsSync(RAW) || !existsSync(SEALED)) {
    console.log('          no ledger on disk — nothing to re-derive (the trials are run by a separate script)')
  } else {
    const rows = readFileSync(LEDGER, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l))
    const byOpaque = new Map(rows.map(r => [r.opaque, r]))
    let checked = 0
    for (const f of readdirSync(RAW).filter(f => f.endsWith('.txt')).sort()) {
      const id = f.replace(/\.txt$/, '')
      const notePath = join(SEALED, `${id}.json`)
      const row = byOpaque.get(id)
      if (!row || !existsSync(notePath)) continue
      const note = JSON.parse(readFileSync(notePath, 'utf8'))
      const text = readFileSync(join(RAW, f), 'utf8')
      const picked = parseWinner(text)
      const detected = note.degraded_side === 'none' ? null
        : picked === null ? null
        : picked !== note.degraded_side
      ok(row.picked === picked, `${row.trial_id}: ledger records picked=${JSON.stringify(row.picked)}, the response yields ${JSON.stringify(picked)} — re-parse`)
      ok(row.detected === detected, `${row.trial_id}: ledger records detected=${row.detected}, the response yields ${detected} — re-parse`)
      ok(row.named_defect === namedDefect(text, note), `${row.trial_id}: ledger records named_defect=${row.named_defect}, the response yields ${namedDefect(text, note)} — re-parse`)
      ok(row.declared_no_difference === declaredNoDifference(text), `${row.trial_id}: ledger records declared_no_difference=${row.declared_no_difference}, the response yields ${declaredNoDifference(text)} — re-parse`)
      checked++
    }
    console.log(`          ${checked} trial(s) re-derived from the raw response and the sealed note`)
    ok(checked > 0, 'no trial could be re-derived — raw responses and sealed notes exist but nothing paired, so this check examined nothing')
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

if (failures) {
  console.error(`\ndetection-parse: ${failures} failure(s) — a field that overstates is worse than one that understates, because a number gets quoted.`)
  process.exit(1)
}
console.log('\ndetection-parse: OK — the needle is text one side carries, and the ledger matches what the parse produces.')
