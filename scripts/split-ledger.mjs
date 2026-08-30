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
  console.log(`split-ledger: ${e.trials} trial(s) — ${JSON.stringify(e.by_kind)}${e.legacy_rows ? ` — plus ${e.legacy_rows} row(s) from before issue 71 that carry no for/against counts, NOT counted; regenerate the ledger from its verdicts with --ingest` : ''}`)
  if (!e.trials) {
    // THE RESIDUAL ON THE EMPTY BRANCH, which is the branch this is on today and
    // the one where a silent report would be most misleading.
    console.log('split-ledger: disagreement is UNMEASURED here. Nothing has been ingested, so this says')
    console.log('              nothing about the critic and does not narrow #20\'s one panel of five.')
    console.log('              An empty ledger is an empty ledger, never a low disagreement rate.')
    return
  }
  const pct = x => `${(x * 100).toFixed(0)}%`
  // THE UNITS ARE IN THE LINE. The old line printed a per-judge rate that moved
  // with k (#71) and before that a per-panel rate under a per-judge label (#70);
  // each read as a result. What is measured is pairs, over panels.
  console.log(`split-ledger: discordance d = ${pct(e.d)} of judge PAIRS on the same bytes disagreed, over ${e.trials} PANEL(s) (${e.judges} judges; ${e.split_panels} panel(s) split)   Wilson 95% CI ${pct(e.d_wilson[0])}–${pct(e.d_wilson[1])}`)
  console.log(`split-ledger: by k — ${Object.entries(e.by_k).map(([k, v]) => `k=${k}: d=${pct(v.d)} over ${v.panels} panel(s)`).join('; ')}`)
  console.log('              d has the same expectation at every k for independent judges, so these are poolable;')
  console.log('              a d that drifts with k as panels accumulate says the judges are not independent.')
  console.log(`split-ledger: per-judge error q = ${pct(e.q)}   (CI ${pct(e.q_wilson[0])}–${pct(e.q_wilson[1])}) — IF a judge beats a coin. d = 2q(1-q) has two`)
  console.log('              roots, q and 1-q, and disagreement cannot tell a judge right 80% of the time from one')
  console.log('              right 20% of the time. This takes the root below one half. That is an assumption about')
  console.log('              the judge; the only ground-truthed q here is the detection rate on planted defects')
  console.log('              (docs/runs/2026-08-27-detection-rate/), and none exists for "which artifact is better".')
  if (e.d_above_half) {
    console.log(`              d = ${pct(e.d)} is above 50%, more disagreement than independent judges can produce in`)
    console.log('              expectation. At this many panels that is noise; if it stays above one half as panels')
    console.log('              accumulate, the independent-judge model is wrong and q is not defined by d at all.')
  }
  console.log(`split-ledger: critics needed for a <=${pct(e.target)} false exit — ${e.N_at_low} at the low end of the interval, ${e.N_at_point} at the point estimate, ${e.N_at_high} at the high end`)
  // ISSUE 21'S TWO FALSIFIERS, COMPUTED FROM THE ENDS OF THE INTERVAL. "Splits
  // converging on near-unanimity" is the HIGH end needing one critic: even the
  // pessimistic reading says the line buys nothing, and #20's composition should
  // close. "Splits staying near 50/50" is the LOW end: the cheapest line the data
  // allows, which is a cost the operator judges — no number here decides what is
  // affordable. Anything else is an interval this many panels does not decide.
  //
  // This used to print "no affordable N reaches it, which falsifies the
  // composition" whenever the HIGH end exceeded 10 — a hand-picked cutoff applied
  // to the wrong end, so two panels with a wide interval read as a falsification.
  // A wide interval falsifies nothing; it says the panels are few.
  const verdict = e.N_at_high === 1
    ? 'FALSIFIER 1 MET: even the high end of the interval needs one critic — the splits have converged on unanimity, the line buys nothing, and the composition in #20 is unjustified by this data'
    : `neither falsifier decided: the interval spans ${e.N_at_low} to ${e.N_at_high} critics. The cheapest line this data allows is ${e.N_at_low}${e.N_at_low === 1 ? ' — at the low end a single critic already clears the bar' : ''}; whether ${e.N_at_low} per round is affordable is the operator's cost to judge, and a low end that stays unaffordable as panels accumulate is falsifier 2 (the blind A/B is the wrong terminator, not an under-parameterised one)`
  console.log(`split-ledger: ${verdict}`)
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
  console.log('              NOT ESTABLISHED — which side of any split was RIGHT. d measures disagreement;')
  console.log('              q is what it implies for a judge assumed to beat a coin, and nothing here tests that.')
}

if (!has('--ingest') && !has('--report')) {
  console.error('usage: node scripts/split-ledger.mjs --ingest <verdict.json> [--run <token>] | --report')
  process.exit(2)
}
if (has('--ingest')) ingest()
if (has('--report')) report()
