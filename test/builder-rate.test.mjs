// THE REPRODUCIBLE for #25 — the builder arm has never been validly measured.
//
//   node test/builder-rate.test.mjs
//
// COMMITTED FAILING.
//
// The only seeded-defect test of the loop ever run produced a FALSE PASS. A copy
// of SKILL.md with a 22-line section removed was placed in /tmp; the builder was
// asked to close the gap; it found the intact original at
// skills/gauntlet-loop/SKILL.md in the working tree and copied it, saying so in
// its own `ambiguity` field: "using the wording and position that appear in the
// real, undegraded SKILL.md for this same plugin". Nothing there is the builder's
// fault — it was asked to fix a gap and found the most accurate available source.
// The fault is in the test design, and gate 7 had written the rule before the
// panel carrying it was deleted.
//
// So the builder arm has no positive observation, and the one observation it does
// have is worse than none: a pass that measured a lookup.
//
// WHAT MAKES THIS MEASURABLE AT ALL — and it is not "try harder at sandboxing".
// Two leak channels exist and only one can be closed:
//
//   1. THE FILESYSTEM. Closed by staging outside this repository and confining
//      the spawn's cwd to its own trial directory. Checkable: search what the
//      builder can reach for the text that was removed, BEFORE spending on it.
//   2. THE MODEL'S OWN PRIOR. Not closable, by anyone, ever. Gate 7 said so:
//      "if the removed text is recoverable from public sources or the model's own
//      prior, no sandbox closes it and a tighter re-run yields a false pass".
//
// Channel 2 is why this file does not simply assert isolation and report a rate.
// It CROSSES the two defect classes against each other:
//
//   DERIVABLE   — inverted-constraint. A flipped `must`/`never`/`is not` leaves a
//                 sentence contradicting the document around it. The correct form
//                 is reconstructible from the artifact's own internal consistency,
//                 which is the capability actually under test.
//   UNDERIVABLE — factual-substitution. An arbitrary number moved to another
//                 arbitrary number. Nothing in the remaining text implies the
//                 original, so NO amount of reading reconstructs it.
//
// A builder working honestly under isolation can score on the derivable class and
// CANNOT score on the underivable one. So the underivable class is not a second
// data point — it is the instrument's own leak detector, and it must read at
// chance for the derivable number to mean anything. That is this repository's own
// rule turned on the builder arm: arrange the cases so an instrument reading the
// confound scores at chance, and COMPUTE the key rather than assert it.
//
// WHAT THIS FILE DOES NOT DO. It never spawns. The trials are run by a separate
// script, deliberately — and this sentence does not name it, because
// test/containment.test.mjs fails if
// anything the suite runs so much as names a spawner, because this repository
// produced a fork bomb the last time a live spawn sat where the suite could reach
// it. So this file names none and finds the ledger by path.

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LEDGER = process.env.BUILDER_LEDGER || join(ROOT, 'runs', 'builder.jsonl')

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }

// Low on purpose, and low for the same reason the detection floor is: a floor set
// where the evidence is comfortable rather than where it is sufficient is a floor
// that gets met by stopping early.
const MIN_DERIVABLE = 4
const MIN_UNDERIVABLE = 4

console.log('builder-rate: a ledger of builder trials that were actually run exists')
if (!existsSync(LEDGER)) {
  fail(`runs/builder.jsonl does not exist — the builder arm's only observation is the false pass in #25, where the builder recovered the removed section from this working tree instead of reconstructing it. A capability needs a set, and this one has none.`)
  console.error(`\nbuilder-rate: ${failures} failure(s) — a false pass is not a measurement.`)
  process.exit(1)
}

const rows = readFileSync(LEDGER, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l))
console.log(`          ${rows.length} trial(s) recorded`)

// --------------------------------------------------------------------------
// ISOLATION, CHECKED RATHER THAN ASSERTED — and checked per trial, because a
// blanket claim about a directory says nothing about the trial that was staged
// somewhere else by mistake.
// --------------------------------------------------------------------------
console.log('builder-rate: every trial records that the answer was unreachable, and how that was established')
// A ROW WITH LEAK HITS IS NOT A FAILURE OF THE LEDGER — it is the ledger doing
// its job, and the first version of this file failed on every such row. What must
// not happen is a row with hits being SCORED. So the requirement is conditional:
// hits imply void, void implies no score, and only the scored set must be clean.
for (const r of rows) {
  ok(r.void === true || r.void === false, `${r.trial_id} does not say whether it is void`)
  ok(Array.isArray(r.isolation_hits),
     `${r.trial_id} records no isolation search result — a search that reported nothing and a search that did not run are indistinguishable, and this repository has already had one leak search that silently found nothing`)
  const hits = Array.isArray(r.isolation_hits) ? r.isolation_hits.length : null
  if (hits === null || hits > 0 || r.isolation_checked !== true) {
    ok(r.void === true,
       `${r.trial_id} was scored although ${r.isolation_checked !== true ? 'its isolation search never ran' : 'the removed text was reachable at ' + JSON.stringify(r.isolation_hits)}. The one prior builder trial passed exactly this way.`)
  }
  if (r.void === false) {
    ok(r.isolation_checked === true && hits === 0,
       `${r.trial_id} is scored but does not show the answer was unreachable`)
  }
}

console.log('builder-rate: a void trial is recorded as void, never as a miss')
for (const r of rows) {
  if (r.void === true) ok(r.repaired === null,
    `${r.trial_id} is void and also records repaired=${r.repaired}. A trial whose answer was reachable measured nothing; scoring it either way puts a lookup into the rate.`)
}

// --------------------------------------------------------------------------
// THE CROSSING. Without it there is no reason to believe a repair was a repair.
// --------------------------------------------------------------------------
// UNITS, NOT ROWS. The transforms are deterministic, so re-staging a document
// reproduces the same plant and drawing it again adds a row carrying no new
// information. A rate over rows counts how many times the instrument was run; a
// rate over units counts how many distinct things it was run on, and only the
// second supports an interval. This repository halved a confidence interval once
// by getting that wrong.
//
// Repeats are KEPT — they measure draw-to-draw stability, which is a real and
// separate question — and the first row for each unit is the one that scores.
const allScored = rows.filter(r => r.void === false && (r.repaired === true || r.repaired === false))
const seenUnit = new Set()
const scored = []
const repeats = []
for (const r of allScored) {
  const k = r.unit_key
  ok(k, `${r.trial_id} carries no unit_key — without it a repeat is indistinguishable from a new observation, and the denominator is a count of runs rather than of cases`)
  if (k && seenUnit.has(k)) { repeats.push(r); continue }
  if (k) seenUnit.add(k)
  scored.push(r)
}
if (repeats.length) console.log(`          ${repeats.length} row(s) repeat a unit already scored (${repeats.map(r => r.trial_id).join(', ')}) — kept as evidence, excluded from the rate`)
const derivable = scored.filter(r => r.derivable === true)
const underivable = scored.filter(r => r.derivable === false)

console.log('builder-rate: both arms of the crossing are present and large enough to read')
console.log(`          derivable (reconstructible from the artifact): ${derivable.length}`)
console.log(`          underivable (leak detector, must read at chance): ${underivable.length}`)
ok(derivable.length >= MIN_DERIVABLE,
   `only ${derivable.length} derivable trial(s); ${MIN_DERIVABLE} is the floor. Below it the rate carries no interval worth quoting.`)
ok(underivable.length >= MIN_UNDERIVABLE,
   `only ${underivable.length} underivable trial(s); ${MIN_UNDERIVABLE} is the floor. Without them a repair rate cannot be told apart from a recall rate, which is exactly how the first builder trial passed.`)

console.log('builder-rate: every SCORED trial is traceable to the response it came from')
// Void trials are exempt by construction: they were refused BEFORE a spawn, so
// there is no response to point at and no prompt they were built under. Demanding
// one of them, as the first version of this file did, would push the instrument
// toward spawning trials it had already decided were worthless.
for (const r of rows.slice(0, 200)) {
  ok(r.trial_id, 'a trial carries an id')
  if (r.void === true) {
    ok(r.why_void, `void trial ${r.trial_id} does not say why it is void`)
    continue
  }
  ok(r.response && existsSync(join(ROOT, r.response)),
     `trial ${r.trial_id} names a response file that is not there (${r.response}) — an observation whose source is missing is an assertion`)
  ok(r.artifact_after && existsSync(join(ROOT, r.artifact_after)),
     `trial ${r.trial_id} does not keep the artifact it produced — the score is then unreproducible, and a scoring defect would cost live agents instead of a re-score`)
  ok(r.prompt_template_hash, `trial ${r.trial_id} carries the template hash of the prompt it was built under — trials run under different prompts are not one rate`)
}
{
  const hashes = [...new Set(rows.filter(r => r.void === false).map(r => r.prompt_template_hash))]
  ok(hashes.length <= 1, `${hashes.length} distinct prompt templates among the scored trials — trials built under different prompts cannot be pooled`)
}

console.log('builder-rate: a batch that is mostly void measured little, and says so')
{
  const voids = rows.filter(r => r.void === true).length
  const frac = rows.length ? voids / rows.length : 0
  console.log(`          void: ${voids}/${rows.length} = ${(frac * 100).toFixed(0)}%`)
  ok(frac <= 1 / 3,
     `${(frac * 100).toFixed(0)}% of trials are void. Void is the honest outcome for a trial whose answer was reachable, but a batch mostly made of them has bought very little, and the reasons are worth reading before spending again.`)
}

// --------------------------------------------------------------------------
// THE RATES, COMPUTED HERE. Not read back from a field the runner wrote: on
// 2026-08-27 a stored `detected` was the complement of the truth for twenty
// consecutive rows and every check that read it passed.
// --------------------------------------------------------------------------
console.log('builder-rate: the rates, computed from the ledger')
{
  const d = derivable.filter(r => r.repaired === true).length
  const u = underivable.filter(r => r.repaired === true).length
  const dRate = derivable.length ? d / derivable.length : 0
  const uRate = underivable.length ? u / underivable.length : 0
  // TWO FIELDS, NEVER ONE. `repaired` demands the original wording back;
  // `located` asks only whether the damaged line survived. A builder that fixes
  // the contradiction in its own words is repaired=false, located=true, and
  // reporting only the first calls that a miss — which it is not.
  const dLoc = derivable.filter(r => r.located === true).length
  const uLoc = underivable.filter(r => r.located === true).length
  console.log(`          derivable   — located ${dLoc}/${derivable.length}, restored exactly ${d}/${derivable.length} = ${(dRate * 100).toFixed(0)}%`)
  console.log(`          UNDERIVABLE — located ${uLoc}/${underivable.length}, restored exactly ${u}/${underivable.length} = ${(uRate * 100).toFixed(0)}%   <- the leak detector`)
  console.log(`          the gap between located and restored is the set a human must read: ${dLoc - d} derivable trial(s)`)
  console.log(`          void: ${rows.filter(r => r.void === true).length}/${rows.length}`)
  ok(derivable.every(r => r.located === true || r.located === false),
     'every scored derivable trial records whether the damaged line survived — without it, "fixed it differently" and "never found it" are the same number')

  // THE READING, and the branch that carries the verdict is the branch that says
  // what it cannot establish.
  // ONLY THE CLEAN SUBSET DETECTS A LEAK. An underivable trial whose original
  // value still appears elsewhere in the damaged document is reconstructible by
  // reading, so a repair of it is the derivable capability, not a breach — that
  // is what reading the first batch's three hits established, in every case.
  const recoverable = underivable.filter(r => r.recoverable_from_context === true || r.recoverable_by_shape === true)
  const clean = underivable.filter(r => r.recoverable_from_context === false && r.recoverable_by_shape === false)
  const cleanHits = clean.filter(r => r.repaired === true).length
  console.log(`          underivable arm: ${clean.length} clean, ${recoverable.length} whose original recurs in the document`)
  console.log(`          LEAK DETECTOR (clean subset only): ${cleanHits}/${clean.length} repaired`)
  ok(clean.length >= MIN_UNDERIVABLE,
     `only ${clean.length} genuinely underivable unit(s); ${MIN_UNDERIVABLE} is the floor. The rest had the original value sitting elsewhere in the same document, so they measure reading rather than leaking, and a leak detector made of them detects nothing.`)
  // A HIT MUST BE ADJUDICATED IN THE REPOSITORY, not in someone's head.
  //
  // Every firing of this detector so far has turned out to be reconstruction
  // rather than recall, and each one was established by reading the artifact. But
  // a reading that lives only in a chat log is not evidence: the next reader sees
  // a repaired underivable trial and no record of why it is not a leak. So the
  // adjudication is a file, one line per hit, naming the mechanism — and this
  // check fails until every hit has one.
  //
  // It deliberately does NOT check that the adjudication is correct. Nothing here
  // can. What it enforces is that a human looked and left the reason where the
  // next person will find it, which is the difference between a residual that is
  // disclosed and one that is forgotten.
  const ADJ = join(ROOT, 'docs', 'runs', '2026-08-27-builder-arm', 'adjudications.jsonl')
  const adjudicated = new Map()
  if (existsSync(ADJ)) {
    for (const line of readFileSync(ADJ, 'utf8').split('\n')) {
      if (!line.trim()) continue
      try { const a = JSON.parse(line); if (a.trial_id) adjudicated.set(a.trial_id, a) } catch {}
    }
  }
  const unexplained = clean.filter(r => r.repaired === true && !adjudicated.has(r.trial_id))
  for (const r of clean.filter(r => r.repaired === true)) {
    const a = adjudicated.get(r.trial_id)
    if (a) ok(a.mechanism && a.verdict, `${r.trial_id} has an adjudication with no mechanism or no verdict — "someone looked" is not a reason`)
  }
  if (adjudicated.size) {
    console.log(`          adjudicated hits: ${[...adjudicated.values()].map(a => a.trial_id + ' = ' + a.verdict + ' (' + a.mechanism + ')').join('; ')}`)
  }
  if (clean.length && unexplained.length > 0) {
    // A HIT IS A FLAG FOR INSPECTION, NOT A VERDICT — because the recoverability
    // check UNDERSTATES. It compares strings, and a heading sequence gives
    // `Step 2` away without the string `Step 2` occurring anywhere. So a repair in
    // this arm has two readings and the ledger cannot separate them alone.
    const hits = unexplained.map(r => r.trial_id)
    fail(`the builder repaired ${unexplained.length} GENUINELY UNDERIVABLE defect(s) with no adjudication on file (of ${cleanHits} hits in ${clean.length} clean units) (${hits.join(', ')}). Two readings, and the ledger cannot tell them apart: either a leak channel is open, or those particular plants were reconstructible from the document's own structure after all — which the recoverability check misses whenever the original is implied rather than repeated. READ THOSE ARTIFACTS before quoting any repair rate; until one reading is established, the derivable rate of ${(dRate * 100).toFixed(0)}% is not a repair rate and #25 is not closed.`)
  } else if (derivable.length) {
    console.log(`          READING: the leak detector is at zero, so ${(dRate * 100).toFixed(0)}% is a reconstruction rate rather than a recall rate.`)
  }
  ok(Number.isFinite(dRate), 'the derivable rate is computable')
}

console.log('builder-rate: stating what this cannot establish')
console.log('          NOT MEASURED: whether these defects resemble what a real round meets. They are')
console.log('          planted single transforms; a real round hands the builder a critic’s gap in prose.')
console.log('          NOT CLOSED: the model-prior channel. It cannot be closed, only crossed against —')
console.log('          which is what the underivable arm is for, and it bounds rather than eliminates.')
console.log('          NOT FULLY MEASURED: whether each underivable plant really is underivable. The check')
console.log('          compares strings, so it catches an original that RECURS and misses one that is')
console.log('          merely IMPLIED — a heading sequence gives "Step 2" away with no such string present.')
console.log('          NOT MEASURED: whether a repair the scorer calls false was a valid fix in other words.')
console.log('          The scorer understates by construction, which is the safe direction.')

if (failures) {
  console.error(`\nbuilder-rate: ${failures} failure(s) — the builder arm is still unmeasured.`)
  process.exit(1)
}
console.log(`\nbuilder-rate: OK — ${scored.length} scored trials, isolation checked per trial, leak detector crossed against the repair rate.`)
