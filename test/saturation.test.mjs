// THE REPRODUCIBLE for #22 — a saturated case cannot measure a discrimination,
// and nothing in this repository says so where the number is printed.
//
//   node test/saturation.test.mjs
//
// COMMITTED FAILING.
//
// WHAT #22 SAYS. A measurement run on a case far from the decision boundary
// cannot produce the disagreement it is looking for. It returns unanimity, and
// unanimity reads as reassurance. `SKILL.md`'s gate 6 states the rule for
// acceptance criteria — "a saturated corpus never engages the clause" — and
// nothing applies it to the measurements this repository actually quotes.
//
// WHERE IT BITES TODAY, and this is the instance that made the issue worth
// reopening as work rather than as a note: `oracle-report` prints a per-side
// error rate over a corpus somebody chose. On 2026-08-26 every artifact in its
// produces-an-instruction arm was a markdown document and every does-the-work
// artifact but two was a script, so a classifier reading nothing but the file
// extension scored 6/6 on the writer arm and 17/19 overall. The instrument
// scored 0 errors. The report cannot tell those two apart, and prints the second
// as though it settled something.
//
// THE PROPERTY: A REPORTED DISCRIMINATION MUST STATE WHAT A TRIVIAL CONFOUND
// SCORES ON THE SAME SET. Not "is this corpus good" — that is unanswerable — but
// the one comparison that is computable: if the cheapest possible classifier
// scores what the instrument scores, the set could not have produced a
// disagreement, and the number is uninformative rather than reassuring.
//
// THE CONTROL IS THE POINT. Case B is the same corpus with two rows crossed, so
// the confound stops predicting the label. A check that cries saturation on
// everything measures nothing, exactly like one that never does — so the two
// cases are built to differ ONLY in whether the confound predicts the label, and
// the expected baseline is COMPUTED here from the ledger rather than asserted, so
// the report's number can come back wrong.
//
// Case B passes today VACUOUSLY: the report says nothing about saturation, so it
// cannot wrongly say it. It begins measuring when the fix lands.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPORT = join(ROOT, 'scripts', 'oracle-report.mjs')
const { liveInstrument } = await import(join(ROOT, 'scripts', 'oracle-instrument.mjs'))
const LIVE = liveInstrument()

let failures = 0
const ok = (cond, m) => { if (cond) console.log(`  ok    ${m}`); else { console.error(`  FAIL  ${m}`); failures++ } }

const sha = s => 'sha256:' + createHash('sha256').update(s).digest('hex')

// ---------------------------------------------------------------------------
// A ledger is built on disk because the report VERIFIES it: acceptance commands
// are re-run and emission hashes are recomputed. A fixture that only looks right
// in JSON is refused before any rate is printed, which is the report working.
// ---------------------------------------------------------------------------
function build(dir, spec) {
  const corpus = [], results = []
  spec.forEach(({ id, role, ext }) => {
    const artifact = join(dir, `${id}${ext}`)
    writeFileSync(artifact, `# ${id}\n`)
    let row
    if (role === 'does-the-work') {
      row = { id, grounding: 'mechanical', artifact, artifact_hash: sha(id), goal: 'a synthetic goal', inspect: null,
              expected_role: role, disputed: false,
              evidence: { method: 'mechanical-execution', acceptance_command: 'true', exit_code: 0, stdout_head: null },
              selection_note: 'synthetic fixture for test/saturation.test.mjs' }
    } else {
      const emission = join(dir, `${id}-emission.md`)
      const body = `emitted by ${id}\n`
      writeFileSync(emission, body)
      row = { id, grounding: 'agentic', artifact, artifact_hash: sha(id), goal: 'a synthetic goal', inspect: null,
              expected_role: role, disputed: false,
              evidence: { method: 'agentic-execution', emissions: [{ path: emission, hash: sha(body) }],
                          classifications: [{ path: emission, hash: sha(body), verdict: 'addressed-to-a-further-party' }],
                          classified_by: 'synthetic' },
              selection_note: 'synthetic fixture for test/saturation.test.mjs' }
    }
    corpus.push(row)
    results.push({ row: id, artifact, expected_role: role, predicted_role: role, correct: true,
                   what_it_is: 'synthetic', reasoning: 'synthetic', prompt_hash: sha(id),
                   template_hash: LIVE.template_hash, schema_fingerprint: LIVE.schema_fingerprint,
                   observer: 'synthetic', grounding: row.grounding })
  })
  return { corpus, results }
}

function report(spec) {
  const dir = mkdtempSync(join(tmpdir(), 'saturation-'))
  try {
    mkdirSync(dir, { recursive: true })
    const { corpus, results } = build(dir, spec)
    const w = (name, rows) => { const p = join(dir, name); writeFileSync(p, rows.map(r => JSON.stringify(r)).join('\n') + '\n'); return p }
    const r = spawnSync(process.execPath, [REPORT], {
      encoding: 'utf8', cwd: ROOT, timeout: 60_000,
      env: { ...process.env, ORACLE_CORPUS: w('corpus.jsonl', corpus), ORACLE_RESULTS: w('results.jsonl', results), ORACLE_PAIRINGS: (writeFileSync(join(dir, 'p.jsonl'), ''), join(dir, 'p.jsonl')) },
    })
    return String(r.stdout) + String(r.stderr)
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

// The cheapest classifier there is: read the file extension, guess the role.
// Computed here, from the same spec the ledger is built from, so the report's
// claim about it can be checked rather than trusted.
const baseline = spec => {
  const scored = spec.filter(s => s.role !== 'could-not-open')
  const hit = scored.filter(s => (s.ext !== '.md') === (s.role === 'does-the-work')).length
  return { hit, n: scored.length }
}

const W = n => ({ id: `worker-${n}`, role: 'does-the-work', ext: '.sh' })
const R = n => ({ id: `writer-${n}`, role: 'produces-an-instruction', ext: '.md' })

// CASE A — every writer is prose, every worker is a script. The extension alone
// separates the set perfectly, which is the shape the real corpus had.
const SATURATED = [W(1), W(2), W(3), W(4), W(5), W(6), R(1), R(2), R(3), R(4), R(5), R(6)]

// CASE B — the same twelve rows with two crossed: one script that writes an
// instruction, one prose file that does the work. Nothing else differs.
const CROSSED = SATURATED.map(s =>
  s.id === 'writer-6' ? { ...s, ext: '.sh' } : s.id === 'worker-6' ? { ...s, ext: '.md' } : s)

const outA = report(SATURATED)
const outB = report(CROSSED)

console.log('saturation: the fixtures reach the line under test at all')
ok(/per-side error/.test(outA), 'the saturated ledger produces a per-side rate — without one there is nothing to qualify')
ok(/per-side error/.test(outB), 'the crossed ledger produces a per-side rate too')

console.log('saturation: the report states what a trivial confound scores on the same set')
const stated = out => {
  const m = out.match(/trivial baseline\s+(\d+)\/(\d+)/)
  return m ? { hit: +m[1], n: +m[2] } : null
}
const bA = baseline(SATURATED), bB = baseline(CROSSED)
const sA = stated(outA), sB = stated(outB)
ok(sA !== null, `the saturated report names a trivial-confound baseline. Today it names none, so a reader cannot tell an accurate instrument from an easy corpus — which is #22's whole claim. Computed here: ${bA.hit}/${bA.n} by file extension alone`)
ok(sB !== null, `the crossed report names one too. Computed here: ${bB.hit}/${bB.n}`)
if (sA && sB) {
  ok(sA.hit === bA.hit && sA.n === bA.n, `and the saturated baseline it prints matches what the ledger supports (said ${sA.hit}/${sA.n}, computed ${bA.hit}/${bA.n})`)
  ok(sB.hit === bB.hit && sB.n === bB.n, `and the crossed one does too (said ${sB.hit}/${sB.n}, computed ${bB.hit}/${bB.n})`)
}

console.log('saturation: a set the confound separates perfectly is called uninformative, not clean')
ok(/UNINFORMATIVE|SATURATED/.test(outA),
   'the saturated report says the rate cannot separate the instrument from the confound. A clean 0/N on a set that could not have produced a disagreement is the reassurance #22 was filed about')

console.log('saturation: and a crossed set is NOT called saturated  [holds today, vacuously]')
ok(!/UNINFORMATIVE|SATURATED/.test(outB),
   'crossing two rows removes the warning. A check that fires on every corpus measures exactly as much as one that never fires, so this is the half that keeps the other half honest')

console.log('saturation: stating what this file does NOT establish')
console.log('          NOT MEASURED: whether the corpus is REPRESENTATIVE. A crossed set is not a')
console.log('          sampled one, and selection bias (#38) is untouched by anything here. The')
console.log('          baseline is also ONE confound — the file extension. A set crossed against it')
console.log('          can still be saturated on length, subject, or authorship, and this file would')
console.log('          call it clean.')

if (failures) {
  console.error(`\nsaturation: ${failures} failure(s) — a discrimination is reported without saying what a trivial confound scores on the same set.`)
  process.exit(1)
}
console.log('\nsaturation: OK — an easy set is reported as uninformative, and a crossed one is not.')
