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
// ORACLE_CORPUS / ORACLE_RESULTS, same as the other two tools — a test asserting on
// cohort grouping needs ledgers it can construct, and must never write the real ones.
const LEDGER = { 'corpus.jsonl': process.env.ORACLE_CORPUS, 'results.jsonl': process.env.ORACLE_RESULTS }
const read = f => {
  const p = LEDGER[f] || join(ROOT, 'oracle', f)
  return existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : []
}

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
  // GROUPED BY TEMPLATE. Grouping by prompt_hash put every row in its own cohort,
  // because the goal and artifact path are interpolated into the prompt — the tool
  // reported four cohorts of one on a four-row corpus. An observation predating the
  // template hash has none; it belongs to an unknown instrument and is reported as
  // its own cohort rather than silently folded into a current one.
  const k = `${r.template_hash || 'template-unknown:' + (r.prompt_hash || 'none')}|${r.schema_fingerprint}`
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
    const all = rs.filter(r => r.arm === arm)
    if (!all.length) continue
    // DISPUTED rows are excluded from the rate and reported on their own. Their ground
    // truth is contested — two independent classifiers disagreed about what the
    // artifact emitted — so scoring an observation against one costs a choice of side,
    // and that choice is the authored answer key this corpus exists to replace. A
    // disagreement is a finding, not a data point to be averaged in.
    const contested = all.filter(r => r.disputed)
    const a = all.filter(r => !r.disputed)
    if (!a.length) {
      console.log('')
      console.log(`   ${arm} arm`)
      console.log(`     observations      ${all.length}, ALL DISPUTED — no rate, and that is the finding`)
      for (const c of contested) console.log(`       ${c.row}: classifiers disagreed on what it emitted`)
      continue
    }
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

    // ANSWER STABILITY, which this report has been listing as unestablished since it
    // was written. Accuracy and stability are different questions and the same rows
    // answer both: a row drawn twice that comes back differently is unstable, whether
    // or not either draw was correct. One draw per row cannot tell a systematic bias
    // from a coin landing the same way twice, so a flip rate is the only thing that
    // separates them — and until it is MEASURED, reporting it as zero would be
    // assuming exactly what needs checking.
    const byRow = new Map()
    for (const o of a) {
      if (!byRow.has(o.row)) byRow.set(o.row, [])
      byRow.get(o.row).push(o.predicted_role)
    }
    const redrawn = [...byRow.entries()].filter(([, v]) => v.length > 1)
    const flipped = redrawn.filter(([, v]) => new Set(v).size > 1)
    if (!redrawn.length) {
      console.log(`     answer stability  NOT MEASURED — every row has one draw, so a wrong answer`)
      console.log(`                       cannot be told from a fluke. Re-run a row to find out.`)
    } else {
      console.log(`     answer stability  ${flipped.length}/${redrawn.length} redrawn row(s) FLIPPED between draws`)
      for (const [row, v] of flipped) console.log(`       ${row}: ${v.join(' then ')}`)
      if (!flipped.length) {
        console.log(`                       ${redrawn.length} row(s) drawn twice, none flipped. At this many redraws that`)
        console.log(`                       bounds instability loosely, and says nothing about the rows never redrawn.`)
      }
    }
    if (contested.length) {
      console.log(`     DISPUTED          ${contested.length}, excluded from the rate above — contested ground truth is a finding, not a data point`)
      for (const c of contested) console.log(`       ${c.row}`)
    }
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
        // DERIVED FROM THE INTERVAL, NOT THE POINT. The first real run of this branch
        // printed "~0% would be falsely refused" off a point estimate of 0/6 — a bare
        // point estimate, in the one tool here whose whole purpose is refusing those,
        // and it read as "this is safe" while the interval above it reached 39%.
        //
        // 2p(1-p) is not monotonic: it rises to 0.5 at p=0.5 and falls after. So the
        // range is taken over the CI's endpoints AND p=0.5 when the interval contains
        // it, rather than by mapping the endpoints and hoping.
        const f2 = q => 2 * q * (1 - q)
        const pts = [ci[0], ci[1], ...(ci[0] <= 0.5 && 0.5 <= ci[1] ? [0.5] : [])].map(f2)
        const lo = Math.min(...pts), hi = Math.max(...pts)
        console.log(`     derived per-run   ${pct(lo)}–${pct(hi)} of two-does-the-work pairings would be falsely refused,`)
        console.log(`       false refusal   carried through from the interval above rather than from the point`)
        console.log(`                       estimate, and ASSUMING the two sides fail independently — an assumption`)
        console.log(`                       nothing here measures, and probably false: same model, same run. Secondary.`)
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
