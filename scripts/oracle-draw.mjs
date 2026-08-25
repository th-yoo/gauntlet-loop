// Produce oracle observations instead of being told about them. #39.
//
//   node scripts/oracle-draw.mjs --row <id>        [--draws 2] [--dry-run]
//   node scripts/oracle-draw.mjs --all             [--draws 2] [--dry-run]
//   node scripts/oracle-draw.mjs --pairing <id>    [--draws 2] [--dry-run]
//   node scripts/oracle-draw.mjs --all-pairings    [--draws 2] [--dry-run]
//
// THIS SPAWNS LIVE AGENTS. It is the only file here that does, and everything below is
// arranged around that one fact.
//
// WHY IT EXISTS. `oracle-record.mjs` validates exactly one thing about an observation:
// that the predicted role is in the schema. The reasoning and the observer name are
// caller-supplied strings, so an observation could be — and during a root-cause pass, was
// — typed by hand and accepted. The two hashes it enforces prove WHICH PROMPT an
// observation belongs to, never that anybody ran it. And re-collection after a prompt
// change costs one hand invocation per draw, which is why evidence lags the prompt.
//
// WHAT IT RECORDS, AND WHAT THAT IS WORTH. Each draw's response is written to disk and
// named by the observation, so an observation can be traced back to the text it came
// from. That is not a proof of origin and is not offered as one — a person recording by
// hand could write the same file, and nothing here would know. Nothing in this corpus's
// history shows that happening. What it makes checkable is narrower: that an
// observation's fields are the ones its response actually contains.
//
// ── CONTAINMENT ─────────────────────────────────────────────────────────────────────
// This repository has already produced a fork bomb: a live `claude -p` sat in a test
// canary, a mutation sweep removed the guard in front of it and ran it, and the agent it
// spawned re-entered the repo and re-ran the suite that spawned it. Depth 13, 22 live
// agents, ~3.5 minutes (docs/runs/2026-08-25-oracle-fork-bomb/). Three barriers, because
// each can be true while another is false:
//
//   1. STATIC — test/drift-guard.mjs fails if any file the suite or a mutation sweep runs
//      so much as names this one. A test that wants to prove this refuses must assert on
//      the message without naming or invoking the file.
//   2. DYNAMIC — run-all and mutate's check set GAUNTLET_SUITE, this refuses while it is
//      set, and env is inherited by every descendant. That is the reachability a name scan
//      cannot see: an agent that re-enters the repo from inside a suite run carries the
//      marker, so it cannot spawn either.
//   3. SELF-BOUNDING — a hard ceiling on spawns per invocation and a timeout per spawn.
//      Note what the timeout does not do: killing the child does not kill what the child
//      spawned. It bounds the wait, not the blast.
//
// ALL THREE BARRIERS ARE CHECKED BY test/containment.test.mjs, and none of its cases runs
// this file. They are claims about SOURCE: that nothing the suite executes names a
// model-spawner, that the marker refusal is reached before any spawn call is, and that
// every spawn carries a timeout under a ceiling that is compared before it. That file
// finds its subjects by what they do rather than by name, so a second spawner added later
// is covered without an edit here.
//
// An earlier version of this paragraph said barriers 1 and 2 could not both be automated —
// that a test proving the refusal would have to invoke the spawner, and barrier 1 forbids
// that. Wrong, and worth leaving recorded: it is true only of a test that INVOKES. The
// postmortem had already said what to do instead — "verify by mutation that removing the
// guard cannot reach a spawn of an interactive binary" — and reachability is a property of
// the text. Declaring something untestable is cheap and was, here, premature.
//
// STILL NEVER EXECUTED: the spawn itself. `--dry-run` exercises every line except
// spawnSync('claude', ...) and everything downstream of it — response parsing, the schema
// check, the raw-response record, the handoff to oracle-record. No static check reaches
// that; only a live draw does.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const EXTRACT = join(ROOT, 'scripts', 'oracle-extract.mjs')
const RECORD = join(ROOT, 'scripts', 'oracle-record.mjs')
const CORPUS = process.env.ORACLE_CORPUS || join(ROOT, 'oracle', 'corpus.jsonl')
const PAIRINGS = process.env.ORACLE_PAIRINGS || join(ROOT, 'oracle', 'pairings.jsonl')

// BARRIER 2. First statement that runs, before any argument is even read, so there is no
// path through this file that reaches a spawn with the marker set.
if (process.env.GAUNTLET_SUITE) {
  console.error('oracle-draw: refusing — GAUNTLET_SUITE is set, so this process descends from a test suite or a mutation sweep.')
  console.error('This tool spawns live agents. A sweep exists to remove a guard and run the check anyway, and an agent')
  console.error('spawned from inside one re-enters this repo carrying the same marker. That is how this repo reached')
  console.error('depth 13 in 3.5 minutes. See docs/runs/2026-08-25-oracle-fork-bomb/.')
  process.exit(2)
}

// BARRIER 3. Ceilings, not defaults — an invocation cannot ask for more.
const MAX_SPAWNS_PER_RUN = 40
const SPAWN_TIMEOUT_MS = 180_000

const argv = process.argv.slice(2)
const FLAGS = ['--row', '--draws', '--observer', '--pairing']
const arg = n => { const i = argv.indexOf(n); const v = argv[i + 1]; return i === -1 || v === undefined || FLAGS.includes(v) ? null : v }
const rowId = arg('--row')
const all = argv.includes('--all')
const pairingId = arg('--pairing')
const allPairings = argv.includes('--all-pairings')
const dryRun = argv.includes('--dry-run')
const draws = Math.max(1, Number(arg('--draws') || 2))
const observer = arg('--observer') || 'oracle-draw'

const modes = [rowId, all, pairingId, allPairings].filter(Boolean).length
if (modes !== 1) {
  console.error('usage: node scripts/oracle-draw.mjs (--row <id> | --all | --pairing <id> | --all-pairings) [--draws 2] [--observer <name>] [--dry-run]')
  console.error('--dry-run does everything except spawn: it resolves rows, captures the live prompt, and prints what it would send.')
  console.error('')
  console.error('--pairing draws BOTH SIDES of a declared pairing in this one invocation and joins them with a draw')
  console.error('id, which is what makes the pair an observation of the VERDICT rather than of two roles. Per-side')
  console.error('draws cannot be assembled into one afterwards: the pairing check runs both sides in one pass, and')
  console.error('two sides taken at different times are two measurements of two moments.')
  process.exit(2)
}
if (!existsSync(CORPUS)) { console.error(`oracle-draw: no corpus at ${CORPUS}`); process.exit(2) }

const rows = readFileSync(CORPUS, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
const byId = new Map(rows.map(r => [r.id, r]))
const pairMode = !!(pairingId || allPairings)

// PAIRINGS RESOLVE TO ROWS, and a pairing naming a row the corpus does not have is refused
// rather than drawn one-sided: half a pairing is not a smaller pairing.
let pairTargets = []
if (pairMode) {
  if (!existsSync(PAIRINGS)) { console.error(`oracle-draw: no pairings ledger at ${PAIRINGS}. Declare one with scripts/oracle-pair.mjs first.`); process.exit(2) }
  const pairs = readFileSync(PAIRINGS, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  const wanted = allPairings ? pairs : pairs.filter(p => p.id === pairingId)
  if (!wanted.length) { console.error(`oracle-draw: no pairing "${pairingId}". Known: ${pairs.map(p => p.id).join(', ') || '(none)'}`); process.exit(2) }
  for (const p of wanted) {
    const sides = p.sides.map(id => byId.get(id))
    if (sides.some(x => !x)) { console.error(`oracle-draw: pairing "${p.id}" names a row the corpus does not have (${p.sides.join(', ')}).`); process.exit(2) }
    pairTargets.push({ pairing: p, sides })
  }
}
const targets = pairMode ? [] : all ? rows : rows.filter(r => r.id === rowId)
if (!pairMode && !targets.length) { console.error(`oracle-draw: no row "${rowId}". Known: ${rows.map(r => r.id).join(', ')}`); process.exit(2) }

// BARRIER 3, ENFORCED. A pairing costs two spawns per draw, because both sides are drawn
// here — that is the point of the mode, and it is also the reason the ceiling has to count
// sides rather than targets.
const planned = pairMode ? pairTargets.length * 2 * draws : targets.length * draws
if (planned > MAX_SPAWNS_PER_RUN) {
  console.error(`oracle-draw: ${pairMode ? `${pairTargets.length} pairing(s) x 2 sides` : `${targets.length} row(s)`} x ${draws} draw(s) = ${planned} spawns, over the ceiling of ${MAX_SPAWNS_PER_RUN}.`)
  console.error('The ceiling is not a default to raise. Narrow the run, or make several.')
  process.exit(2)
}

const ROLES = ['does-the-work', 'produces-an-instruction', 'could-not-open']
const sha = s => 'sha256:' + createHash('sha256').update(s).digest('hex')
const RAW = join(ROOT, 'oracle', 'raw')
// One stamp per invocation, so a draw id says which run produced it and two runs of the
// same pairing cannot collide.
const RUN_STAMP = Date.now().toString(36)

function livePrompt(row) {
  const r = spawnSync(process.execPath, [EXTRACT, '--artifact', row.artifact, '--goal', row.goal,
    // The absence arm's artifact is not there on purpose; extract refuses a missing path
    // unless told the absence is the measurement.
    ...(row.arm === 'could-not-open' ? ['--absent'] : []), '--json'],
    { encoding: 'utf8', cwd: ROOT, timeout: 60_000 })
  if (r.status !== 0) throw new Error(`extraction failed for ${row.id}: ${String(r.stderr || '').trim().split('\n').slice(-2).join(' | ')}`)
  return JSON.parse(r.stdout)
}

// The prompt goes to the agent UNCHANGED, plus the one instruction the runtime would
// otherwise supply: answer in the schema's shape. Retyping any of the question here would
// rebuild the second copy oracle-extract exists to avoid.
function askedOf(prompt) {
  return `${prompt}\n\nReturn ONLY a JSON object, no other text: {"verdict": one of ${ROLES.map(r => JSON.stringify(r)).join('|')}, "reasoning": "<what in the artifact settles it>", "what_it_is": "<what kind of object it is, in your own words>"}`
}

let spawned = 0
const produced = []

// ONE SIDE, DRAWN. Returns null when the probe produced nothing usable — a dead probe, a
// non-JSON answer, an answer outside the schema — because none of those is an observation
// and recording one would be inventing an answer for an agent that did not give one.
function drawSide(row, label) {
  let live
  try { live = livePrompt(row) } catch (e) { console.error(String(e.message)); process.exit(1) }
  const text = askedOf(live.prompt)
  if (dryRun) {
    console.log(`[dry-run] ${label} — would spawn claude -p for ${row.id}, ${text.length} chars, prompt ${live.prompt_hash.slice(0, 23)}…`)
    return null
  }
  if (spawned >= MAX_SPAWNS_PER_RUN) { console.error('oracle-draw: spawn ceiling reached mid-run'); process.exit(1) }
  spawned++
  const started = Date.now()
  const r = spawnSync('claude', ['-p', text], { encoding: 'utf8', cwd: ROOT, timeout: SPAWN_TIMEOUT_MS })
  const ms = Date.now() - started
  if (r.status !== 0 || !r.stdout) {
    console.error(`oracle-draw: ${label} produced nothing (status ${r.status}). Not recorded — a dead probe is not an answer.`)
    return null
  }
  const raw = r.stdout
  let parsed
  try { parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) } catch {
    console.error(`oracle-draw: ${label} did not return JSON. Not recorded.`)
    return null
  }
  if (!ROLES.includes(parsed.verdict)) {
    console.error(`oracle-draw: ${label} answered "${parsed.verdict}", outside the schema. Not recorded.`)
    return null
  }
  // The response, kept so the observation can be traced back to it. oracle-record
  // refuses unless the fields it is handed are the ones this file contains.
  mkdirSync(RAW, { recursive: true })
  const rawPath = join(RAW, `${row.id}-${live.prompt_hash.slice(7, 19)}-${sha(raw).slice(7, 15)}.txt`)
  writeFileSync(rawPath, raw)
  return { row, live, parsed, rawPath, ms }
}

// Recording is delegated, and deliberately: every check that decides whether an observation
// is admissible — the instrument hashes, the row's grounding, the response the fields must
// agree with, and now which pairing and draw a side belongs to — lives in a file the suite
// can run. Nothing the suite runs may name this one.
function recordSide(side, tag, extra = []) {
  const rec = spawnSync(process.execPath, [RECORD,
    '--row', side.row.id, '--predicted', side.parsed.verdict,
    '--reasoning', String(side.parsed.reasoning || ''), '--what-it-is', String(side.parsed.what_it_is || ''),
    '--prompt-hash', side.live.prompt_hash, '--schema-fingerprint', side.live.schema_fingerprint,
    '--observer', tag,
    // The response this observation came from, checked by oracle-record against these
    // very fields. Writing the file and not referencing it — which is what this did at
    // first — leaves corroboration sitting beside the ledger with nothing joining them,
    // and an observation you cannot trace back to a response is an attested one.
    '--raw', side.rawPath.replace(ROOT + '/', ''), ...extra], { encoding: 'utf8', cwd: ROOT, timeout: 60_000 })
  console.log(`${side.row.id}  ${side.parsed.verdict}  ${side.ms} ms  raw ${side.rawPath.replace(ROOT + '/', '')}  ${rec.status === 0 ? String(rec.stdout).trim() : 'RECORD REFUSED: ' + String(rec.stderr || '').trim().split('\n')[0]}`)
  produced.push({ row: side.row.id, verdict: side.parsed.verdict, recorded: rec.status === 0 })
  return rec.status === 0
}

for (const row of targets) {
  for (let d = 1; d <= draws; d++) {
    const side = drawSide(row, `${row.id} draw ${d}/${draws}`)
    if (side) recordSide(side, `${observer}:${d}`)
  }
}

// ── PAIRING DRAWS ───────────────────────────────────────────────────────────────────
//
// BOTH SIDES IN ONE INVOCATION. That is the whole difference from drawing the two rows
// separately, and it is what #37 is about: the pairing check runs roleOf on both artifacts
// in one pass and composes the verdict from what came back. Nothing recorded here is the
// verdict — oracle-report recomposes it by running loop.js on the two roles.
//
// WHAT THE JOIN CANNOT ESTABLISH, said here as well as in the report: a draw id records
// that two sides belong to one draw. Someone recording by hand could pass the same id to
// two sides taken an hour apart, and no check anywhere would know. This is the same
// residual --raw carries.
for (const { pairing, sides } of pairTargets) {
  for (let d = 1; d <= draws; d++) {
    const drawId = `${pairing.id}-${RUN_STAMP}-${d}`
    console.log(`\n${pairing.id} draw ${d}/${draws} (${drawId}) — both sides, this invocation`)
    const drawn = sides.map(row => drawSide(row, `${pairing.id} draw ${d}/${draws}: ${row.id}`))
    if (drawn.some(x => !x)) {
      // A HALF DRAW IS NOT A SMALLER PAIRING. The surviving side is still a perfectly good
      // per-side observation and is recorded as one, without the pairing tag — recording it
      // WITH the tag would leave a draw the report can only exclude, and dropping it would
      // throw away an answer an agent actually gave.
      const alive = drawn.filter(Boolean)
      if (!dryRun) console.error(`oracle-draw: ${pairing.id} draw ${d} abandoned as a pairing — ${drawn.length - alive.length} of 2 sides produced nothing.`)
      for (const side of alive) {
        if (!dryRun) console.error(`  ${side.row.id} answered, and is recorded as a plain per-side observation with no pairing tag.`)
        recordSide(side, `${observer}:${d}`)
      }
      continue
    }
    for (const side of drawn) recordSide(side, `${observer}:${d}`, ['--pairing', pairing.id, '--pairing-draw', drawId])
  }
}

if (dryRun) {
  console.log(`\n[dry-run] ${pairMode ? `${pairTargets.length} pairing(s) x 2 sides` : `${targets.length} row(s)`} x ${draws} draw(s) = ${planned} spawns, ceiling ${MAX_SPAWNS_PER_RUN}. Nothing was spawned and nothing was recorded.`)
  process.exit(0)
}
console.log(`\n${spawned} spawn(s), ${produced.filter(p => p.recorded).length} recorded.`)
console.log('Each observation names the response it came from, and oracle-record checked its fields')
console.log('against that response. That records where an observation came from; it does not establish it.')
if (pairMode) {
  console.log('A pairing draw records that its two sides were drawn together. Nothing here can establish that,')
  console.log('and oracle-report says so beside the rate rather than leaving the stronger reading available.')
}
