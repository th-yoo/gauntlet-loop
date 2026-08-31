// Draw members from the committed frame, deterministically, and record every draw.
//
//   node scripts/frame-draw.mjs --seed <word> --n <k> --list   # the plan, no network
//   node scripts/frame-draw.mjs --seed <word> --n <k>          # fetch, verify, ledger
//
// Issue 73. The frame (oracle/frame.json) is the population; this tool is the only
// thing that turns a member into material a row can be grounded on, and it records
// EVERY member it touches in the draw ledger — fetched, or attrition with the reason.
// Selection bias re-enters through silent attrition: a member quietly skipped because
// its README was huge, or gone, or awkward, is the authored corpus wearing a frame.
//
// DETERMINISM IS THE CLAIM. rank = sha256("<seed>:<full_name>"), ascending; the first
// n of that order are the draw. Re-running with the same seed and frame must name the
// same members in the same order, or every rate above this is void — issue 73 lists
// that as falsifier one. The test pins a hand-computed golden ranking AND runs the
// plan twice; the formula lives here only.
//
// DRIFT CANNOT ARRIVE, it can only fail. The fetch is BY BLOB SHA — content-addressed,
// so GitHub either returns bytes that hash to the pinned sha or the git object model is
// broken — and the hash is RECOMPUTED here (git blob sha1: "blob <len>\0<bytes>") rather
// than trusted from the response envelope. A mismatch, a vanished blob, or an over-bound
// README is an attrition row, never a substitution.
//
// WHAT THE SUITE DOES NOT MEASURE, stated: the network path. Tests drive the exported
// plan/verify/ledger pieces and --list; a fetch needs GitHub, and a suite that needs
// GitHub is red on every airplane. The verify function is the same one the CLI calls.

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, appendFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, basename, resolve } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FRAME = process.env.ORACLE_FRAME || join(ROOT, 'oracle', 'frame.json')
const LEDGER = process.env.ORACLE_DRAWS || join(ROOT, 'oracle', 'sampled-draws.jsonl')
const FIXDIR = process.env.ORACLE_SAMPLED_FIXTURES || join(ROOT, 'oracle', 'fixtures', 'sampled')

// An authored bound, and it is a bound on FIXTURES, not on membership: an over-bound
// member stays in the frame and its draw is recorded as attrition with this number in
// the reason, so the cost of the bound is countable instead of invisible.
export const README_BYTE_BOUND = 262144

export const rankOf = (seed, fullName) => createHash('sha256').update(`${seed}:${fullName}`).digest('hex')

export function drawPlan(frame, seed, n) {
  const ranked = [...frame.members]
    .map(m => ({ m, rank: rankOf(seed, m.full_name) }))
    .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0))
  return ranked.slice(0, n).map((x, i) => ({ index: i, full_name: x.m.full_name, rank: x.rank, member: x.m }))
}

// git's own object hash, recomputed from the bytes — the pinned sha is only a pin if
// something derives it again from the artifact. sha1 because that is what a git blob
// sha IS; this is an identity check against git's namespace, not a security boundary.
export const gitBlobSha = buf => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex')

export function verifyBlob(member, buf) {
  if (buf.length > README_BYTE_BOUND) {
    return { ok: false, why: `readme is ${buf.length} bytes, over the ${README_BYTE_BOUND}-byte fixture bound — kept in the frame, excluded from fixtures, counted as attrition` }
  }
  const got = gitBlobSha(buf)
  if (got !== member.readme_sha) {
    return { ok: false, why: `fetched bytes hash to ${got}, not the pinned ${member.readme_sha} — not this frame's member, refused rather than substituted` }
  }
  return { ok: true }
}

// ONE ROW PER PLANNED MEMBER, whatever happened — the property issue 73 lists as its
// second falsifier. Every input shape returns a row with a status, and every non-fetched
// status carries its why; a caller that could reach a branch returning nothing would be
// the silent attrition this ledger exists to make impossible. The fetch itself is the
// caller's; this decides what the fetch's outcome MEANS.
export function drawOne(planned, fetch) {
  const row = { full_name: planned.full_name, index: planned.index, rank: planned.rank, readme_sha: planned.member.readme_sha, goal: planned.member.description ?? null }
  if (fetch.error) {
    return { ...row, status: 'attrition', why: `the pinned blob could not be fetched (${fetch.error}) — a crash, not a judgement about the member` }
  }
  const v = verifyBlob(planned.member, fetch.bytes)
  if (!v.ok) return { ...row, status: 'attrition', why: v.why }
  if (row.goal === null) {
    return { ...row, status: 'attrition', why: 'the member has no description, so no goal is derivable mechanically — kept in the frame, counted here' }
  }
  return { ...row, status: 'fetched' }
}

export const ledgerRows = path => {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l) } catch { return { unparseable: l.slice(0, 80) } } })
}

const arg = n => { const i = process.argv.indexOf(n); return i === -1 ? null : process.argv[i + 1] }

// The same import-does-not-run guard coverage-sweep uses, for the same reason: the
// exported pieces are what the suite drives, and importing them must not touch a ledger.
const INVOKED = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (INVOKED) {
  const seed = arg('--seed')
  const n = Number(arg('--n'))
  if (!seed || !Number.isInteger(n) || n < 1) {
    console.error('usage: node scripts/frame-draw.mjs --seed <word> --n <k> [--list]')
    console.error('The seed is part of the record: a draw whose seed is lost cannot be re-derived, and')
    console.error('an unrecorded re-draw with a fresh seed is how a sampled corpus gets cherry-picked.')
    process.exit(2)
  }
  if (!existsSync(FRAME)) {
    console.error(`frame-draw: REFUSED — no frame at ${FRAME}. A draw without a committed population is`)
    console.error('the authored corpus with extra steps; run scripts/frame-snapshot.mjs first.')
    process.exit(2)
  }
  const frame = JSON.parse(readFileSync(FRAME, 'utf8'))
  const plan = drawPlan(frame, seed, n)

  if (process.argv.includes('--list')) {
    for (const p of plan) console.log(`${String(p.index).padStart(3)} ${p.rank.slice(0, 12)} ${p.full_name}`)
    console.log(`\nframe ${frame.frame_id} — ${plan.length} of ${frame.n} members, seed ${JSON.stringify(seed)}. No network was touched.`)
    process.exit(0)
  }

  const prior = ledgerRows(LEDGER)
  const already = new Set(prior.filter(r => r.frame_id === frame.frame_id && r.seed === seed).map(r => r.full_name))
  let fetched = 0, attrition = 0, skipped = 0
  for (const p of plan) {
    if (already.has(p.full_name)) { skipped++; continue }
    const r = spawnSync('gh', ['api', `repos/${p.full_name}/git/blobs/${p.member.readme_sha}`, '--jq', '.content'], { encoding: 'utf8', timeout: 60_000, maxBuffer: 32 * 1024 * 1024 })
    const fetch = r.error || r.status !== 0
      ? { error: (r.error && r.error.message) || String(r.stderr).trim().split('\n')[0] || `gh exited ${r.status}` }
      : { bytes: Buffer.from(r.stdout.replace(/\n/g, ''), 'base64') }
    const row = { frame_id: frame.frame_id, seed, ...drawOne(p, fetch) }
    if (row.status === 'fetched') {
      const dir = join(FIXDIR, p.full_name.replace('/', '__'))
      mkdirSync(dir, { recursive: true })
      const file = join(dir, basename(p.member.readme_path))
      writeFileSync(file, fetch.bytes)
      row.fixture = file.startsWith(ROOT) ? file.slice(ROOT.length + 1) : file
      fetched++
    } else attrition++
    appendFileSync(LEDGER, JSON.stringify(row) + '\n')
  }
  console.log(`frame-draw: ${fetched} fetched, ${attrition} attrition (reasons in the ledger), ${skipped} already drawn under this seed`)
  console.log(`            ledger ${LEDGER} — every member the plan named has a row; a drawn member`)
  console.log('            with no row would be silent attrition, which is the one thing this ledger exists to make impossible.')
}
