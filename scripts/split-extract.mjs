// Turn a run's history into panel trials, and panel trials into an interval on
// the judges' disagreement — and, under one stated assumption, on their error.
//
// ISSUE 21. `q` was measured once — five identical judges on one unchanged
// near-boundary pair split 3-2 — and the interval on it was wide enough to span
// "the tunnel buys nothing" (N=1) to "the tunnel is unaffordable" (N=19), so a
// point estimate would hard-code a design decision the data does not support in
// either direction. Narrowing it directly needs ~92 trials at ~44k tokens each —
// about 4M tokens, for one artifact pair, one model family, one side assignment.
//
// ISSUE 71 — WHAT IS ESTIMATED, AND WHY THE OLD ESTIMATOR COULD NOT BE POOLED.
// This file used to score a panel by min(against, k - against): the minority
// side, taken to be the side that erred. That is the question the panel exists to
// answer, borrowed as its own premise, and it produced two symptoms from one
// cause: the rate was biased low (0.240 against a true 0.4 at k=2) and it moved
// with k (0.342 at k=9), so trials from runs at different critic counts could not
// be pooled and a loop deriving N from its own splits would raise k, read a higher
// rate, derive a larger N, and raise k again.
//
// The estimand now is DISCORDANT PAIRS PER PAIR: for a panel of k judges with
// `for` picking the candidate and `against` not, for*against of the k(k-1)/2
// pairs disagree. For judges erring independently with probability q its
// expectation is 2q(1-q) at EVERY k — computed exactly in test/split-extract.test.mjs
// against the binomial, beside the two rates it replaces, which drift. So panels
// from k=2 and k=9 are samples of one quantity and pooling them is sound, and a
// derived N cannot feed back into the rate it was derived from.
//
// WHAT IT STILL CANNOT DO, and it is stated in the report on every branch:
// disagreement is symmetric in q and 1-q. A panel of judges right 80% of the time
// and a panel right 20% of the time disagree at exactly the same rate. Recovering
// q from d picks the root below one half — a judge that beats a coin — and that is
// an ASSUMPTION about the judge, not a measurement of it. The only ground-truthed
// q this repository holds is the detection rate on planted defects (12/15,
// docs/runs/2026-08-27-detection-rate/), and it is what makes the assumption
// reasonable rather than proven. No equivalent exists for "which of two artifacts
// is better", which is the judgement the loop actually makes.
//
// The issue's answer was to stop buying the study and let the loop pay for it:
// every round already spawns the critics, so record the splits and accumulate
// them. Three of its four requirements are already in loop.js — `args.critics` is
// a run parameter, every round records `split.for_candidate` /
// `split.against_candidate`, and every position carries its `side` and `margin`.
// The fourth was not: nothing accumulated them, so p never narrowed.
//
// TWO TRIAL SHAPES, and the second is why this works at the DEFAULT k=1.
//
//   within-round — k judges on the same bytes in one round. Available only when
//     the operator sets args.critics > 1.
//   arm-confirm  — #18's confirmation. A WOWED win ARMS the exit; the next round
//     spawns a FRESH critic against the UNCHANGED artifact with the sides flipped,
//     and only a second wowed win fires. That is two independently spawned judges
//     on identical bytes at opposite positions: exactly the paired observation q
//     needs, produced by every armed run at k=1, at no additional cost.
//
//     THE POPULATION CHANGED AT DECISION 0007 and pooling has to account for it.
//     Arming used to require only that the candidate won; it now also requires that
//     no critic called the margin narrow. So panels collected after 0007 are
//     CONDITIONED on a non-narrow first verdict, and panels collected before it are
//     not. If a decisive first verdict is more reproducible than a narrow one — the
//     obvious hypothesis, and untested — then d measured on the new population is
//     biased low against the old. Nothing here can detect that from the rows, so
//     the report DISCLOSES the mix rather than correcting for it.
//
//     ALSO UNCOLLECTED, and named so it is not mistaken for an oversight: a round
//     that is not wowed and whose critic names no shortfall skips its build, so the
//     NEXT round judges identical bytes with a fresh critic — another paired
//     observation, free, that `h.armed` does not gate in. Collecting it would widen
//     the population again, which is a decision about what this instrument measures
//     and belongs in a decision record, not in a parser.
//
// The arm-confirm shape postdates this issue. It is the reason the accumulator is
// worth building at the default k rather than only for operators who raise it.
//
// THIS COMMENT USED TO SAY k>1 "HAS NEVER BEEN RUN", AND IT HAD. A verdict from
// 2026-08-26 carries `critics=2` on both of its pieces and two positions a round,
// so two within-round trials were sitting unread while the text beside the reader
// said the shape was hypothetical. The claim is removed rather than corrected to a
// new count: how many runs of each shape exist is derivable from the ledger, and a
// derivable fact restated in a comment is one nothing recomputes. `--report`
// prints `by_kind`, which is the recomputation.
//
// NOTHING HERE SPAWNS, READS, OR WRITES. Verdict in, trials out.

// A trial is identified by (run token, rounds involved) so re-ingesting a run
// cannot inflate the denominator. Rates count UNITS, not repeats — redrawing the
// same case halved a confidence interval in this repository once.
// THE PIECE IS PART OF THE IDENTITY. Two pieces of one decomposition arm and
// confirm on the SAME round numbers — one@r1->r2 and two@r1->r2 — so a key of
// (run, kind, rounds) collides and the ledger silently drops one of two genuine
// observations. A deduplicating key that is too coarse does not inflate the
// denominator; it shrinks it, which is the harder direction to notice.
export function trialKey(t) {
  return [t.run, t.kind, t.piece || '-', ...t.rounds].join(' ')
}

export function extractTrials(verdict, run) {
  const history = (verdict && verdict.history) || []
  const out = []
  const token = run || (verdict && verdict.run) || 'unknown-run'

  for (let i = 0; i < history.length; i++) {
    const h = history[i]
    const positions = (h.split && h.split.positions) || []

    // WITHIN-ROUND. One trial per round that ran more than one critic. A single
    // critic is not a split — it is one judge, and counting it as a unanimous
    // panel of one would put a 0-disagreement observation into the denominator
    // for free, which is the cheapest possible way to make p look small.
    if (positions.length > 1) {
      const against = positions.filter(p => !p.candidateWon).length
      out.push({
        run: token, kind: 'within-round', rounds: [h.round], piece: h.piece || null,
        judges: positions.length,
        // BOTH COUNTS, NEITHER CALLED THE ERROR. Which side erred is not known here,
        // and a field named `minority` was the place that assumption used to hide.
        for_candidate: positions.length - against,
        against_candidate: against,
        disagreed: against > 0 && against < positions.length,
        sides: positions.map(p => p.side),
        candidate_wins_by_side: positions.reduce((m, p) => {
          m[p.side] = (m[p.side] || 0) + (p.candidateWon ? 1 : 0); return m
        }, {}),
        judgements_by_side: positions.reduce((m, p) => { m[p.side] = (m[p.side] || 0) + 1; return m }, {}),
      })
    }

    // ARM-CONFIRM. The arming round and the one after it judge the SAME bytes —
    // loop.js does not build while armed, which is what makes the pair a paired
    // observation rather than two looks at two artifacts.
    if (!h.armed) continue
    // THE CONFIRMING ROUND IS THE NEXT ONE FOR THE SAME PIECE, not the next entry
    // in history. With a decomposition, pieces interleave — history reads
    // one@r1(armed), two@r1(armed), one@r2(confirmed), two@r2(confirmed) — so
    // adjacency pairs piece two's ARM with piece one's CONFIRM. Two different
    // artifacts, judged by two critics, recorded as one paired observation of the
    // same bytes; and piece one's real pair is dropped, because its neighbour is
    // piece two's arm.
    //
    // Found by building a two-piece run, not by reading this loop. The
    // single-piece case — every run so far — cannot distinguish the two rules.
    const next = history.slice(i + 1).find(x => x.piece === h.piece)
    if (!next) continue                      // armed at the last round for this piece: no second look
    const a = positions[0], b = (next.split && next.split.positions) || []
    if (!a || b.length === 0) continue
    const second = b[0]
    // WHAT MAKES THE PAIR SOUND, and where that property is actually guarded.
    //
    // The two rounds are a paired observation only if no build happened between
    // them. That is loop.js's behaviour — it arms without building, so the
    // confirming critic judges the same bytes — and it is asserted at
    // test/exit-confirmation.test.mjs:86 ("neither the arming round nor the
    // confirming round builds, so the artifact is unchanged across the
    // confirmation").
    //
    // This file used to re-check it here, requiring the next entry to be
    // `confirmed` or disarmed from this round. Once the lookup became
    // piece-scoped that branch became unreachable: the next entry for a piece
    // that armed is always its confirm or its disarm. A guard that cannot fire is
    // a guard nothing can test, and a second copy of a property guarded elsewhere
    // is the duplication that has cost this repository three defects already. The
    // property is pinned once, at its source, and depended on here.
    out.push({
      run: token, kind: 'arm-confirm', rounds: [h.round, next.round], piece: h.piece || null,
      judges: 2,
      for_candidate: (a.candidateWon ? 1 : 0) + (second.candidateWon ? 1 : 0),
      against_candidate: (a.candidateWon ? 0 : 1) + (second.candidateWon ? 0 : 1),
      disagreed: a.candidateWon !== second.candidateWon,
      sides: [a.side, second.side],
      candidate_wins_by_side: {
        [a.side]: (a.candidateWon ? 1 : 0),
        [second.side]: (second.candidateWon ? 1 : 0),
      },
      judgements_by_side: { [a.side]: 1, [second.side]: 1 },
    })
  }
  return out
}

// --------------------------------------------------------------------------
// THE ESTIMATE. d is the discordant-pair rate — of the pairs of judges that saw
// the same bytes, the fraction that disagreed. It is what the panels measure
// directly, at any k. q is the per-judge error it implies IF a judge beats a coin,
// and N is what impliedN makes of q.
// --------------------------------------------------------------------------
export function wilson(k, n, z = 1.96) {
  if (!n) return [0, 1]
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n)
  const m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)]
}

// N such that a false exit costs at most `target` per round, at per-judge error
// q. DERIVED, never tabulated: the table in issue 21 is what this function
// returns at q = 0.05, 0.40 and 0.85, and a table would go stale the moment q
// moved, which is the whole point of accumulating.
export function impliedN(q, target = 0.05) {
  if (!(q > 0)) return 1                    // a judge that never errs needs no line
  if (q >= 1) return Infinity               // a judge that always errs is never safe
  return Math.max(1, Math.ceil(Math.log(target) / Math.log(q)))
}

// A panel's discordant-pair fraction: for*against disagreeing pairs of the
// k(k-1)/2 the panel contains. A panel of two is one pair, so this is 0 or 1.
export function discordance(t) {
  const k = t.for_candidate + t.against_candidate
  const pairs = k * (k - 1) / 2
  return pairs ? (t.for_candidate * t.against_candidate) / pairs : null
}

// d -> q under the assumption q <= 1/2. d = 2q(1-q) has two roots, q and 1-q,
// and disagreement cannot tell them apart; this takes the one that says the
// judge beats a coin. Above d = 1/2 no q produces it in expectation — more
// disagreement than independent judges can have — and q is reported at 1/2.
export function errorFromDiscordance(d) {
  if (d === null || !(d >= 0)) return null
  if (d >= 0.5) return 0.5
  return (1 - Math.sqrt(1 - 2 * d)) / 2
}

export function estimate(trials, target = 0.05) {
  // ONLY ROWS THAT CARRY BOTH COUNTS. A row from before issue 71 carries `minority`
  // and neither count; the counts are not recoverable from it, and reading it as
  // anything would be reading the assumption this estimator exists to remove.
  // Such rows are counted and named so the ledger can be regenerated from its
  // verdicts, which is one command.
  const usable = trials.filter(t => Number.isInteger(t.for_candidate) && Number.isInteger(t.against_candidate) && t.for_candidate + t.against_candidate >= 2)
  const legacy = trials.length - usable.length
  // THE UNIT IS A PANEL. The pairs inside a panel share judges and are not
  // independent, so the pair count is not a sample size; each panel is one
  // observation of a bounded quantity, and the interval is over panels.
  const n = usable.length
  const sum = usable.reduce((s, t) => s + discordance(t), 0)
  const d = n ? sum / n : null
  const [dLo, dHi] = wilson(sum, n)
  const q = errorFromDiscordance(d)
  // PER k, because the model's one falsifiable prediction is that d does not move
  // with k. Rates that drift across this table are what issue 71 found; a d that
  // drifts would say the independent-judge model is wrong, not that k matters.
  const by_k = {}
  for (const t of usable) {
    const k = t.for_candidate + t.against_candidate
    by_k[k] = by_k[k] || { panels: 0, discordance_sum: 0 }
    by_k[k].panels++
    by_k[k].discordance_sum += discordance(t)
  }
  for (const k of Object.keys(by_k)) { by_k[k].d = by_k[k].discordance_sum / by_k[k].panels; delete by_k[k].discordance_sum }
  // POSITION BIAS, SEPARATED. Every trial puts judges on both sides — arm-confirm
  // by construction, within-round by (round + index) parity — so the candidate's
  // win rate per side is readable without a separate study. If it differs, the
  // disagreement being measured is partly the position and not the judge.
  const bySide = {}
  for (const t of usable) {
    for (const side of Object.keys(t.judgements_by_side || {})) {
      bySide[side] = bySide[side] || { judgements: 0, candidate_wins: 0 }
      bySide[side].judgements += t.judgements_by_side[side]
      bySide[side].candidate_wins += (t.candidate_wins_by_side || {})[side] || 0
    }
  }
  return {
    trials: n,
    legacy_rows: legacy,
    judges: usable.reduce((s, t) => s + t.for_candidate + t.against_candidate, 0),
    split_panels: usable.filter(t => t.for_candidate > 0 && t.against_candidate > 0).length,
    // d: what was measured. q: what it implies under the stated assumption.
    d,
    d_wilson: n ? [dLo, dHi] : null,
    q,
    q_wilson: n ? [errorFromDiscordance(dLo), errorFromDiscordance(dHi)] : null,
    d_above_half: d !== null && d > 0.5,
    // The interval's ENDS are what issue 21 is about: the point estimate is not
    // the finding, the span is.
    N_at_point: q === null ? null : impliedN(q, target),
    N_at_low: n ? impliedN(errorFromDiscordance(dLo), target) : null,
    N_at_high: n ? impliedN(errorFromDiscordance(dHi), target) : null,
    target,
    by_k,
    by_side: bySide,
    by_kind: usable.reduce((m, t) => { m[t.kind] = (m[t.kind] || 0) + 1; return m }, {}),
  }
}
