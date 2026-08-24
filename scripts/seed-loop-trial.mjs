// Set up a seeded-defect trial of the LOOP, and refuse to set up an invalid one.
//
//   node scripts/seed-loop-trial.mjs --artifact <path> --section "## Heading" --to <dir>
//   node scripts/seed-loop-trial.mjs --check <degraded-file> --sealed <sealed-note>
//
// A seeded-defect trial measures whether the loop can CLOSE a gap. It measures
// nothing if the removed text is sitting somewhere the builder can read, because
// then the builder recovers the answer instead of reconstructing it — and a
// perfect "fix" is produced by a lookup.
//
// This is not hypothetical and it is not the builder's fault. In the first such
// trial ever run here (issue #25) the builder said so itself:
//
//   "I resolved this by using the wording and position that appear in the real,
//    undegraded SKILL.md for this same plugin"
//
// The degraded copy was in /tmp; the original was in the working tree; the
// builder holds Read. SKILL.md's gate 7 had already written the rule — "if the
// removed text is recoverable from public sources or the model's own prior, no
// sandbox closes it and a tighter re-run yields a false pass" — and the trial was
// designed anyway by someone who had read it that day.
//
// So the isolation is CHECKED here rather than asserted. The tool searches the
// places a builder plausibly reaches for the text it just removed, and refuses to
// write the trial if it finds it.
//
// WHAT THIS CANNOT CLOSE, stated plainly: the model's own prior. A section whose
// content is conventional — a licence header, a standard CLI usage block — is
// reconstructible from training, and no filesystem check touches that. Gate 7's
// advice applies: prefer inverting a constraint that exists only in this
// artifact, so the removed string stays checkable while its correct form is
// underivable from anything else.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { basename, join, resolve } from 'node:path'

const argv = process.argv.slice(2)
const arg = n => { const i = argv.indexOf(n); return i === -1 ? null : argv[i + 1] }
const has = n => argv.includes(n)

// Where a builder plausibly looks. Not "the whole machine" — a check that takes
// ten minutes is a check nobody runs.
const SEARCH_ROOTS = [
  process.cwd(),
  join(process.env.HOME || '', '.claude', 'plugins'),
  '/tmp/gauntlet-loop',
].filter(p => p && existsSync(p))

// A needle long and distinctive enough that finding it means finding the text,
// not finding a coincidence. Shortest useful line over 40 chars, else the
// longest line there is.
function needleFrom(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 40 && !/^[#\-*|`\s]*$/.test(l))
  if (!lines.length) return null
  return lines.sort((a, b) => b.length - a.length)[0]
}

function copiesOf(needle, ignore) {
  const found = []
  for (const root of SEARCH_ROOTS) {
    let out = ''
    try {
      out = execFileSync('grep', ['-rlF', '--binary-files=without-match', needle, root], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    } catch { continue }   // grep exits 1 when nothing matches
    for (const f of out.split('\n').filter(Boolean)) {
      if (!ignore.some(i => resolve(f) === resolve(i))) found.push(f)
    }
  }
  return [...new Set(found)]
}

if (has('--check')) {
  const degraded = arg('--check')
  const sealedPath = arg('--sealed')
  if (!degraded || !sealedPath) { console.error('usage: --check <degraded-file> --sealed <sealed-note>'); process.exit(2) }
  const sealed = readFileSync(sealedPath, 'utf8')
  const needle = needleFrom(sealed)
  if (!needle) { console.error('check: the sealed note has no line distinctive enough to search for — this trial is not leak-checkable, which is itself a reason not to run it'); process.exit(1) }
  const leaks = copiesOf(needle, [sealedPath, degraded])
  if (leaks.length) {
    console.error(`LEAK: the removed text is still readable at ${leaks.length} path(s):`)
    for (const f of leaks) console.error(`  ${f}`)
    console.error('A builder that reads any of these recovers the answer instead of closing the gap, and the trial measures nothing.')
    process.exit(1)
  }
  console.log(`ok: no reachable copy of the removed text under ${SEARCH_ROOTS.length} search root(s)`)
  process.exit(0)
}

const artifact = arg('--artifact')
const section = arg('--section')
const to = arg('--to')
if (!artifact || !section || !to) {
  console.error('usage: --artifact <path> --section "## Heading" --to <dir>   |   --check <file> --sealed <note>')
  process.exit(2)
}

const src = readFileSync(artifact, 'utf8')
const start = src.indexOf(section)
if (start === -1) { console.error(`seed: ${artifact} has no section starting "${section}"`); process.exit(1) }
const after = src.indexOf('\n## ', start + 1)
const end = after === -1 ? src.length : after + 1
const removed = src.slice(start, end)

mkdirSync(to, { recursive: true })
const degraded = join(to, basename(artifact))
const sealedPath = join(to, `SEALED-${basename(artifact)}.txt`)
writeFileSync(degraded, src.slice(0, start) + src.slice(end))
writeFileSync(sealedPath, removed)

const needle = needleFrom(removed)
if (!needle) {
  console.error('seed: the removed section has no line distinctive enough to search for. This trial cannot be leak-checked, so a pass would not be evidence. Remove a different section.')
  process.exit(1)
}
const leaks = copiesOf(needle, [sealedPath, degraded])

console.log(`seeded: ${degraded}`)
console.log(`  removed ${removed.split('\n').length} lines starting "${section}"`)
console.log(`  sealed note: ${sealedPath}`)
if (leaks.length) {
  console.error('')
  console.error(`REFUSING TO CALL THIS A TRIAL: the removed text is still readable at ${leaks.length} path(s):`)
  for (const f of leaks) console.error(`  ${f}`)
  console.error('')
  console.error('Move or hide the original before running, or seed a different defect. A builder that')
  console.error('reads any of these produces a perfect fix by lookup, and the run measures nothing.')
  process.exit(1)
}
console.log(`  isolation: ok — no reachable copy under ${SEARCH_ROOTS.length} search root(s)`)
