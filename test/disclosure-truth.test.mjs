// THE REPRODUCIBLE for issue 19: a pinned disclosure that is false.
//
//   node test/disclosure-truth.test.mjs
//
// COMMITTED FAILING.
//
// Issue 19 says loop.js exits on ∃-one-favourable-round where the source exits on
// ∀-judges-wowed, and names four places the repository asserts "gauntlet" as a
// defined noun. Re-running its evidence: all four assertions are gone, and the
// exit is now arm-then-confirm — a win arms, a fresh critic on the opposite side
// against the unchanged artifact confirms. The issue as written is stale.
//
// What survives is one live instance of its actual complaint, in a place the
// issue could not have named. loop.js's own not_enforced list says:
//
//     "k>1 is an ADDITION, not source fidelity. Both primary texts say one critic
//      per piece, singular; the source gets width by decomposing the goal, WHICH
//      THIS LOOP DOES NOT DO."
//
// The loop does decompose. It dispatches gauntlet-lead, splits the goal into
// pieces, and judges each piece on its own — and the same verdict, forty lines
// earlier, describes that decomposition in detail. The file contradicts itself,
// and the false half is the half making the source-fidelity claim.
//
// THE STRUCTURAL POINT, which is why this file exists rather than a one-line edit:
// that sentence is PINNED. It is in test/drift-facts.mjs, drift-guard fails if it
// disappears, and scripts/guard-sweep.mjs verifies that pin still bites. All of
// that machinery was faithfully protecting a false statement, because a
// disclosure is pinned for PRESENCE and nothing checks it is TRUE.
//
// So this file checks the claim against BEHAVIOUR: run the loop, watch it
// decompose, and require that nothing shipped denies it. The denial is matched by
// pattern rather than by its exact words, so rewording the same false claim does
// not evade the check.
//
// NOTHING HERE SPAWNS.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { runLoop } from './harness.mjs'
import { auditFigures, describeProblem, figureTokens } from '../scripts/disclosure-figures.mjs'
import { disclosureKey } from '../scripts/disclosure-audit.mjs'
import { adjudicationLedger } from '../scripts/adjudications.mjs'
import { LOOP_DISCLOSURES } from './drift-facts.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }

console.log('disclosure-truth: the loop decomposes — established by running it, not by reading it')
let decomposes = false
{
  const r = await runLoop({
    args: { goal: 'g', candidate: '/x/a.md', reference: '/x/b.md', token: '/t' },
    lead: { decomposes: true, split_criterion: 'two files', pieces: [
      { name: 'one', observable: 'o1', candidate: '/x/p1.md', reference: '/x/r1.md' },
      { name: 'two', observable: 'o2', candidate: '/x/p2.md', reference: '/x/r2.md' }] },
    rounds: Array.from({ length: 4 }, () => ({ candidateWins: true, gap: 'g', margin: 'clear' })),
  }).catch(e => { fail(`the stubbed loop threw: ${e.message}`); return null })
  const pieces = r ? [...new Set((r.result.history || []).map(h => h.piece).filter(Boolean))] : []
  decomposes = pieces.length > 1
  ok(decomposes,
     `the loop judged ${pieces.length} distinct piece(s) when handed a decomposing lead — if it genuinely cannot decompose, the disclosure below is true and THIS test is the thing that is wrong`)
  console.log(`          ${pieces.length} distinct piece(s) judged in one run: ${pieces.join(', ') || '(none)'}`)
}

console.log('disclosure-truth: nothing shipped denies a capability the run just demonstrated')
{
  // MATCHED BY PATTERN, not by the exact sentence. Pinning the literal string
  // would be satisfied by rewording the same false claim, which is the failure
  // mode a pin has: it guards the words rather than what they assert.
  const DENIES_DECOMPOSITION = [
    /which this loop does not do/i,
    /this loop does not (?:\w+ )*decompos/i,
    /decompos\w*[^.]{0,80}?which this loop does not/i,
  ]
  const loopSrc = readFileSync(join(ROOT, 'skills', 'gauntlet-loop', 'loop.js'), 'utf8')

  // The disclosures as pinned, and as they appear in the shipped source.
  const surfaces = [
    ...LOOP_DISCLOSURES.map(d => ({ where: 'test/drift-facts.mjs (pinned)', text: d })),
    ...loopSrc.split('\n')
      .filter(l => /ADDITION, not source fidelity/.test(l))
      .map(l => ({ where: 'skills/gauntlet-loop/loop.js (shipped)', text: l })),
  ]
  for (const s of surfaces) {
    for (const re of DENIES_DECOMPOSITION) {
      if (re.test(s.text)) {
        fail(`${s.where} asserts the loop does not decompose, and the run above judged two pieces. ` +
             `A disclosure is pinned for PRESENCE — drift-guard fails if it disappears and guard-sweep ` +
             `confirms that pin bites — and none of that notices when the sentence is false: ` +
             `"${s.text.trim().slice(0, 150)}"`)
        break
      }
    }
  }
  if (!failures) console.log(`          ${surfaces.length} surface(s) checked, none denies it`)
}

// --------------------------------------------------------------------------
// A DISCLOSURE THAT STATES A FIGURE SAYS WHERE THE FIGURE COMES FROM. Issue #56.
//
// COMMITTED FAILING. loop.js emitted "an evaluator whose detection rate is n=1
// (#29)" into every run's own not_enforced list for a day after the rate was
// measured at 12/15, and every check in this repository passed on it: changing
// n=1 to n=99, or to "80% and amply proven", or replacing the whole tail of the
// sentence with "Bananas are a berry and the moon is cheese", was NOT CAUGHT by
// run-all, drift-guard or disclosure-audit. The pin reaches 62 characters of a
// 1205-character sentence.
//
// THE SUBJECT IS WHAT THE LOOP EMITS, not what its source says. The disclosures
// are read off a run's `not_enforced`, so a sentence assembled at runtime is
// checked the same as a literal, and the source-parsing this would otherwise need
// does not exist to get wrong.
// --------------------------------------------------------------------------
console.log('disclosure-truth: a disclosure that states a figure says where the figure comes from')
{
  const ADJ = process.env.DISCLOSURE_ADJUDICATIONS || join(ROOT, 'docs', 'disclosure-adjudications.jsonl')
  const adj = adjudicationLedger(existsSync(ADJ) ? readFileSync(ADJ, 'utf8') : '', a => a.key ?? null)
  const exists = p => existsSync(join(ROOT, p))
  const read = p => readFileSync(join(ROOT, p), 'utf8')

  const r = await runLoop({
    args: { goal: 'g', candidate: '/x/a.md', reference: '/x/b.md', token: '/t' },
    rounds: [{ candidateWins: true, gap: 'g', margin: 'clear' }, { candidateWins: true, gap: 'g', margin: 'clear' }],
  }).catch(e => { fail(`the stubbed loop threw: ${e.message}`); return null })
  const emitted = (r && r.result && r.result.not_enforced) || []
  ok(emitted.length > 0, 'the run emitted no disclosures at all, so this check examined nothing')

  let withFigures = 0, sourced = 0, adjudicatedAway = 0
  for (const d of emitted) {
    if (!figureTokens(d).length) continue
    withFigures++
    const problems = auditFigures(d, { exists, read })
    if (!problems.length) { sourced++; continue }
    // THE KEY COMES FROM THE PIN, not from the emitted string. `disclosureKey`
    // takes the first 40 characters, and a pinned prefix shorter than that keys
    // to itself while the emitted sentence keys to 40 — two keys for one
    // disclosure, which is the coordinate-system collision this repository has
    // now paid for three times. disclosure-audit looks the row up by the pin, so
    // this must too, or every row here reads as unspent over there.
    const pinned = LOOP_DISCLOSURES.find(x => d.startsWith(x))
    const key = disclosureKey(pinned || d)
    // ONLY "unsourced" IS ADJUDICABLE. A citation that does not resolve, or a
    // figure absent from the file it names, is a broken claim rather than an
    // unrecorded one, and recording a reason for it would be the rubber stamp
    // this repository keeps finding.
    const a = adj.get(key)
    if (problems.every(p => p.kind === 'unsourced') && a && String(a.why || '').length >= 120) {
      adjudicatedAway++
      continue
    }
    for (const p of problems) fail(describeProblem(p, `an emitted disclosure ("${key}…")`))
  }
  ok(withFigures > 0,
     `not one of the ${emitted.length} emitted disclosure(s) states a figure, so this check confirmed nothing. Either the rule stopped matching or the disclosures stopped making claims.`)
  console.log(`          ${emitted.length} disclosure(s) emitted · ${withFigures} state a figure · ${sourced} cite a file that contains it · ${adjudicatedAway} adjudicated as unrecorded`)
}

console.log('disclosure-truth: and that rule can fail — one constructed disclosure per branch')
{
  const files = { 'docs/evidence.md': 'the rate came out 12 / 15 across the batch, and the judges split 3 \u2013 2' }
  const exists = p => Object.prototype.hasOwnProperty.call(files, p)
  const read = p => files[p]

  const clean = 'THE RATE IS 12/15 and it is written down in docs/evidence.md.'
  ok(auditFigures(clean, { exists, read }).length === 0,
     'a figure cited to a file that contains it was reported — spacing differs between "12/15" and "12 / 15" and the rule must not be satisfied by reformatting either way')

  // AN EN-DASH AND A HYPHEN ARE ONE NUMBER WRITTEN TWICE. Without this case the
  // dash normalisation is code nothing needs, and the sweep says so: it swept
  // NOT CAUGHT until this line existed.
  const dashed = 'THE JUDGES SPLIT 3-2, recorded in docs/evidence.md.'
  ok(auditFigures(dashed, { exists, read }).length === 0,
     `a figure written with a hyphen was not found in a file that writes it with an en-dash: ${JSON.stringify(auditFigures(dashed, { exists, read }))}`)

  const unsourced = 'THE RATE IS 12/15, and this sentence names no file at all.'
  const u = auditFigures(unsourced, { exists, read })
  ok(u.length === 1 && u[0].kind === 'unsourced',
     `a figure with nowhere to point was accepted: ${JSON.stringify(u)} — that is issue #56 exactly`)

  const wrongFile = 'THE RATE IS 9/11 and it is in docs/evidence.md.'
  const w = auditFigures(wrongFile, { exists, read })
  ok(w.length === 1 && w[0].kind === 'not-in-source',
     `a figure absent from the file it cites was accepted: ${JSON.stringify(w)} — a citation is only sourcing if the number is in it`)

  const gone = 'THE RATE IS 12/15 and it is in docs/deleted.md.'
  const g = auditFigures(gone, { exists, read })
  ok(g.some(p => p.kind === 'missing-path'),
     `a citation to a file that does not exist was accepted: ${JSON.stringify(g)}`)

  ok(auditFigures('NO FIGURE HERE, only prose about behaviour.', { exists, read }).length === 0,
     'a disclosure stating no figure was reported — then every sentence is a finding')
  ok(figureTokens('at the default k=1 that phrase quantifies over a set of one').length === 0,
     'k=1 was read as a measurement. It describes the run that is speaking, and a rule that fires on it would make the loop unable to describe its own configuration')
  ok(figureTokens('across five spawns on one unchanged pair').length === 0,
     'a number written as a word was read as a figure')
  ok(figureTokens('a 3-2 split').length === 1 && figureTokens('detection rate is n=1').length === 1 && figureTokens('55-93%').length >= 1,
     'a ratio, an n= and a percentage must all count as figures, or the rule reaches only the shape that motivated it')
}


console.log('disclosure-truth: stating what this cannot establish')
console.log('          NOT CHECKED: the other 18 disclosures. Each is pinned for presence and nothing')
console.log('          verifies any of them is TRUE. Decomposition is checkable because the harness can')
console.log('          exercise it; "nothing verifies that a harsh instruction produced a harsh critic"')
console.log('          cannot be run, and its truth rests on reading alone — same as this one did.')

if (failures) {
  console.error(`\ndisclosure-truth: ${failures} failure(s) — a pinned false statement is worse than an unpinned one, because the pin reads as verification.`)
  process.exit(1)
}
console.log('\ndisclosure-truth: OK — the loop decomposes, and nothing shipped denies it.')
