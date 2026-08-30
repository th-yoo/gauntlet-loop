// Turn a run's history into q-trials, and q-trials into an interval on p.
//
// ISSUE 21. `q` was measured once — five identical judges on one unchanged
// near-boundary pair split 3-2 — and the interval on p runs from 0.05 to 0.85.
// Worked through the exit arithmetic that spans "the tunnel buys nothing" (N=1)
// to "the tunnel is unaffordable" (N=19), so a point estimate of 0.4 would
// hard-code a design decision the data does not support in either direction.
// Narrowing it directly needs ~92 trials at ~44k tokens each — about 4M tokens,
// for one artifact pair, one model family, one side assignment.
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
//   arm-confirm  — #18's confirmation. A win ARMS the exit; the next round spawns
//     a FRESH critic against the UNCHANGED artifact with the sides flipped, and
//     only a second win fires. That is two independently spawned judges on
//     identical bytes at opposite positions: exactly the paired observation q
//     needs, produced by every armed run at k=1, at no additional cost.
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
        minority: Math.min(against, positions.length - against),
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
      minority: a.candidateWon === second.candidateWon ? 0 : 1,
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
// THE ESTIMATE. p is the probability a fresh judge lands on the minority side of
// the same artifact — the quantity #20 measured once at 2/5 and #21 says nothing
// has narrowed since.
// --------------------------------------------------------------------------
export function wilson(k, n, z = 1.96) {
  if (!n) return [0, 1]
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n)
  const m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)]
}

// N such that a false exit costs at most `target` per round, at disagreement
// probability p. DERIVED, never tabulated: the table in issue 21 is what this
// function returns at p = 0.05, 0.40 and 0.85, and a table would go stale the
// moment p moved, which is the whole point of accumulating.
export function impliedN(p, target = 0.05) {
  if (!(p > 0)) return 1                    // a judge that never dissents needs no line
  if (p >= 1) return Infinity               // a coin that always dissents is never safe
  return Math.max(1, Math.ceil(Math.log(target) / Math.log(p)))
}

export function estimate(trials, target = 0.05) {
  // THE UNIT IS A JUDGE, because that is the unit impliedN consumes: p^N is the
  // chance N judges all err independently. This counted disagreeing PANELS over
  // panels (#70), and the two are not the same number — the first real ingest this
  // repository did was two panels of two, split 1-1, which reads 2/2 = 100% and
  // Infinity critics as a panel rate and 2/4 = 50% and five critics as a judge
  // rate. It printed the first, under the headline that no affordable N reaches
  // the bar.
  //
  // It survived because the test beside it built five trials of five judges and
  // asserted 0.4, calling that "#20's 2/5" — 2 panels over 5 panels prints the same
  // digits as 2 judges over 5 judges, and the coincidence made the wrong unit look
  // right.
  //
  // A unanimous panel contributes its judges to the denominator and nothing to the
  // numerator; dropping it would be the same defect one level in.
  const nTrials = trials.length
  const n = trials.reduce((s, t) => s + (t.judges || 0), 0)
  const k = trials.reduce((s, t) => s + (t.minority || 0), 0)
  const p = n ? k / n : null
  const [lo, hi] = wilson(k, n)
  // POSITION BIAS, SEPARATED. Every trial puts judges on both sides — arm-confirm
  // by construction, within-round by (round + index) parity — so the candidate's
  // win rate per side is readable without a separate study. If it differs, the
  // disagreement being measured is partly the position and not the judge.
  const bySide = {}
  for (const t of trials) {
    for (const side of Object.keys(t.judgements_by_side || {})) {
      bySide[side] = bySide[side] || { judgements: 0, candidate_wins: 0 }
      bySide[side].judgements += t.judgements_by_side[side]
      bySide[side].candidate_wins += (t.candidate_wins_by_side || {})[side] || 0
    }
  }
  return {
    trials: nTrials,
    judges: n,
    // KEPT SEPARATE from `disagreements`, which is now a judge count. A reader
    // comparing runs needs to see how many panels split as well as how many judges
    // dissented, and collapsing the two is what produced #70.
    split_panels: trials.filter(t => t.disagreed).length,
    disagreements: k,
    p,
    wilson: n ? [lo, hi] : null,
    // The interval's ENDS are what issue 21 is about: the point estimate is not
    // the finding, the span is.
    N_at_point: p === null ? null : impliedN(p, target),
    N_at_low: n ? impliedN(lo, target) : null,
    N_at_high: n ? impliedN(hi, target) : null,
    target,
    by_side: bySide,
    by_kind: trials.reduce((m, t) => { m[t.kind] = (m[t.kind] || 0) + 1; return m }, {}),
  }
}
