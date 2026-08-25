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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// Same reason as oracle-add.mjs: a suite run under a removed guard must not be able
// to write into the tracked ledgers.
const CORPUS = process.env.ORACLE_CORPUS || join(ROOT, 'oracle', 'corpus.jsonl')
const RESULTS = process.env.ORACLE_RESULTS || join(ROOT, 'oracle', 'results.jsonl')
const ROLES = ['does-the-work', 'produces-an-instruction', 'could-not-open']

const argv = process.argv.slice(2)
const FLAGS = ['--row', '--predicted', '--reasoning', '--prompt-hash', '--schema-fingerprint', '--observer', '--what-it-is', '--raw']
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

if (!rowId || !predicted || !promptHash || !schemaFp) {
  console.error('usage: node scripts/oracle-record.mjs --row <id> --predicted <role> --reasoning "<text>" --prompt-hash <hash> --schema-fingerprint <hash> [--observer <name>] [--what-it-is "<text>"] [--raw <response file>]')
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
// insertions-only apart from one schema migration, and no record anywhere describes a
// corrected observation. This catches a MISMATCH between what was typed and what a
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

// The artifact must still be the one the row was grounded against.
const abs = existsSync(resolve(ROOT, row.artifact)) ? resolve(ROOT, row.artifact) : row.artifact
if (!existsSync(abs)) {
  console.error(`record: row "${rowId}" points at ${row.artifact}, which no longer exists. Its ground truth cannot be re-established, so an observation against it means nothing.`)
  process.exit(1)
}
const nowHash = 'sha256:' + createHash('sha256').update(readFileSync(abs)).digest('hex')
if (nowHash !== row.artifact_hash) {
  console.error(`record: ${row.artifact} has changed since row "${rowId}" was added.`)
  console.error(`    grounded against ${row.artifact_hash}`)
  console.error(`    on disk now      ${nowHash}`)
  console.error('The row\'s expected role was established for the old content. Re-add the row (--force) before recording.')
  process.exit(1)
}

// THE INSTRUMENT CHECK. Re-extract, right now, from the loop.js on disk.
const ex = spawnSync(process.execPath, [join(ROOT, 'scripts', 'oracle-extract.mjs'),
  '--artifact', row.artifact, '--goal', row.goal, ...(row.inspect ? ['--inspect', row.inspect] : []), '--json'],
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
  process.exit(1)
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
  // Present only when a response on disk was checked against these fields. Its absence
  // means attested, and oracle-report says so rather than letting the two look alike.
  ...(corroboration ? { corroboration } : {}),
}
appendFileSync(RESULTS, JSON.stringify(rec) + '\n')
console.log(`recorded ${rowId}: expected ${row.expected_role}, got ${predicted} — ${rec.correct ? 'CORRECT' : 'WRONG'}`)
