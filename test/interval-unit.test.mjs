// THE REPRODUCIBLE for S4 of the #28 suspect list — an interval computed over the
// wrong unit.
//
//   node test/interval-unit.test.mjs
//
// WHAT WENT WRONG, AND IT WENT WRONG IN FRONT OF ITS AUTHOR. On 2026-08-26 the
// pairing arm's false-refusal figure moved from `0/6, 95% CI [0%, 39%]` to
// `0/18, 95% CI [0%, 18%]` because the SAME six pairings were each drawn twice
// more. No pairing was added. Nothing new was tested. The interval halved because
// one question was asked three times.
//
// `oracle-report` already knows this is wrong, and says so two lines above the
// number that does it:
//
//     distinct artifacts N   <- the number that bears on any statistical claim
//
// and in the comment over that line: "repeat executions of ONE artifact are not
// independent evidence, and a rate computed over observations would let one
// artifact measured twice masquerade as two." Then `wilson()` is handed the
// observation count.
//
// THE PROPERTY, stated so it covers the arms this incident did not touch: AN
// INTERVAL IS COMPUTED OVER THE UNIT THE CLAIM IS ABOUT — artifacts for a per-side
// error rate, pairings for a false-refusal rate — and never over repeats of that
// unit. Redrawing buys stability evidence, which the report reports separately. It
// does not buy a narrower rate.
//
// WHY THE FIXTURES ARE SYNTHETIC. Reproducing this against the real ledger would
// mean spending live agents to make a number move. The ledger paths are already
// injectable — oracle-report reads ORACLE_CORPUS, ORACLE_RESULTS and
// ORACLE_PAIRINGS — so the case is built rather than harvested, and it can assert
// on an interval whose correct value is known by construction.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPORT = join(ROOT, 'scripts', 'oracle-report.mjs')

// THE SYNTHETIC DRAWS MUST CARRY THE LIVE INSTRUMENT'S HASHES, and they are read
// from the same function the report reads them from rather than copied. A draw
// stamped with an invented template hash is excluded by the report as "drawn
// against an instrument that no longer ships" — correctly, and the first version
// of this file learned it by watching the pairing cell report NO PAIRING HAS BEEN
// OBSERVED. A second copy of that derivation is a copy that drifts.
const { liveInstrument } = await import(join(ROOT, 'scripts', 'oracle-instrument.mjs'))
const LIVE = liveInstrument()

let failures = 0
const ok = (cond, m) => { if (cond) console.log(`  ok    ${m}`); else { console.error(`  FAIL  ${m}`); failures++ } }

const HASH = c => 'sha256:' + String(c).repeat(64).slice(0, 64)

const corpusRow = (id, role = 'does-the-work') => ({
  id,
  grounding: 'mechanical',
  artifact: `oracle/fixtures/synthetic/${id}`,
  artifact_hash: HASH(0),
  goal: 'a synthetic goal',
  inspect: null,
  expected_role: role,
  disputed: false,
  // `true` is the cheapest command that exits 0. oracle-report RE-RUNS acceptance
  // rather than trusting a stored exit code, so a row without a runnable one is
  // refused before any rate is printed.
  evidence: { method: 'mechanical-execution', acceptance_command: 'true', exit_code: 0, stdout_head: null },
  selection_note: 'synthetic fixture for test/interval-unit.test.mjs',
})

const obs = (row, { correct = true, observer = 'synthetic', pairing = null, draw = null } = {}) => ({
  row,
  artifact: `/synthetic/${row}`,
  expected_role: 'does-the-work',
  predicted_role: correct ? 'does-the-work' : 'produces-an-instruction',
  correct,
  what_it_is: 'synthetic',
  reasoning: 'synthetic',
  prompt_hash: HASH(1),
  template_hash: LIVE.template_hash,
  schema_fingerprint: LIVE.schema_fingerprint,
  observer,
  grounding: 'mechanical',
  ...(pairing ? { pairing, pairing_draw: draw } : {}),
})

const lines = xs => xs.map(x => JSON.stringify(x)).join('\n') + '\n'

function report({ corpus, results, pairings = [] }) {
  const dir = mkdtempSync(join(tmpdir(), 'interval-unit-'))
  try {
    writeFileSync(join(dir, 'corpus.jsonl'), lines(corpus))
    writeFileSync(join(dir, 'results.jsonl'), lines(results))
    writeFileSync(join(dir, 'pairings.jsonl'), pairings.length ? lines(pairings) : '')
    const r = spawnSync(process.execPath, [REPORT], {
      encoding: 'utf8',
      cwd: ROOT,
      env: { ...process.env, ORACLE_CORPUS: join(dir, 'corpus.jsonl'), ORACLE_RESULTS: join(dir, 'results.jsonl'), ORACLE_PAIRINGS: join(dir, 'pairings.jsonl') },
      timeout: 60_000,
    })
    return String(r.stdout) + String(r.stderr)
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

// THE PARSER IS AN INSTRUMENT AND CAN BE BUILT WRONG. A regex that matches nothing
// would make every comparison below trivially true — two undefineds are equal — so
// a miss is a FAILURE here, reported as one, never a silent pass.
function grab(text, label) {
  const m = text.match(new RegExp(`${label}\\s+(\\d+)/(\\d+), 95% CI \\[(\\d+)%, (\\d+)%\\]`))
  if (!m) return null
  return { k: +m[1], n: +m[2], lo: +m[3], hi: +m[4], ci: `[${m[3]}%, ${m[4]}%]` }
}

// ---------------------------------------------------------------------------
// FIVE distinct artifacts, because oracle-report refuses to pose a rate under
// that (`distinct < 5`). The threshold is the report's own, and this case has to
// clear it to reach the line under test.
// ---------------------------------------------------------------------------
const FIVE = ['a', 'b', 'c', 'd', 'e'].map(id => corpusRow(`synth-${id}`))
const ONCE_EACH = FIVE.map(r => obs(r.id))

console.log('interval-unit: redrawing one artifact does not narrow the per-side interval')
{
  const base = grab(report({ corpus: FIVE, results: ONCE_EACH }), 'per-side error')
  const redrawn = grab(report({
    corpus: FIVE,
    // The same five artifacts. One of them asked twenty more times, which is
    // stability evidence and nothing else.
    results: [...ONCE_EACH, ...Array.from({ length: 20 }, (_, i) => obs('synth-a', { observer: `redraw-${i}` }))],
  }), 'per-side error')

  ok(base !== null, 'the base report prints a per-side interval at all — without it nothing below is measuring anything')
  ok(redrawn !== null, 'the redrawn report prints a per-side interval at all')
  if (base && redrawn) {
    ok(base.n === 5, `the base rate is over 5 distinct artifacts, not observations (got n=${base.n})`)
    ok(redrawn.n === 5, `after 20 redraws of ONE artifact the denominator is still 5 — the corpus still holds five artifacts (got n=${redrawn.n})`)
    ok(base.ci === redrawn.ci, `the interval does not move: base ${base.ci} vs redrawn ${redrawn.ci}. Twenty repeats of one question are not twenty questions`)
  }
}

console.log('interval-unit: an artifact that is wrong once is one wrong artifact, however often it is redrawn')
{
  const wrongOnce = [...FIVE.slice(1).map(r => obs(r.id)), obs('synth-a', { correct: false })]
  const wrongThrice = [
    ...FIVE.slice(1).map(r => obs(r.id)),
    ...Array.from({ length: 3 }, (_, i) => obs('synth-a', { correct: false, observer: `redraw-${i}` })),
  ]
  const one = grab(report({ corpus: FIVE, results: wrongOnce }), 'per-side error')
  const three = grab(report({ corpus: FIVE, results: wrongThrice }), 'per-side error')

  ok(one !== null && three !== null, 'both reports print a per-side interval')
  if (one && three) {
    ok(one.k === 1 && one.n === 5, `one artifact wrong out of five reads as 1/5 (got ${one.k}/${one.n})`)
    ok(three.k === 1 && three.n === 5, `the same artifact wrong three times is still ONE wrong artifact out of five (got ${three.k}/${three.n})`)
    ok(one.ci === three.ci, `the interval does not move: ${one.ci} vs ${three.ci}`)
  }
}

console.log('interval-unit: redrawing a pairing does not narrow the false-refusal interval')
{
  const sides = ['p1a', 'p1b', 'p2a', 'p2b', 'p3a', 'p3b', 'p4a', 'p4b', 'p5a', 'p5b']
  const corpus = sides.map(s => corpusRow(`synth-${s}`))
  const pairings = [1, 2, 3, 4, 5].map(i => ({
    id: `synth-pair-${i}`,
    sides: [`synth-p${i}a`, `synth-p${i}b`],
    selection_note: 'synthetic',
  }))
  const draw = (i, d) => [
    obs(`synth-p${i}a`, { pairing: `synth-pair-${i}`, draw: `synth-pair-${i}-${d}`, observer: `draw-${d}` }),
    obs(`synth-p${i}b`, { pairing: `synth-pair-${i}`, draw: `synth-pair-${i}-${d}`, observer: `draw-${d}` }),
  ]
  const once = [1, 2, 3, 4, 5].flatMap(i => draw(i, 1))
  const thrice = [1, 2, 3, 4, 5].flatMap(i => [...draw(i, 1), ...draw(i, 2), ...draw(i, 3)])

  const a = grab(report({ corpus, results: once, pairings }), 'falsely refused')
  const b = grab(report({ corpus, results: thrice, pairings }), 'falsely refused')

  ok(a !== null && b !== null, 'both reports print a false-refusal interval')
  if (a && b) {
    ok(a.n === 5, `five declared pairings drawn once reads as a denominator of 5 (got ${a.n})`)
    ok(b.n === 5, `the same five pairings drawn three times each is still five pairings (got ${b.n}) — this is the exact move that halved the real figure on 2026-08-26`)
    ok(a.ci === b.ci, `the interval does not move: ${a.ci} vs ${b.ci}`)
  }
}

console.log('interval-unit: stating what this file does NOT establish')
console.log('          NOT MEASURED: whether the interval is the RIGHT interval. Wilson over')
console.log('          distinct units is still a bound on a corpus nobody sampled — selection bias')
console.log('          (#38) is untouched by anything here, and a rate over five artifacts someone')
console.log('          chose is not a rate over artifacts the probe will meet.')

if (failures) {
  console.error(`\ninterval-unit: ${failures} failure(s) — a rate is being computed over repeats of its own unit.`)
  process.exit(1)
}
console.log('\ninterval-unit: OK — intervals move only when the corpus does.')
