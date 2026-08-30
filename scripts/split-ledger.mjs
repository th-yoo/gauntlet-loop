// Accumulate the loop's own splits so p narrows without buying a study.
//
//   node scripts/split-ledger.mjs --ingest <verdict.json> [--run <token>]
//   node scripts/split-ledger.mjs --report
//
// ISSUE 21's fourth requirement. The first three are already in loop.js:
// `args.critics` is a run parameter, every round records its split and each
// critic's margin, and every position carries the side it judged from. What was
// missing is the accumulation — without it the recorded splits are a diary, p
// stays where #20 left it at 2/5, and the interval keeps spanning "the tunnel
// buys nothing" to "the tunnel is unaffordable".
//
// Narrowing p directly needs ~92 trials at ~44k tokens each: about 4M tokens, more
// than every run this repository has ever done combined, to set one parameter. The
// loop was going to spawn those critics anyway. This reads them.
//
// NOTHING HERE SPAWNS. Verdict JSON in, one JSONL row per trial out.

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { extractTrials, estimate, trialKey, wilson } from './split-extract.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const has = f => argv.includes(f)
const val = (f, d) => { const i = argv.indexOf(f); return i === -1 ? d : argv[i + 1] }
const LEDGER = process.env.SPLIT_LEDGER || join(ROOT, 'runs', 'splits.jsonl')

const read = () => existsSync(LEDGER)
  ? readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
  : []

function ingest() {
  const path = val('--ingest')
  if (!path || !existsSync(path)) { console.error(`ingest: no verdict at ${path}`); process.exit(2) }
  const verdict = JSON.parse(readFileSync(path, 'utf8'))
  const token = val('--run', verdict.run || verdict.token || path)
  const found = extractTrials(verdict, token)
  // DEDUPED BY UNIT. Re-ingesting a verdict must not inflate the denominator —
  // a rate over rows counts how many times the file was read, and this repository
  // halved a confidence interval once by getting that distinction wrong.
  const seen = new Set(read().map(trialKey))
  const fresh = found.filter(t => !seen.has(trialKey(t)))
  mkdirSync(dirname(LEDGER), { recursive: true })
  for (const t of fresh) appendFileSync(LEDGER, JSON.stringify(t) + '\n')
  console.log(`ingest: ${found.length} trial(s) in the verdict, ${fresh.length} new, ${found.length - fresh.length} already recorded`)
  if (!found.length) {
    console.log('ingest: this run produced no paired observation — no round armed, and args.critics was 1.')
    console.log('        That is not a failure. A run whose candidate never wins never arms, and a')
    console.log('        single critic per round is one judge rather than a split.')
  }
}

function report() {
  const trials = read()
  const e = estimate(trials)
  console.log(`split-ledger: ${e.trials} trial(s) — ${JSON.stringify(e.by_kind)}`)
  if (!e.trials) {
    // THE RESIDUAL ON THE EMPTY BRANCH, which is the branch this is on today and
    // the one where a silent report would be most misleading.
    console.log('split-ledger: p is UNMEASURED here. Nothing has been ingested, so this says nothing')
    console.log('              about the critic and does not narrow #20\'s 2/5. The interval still spans')
    console.log('              N=1 ("the tunnel buys nothing") to N=19 ("the tunnel is unaffordable").')
    console.log('              An empty ledger is an empty ledger, never a low disagreement rate.')
    return
  }
  const pct = x => `${(x * 100).toFixed(0)}%`
  // THE UNITS ARE IN THE LINE, because printing "2/2" over trials while the
  // arithmetic below consumes a per-judge rate is how #70 read as a result.
  console.log(`split-ledger: dissent p = ${e.disagreements}/${e.judges} JUDGES = ${pct(e.p)}   Wilson 95% CI ${pct(e.wilson[0])}–${pct(e.wilson[1])}`)
  console.log(`split-ledger: over ${e.trials} trial(s), of which ${e.split_panels} panel(s) split`)
  console.log(`split-ledger: critics needed for a <=${pct(e.target)} false exit — ${e.N_at_low} at the low end of the interval, ${e.N_at_point} at the point estimate, ${e.N_at_high} at the high end`)
  if (e.N_at_low === 1) console.log('              At the low end a single critic already clears the bar, so the line buys nothing.')
  if (!Number.isFinite(e.N_at_high) || e.N_at_high > 10) console.log('              At the high end no affordable N reaches it, which falsifies the composition rather than tuning it.')
  console.log('split-ledger: position breakdown (candidate wins / judgements, by the side it was on)')
  for (const [side, s] of Object.entries(e.by_side)) {
    console.log(`              side ${side}: ${s.candidate_wins}/${s.judgements}${s.judgements ? ` = ${pct(s.candidate_wins / s.judgements)}` : ''}`)
  }
  const sides = Object.values(e.by_side)
  if (sides.length === 2 && sides.every(s => s.judgements > 0)) {
    const gap = Math.abs(sides[0].candidate_wins / sides[0].judgements - sides[1].candidate_wins / sides[1].judgements)
    // WHETHER THE GAP MEANS ANYTHING IS COMPUTED, not asserted and not thresholded.
    // This line used to read "disagreement this large is position, not judge
    // variance" unconditionally, and it printed that under a gap of 0% — a sentence
    // emitted whatever the number says cannot be wrong, so it cannot inform, and
    // here it stated the reverse of what the number meant.
    //
    // A hand-picked cut-off would be the same defect wearing arithmetic: a
    // parameter fitted to whichever case prompted it. What decides instead is the
    // same wilson() the rest of this instrument runs on. Two intervals that overlap
    // are two rates this many trials cannot tell apart; the verdict flips on its
    // own as trials accumulate, which is the whole design of issue 21.
    const [aLo, aHi] = wilson(sides[0].candidate_wins, sides[0].judgements)
    const [bLo, bHi] = wilson(sides[1].candidate_wins, sides[1].judgements)
    const overlap = aLo <= bHi && bLo <= aHi
    console.log(`              between-side gap ${pct(gap)}`)
    console.log(`              side intervals ${pct(aLo)}-${pct(aHi)} and ${pct(bLo)}-${pct(bHi)}`)
    console.log(overlap
      ? '              they OVERLAP, so this set does not separate position from judge variance — the gap is not evidence of either, at this many judgements'
      : '              they do NOT overlap, so the sides differ by more than sampling noise at this n; position is what the two groups differ by, and is the candidate explanation')
  }
  console.log('split-ledger: NOT ESTABLISHED — these trials come from whatever runs happened to be')
  console.log('              ingested. There is no sampling frame over artifacts, models or goals, so')
  console.log('              the interval is about THIS set of runs and generalises only as far as it does.')
}

if (!has('--ingest') && !has('--report')) {
  console.error('usage: node scripts/split-ledger.mjs --ingest <verdict.json> [--run <token>] | --report')
  process.exit(2)
}
if (has('--ingest')) ingest()
if (has('--report')) report()
