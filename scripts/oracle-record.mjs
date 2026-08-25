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
const FLAGS = ['--row', '--predicted', '--reasoning', '--prompt-hash', '--schema-fingerprint', '--observer', '--what-it-is']
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

if (!rowId || !predicted || !promptHash || !schemaFp) {
  console.error('usage: node scripts/oracle-record.mjs --row <id> --predicted <role> --reasoning "<text>" --prompt-hash <hash> --schema-fingerprint <hash> [--observer <name>] [--what-it-is "<text>"]')
  process.exit(2)
}
if (!ROLES.includes(predicted)) {
  console.error(`record: "${predicted}" is not one of the three roles the schema allows (${ROLES.join(', ')}). An observation outside the schema is not an observation of this instrument.`)
  process.exit(2)
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
}
appendFileSync(RESULTS, JSON.stringify(rec) + '\n')
console.log(`recorded ${rowId}: expected ${row.expected_role}, got ${predicted} — ${rec.correct ? 'CORRECT' : 'WRONG'}`)
