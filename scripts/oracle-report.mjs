// Tally the oracle observations, and refuse to say more than they support.
//
//   node scripts/oracle-report.mjs
//
// WHAT IS BEING BOUNDED. The pairing check refuses a run only when EXACTLY ONE side
// is classified `produces-an-instruction` (loop.js: `writers.length === 1`). So the
// only route to a false refusal is a genuinely does-the-work artifact misjudged as a
// writer, and the does-the-work arm measures that misjudgement directly.
//
// PER-SIDE ACCURACY IS THE PRIMARY NUMBER, not the refusal rate. The refusal rate is
// derived from it and only under an assumption — that the two sides of a real pairing
// fail independently — which is not measured anywhere and is probably false, since
// both sides are judged by the same model on the same day. And the derived figure is
// blind to a case the per-side figure is not: both sides misjudged as writers reads
// as `comparable`, so no refusal fires and a refusal-rate framing never sees it.
//
// Cohorts are NEVER pooled across prompt hashes. The prompt changed once and
// invalidated five of seven observations; blending an old cohort into a new rate
// would hide exactly that.

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = f => existsSync(join(ROOT, 'oracle', f))
  ? readFileSync(join(ROOT, 'oracle', f), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  : []

const corpus = read('corpus.jsonl')
const results = read('results.jsonl')

console.log('oracle report — the pairing check\'s roleOf classifier')
console.log('')
console.log(`corpus: ${corpus.length} row(s) — ${corpus.filter(r => r.arm === 'does-the-work').length} does-the-work, ${corpus.filter(r => r.arm === 'generator').length} generator`)

if (!results.length) {
  console.log('')
  console.log('NO OBSERVATIONS YET. The corpus is set up; nothing has been measured against it.')
  console.log('This question cannot be posed yet — and that is the honest reading, not a rate of zero.')
  process.exit(0)
}

// Group by instrument, then by arm. A cohort is (prompt_hash, schema_fingerprint).
const cohorts = new Map()
for (const r of results) {
  const k = `${r.prompt_hash}|${r.schema_fingerprint}`
  if (!cohorts.has(k)) cohorts.set(k, [])
  cohorts.get(k).push(r)
}

// Wilson score interval — a proportion with n in single digits has no meaningful
// point estimate, and a bare percentage invites one to be read anyway.
function wilson(k, n, z = 1.96) {
  if (!n) return null
  const p = k / n, d = 1 + z * z / n
  const c = (p + z * z / (2 * n)) / d
  const h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d
  return [Math.max(0, c - h), Math.min(1, c + h)]
}
const pct = x => `${(x * 100).toFixed(0)}%`

for (const [k, rs] of cohorts) {
  const [ph] = k.split('|')
  console.log('')
  console.log(`── instrument ${ph.slice(0, 23)}… ─────────────────────────`)
  if (cohorts.size > 1) console.log('   (cohorts are reported separately: a different prompt is a different instrument)')

  for (const arm of ['does-the-work', 'generator']) {
    const a = rs.filter(r => r.arm === arm)
    if (!a.length) continue
    const n = a.length
    const distinct = new Set(a.map(r => r.artifact)).size
    const wrong = a.filter(r => !r.correct)
    const ci = wilson(wrong.length, n)

    console.log('')
    console.log(`   ${arm} arm`)
    console.log(`     observations      ${n}`)
    // n_distinct is reported beside n because repeat executions of ONE artifact are
    // not independent evidence, and a rate computed over observations would let one
    // artifact measured twice masquerade as two.
    console.log(`     distinct artifacts ${distinct}${distinct < n ? '   <- the number that bears on any statistical claim' : ''}`)
    console.log(`     misclassified     ${wrong.length}`)
    for (const w of wrong) console.log(`       ${w.row}: expected ${w.expected_role}, got ${w.predicted_role}`)

    if (distinct < 5) {
      console.log(`     rate              CANNOT BE POSED — ${distinct} distinct artifact(s) supports no rate.`)
      if (wrong.length === 0) {
        // The rule of three is 3/n, which EXCEEDS 1 below n=3 — printing it raw gave
        // "up to about 300%", an impossible rate, in this tool's very first run. Capped,
        // and below n=3 the bound carries no information at all, so say that instead of
        // dressing a vacuous number as a result.
        const bound = 3 / n
        console.log(`                       ${wrong.length}/${n} wrong is consistent with a per-side error rate anywhere`)
        console.log(bound >= 1
          ? `                       up to 100% — at n=${n} the rule of three bounds nothing. Not evidence of accuracy.`
          : `                       up to about ${pct(bound)} (rule of three at n=${n}). Not evidence of accuracy.`)
      }
    } else {
      console.log(`     per-side error    ${wrong.length}/${n}, 95% CI [${pct(ci[0])}, ${pct(ci[1])}]  <- PRIMARY`)
      if (arm === 'does-the-work') {
        const p = wrong.length / n
        console.log(`     derived per-run   ~${pct(2 * p * (1 - p))} of two-does-the-work pairings would be falsely refused,`)
        console.log(`       false refusal   ASSUMING the two sides fail independently. That assumption is not`)
        console.log(`                       measured and is probably false — same model, same run. Secondary.`)
      }
    }
  }
}

console.log('')
console.log('WHAT THIS DOES NOT ESTABLISH')
console.log('  - Selection bias is not corrected. The corpus is whatever its builder chose to add;')
console.log('    the RELATION in each row is mechanical, the SELECTION of rows is not. Adding more')
console.log('    rows of the same kind does not fix this and can hide it.')
console.log('  - Answer stability. One observation per row is one draw. A wrong answer may be a')
console.log('    fluke rather than a bias, and nothing here separates them without repeat draws.')
console.log('  - Coverage. The classification rule is one rule, but which artifacts were put in')
console.log('    front of it is exactly the corpus and nothing more.')
