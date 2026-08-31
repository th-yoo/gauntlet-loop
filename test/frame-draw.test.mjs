// The sampled corpus's draw is deterministic, verified against git's own namespace,
// and cannot lose a member in silence.
//
//   node test/frame-draw.test.mjs
//
// Issue 73 lists its falsifiers and the first two are this file's cases: same seed,
// same frame, different member list means the sampler is broken and every rate above
// it is void; a drawn member missing from the ledger means attrition is silent and
// the cohort is the authored corpus wearing a frame. The suite never touches the
// network — the exported plan, verify and row-decision functions are the same ones
// the CLI calls, and --list is the CLI path that needs no GitHub.

import { drawPlan, rankOf, gitBlobSha, verifyBlob, drawOne, README_BYTE_BOUND } from '../scripts/frame-draw.mjs'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

let failures = 0
const ok = (cond, m) => { if (cond) console.log(`  ok    ${m}`); else { console.error(`  FAIL  ${m}`); failures++ } }

const member = (full_name, over = {}) => ({ full_name, default_branch: 'main', head_sha: 'h', stars: 1, description: `about ${full_name}`, readme_path: 'README.md', readme_sha: gitBlobSha(Buffer.from(`readme of ${full_name}\n`)), readme_size: 1, ...over })
const tiny = { frame_id: 'test-frame', n: 3, members: [member('alpha/one'), member('beta/two'), member('gamma/three')] }

console.log('frame-draw: the ranking is the pinned formula, not whatever the code currently does')
{
  // Hand-computed once: sha256("golden-seed:<name>") — recompute with
  //   node -e "console.log(require('crypto').createHash('sha256').update('golden-seed:alpha/one').digest('hex'))"
  // The golden literals are the anchor OUTSIDE the script: if the formula drifts
  // (seed and name swapped, a different hash, a different separator), the plan still
  // agrees with itself twice, and only these constants notice.
  ok(rankOf('golden-seed', 'alpha/one') === '54d7b1ec6f5a490761c47060acd129b56c64bdffc5f673fa2eb9e3360597d449',
     'rankOf matches the hand-computed sha256 for a known seed and member')
  const plan = drawPlan(tiny, 'golden-seed', 3)
  ok(plan.map(p => p.full_name).join(',') === 'alpha/one,beta/two,gamma/three',
     `the golden seed orders the tiny frame alpha,beta,gamma (got ${plan.map(p => p.full_name).join(',')})`)
}

console.log('frame-draw: the same seed reproduces the plan and a different seed does not')
{
  const frame = JSON.parse(readFileSync(join(ROOT, 'oracle', 'frame.json'), 'utf8'))
  const a = JSON.stringify(drawPlan(frame, 'issue73-batch1', 10).map(p => p.full_name))
  const b = JSON.stringify(drawPlan(frame, 'issue73-batch1', 10).map(p => p.full_name))
  const c = JSON.stringify(drawPlan(frame, 'another-seed', 10).map(p => p.full_name))
  ok(a === b, 'two plans from one seed name the same members in the same order — issue 73 falsifier one')
  ok(a !== c, 'a different seed reorders the draw — a sampler indifferent to its seed is a fixed list wearing one')
  ok(drawPlan(frame, 'issue73-batch1', 10).every(p => frame.members.some(m => m.full_name === p.full_name)),
     'every planned member is a frame member — the plan cannot introduce a repository the population does not hold')
}

console.log('frame-draw: the blob hash is recomputed against git\'s own namespace')
{
  ok(gitBlobSha(Buffer.from('hello\n')) === 'ce013625030ba8dba906f756967f9e9ca394464a',
     'gitBlobSha("hello\\n") equals git\'s canonical example hash — the anchor is git\'s namespace, not this repo\'s own formula')
  const m = member('x/y')
  ok(verifyBlob(m, Buffer.from('readme of x/y\n')).ok === true, 'bytes matching the pin verify')
  const bad = verifyBlob(m, Buffer.from('something else\n'))
  ok(bad.ok === false && bad.why.includes(m.readme_sha),
     'mismatched bytes are refused and the why names the pinned hash — refused rather than substituted')
  const big = verifyBlob(m, Buffer.alloc(README_BYTE_BOUND + 1))
  ok(big.ok === false && big.why.includes(String(README_BYTE_BOUND)),
     'an over-bound readme is refused and the why carries the bound, so the bound\'s cost is countable')
}

console.log('frame-draw: every planned member becomes a row, whatever the fetch did')
{
  const p = { full_name: 'x/y', index: 0, rank: 'r', member: member('x/y') }
  const crash = drawOne(p, { error: 'boom' })
  ok(crash.status === 'attrition' && /crash, not a judgement/.test(crash.why),
     'a failed fetch is an attrition row calling itself a crash — not a judgement about the member, and not silence')
  const drift = drawOne(p, { bytes: Buffer.from('not the pinned bytes\n') })
  ok(drift.status === 'attrition' && drift.why.includes(p.member.readme_sha),
     'unverifiable bytes are an attrition row naming the pin')
  const nodesc = drawOne({ ...p, member: member('x/y', { description: null }) }, { bytes: Buffer.from('readme of x/y\n') })
  ok(nodesc.status === 'attrition' && /no description/.test(nodesc.why),
     'a member with no mechanical goal is attrition WITH a reason — dropped at snapshot time it would have been attrition nothing counts')
  const good = drawOne(p, { bytes: Buffer.from('readme of x/y\n') })
  ok(good.status === 'fetched' && good.goal === 'about x/y',
     'verified bytes plus a mechanical goal is a fetched row carrying that goal verbatim')
  ok([crash, drift, nodesc, good].every(r => r.full_name === 'x/y' && r.status),
     'all four outcomes return a row with a status — no input shape returns nothing, which is what makes silent attrition impossible in the deciding function')
}

console.log('frame-draw: the CLI plans without a network and refuses without a frame')
{
  const dir = mkdtempSync(join(tmpdir(), 'frame-draw-'))
  const framePath = join(dir, 'frame.json')
  writeFileSync(framePath, JSON.stringify(tiny))
  const env = { ...process.env, ORACLE_FRAME: framePath }
  const list = spawnSync(process.execPath, ['scripts/frame-draw.mjs', '--seed', 'golden-seed', '--n', '2', '--list'], { encoding: 'utf8', cwd: ROOT, env })
  ok(list.status === 0 && /alpha\/one/.test(list.stdout) && /No network was touched/.test(list.stdout),
     '--list prints the plan and says no network was touched')
  const noframe = spawnSync(process.execPath, ['scripts/frame-draw.mjs', '--seed', 's', '--n', '1'], { encoding: 'utf8', cwd: ROOT, env: { ...process.env, ORACLE_FRAME: join(dir, 'absent.json') } })
  ok(noframe.status === 2 && /without a committed population/.test(noframe.stderr),
     'a draw with no frame is refused in the refusal\'s own words — the authored corpus with extra steps')
  const noargs = spawnSync(process.execPath, ['scripts/frame-draw.mjs'], { encoding: 'utf8', cwd: ROOT, env })
  ok(noargs.status === 2 && /seed is part of the record/.test(noargs.stderr),
     'a seedless draw is refused: an unrecorded re-draw with a fresh seed is how a sampled corpus gets cherry-picked')
  rmSync(dir, { recursive: true, force: true })
}

console.log('frame-draw: stating what this suite cannot establish')
console.log('          NOT MEASURED: the network path — the gh fetch, the fixture write, and the')
console.log('          append loop that gives each planned member its ledger row. Those run only')
console.log('          against GitHub, and a suite that needs GitHub is red on every airplane.')
console.log('          The deciding function is shared with the CLI; the loop around it is not driven here.')
console.log('          NOT MEASURED: the frame\'s own authorship. The query, the order and N are choices;')
console.log('          this file checks draws within the frame, and nothing can check the frame against the world.')

if (failures) {
  console.error(`\nframe-draw: ${failures} failure(s) — a sampler that cannot be re-derived, or loses members in silence, voids every rate above it.`)
  process.exit(1)
}
console.log('\nframe-draw: OK — the plan re-derives from the seed, the bytes re-derive from git\'s namespace, and every planned member gets a row.')
