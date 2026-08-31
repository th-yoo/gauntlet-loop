// Enumerate the sampled corpus's population ONCE, and commit what was enumerated.
//
//   node scripts/frame-snapshot.mjs            # writes oracle/frame.json (refuses if present)
//   node scripts/frame-snapshot.mjs --force    # replaces it, which RETIRES the old frame
//
// Issue 73. The frame is the denominator issue 38 said no rate here had: a committed
// list of members, decided BEFORE any row is drawn, so a hard member cannot be quietly
// avoided. The query below is authored — a pinned GitHub search is a choice, top-by-stars
// is a bias — and the claim that survives is "random within this frame", which is why the
// snapshot records the query beside the members instead of pretending the members fell
// from the sky.
//
// THE SNAPSHOT IS THE POPULATION; the query is its provenance. GitHub search drifts,
// repositories move, READMEs change. Re-running the query tomorrow gives a different
// list, which is why the list is committed: draws are made against the frozen members,
// and a member whose content no longer matches its pinned blob hash is ATTRITION with a
// reason, never a silent substitution (that check lives in frame-draw.mjs, which fetches
// blobs BY HASH — content-addressed, so drift cannot even arrive).
//
// WHAT EACH MEMBER PINS. The README is resolved by GitHub's own /readme endpoint — one
// mechanical rule for every member, however the file is spelled — and pinned by its git
// blob sha. The goal is the repository description, verbatim, or null: a member with no
// description stays IN the frame and fails grounding with that reason recorded, because
// dropping it here would be attrition performed at snapshot time where no ledger sees it.

import { spawnSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = process.env.ORACLE_FRAME || join(ROOT, 'oracle', 'frame.json')

// Authored, and pinned so the authorship is inspectable: popular (a bias), recently
// pushed (a bias), first N of GitHub's star-descending order (a bias). N is what makes
// a denominator exist at all.
export const QUERY = 'stars:>=5000 pushed:>2026-01-01'
export const N = 200

const gh = args => {
  const r = spawnSync('gh', args, { encoding: 'utf8', timeout: 60_000 })
  if (r.error || r.status !== 0) {
    return { error: (r.error && r.error.message) || String(r.stderr).trim().split('\n')[0] || `gh exited ${r.status}` }
  }
  try { return { data: JSON.parse(r.stdout) } } catch { return { error: 'gh returned something that is not JSON' } }
}

async function main() {
  if (existsSync(OUT) && !process.argv.includes('--force')) {
    console.error(`frame-snapshot: REFUSED — ${OUT} already exists. A frame is a population other`)
    console.error('artifacts already cite by id; replacing it silently would re-denominate every rate')
    console.error('drawn against it. Pass --force to retire it deliberately, and expect every draw')
    console.error('ledger row citing the old frame_id to stop resolving.')
    process.exit(2)
  }

  const members = []
  for (let page = 1; members.length < N; page++) {
    const q = encodeURIComponent(QUERY)
    const res = gh(['api', `search/repositories?q=${q}&sort=stars&order=desc&per_page=100&page=${page}`])
    if (res.error) { console.error(`frame-snapshot: REFUSED — the search could not run (${res.error}). A frame built from a partial enumeration is a different population wearing the same id.`); process.exit(2) }
    if (!res.data.items || !res.data.items.length) break
    for (const it of res.data.items) {
      if (members.length >= N) break
      members.push({
        full_name: it.full_name,
        default_branch: it.default_branch,
        head_sha: null,          // filled below, per member
        stars: it.stargazers_count,
        description: it.description ?? null,
        readme_path: null,
        readme_sha: null,
        readme_size: null,
      })
    }
  }
  if (members.length < N) {
    console.error(`frame-snapshot: the query enumerated only ${members.length} of the intended ${N}.`)
    console.error('The frame is what was enumerable — recorded as such, not padded.')
  }

  let readmeless = 0
  for (const m of members) {
    const head = gh(['api', `repos/${m.full_name}/commits/${m.default_branch}`, '--jq', '{sha: .sha}'])
    m.head_sha = head.error ? null : head.data.sha
    const rd = gh(['api', `repos/${m.full_name}/readme`, '--jq', '{path: .path, sha: .sha, size: .size}'])
    if (rd.error) { readmeless++; continue }     // stays a member; grounding will record the reason
    m.readme_path = rd.data.path
    m.readme_sha = rd.data.sha
    m.readme_size = rd.data.size
  }

  const frame = {
    frame_id: `gh-stars5000-pushed2026-n${members.length}-2026-08-31`,
    query: QUERY,
    enumerated: new Date().toISOString(),
    order: 'github search sort=stars order=desc, first pages, as returned on the enumeration date',
    n: members.length,
    authored: 'the query, the cutoff, the order and N are choices; membership within them is not',
    members,
  }
  writeFileSync(OUT, JSON.stringify(frame, null, 1) + '\n')
  console.log(`frame-snapshot: ${OUT} — ${members.length} members, ${readmeless} with no resolvable README (kept; attrition is the draw ledger's to record, with reasons)`)
  console.log('               The frame is authored and says so in its own record. Rates drawn against it')
  console.log('               estimate THIS population, never the pairings operators bring.')
}
await main()
