// Record ONE real observation of the pairing check against ONE corpus row.
//
//   node scripts/oracle-record.mjs --row <id> --predicted <role> --reasoning "<text>" \
//        --prompt-hash <hash> --schema-fingerprint <hash> [--observer <name>]
//
// THE STALENESS PROBLEM THIS SOLVES. The pairing check's prompt has already changed
// once, and it silently invalidated five of the seven observations then on record —
// they had been made against a two-verdict question that no longer existed, and
// nothing tied an observation to the wording that produced it. Someone had to notice.
//
// So an observation is only accepted when the instrument that produced it is still
// the instrument on disk: the supplied hashes must match what scripts/oracle-extract.mjs
// reports for that row RIGHT NOW. When loop.js's prompt changes, every subsequent
// record against the old hash is refused at the door, and scripts/oracle-report.mjs
// keeps the old cohort separate rather than blending it into a rate.
//
// The artifact is pinned the same way. A row whose file changed since it was added
// describes a different artifact, and observations about the old content are not
// evidence about the new one.

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, appendFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

// WHAT EACH EXIT CODE MEANS. A caller has to be able to tell WHICH refusal fired,
// and a code earns its own value by naming a different thing to DO — not by marking
// a different internal branch.
//
// This exists because two refusals shared code 1 and a guard could not tell them
// apart. test/oracle.test.mjs asserted the stale-instrument refusal with
// `eq(r.code, 1)` and was handed the missing-artifact refusal, which also exited 1;
// the assertion passed against an unrelated failure and only a message check one
// line later caught it. CLAUDE.md already states the rule — "a check whose PASS
// condition is satisfied by the thing being broken measures nothing" — so the codes
// now carry it.
//
//   2  bad input. Fix the command line.
//   3  the ROW no longer describes reality: its artifact is gone, its artifact
//      changed, or an absence row's file appeared. Re-ground or re-add the row.
//      Missing and changed share this code deliberately: one remedy, one code.
//   4  the OBSERVATION was made against a different instrument than the one on
//      disk. Re-run the observation; the row is fine.
//   1  the observation is internally inconsistent, or the live prompt could not be
//      extracted at all.
const EXIT_ROW_UNGROUNDED = 3
const EXIT_STALE_INSTRUMENT = 4

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// Same reason as oracle-add.mjs: a suite run under a removed guard must not be able
// to write into the tracked ledgers.
const CORPUS = process.env.ORACLE_CORPUS || join(ROOT, 'oracle', 'corpus.jsonl')
const RESULTS = process.env.ORACLE_RESULTS || join(ROOT, 'oracle', 'results.jsonl')
const PAIRINGS = process.env.ORACLE_PAIRINGS || join(ROOT, 'oracle', 'pairings.jsonl')
const ROLES = ['does-the-work', 'produces-an-instruction', 'could-not-open']

const argv = process.argv.slice(2)
const FLAGS = ['--row', '--predicted', '--reasoning', '--prompt-hash', '--schema-fingerprint', '--observer', '--what-it-is', '--raw', '--pairing', '--pairing-draw']
const arg = n => {
  const i = argv.indexOf(n)
  if (i === -1) return null
  const v = argv[i + 1]
  return v === undefined || FLAGS.includes(v) ? null : v
}

const rowId = arg('--row')
const predicted = arg('--predicted')
const reasoning = arg('--reasoning')
const promptHash = arg('--prompt-hash')
const schemaFp = arg('--schema-fingerprint')
const observer = arg('--observer') || 'unnamed'
const whatItIs = arg('--what-it-is')
const rawPath = arg('--raw')
const pairing = arg('--pairing')
const pairingDraw = arg('--pairing-draw')

if (!rowId || !predicted || !promptHash || !schemaFp) {
  console.error('usage: node scripts/oracle-record.mjs --row <id> --predicted <role> --reasoning "<text>" --prompt-hash <hash> --schema-fingerprint <hash> [--observer <name>] [--what-it-is "<text>"] [--raw <response file>] [--pairing <id> --pairing-draw <id>]')
  process.exit(2)
}
if (!ROLES.includes(predicted)) {
  console.error(`record: "${predicted}" is not one of the three roles the schema allows (${ROLES.join(', ')}). An observation outside the schema is not an observation of this instrument.`)
  process.exit(2)
}

// --raw: THE FIELDS MUST AGREE WITH A RESPONSE ON DISK.
//
// Everything above this line validates the INSTRUMENT — that the prompt and schema an
// observation claims are the ones on disk today. Nothing validated the OBSERVATION: the
// verdict is checked against an enum, and the reasoning is whatever the caller passed. So
// an observation transcribed from the wrong draw, or paraphrased from memory rather than
// copied, records as cleanly as an accurate one.
//
// WHAT THIS IS NOT FOR. It is not a defence against anyone. A person recording by hand
// can write this file too, and no check that runs here could tell. Nothing in this
// corpus's history shows that happening, deliberately or otherwise: results.jsonl is
// insertions-only apart from two migrations — one of schema, and one on 2026-08-26 that
// re-keyed 12 records' template_hash after oracle-extract was found to be blanking the
// caller's spelling of the artifact path rather than the resolved path it had actually
// interpolated. Each of those 12 was re-keyed only because re-extracting its row
// reproduced the record's own prompt_hash byte for byte, which is what established that
// the observation was made against the prompt that ships. No verdict was touched. This catches a MISMATCH between what was typed and what a
// response says — a slip, not an attack — and that failure has never been observed here
// either. It is a precaution with no incident behind it, which is worth saying out loud
// rather than dressing up.
//
// Optional on purpose. A person who ran the probe in a chat window has no file to point
// at, and refusing them would push the same hand-recording through an empty gesture. What
// the corpus gains is the DISTINCTION: oracle-report counts corroborated observations
// separately, so how many rest on a response that exists is visible rather than assumed.

let corroboration = null
if (rawPath) {
  const abs = existsSync(resolve(ROOT, rawPath)) ? resolve(ROOT, rawPath) : rawPath
  if (!existsSync(abs)) {
    console.error(`record: --raw ${rawPath} does not exist. A corroboration that is not on disk corroborates nothing.`)
    process.exit(2)
  }
  const rawText = readFileSync(abs, 'utf8')
  let body
  try { body = JSON.parse(rawText.slice(rawText.indexOf('{'), rawText.lastIndexOf('}') + 1)) } catch {
    console.error(`record: --raw ${rawPath} holds no JSON object, so there is nothing in it to compare these fields against.`)
    process.exit(2)
  }
  // Compared against the PARSED response, not against the file's text: a reasoning string
  // containing a quote or a newline is escaped on disk, so a substring test would refuse a
  // faithful transcription and pass a lucky one.
  const mismatch = []
  if (body.verdict !== predicted) mismatch.push(`--predicted ${JSON.stringify(predicted)} but the response says ${JSON.stringify(body.verdict)}`)
  if (reasoning !== null && String(body.reasoning || '') !== reasoning) mismatch.push('--reasoning is not the reasoning in the response')
  if (mismatch.length) {
    console.error(`record: the fields do not agree with ${rawPath}:`)
    for (const m of mismatch) console.error(`  ${m}`)
    console.error('An observation and the response it claims to come from have to be the same observation.')
    process.exit(1)
  }
  corroboration = { raw: rawPath, raw_hash: 'sha256:' + createHash('sha256').update(rawText).digest('hex') }
}
if (!existsSync(CORPUS)) { console.error('record: oracle/corpus.jsonl does not exist — add a row first.'); process.exit(2) }

const rows = readFileSync(CORPUS, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
const row = rows.find(r => r.id === rowId)
if (!row) {
  console.error(`record: no corpus row "${rowId}". Known rows: ${rows.map(r => r.id).join(', ') || '(none)'}`)
  process.exit(2)
}

// ── A SIDE OF A PAIRING DRAW ────────────────────────────────────────────────────────
//
// The verdict that can refuse a run is not a property of this row. It is composed from
// TWO roles under one goal (loop.js: `writers.length === 1`), and every observation in
// this ledger is of one artifact alone — which is why the false-refusal rate has only
// ever been printed as a derivation. #37.
//
// So a pairing OBSERVATION is two of these records joined by `--pairing-draw`. Nothing
// about the verdict is stored: oracle-report recomposes it from the two predicted roles
// by running loop.js, every read, exactly as the expected verdict is derived from the two
// rows. Storing either would be #40 again.
//
// WHAT THE JOIN IS AND IS NOT. It records that these two sides belong to one draw. It
// cannot establish that they were DRAWN together — a caller can pass the same draw id to
// two sides taken an hour apart, and no check here or anywhere else could tell. That is
// the same residual `--raw` carries, and oracle-report states it beside the number rather
// than leaving the reader to assume the stronger claim.
if (pairingDraw && !pairing) {
  console.error('record: --pairing-draw was given with no --pairing, so this join key points at nothing.')
  console.error('A draw id joins the two sides of ONE declared pairing. Name the pairing, or drop both flags and')
  console.error('record this as the ordinary per-side observation it is.')
  process.exit(2)
}
if (pairing) {
  if (!pairingDraw) {
    console.error(`record: --pairing ${pairing} was given with no --pairing-draw.`)
    console.error('A side that cannot be joined to the side drawn beside it is not an observation of a pairing — the')
    console.error('verdict needs both roles. Pass the same --pairing-draw to both sides of the draw.')
    process.exit(2)
  }
  if (!existsSync(PAIRINGS)) {
    console.error(`record: no pairings ledger at ${PAIRINGS}, so pairing "${pairing}" is not declared. Declare it with scripts/oracle-pair.mjs first.`)
    process.exit(2)
  }
  const pairs = readFileSync(PAIRINGS, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  const p = pairs.find(x => x.id === pairing)
  if (!p) {
    console.error(`record: no pairing "${pairing}". Known: ${pairs.map(x => x.id).join(', ') || '(none)'}`)
    process.exit(2)
  }
  // The row must be one of the two sides. Without this the report composes a verdict from
  // an artifact the pairing never contained — and it cannot notice, because the arithmetic
  // works perfectly on the wrong pair: both rows are grounded, both carry a role.
  if (!p.sides.includes(rowId)) {
    console.error(`record: row "${rowId}" is not a side of pairing "${pairing}" (${p.sides.join(' + ')}).`)
    console.error('A pairing verdict composed from an artifact the pairing does not contain measures a pair nobody declared.')
    process.exit(2)
  }
  // A draw is TWO sides. A third record under one draw id composes nothing, and at read
  // time the only available response is to drop the draw — silently, unless the report
  // goes out of its way. Refusing here names the fix instead.
  const already = existsSync(RESULTS)
    ? readFileSync(RESULTS, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(o => o.pairing_draw === pairingDraw)
    : []
  const clash = already.find(o => o.row === rowId)
  if (clash) {
    console.error(`record: draw "${pairingDraw}" already holds an observation of row "${rowId}" (${clash.predicted_role}).`)
    console.error('A draw is the two sides of one pairing, once each. Use a new draw id for a second draw of this pairing.')
    process.exit(2)
  }
  if (already.length >= 2) {
    console.error(`record: draw "${pairingDraw}" already has ${already.length} sides (${already.map(o => o.row).join(', ')}).`)
    process.exit(2)
  }
}

// The artifact must still be the one the row was grounded against — or, for the absence
// arm, must still be absent. Same claim either way: the thing an observation was made
// about has not changed underneath it. A row whose ground truth is "there is nothing
// there" is invalidated by a file appearing, exactly as a hashed row is by an edit.
const abs = existsSync(resolve(ROOT, row.artifact)) ? resolve(ROOT, row.artifact) : row.artifact
const isAbsence = row.arm === 'could-not-open'
if (isAbsence) {
  if (existsSync(abs)) {
    console.error(`record: row "${rowId}" is a could-not-open row, but ${row.artifact} now EXISTS.`)
    console.error('Its ground truth was that there is nothing there. An observation against it now measures something else.')
    process.exit(EXIT_ROW_UNGROUNDED)
  }
} else {
  if (!existsSync(abs)) {
    console.error(`record: row "${rowId}" points at ${row.artifact}, which no longer exists. Its ground truth cannot be re-established, so an observation against it means nothing.`)
    process.exit(EXIT_ROW_UNGROUNDED)
  }
  const nowHash = 'sha256:' + createHash('sha256').update(readFileSync(abs)).digest('hex')
  if (nowHash !== row.artifact_hash) {
    console.error(`record: ${row.artifact} has changed since row "${rowId}" was added.`)
    console.error(`    grounded against ${row.artifact_hash}`)
    console.error(`    on disk now      ${nowHash}`)
    console.error('The row\'s expected role was established for the old content. Re-add the row (--force) before recording.')
    process.exit(EXIT_ROW_UNGROUNDED)
  }
}

// THE INSTRUMENT CHECK. Re-extract, right now, from the loop.js on disk. --absent is
// passed through for the absence arm, because extract refuses a missing path unless the
// caller states that the absence is what is being measured — and here the row states it.
const ex = spawnSync(process.execPath, [join(ROOT, 'scripts', 'oracle-extract.mjs'),
  '--artifact', row.artifact, '--goal', row.goal, ...(row.inspect ? ['--inspect', row.inspect] : []),
  ...(isAbsence ? ['--absent'] : []), '--json'],
  { encoding: 'utf8', cwd: ROOT })
if (ex.status !== 0) {
  console.error('record: could not re-extract the live prompt, so this observation cannot be tied to an instrument.')
  console.error(String(ex.stderr || '').trim().split('\n').slice(0, 4).map(l => '    ' + l).join('\n'))
  process.exit(1)
}

const live = JSON.parse(ex.stdout)
if (live.prompt_hash !== promptHash || live.schema_fingerprint !== schemaFp) {
  console.error(`record: the observation was made against a DIFFERENT instrument than the one on disk.`)
  console.error(`    observed against prompt ${promptHash}`)
  console.error(`    loop.js now produces    ${live.prompt_hash}`)
  if (live.schema_fingerprint !== schemaFp) {
    console.error(`    observed against schema ${schemaFp}`)
    console.error(`    loop.js now produces    ${live.schema_fingerprint}`)
  }
  console.error('')
  console.error('This is the refusal that exists because the prompt changed once already and silently invalidated')
  console.error('five of seven observations. Re-run the observation against the current prompt; do not record this one.')
  process.exit(EXIT_STALE_INSTRUMENT)
}

const rec = {
  row: rowId,
  arm: row.arm,
  artifact: row.artifact,
  expected_role: row.expected_role,
  // Carried from the row. A DISPUTED row is one whose two independent classifiers
  // disagreed about what the artifact emitted, so its expected_role is contested — an
  // observation against it cannot be scored right or wrong without picking a side,
  // which is the answer key again.
  disputed: !!row.disputed,
  predicted_role: predicted,
  correct: predicted === row.expected_role,
  what_it_is: whatItIs || null,
  reasoning: reasoning || null,
  prompt_hash: promptHash,
  // Recorded from the LIVE extraction rather than the caller: the caller already
  // proved it is on the current instrument by matching prompt_hash above, and the
  // template is what the report groups by.
  template_hash: live.template_hash,
  schema_fingerprint: schemaFp,
  observer,
  // The join, and nothing derived from it. Which pairing these two sides belong to and
  // which draw they were taken in; the verdict they compose to is recomputed on every
  // read by running loop.js.
  ...(pairing ? { pairing, pairing_draw: pairingDraw } : {}),
  // Present only when a response on disk was checked against these fields. Its absence
  // means attested, and oracle-report says so rather than letting the two look alike.
  ...(corroboration ? { corroboration } : {}),
}
appendFileSync(RESULTS, JSON.stringify(rec) + '\n')
console.log(`recorded ${rowId}: expected ${row.expected_role}, got ${predicted} — ${rec.correct ? 'CORRECT' : 'WRONG'}${pairing ? `  [pairing ${pairing}, draw ${pairingDraw}]` : ''}`)
