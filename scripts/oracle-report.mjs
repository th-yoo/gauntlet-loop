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
// AND THE PAIRING ARM MEASURES IT DIRECTLY. A pairing is two grounded artifacts under
// ONE goal, drawn in one invocation and joined by a draw id, so the verdict can be
// composed from two observed roles instead of inferred from one rate. That figure is
// reported beside the derivation rather than in place of it: it rests on however many
// pairings someone declared, and its draws are the same draws the per-side rate is
// computed over, so the two are not independent checks of each other. Comparing them
// tests the independence assumption; it does not corroborate either.
//
// Cohorts are NEVER pooled across prompt hashes. The prompt changed once and
// invalidated five of seven observations; blending an old cohort into a new rate
// would hide exactly that.

import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { liveInstrument } from './oracle-instrument.mjs'
import { verdictFor } from './oracle-derive.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// ORACLE_CORPUS / ORACLE_RESULTS, same as the other two tools — a test asserting on
// cohort grouping needs ledgers it can construct, and must never write the real ones.
const LEDGER = { 'corpus.jsonl': process.env.ORACLE_CORPUS, 'results.jsonl': process.env.ORACLE_RESULTS, 'pairings.jsonl': process.env.ORACLE_PAIRINGS }
const read = f => {
  const p = LEDGER[f] || join(ROOT, 'oracle', f)
  return existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : []
}

const corpus = read('corpus.jsonl')
const pairings = read('pairings.jsonl')
const results = read('results.jsonl')

console.log('oracle report — the pairing check\'s roleOf classifier')
console.log('')
console.log(`corpus: ${corpus.length} row(s) — ${corpus.filter(r => r.grounding === 'mechanical').length} mechanical, ${corpus.filter(r => r.grounding === 'agentic').length} agentic, ${corpus.filter(r => r.grounding === 'absence').length} absence`)
console.log(`        expecting — ${['does-the-work', 'produces-an-instruction', 'could-not-open'].map(r => `${corpus.filter(x => x.expected_role === r).length} ${r}`).join(', ')}`)

// A PIN ESTABLISHED LATE IS NOT THE SAME FACT AS A PIN ESTABLISHED AT ADD TIME, and the
// difference is invisible once both are just hashes. Five generator rows predate emission
// hashing entirely: the 2026-08-26 migration hashed whatever was on disk that day, which
// freezes the content but cannot tell it from content that had already drifted. Rows added
// since carry a hash taken when the emission was produced. Printed rather than absorbed —
// pinning something unverifiable and saying nothing would be the same defect one level up.
const latePins = corpus.flatMap(r => ((r.evidence || {}).emissions || []).filter(e => e.pinned_by).map(e => `${r.id}: ${e.path} (${e.pinned_by})`))
if (latePins.length) {
  console.log(`  ${latePins.length} emission pin(s) were established by a later migration, not when the row was added:`)
  for (const l of latePins) console.log(`    ${l}`)
  console.log('  Their content is fixed from that day forward; whether it had already drifted before it cannot say.')
}

// GROUNDING IS RE-RUN, NOT REMEMBERED.
//
// oracle-add runs the acceptance command once, refuses the row unless it exits 0, and
// stores `exit_code: 0`. Nothing ever ran it again, so the row's evidence was a past
// result. That is not a hypothetical: replacing the file a command compiles — one the row
// does not pin, because a row pins ONE artifact and a command reads whatever it likes —
// left the command exiting 1 while the whole suite stayed green and oracle-record accepted
// an observation against the row and scored it CORRECT.
//
// AND THAT IS WHY RE-RUNNING RATHER THAN PINNING. The command's footprint is unbounded and
// unrecorded: `evidence` carries acceptance_command, exit_code and stdout_head, and no
// dependency set. There is no list of files to hash. Running the thing is the only check
// whose scope matches the claim.
//
// An agentically grounded row has no command, so its evidence is the emission — everything executing
// the artifact produced. That was a bare path: deleting it outright changed nothing anyone
// could see. Existence and hash are now checked for EVERY file the execution emitted, which
// is the half the single-path field could not cover.
//
// Arbitrary shell out of the ledger runs here, which is the same trust oracle-add already
// extends when it runs the command to admit the row, and it is bounded by a timeout for
// the reason mutate.mjs learned: a check that hangs reports nothing, and nothing reads as
// "not run" rather than "broken".
if (corpus.length) {
  const ungrounded = []
  for (const row of corpus) {
    if (row.grounding === 'agentic') {
      // EVERY FILE THE EXECUTION EMITTED, not the first one. This read `evidence.emission`,
      // a single path, while an agentic execution produces a set — and the one real
      // multi-file case had the blind classifier quoting the file the row did not pin.
      // Unlike the acceptance command below, there is nothing to re-run here: re-running
      // means spawning an agent, which is the judgement under test. The emission is finite
      // and on disk, so it is pinned exactly instead.
      const ems = row.evidence && row.evidence.emissions
      if (!Array.isArray(ems) || !ems.length) {
        ungrounded.push(`row ${JSON.stringify(row.id)}: a generator row with no emissions recorded — nothing shows what executing it produced. A row carrying the old single \`emission\` field needs re-adding: the label rests on every file the execution produced, and one path cannot say so.`)
        continue
      }
      for (const em of ems) {
        const abs = existsSync(join(ROOT, em.path)) ? join(ROOT, em.path) : em.path
        if (!existsSync(abs)) { ungrounded.push(`row ${JSON.stringify(row.id)}: its emission ${em.path} is gone, and the files this row emitted are its entire ground truth`); continue }
        const now = 'sha256:' + createHash('sha256').update(readFileSync(abs)).digest('hex')
        if (now !== em.hash) ungrounded.push(`row ${JSON.stringify(row.id)}: its emission ${em.path} has changed since the row was added — grounded against ${String(em.hash).slice(0, 23)}…, on disk now ${now.slice(0, 23)}…`)
      }
      continue
    }
    const cmd = row.evidence && row.evidence.acceptance_command
    if (!cmd) { ungrounded.push(`row ${JSON.stringify(row.id)}: no acceptance command recorded, so nothing grounds it`); continue }
    const r = spawnSync(cmd, { shell: true, cwd: ROOT, stdio: 'ignore', timeout: 60_000 })
    if (r.status !== 0) {
      ungrounded.push(`row ${JSON.stringify(row.id)}: its acceptance command exits ${r.status === null ? 'nothing (killed or timed out)' : r.status} now, and exited 0 when the row was added — \`${cmd.length > 90 ? cmd.slice(0, 90) + '…' : cmd}\``)
    }
  }
  if (ungrounded.length) {
    console.log('')
    console.log(`REFUSING: ${ungrounded.length} row(s) are no longer grounded.`)
    for (const u of ungrounded) console.log(`  ${u}`)
    console.log('  A row\'s ground truth is what its command does NOW, not the exit code stored when it was added.')
    console.log('  Observations against an ungrounded row are not evidence; fix the row or drop it.')
    process.exit(1)
  }
}

if (!results.length) {
  console.log('')
  console.log('NO OBSERVATIONS YET. The corpus is set up; nothing has been measured against it.')
  console.log('This question cannot be posed yet — and that is the honest reading, not a rate of zero.')
  process.exit(0)
}

// AN ANSWER THIS REPORT DOES NOT SCORE IS NOT A ZERO, IT IS A SILENT DROP.
//
// The loop below iterates a fixed list, so an observation expecting any other role is
// counted nowhere and printed nowhere: the cohort header appears with nothing under it and
// the run exits 0. That is the only silent outcome this tool has, and the observation most
// likely to land in it is a `could-not-open` one — the very verdict #34 records as having
// no evidence. Refusing costs a line; a number that quietly excluded an observation costs
// whatever was decided on it.
//
// SCORED_ROLES is the single source for both this refusal and the loop below. Two lists
// would drift, and the drift would restore the silent drop with the guard still green.
// could-not-open joined these when the corpus gained a way to express an absence. It is a
// verdict the probe can return and a third way a run gets refused, and it sat at zero
// observations because the row could not be added, not because nobody drew it.
// GROUPED BY THE ANSWER, NOT BY HOW THE ROW WAS GROUNDED. These were one field, `arm`,
// which meant both at once — so `generator` named a role while `does-the-work` named a
// grounding, and a row grounded by execution could only ever expect one answer (#49). What
// this report scores is the answer the probe should have given, so that is what it groups
// by; the grounding is carried on each observation and is a different fact.
const SCORED_ROLES = ['does-the-work', 'produces-an-instruction', 'could-not-open']
const unscored = results.filter(r => !SCORED_ROLES.includes(r.expected_role))
if (unscored.length) {
  console.log('')
  console.log(`REFUSING: ${unscored.length} observation(s) expect a role this report does not score.`)
  for (const role of [...new Set(unscored.map(r => r.expected_role))]) {
    const hits = unscored.filter(o => o.expected_role === role)
    console.log(`  role ${JSON.stringify(role)} — ${hits.length} observation(s), first on row ${hits[0].row}`)
  }
  console.log(`  This report scores ${SCORED_ROLES.join(' and ')}. Add the role here, or take the observations`)
  console.log('  out of the ledger — but they are not going to be counted silently.')
  process.exit(1)
}

// AND AN OBSERVATION NAMING A PAIRING NOBODY DECLARED IS THE SAME SILENT DROP, found by
// the rule rather than by an incident: the pairing block below iterates DECLARED pairings,
// so a side tagged with one that is not in the ledger is counted nowhere and printed
// nowhere, exactly as an unscored arm was. oracle-record refuses this at the door, which
// means the way it arrives is a pairing REMOVED after its draws were taken — the corpus
// moving underneath a number, which is the class this report exists to catch.
const declaredPairings = new Set(pairings.map(p => p.id))
const orphaned = results.filter(o => o.pairing && !declaredPairings.has(o.pairing))
if (orphaned.length) {
  console.log('')
  console.log(`REFUSING: ${orphaned.length} observation(s) name a pairing that is not declared.`)
  for (const id of [...new Set(orphaned.map(o => o.pairing))]) {
    const hits = orphaned.filter(o => o.pairing === id)
    console.log(`  pairing ${JSON.stringify(id)} — ${hits.length} side-observation(s), on row(s) ${[...new Set(hits.map(o => o.row))].join(', ')}`)
  }
  console.log('  Declare it again, or take the tag off those observations — they are not going to be counted silently.')
  process.exit(1)
}

// GROUND TRUTH IS RE-DERIVED HERE, NOT READ BACK OUT OF THE OBSERVATION.
//
// `correct` was computed once, by oracle-record, at the moment the observation was written
// (`predicted === row.expected_role`), and every rate below used to come from that stored
// value. So a row whose expected_role is later CORRECTED — which is exactly what a
// #36-class finding produces, since #36 changed what the right answer IS for a whole class
// of artifact — left every existing draw carrying its old score, silently. The corpus could
// assert the opposite of what was measured and this report would not change by a character;
// scripts/staleness-trial.mjs demonstrates that by inverting a row and diffing the output.
//
// `disputed` was worse, and it was found by the root cause rather than by an incident: if
// the defect is "a derivable fact is stored", it is in every such field. This one is copied
// onto the observation (oracle-record.mjs) and was filtered on the observation's copy, and
// it decides whether an observation counts toward a rate AT ALL. Marking a row disputed
// withdrew nothing that had already been drawn.
//
// Both now come from the row, every run. The stored `correct` is kept and compared rather
// than ignored: a disagreement between what was written and what the corpus says today is
// the event worth hearing about, and comparing two independently produced values is the
// over-determination this repo asks a checker to supply.
const byId = new Map(corpus.map(r => [r.id, r]))
if (!corpus.length) {
  // NOT the same as "everything agrees". Without a corpus there is nothing to re-derive
  // against, and saying so is the honest reading — a constructed ledger with no corpus is
  // how the report's own tests exercise cohort grouping.
  console.log('ground truth: NOT RE-DERIVED — no corpus supplied, so nothing checks the recorded verdicts against it')
} else {
  const disagreements = []
  for (const o of results) {
    const row = byId.get(o.row)
    if (!row) { disagreements.push(`observation on row ${JSON.stringify(o.row)} — the corpus has no such row, so nothing establishes what its answer was`); continue }
    const nowCorrect = o.predicted_role === row.expected_role
    if (nowCorrect !== o.correct) {
      disagreements.push(`row ${JSON.stringify(o.row)}: recorded as ${o.correct ? 'CORRECT' : 'WRONG'}, but the corpus now expects ${JSON.stringify(row.expected_role)} and this observation predicted ${JSON.stringify(o.predicted_role)}`)
    }
  }
  if (disagreements.length) {
    console.log('')
    console.log(`REFUSING: ${disagreements.length} observation(s) disagree with the corpus they were scored against.`)
    for (const d of disagreements) console.log(`  ${d}`)
    console.log('  A verdict frozen at record time is not evidence about a corpus that has since been corrected.')
    console.log('  Re-score or re-draw those rows; do not average them into a rate.')
    process.exit(1)
  }
  // The row is the authority on whether its ground truth is contested, at read time.
  for (const o of results) {
    const row = byId.get(o.row)
    if (row) o.disputed = !!row.disputed
  }
}

// WHICH COHORT DESCRIBES THE PROMPT THAT SHIPS.
//
// The report already refuses to pool cohorts, which stops a superseded instrument from
// being blended into a current rate. It did not say which one IS current: two anonymous
// hashes were printed and the answer lived in someone's notes — the same
// remembered-not-enforced shape that let five of seven observations be quoted against a
// prompt that had already changed. The roleOf fix at 5741f5e moved the template hash and
// stranded 15 of 38 observations, and nothing in this output said so.
//
// So the live instrument is read out of loop.js on every run and every cohort is labelled
// against it. If it cannot be read, nothing below is printed: unlabelled numbers are the
// hazard this exists to remove, and printing them with an apology attached leaves them
// quotable.
let live = null
try {
  live = liveInstrument()
} catch (e) {
  console.log('')
  console.log('CANNOT DETERMINE WHICH INSTRUMENT SHIPS — no numbers are printed below.')
  console.log(`  ${String(e.message).split('\n').join('\n  ')}`)
  console.log('')
  console.log('  This is NOT a finding that every cohort is stale. It is a finding that the question')
  console.log('  "which prompt does loop.js send today" could not be answered, so no cohort can be')
  console.log('  labelled at all. Fix the extraction; do not re-draw the corpus on the strength of this.')
  process.exit(1)
}
const liveKey = `${live.template_hash}|${live.schema_fingerprint}`
console.log(`instrument that ships: ${live.template_hash.slice(0, 23)}…   (read from loop.js, never from the ledger)`)

// GROUPED BY TEMPLATE. Grouping by prompt_hash put every row in its own cohort,
// because the goal and artifact path are interpolated into the prompt — the tool
// reported four cohorts of one on a four-row corpus. An observation predating the
// template hash has none; it belongs to an unknown instrument and is reported as
// its own cohort rather than silently folded into a current one.
//
// Named once because the pairing block below needs the same key: a draw whose two sides
// were taken against different prompts is two instruments, not one observation. A second
// copy of this expression is a copy that drifts, which is the defect this file spends its
// longest comment on.
const cohortKey = r => `${r.template_hash || 'template-unknown:' + (r.prompt_hash || 'none')}|${r.schema_fingerprint}`

// Group by instrument, then by arm. A cohort is (prompt_hash, schema_fingerprint).
const cohorts = new Map()
for (const r of results) {
  const k = cohortKey(r)
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

let liveObservations = 0
for (const [k, rs] of cohorts) {
  const [ph] = k.split('|')
  // THREE states, and the third is not the second. An observation predating the template
  // hash belongs to an instrument nobody recorded, which is a different fact from an
  // instrument that has been replaced — and the repair differs: one needs its prompt
  // identified, the other needs re-drawing.
  const label = k === liveKey ? 'LIVE — the prompt loop.js sends today'
    : ph.startsWith('template-unknown') ? 'UNKNOWN INSTRUMENT — recorded before the template hash existed'
    : 'SUPERSEDED — no run sends this prompt any more'
  if (k === liveKey) liveObservations += rs.length
  console.log('')
  console.log(`── instrument ${ph.slice(0, 23)}… ── ${label}`)
  if (cohorts.size > 1) console.log('   (cohorts are reported separately: a different prompt is a different instrument)')

  for (const arm of SCORED_ROLES) {
    const all = rs.filter(r => r.expected_role === arm)
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

    // THE INTERVAL IS OVER THE UNIT THE CLAIM IS ABOUT, WHICH IS THE ARTIFACT.
    //
    // This line used to be `wilson(wrong.length, n)` — over OBSERVATIONS — two lines
    // above a label that says `distinct artifacts <- the number that bears on any
    // statistical claim`, and directly under a comment saying repeat executions of one
    // artifact are not independent evidence. The principle was written beside the number
    // that violated it, which is how it survived: every reader of this file, including
    // the one who wrote both, read the sentence and not the argument to wilson().
    //
    // It was caught by USING it. On 2026-08-26 the pairing cell's false-refusal figure
    // moved from 0/6, CI [0%, 39%] to 0/18, CI [0%, 18%] because the same six pairings
    // were each drawn twice more. No pairing was added; the interval halved because one
    // question was asked three times.
    //
    // An artifact counts as wrong if ANY draw of it was wrong — the conservative
    // collapse, since a classifier that gets an artifact wrong once is not shown correct
    // by getting it right afterwards. What redraws DO buy is reported separately and
    // honestly, as `answer stability`, which is the only claim they can support.
    // test/interval-unit.test.mjs is the reproducible.
    const wrongUnits = new Set(wrong.map(r => r.artifact)).size
    const ci = wilson(wrongUnits, distinct)

    console.log('')
    console.log(`   ${arm} arm`)
    console.log(`     observations      ${n}`)
    // n_distinct is reported beside n because repeat executions of ONE artifact are
    // not independent evidence, and a rate computed over observations would let one
    // artifact measured twice masquerade as two.
    console.log(`     distinct artifacts ${distinct}${distinct < n ? '   <- the number that bears on any statistical claim' : ''}`)
    console.log(`     misclassified     ${wrong.length}`)
    // CORROBORATED vs ATTESTED. An observation carries a response on disk whose fields
    // were checked against it, or it does not. Neither says where the answer came from —
    // that is not recoverable here and is not claimed. What this reports is how many of
    // the numbers above can be traced back to a text, which is a fact about the ledger
    // rather than a judgement about anyone.
    const corrob = a.filter(o => o.corroboration).length
    console.log(`     corroborated      ${corrob}/${n}${corrob === 0 ? ' — every observation here is attested: the fields were accepted as given' : corrob < n ? ' — the rest are attested' : ''}`)

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
        const bound = 3 / distinct
        console.log(`                       ${wrongUnits}/${distinct} wrong is consistent with a per-side error rate anywhere`)
        console.log(bound >= 1
          ? `                       up to 100% — at ${distinct} distinct artifact(s) the rule of three bounds nothing. Not evidence of accuracy.`
          : `                       up to about ${pct(bound)} (rule of three at ${distinct} distinct artifact(s)). Not evidence of accuracy.`)
      }
    } else {
      console.log(`     per-side error    ${wrongUnits}/${distinct}, 95% CI [${pct(ci[0])}, ${pct(ci[1])}]  <- PRIMARY`)
      console.log(`                       over DISTINCT ARTIFACTS. ${n} observation(s) stand behind it; the extra`)
      console.log(`                       ${n - distinct} are redraws, and they bound stability rather than narrowing this.`)
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

// THE PAIRING ARM — the thing that actually refuses a run, and the one this corpus could
// not express until it had somewhere to say two rows form a pair.
//
// Everything above measures roleOf: one artifact, one role. A refusal fires when exactly
// one SIDE of a pair is an instruction-writer, so the only route to a FALSE refusal is a
// does-the-work artifact read as a writer — and that is a property of two artifacts under
// one goal. Until a pairing could be declared, the false-refusal rate was 2q(1-q) carried
// through the per-side interval under an independence assumption this report itself calls
// probably false.
//
// The expected verdict is DERIVED here, every run, by executing loop.js with the two rows'
// expected roles — never stored, and never retyped. Storing it would be #40 again.
if (pairings.length) {
  console.log('')
  console.log(`── pairings ── ${pairings.length} declared`)

  // A PAIRING OBSERVATION IS TWO SIDE-OBSERVATIONS JOINED BY A DRAW ID. Each side is an
  // ordinary roleOf observation — grounded, instrument-checked, re-scored against the
  // corpus like every other — and what makes the pair an observation of the VERDICT is
  // the draw id they share.
  //
  // The observed verdict is composed HERE, by running loop.js, and stored nowhere. So is
  // the expected one. Both follow a change to loop.js's rule with nothing to re-sync,
  // which is the whole reason oracle-derive.mjs exists.
  //
  // Nested maps rather than a joined string key: a delimiter is a rule about what an id
  // may not contain, and nothing enforces it.
  const draws = new Map()
  for (const o of results) {
    if (!o.pairing) continue
    if (!draws.has(o.pairing)) draws.set(o.pairing, new Map())
    const byDraw = draws.get(o.pairing)
    if (!byDraw.has(o.pairing_draw)) byDraw.set(o.pairing_draw, [])
    byDraw.get(o.pairing_draw).push(o)
  }

  const unscorable = []
  const scored = []

  for (const p of pairings) {
    const [ra, rb] = p.sides.map(id => byId.get(id))
    if (!ra || !rb) { console.log(`   ${p.id}: names a row the corpus does not have — ${p.sides.join(', ')}`); continue }
    let expected
    try { expected = await verdictFor(ra.expected_role, rb.expected_role) }
    catch (e) { console.log(`   ${p.id}: the verdict could not be derived — ${String(e.message).split('\n')[0]}`); continue }

    const mine = [...(draws.get(p.id) || new Map()).entries()]
    console.log(`   ${p.id.padEnd(20)} ${ra.expected_role} + ${rb.expected_role} -> ${expected}   ${mine.length} draw(s)`)
    if (expected === 'comparable') console.log(`   ${' '.repeat(20)} a refusal on this pairing would be FALSE — this is the cell the rate comes from`)

    for (const [drawId, obs] of mine) {
      const sides = p.sides.map(id => obs.find(o => o.row === id))
      // EVERY WAY A DRAW FAILS TO BE ONE IS NAMED RATHER THAN DROPPED. A rate resting on
      // fewer draws than the ledger appears to hold is the silent-drop failure this report
      // already refuses for an unscored arm, and a draw is where it would happen next.
      // Excluded and printed, not fatal: the runner records nothing for a probe that died,
      // so a half draw is the normal consequence of one flaky spawn, and exiting non-zero
      // on it would make a dead agent look like a broken corpus.
      if (obs.length !== 2 || sides.some(x => !x)) {
        unscorable.push(`draw ${drawId} (${p.id}): incomplete — ${obs.length} of 2 sides recorded (${obs.map(o => o.row).join(', ') || 'none'}). One side has no second role to compose with, and supplying one is inventing an answer.`)
        continue
      }
      const keys = new Set(sides.map(cohortKey))
      if (keys.size > 1) {
        unscorable.push(`draw ${drawId} (${p.id}): its two sides were drawn against DIFFERENT instruments, so composing them would answer for a check nobody runs`)
        continue
      }
      if ([...keys][0] !== liveKey) {
        unscorable.push(`draw ${drawId} (${p.id}): drawn against an instrument that no longer ships — re-draw it rather than re-scoring it`)
        continue
      }
      if (sides.some(o => o.disputed)) {
        unscorable.push(`draw ${drawId} (${p.id}): a side's ground truth is contested, so scoring the composed verdict would cost a choice of side`)
        continue
      }
      let observed
      try { observed = await verdictFor(sides[0].predicted_role, sides[1].predicted_role) }
      catch (e) { unscorable.push(`draw ${drawId} (${p.id}): the observed verdict could not be composed — ${String(e.message).split('\n')[0]}`); continue }
      const tag = expected === 'comparable'
        ? (observed === 'comparable' ? '' : '   FALSE REFUSAL')
        : observed === expected ? '   refused, and the corpus says it should be'
        : observed === 'comparable' ? '   MISSED REFUSAL'
        : '   REFUSED FOR THE WRONG REASON'
      console.log(`   ${' '.repeat(20)} draw ${drawId}: ${sides[0].predicted_role} + ${sides[1].predicted_role} -> ${observed}${tag}`)
      scored.push({ pairing: p.id, expected, observed })
    }
  }

  if (unscorable.length) {
    console.log('')
    console.log(`   ${unscorable.length} draw(s) could not be scored, and are excluded from everything below:`)
    for (const u of unscorable) console.log(`     ${u}`)
  }

  const cell = scored.filter(s => s.expected === 'comparable')
  const refused = cell.filter(s => s.observed !== 'comparable')
  const distinctPairings = new Set(cell.map(s => s.pairing)).size
  const trueCell = scored.filter(s => s.expected !== 'comparable')

  if (!scored.length) {
    console.log('')
    console.log('   NO PAIRING HAS BEEN OBSERVED. The verdict that refuses runs has zero draws behind it, so the')
    console.log('   per-run false refusal figure above remains a derivation from the per-side rate and not a')
    console.log('   measurement of the thing itself.')
  } else {
    console.log('')
    console.log(`   ── the false-refusal cell ── ${distinctPairings} distinct pairing(s), ${cell.length} draw(s)`)
    if (!cell.length) {
      console.log('     falsely refused   NOT POSED — every scored draw is of a pairing whose true verdict IS a refusal,')
      console.log('                       so nothing here could have been falsely refused. That is a gap in the corpus,')
      console.log('                       not a rate of zero.')
    } else if (distinctPairings < 5) {
      // The same threshold the per-side arm applies to distinct artifacts. A newer arm does
      // not get a lower bar, and the unit is the PAIRING: two draws of one pairing are one
      // artifact pair measured twice, which is the repeat-execution problem n_distinct
      // exists to keep out of a rate.
      console.log(`     falsely refused   ${refused.length} of ${cell.length} draw(s) — NO RATE: ${distinctPairings} distinct pairing(s) supports no rate.`)
      console.log(`                       Same threshold the per-side arm uses on distinct artifacts. Declaring and`)
      console.log(`                       drawing more pairings in this cell moves it; redrawing these ones does not.`)
    } else {
      // OVER PAIRINGS, NOT DRAWS — the same repair as the per-side arm, and this is the
      // cell where the defect was observed. A pairing counts as falsely refused if ANY
      // of its draws refused it.
      const refusedUnits = new Set(refused.map(s => s.pairing)).size
      const ci = wilson(refusedUnits, distinctPairings)
      console.log(`     falsely refused   ${refusedUnits}/${distinctPairings}, 95% CI [${pct(ci[0])}, ${pct(ci[1])}]   <- MEASURED by drawing the pairing, not derived from 2q(1-q)`)
      console.log(`                       The number #33 calls the one that decides whether an automatic refusal is`)
      console.log(`                       safe to keep. Over DISTINCT PAIRINGS: ${cell.length} draw(s) stand behind it, and`)
      console.log(`                       redrawing these ones will not move it — only declaring more will.`)
    }
    // THE SAME THRESHOLD, and it was missing here first time out. This cell printed a
    // bare `1/1`, which a reader takes for 100% — the bare point estimate this report
    // refuses everywhere else, one branch over from the guard that refuses it. The
    // threshold had been written where the number was being watched.
    //
    // A MISSED REFUSAL prints at any n regardless: a run that would have proceeded on a
    // pairing the corpus says is not comparable is an event, not a rate.
    if (trueCell.length) {
      const fired = trueCell.filter(s => s.observed === s.expected).length
      const missed = trueCell.filter(s => s.observed === 'comparable').length
      const distinctTrue = new Set(trueCell.map(s => s.pairing)).size
      console.log(`   ── the refusal-fires cell ── ${distinctTrue} distinct pairing(s), ${trueCell.length} draw(s) whose true verdict is a refusal`)
      if (distinctTrue < 5) {
        console.log(`     fired correctly   ${fired} of ${trueCell.length} draw(s) — NO RATE: ${distinctTrue} distinct pairing(s) supports no rate.`)
      } else {
        const missedUnits = new Set(trueCell.filter(s => s.observed !== s.expected).map(s => s.pairing)).size
        const firedUnits = distinctTrue - missedUnits
        const ci = wilson(missedUnits, distinctTrue)
        console.log(`     fired correctly   ${firedUnits}/${distinctTrue}, 95% CI on the miss rate [${pct(ci[0])}, ${pct(ci[1])}] — over DISTINCT PAIRINGS (${trueCell.length} draw(s))`)
      }
      if (missed) console.log(`     MISSED            ${missed} draw(s) — the run would have proceeded on a pairing the corpus says is not comparable`)
    }

    // WHAT THESE DRAWS DO NOT ESTABLISH, on the branch that carries the number.
    console.log('')
    console.log('   The sides of these draws are also counted in the per-side arm above, so the measured figure')
    console.log('   and the derived 2q(1-q) one rest on the SAME draws. Comparing them tests the independence')
    console.log('   assumption on one body of evidence; it does not corroborate either with a second.')
    console.log('   And the draw id records that two sides belong to one draw. Nothing here establishes that they')
    console.log('   were DRAWN together — the same residual --raw carries about where an answer came from.')
  }
}

console.log('')
console.log('WHAT THIS DOES NOT ESTABLISH')
console.log('  - Selection bias is not corrected. The corpus is whatever its builder chose to add;')
console.log('    the RELATION in each row is mechanical, the SELECTION of rows is not. Adding more')
console.log('    rows of the same kind does not fix this and can hide it.')
console.log('  - Answer stability beyond the rows that were actually redrawn. Two draws bound')
console.log('    instability loosely, and a redraw is the same model asked again — not an')
console.log('    independent draw.')
console.log('  - Coverage. The classification rule is one rule, but which artifacts were put in')
console.log('    front of it is exactly the corpus and nothing more.')

// THE NUMBERS ABOVE ARE ALL STALE. Printed last because it is the last thing a reader
// should carry away, and it is the only state in which every figure in this report is
// about a prompt nobody runs.
if (!liveObservations) {
  console.log('')
  console.log('NO COHORT DESCRIBES THE PROMPT THAT SHIPS.')
  console.log(`  loop.js sends ${live.template_hash.slice(0, 23)}… today, and every observation above was`)
  console.log('  made against a different prompt. Every number above therefore describes an instrument')
  console.log('  that no longer runs, however good it looks. Re-draw under the live prompt — #34 — before')
  console.log('  quoting any of it.')
  // The exit code fires for the REAL ledger only. A run pointed at a constructed
  // ORACLE_RESULTS is a test of the labelling, not someone about to quote these numbers,
  // and failing there would make the seam that tests this branch untestable.
  if (!process.env.ORACLE_RESULTS) process.exit(1)
}
