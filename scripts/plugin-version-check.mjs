// Does agents/ still match what the current plugin version SHIPPED?
//
//   node scripts/plugin-version-check.mjs
//
// THE DEFECT — issue 68. The plugin cache path is version-pinned: an installed copy at
// 0.2.0 lives under .../gauntlet-loop/0.2.0/ and nothing about it can ever refresh.
// 2548f55 replaced all seven agents and edited plugin.json's DESCRIPTION, not its
// version, so every installed copy kept the old roster and the loop's first spawn failed
// before round 1 (run wf_048b9951-92e, agents_error: 1). The tree looked self-consistent
// the whole time — five agents on disk, five spawned — which is why nothing noticed for
// six commits. The bump to 0.3.0 fixed that instance; this is the check on the class.
//
// WHAT IS CHECKED, AND AGAINST WHAT. The version is a pin on presence: it says a release
// happened, not what it contained. The record of what a version shipped is not a list in
// a file — it is git: the tree of agents/ at the commit that set the version to its
// current value. This finds that commit (the newest one at which the version BECAME what
// it is now) and diffs agents/ from there to the working tree, untracked additions
// included. Any difference means an installed copy at this version does not have what
// the tree has, and the remedy is a bump — which is also what makes the difference
// disappear, because the bump commit becomes the record.
//
// Re-running beats pinning (CLAUDE.md). A manifest listing its agents would be a second
// copy of agents/ that has to be edited in step, and editing in step is precisely the
// discipline that failed. Nothing here is stored; a fabricated record would have to be a
// fabricated commit.
//
// EXIT CODES. 0: agents/ matches what the current version shipped, or the version is in
// no commit yet (an unshipped bump — the working tree is what it will ship). 1: agents/
// differs from the record; every difference is listed. 2: NOT ESTABLISHED — the record
// cannot be reached: a shallow clone that does not contain the bump commit, no manifest,
// no git. CI must check out full history or this cannot answer.
//
// PLUGIN_ROOT overrides the tree examined, so a test can point it at a throwaway
// repository built to make it fail. Same convention as CAPACITY_ADJUDICATIONS.

import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = process.env.PLUGIN_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST = '.claude-plugin/plugin.json'
const SCOPE = 'agents/'

const git = (...args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' })
const notEstablished = why => {
  console.error(`plugin-version-check: NOT ESTABLISHED — ${why}`)
  process.exit(2)
}

// The residual is printed on EVERY branch that carries a verdict, because a limitation
// stated only when nothing is asserted is stated exactly when it does not matter.
function residual() {
  console.log('plugin-version-check: NOT ESTABLISHED — whether any installed copy is AT this version. A')
  console.log('                      cache pinned at an earlier version is invisible from the tree; this checks the')
  console.log('                      tree against its own record, not against any install.')
  console.log(`                      NOT ESTABLISHED — the rest of the plugin. skills/, commands/ and loop.js change`)
  console.log('                      on most commits without a bump, so an install at this version runs whatever')
  console.log(`                      those were at the bump. Scoped to ${SCOPE} because a missing agent stops a run`)
  console.log('                      before round 1; a stale loop.js runs, older.')
}

let manifest
try { manifest = JSON.parse(readFileSync(join(ROOT, MANIFEST), 'utf8')) }
catch (e) { notEstablished(`cannot read ${MANIFEST} in ${ROOT}: ${e.message}`) }
const VERSION = manifest && manifest.version
if (typeof VERSION !== 'string' || !VERSION) notEstablished(`${MANIFEST} carries no version string`)

const inRepo = git('rev-parse', '--is-inside-work-tree')
if (inRepo.status !== 0) notEstablished(`${ROOT} is not a git work tree, so no commit records what any version shipped`)
const shallow = git('rev-parse', '--is-shallow-repository').stdout.trim() === 'true'

const versionAt = commit => {
  const r = git('show', `${commit}:${MANIFEST}`)
  if (r.status !== 0) return null
  try { return JSON.parse(r.stdout).version || null } catch { return null }
}

// Every commit that changed the version line, newest first. -G matches the diff text,
// so a commit that only reworded the description is not here.
const touching = git('log', '--format=%H', '-G"version"', '--', MANIFEST).stdout.split('\n').filter(Boolean)

// THE BUMP: the newest commit at which the version became VERSION. Newest, not oldest,
// so a version reinstated by a revert is compared against the revert.
let bump = null
let everShipped = false
for (const c of touching) {
  if (versionAt(c) !== VERSION) continue
  everShipped = true
  const parent = git('rev-parse', '--verify', '--quiet', `${c}^`)
  if (parent.status !== 0) {
    // No parent reachable. In a full clone that is the root commit and the version was
    // born here. In a shallow clone it is the graft point, and the real bump may be
    // anywhere below it — so the record cannot be reached.
    if (shallow) notEstablished(`shallow clone: ${c.slice(0, 7)} carries ${VERSION} but its parent is not checked out, so the commit that set ${VERSION} cannot be found. Check out full history (fetch-depth: 0).`)
    bump = c
    break
  }
  if (versionAt(parent.stdout.trim()) !== VERSION) { bump = c; break }
}

if (!bump) {
  if (everShipped) notEstablished(`${VERSION} appears in history but no commit that set it was found — this should be impossible in a full clone`)
  if (shallow) notEstablished(`shallow clone: ${VERSION} is in no checked-out commit, so whether it shipped cannot be told from whether history was cut. Check out full history (fetch-depth: 0).`)
  console.log(`plugin-version-check: ${VERSION} is in no commit yet — an unshipped bump. The working tree's ${SCOPE} is what ${VERSION} will ship, so there is nothing to compare it against.`)
  residual()
  process.exit(0)
}

// Tracked differences between the bump commit and the WORKING TREE (not HEAD — an
// uncommitted edit is already a difference an install will never see) ...
const tracked = git('diff', '--name-status', bump, '--', SCOPE).stdout.split('\n').filter(Boolean)
  .map(l => { const [status, ...rest] = l.split('\t'); return { status: status[0], path: rest[rest.length - 1] } })
// ... plus untracked additions, which `git diff` against a commit does not report.
const untracked = git('ls-files', '--others', '--exclude-standard', '--', SCOPE).stdout.split('\n').filter(Boolean)
  .map(path => ({ status: 'A', path }))
const changes = [...tracked, ...untracked]

const shipped = git('ls-tree', '-r', '--name-only', bump, '--', SCOPE).stdout.split('\n').filter(Boolean)
const short = bump.slice(0, 7)

if (changes.length) {
  console.log(`plugin-version-check: FAIL — ${SCOPE} differs from what ${VERSION} shipped at ${short}, and the version is still ${VERSION}.`)
  console.log(`                      An installed ${VERSION} is cached by version and will never see this:`)
  for (const c of changes) console.log(`  ${c.status}  ${c.path}`)
  console.log(`                      Bump the version in ${MANIFEST}; the bump commit becomes the new record.`)
  residual()
  process.exit(1)
}

console.log(`plugin-version-check: ${SCOPE} matches what ${VERSION} shipped at ${short} — ${shipped.length} file(s), none added, removed or edited since.`)
residual()
process.exit(0)
