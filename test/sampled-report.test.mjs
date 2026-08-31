// The sampled cohort's accounting can fail, and its scope disclosure cannot be deleted.
//
//   node test/sampled-report.test.mjs
//
// Issue 73's falsifiers, at the accounting layer: a sampled row that cannot show which
// draw produced it must FAIL the report (silent provenance loss is the authored corpus
// wearing a frame), attrition must be printed with its reasons (a rate over grounded
// rows silently conditions on "groundable"), and the authored-frame scope must print on
// EVERY branch — the branch that carries numbers is the branch that must say what they
// mean, and deleting those lines goes red here.
//
// Everything runs against constructed files in a temp directory through the same env
// seams the tools themselves honour; the tracked oracle/ files are never touched.

import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

let failures = 0
const ok = (cond, m) => { if (cond) console.log(`  ok    ${m}`); else { console.error(`  FAIL  ${m}`); failures++ } }

const dir = mkdtempSync(join(tmpdir(), 'sampled-report-'))
const F = join(dir, 'frame.json'), L = join(dir, 'draws.jsonl'), S = join(dir, 'sampled.jsonl')
const run = (env = {}) => spawnSync(process.execPath, ['scripts/sampled-report.mjs'], {
  encoding: 'utf8', cwd: ROOT,
  env: { ...process.env, ORACLE_FRAME: F, ORACLE_DRAWS: L, ORACLE_SAMPLED: S, ...env },
})

const frame = { frame_id: 'tf', query: 'q', n: 2, authored: 'the query is a choice', members: [] }
const drawRow = (name, status, extra = {}) => JSON.stringify({ frame_id: 'tf', seed: 's1', index: 0, rank: 'r', full_name: name, readme_sha: 'x', goal: 'g', status, ...extra }) + '\n'

const DISCLOSURE = /Random within an authored frame — never representative/
const ATTRITION_SCOPE = /silently conditions on/

console.log('sampled-report: a clean cohort accounts for every member and still states its scope')
{
  writeFileSync(F, JSON.stringify(frame))
  writeFileSync(L, drawRow('a/one', 'fetched', { fixture: 'fx/one/README.md' }) + drawRow('b/two', 'attrition', { why: 'the member has no description, so no goal is derivable mechanically' }))
  writeFileSync(S, JSON.stringify({ id: 'one', artifact: 'fx/one/README.md', expected_role: 'produces-an-instruction', disputed: false }) + '\n')
  const r = run()
  ok(r.status === 0, `clean accounting exits 0 (got ${r.status}): ${r.stderr.slice(0, 120)}`)
  ok(/population\s+2 members/.test(r.stdout), 'the population count is the frame\'s N — the denominator issue 38 said no rate here had')
  ok(/attrition\s+b\/two: the member has no description/.test(r.stdout), 'attrition is printed per member WITH its reason — the only record of what "groundable" excluded')
  ok(/grounded\s+1 row/.test(r.stdout) && /a\/one \(produces-an-instruction\)/.test(r.stdout), 'grounded rows are joined to their draw and named with their role')
  ok(DISCLOSURE.test(r.stdout) && ATTRITION_SCOPE.test(r.stdout),
     'the authored-frame scope and the attrition-conditioning line print on the clean branch — the branch that carries the numbers')
}

console.log('sampled-report: a row with no draw provenance fails, in the failure\'s own words')
{
  writeFileSync(S, JSON.stringify({ id: 'ghost', artifact: 'fx/uninvited/README.md', expected_role: 'does-the-work' }) + '\n')
  const r = run()
  ok(r.status === 1, `an orphan row exits 1 (got ${r.status})`)
  ok(/no draw provenance is the authored corpus wearing a frame/.test(r.stderr),
     'and the failure says what the orphan means, not just that a join missed')
  ok(DISCLOSURE.test(r.stdout), 'the scope disclosure prints on the failing branch too — a reader arrives at whichever branch printed')
}

console.log('sampled-report: a ledger row citing another frame is not this population')
{
  writeFileSync(S, '')
  writeFileSync(L, JSON.stringify({ frame_id: 'other-frame', seed: 's', full_name: 'c/three', status: 'fetched', fixture: 'fx/c/README.md' }) + '\n')
  const r = run()
  ok(r.status === 1 && /not the committed tf/.test(r.stderr),
     'a row denominated in a different frame fails rather than swelling this one\'s counts')
}

console.log('sampled-report: an unreadable ledger line is reported, not swallowed')
{
  writeFileSync(L, 'not json at all\n' + drawRow('a/one', 'fetched', { fixture: 'fx/one/README.md' }))
  writeFileSync(S, '')
  const r = run()
  ok(r.status === 1 && /unreadable ledger line/.test(r.stderr), 'a member that cannot be read is a member that cannot be accounted for — reported')
}

console.log('sampled-report: draws without a frame are refused — a numerator with nothing under it')
{
  const r = run({ ORACLE_FRAME: join(dir, 'absent.json') })
  ok(r.status === 2 && /denominator/.test(r.stderr + r.stdout), 'refused with the reason, not reported as a clean empty cohort')
}

console.log('sampled-report: no frame and no data is a cohort that does not exist, said plainly')
{
  const r = run({ ORACLE_FRAME: join(dir, 'absent.json'), ORACLE_DRAWS: join(dir, 'absent.jsonl'), ORACLE_SAMPLED: join(dir, 'absent2.jsonl') })
  ok(r.status === 0 && /does not exist yet/.test(r.stdout), 'and it says the authored corpus\'s own disclosure is untouched by that')
}

rmSync(dir, { recursive: true, force: true })

console.log('sampled-report: stating what this suite cannot establish')
console.log('          NOT MEASURED: the real oracle/ files — this drives constructed ones through the')
console.log('          same env seams. NOT MEASURED: instrument rates over sampled rows; those are')
console.log('          oracle-report\'s, run with the sampled env, and its disclosures apply there.')

if (failures) {
  console.error(`\nsampled-report: ${failures} failure(s) — a cohort that cannot show its draws, or hides what its numbers mean, overclaims.`)
  process.exit(1)
}
console.log('\nsampled-report: OK — provenance joins are enforced, attrition is spoken, and the scope prints on every branch.')
