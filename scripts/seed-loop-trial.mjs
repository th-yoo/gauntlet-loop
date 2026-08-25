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
// builder holds Read. The rule was already written down — "if the
// removed text is recoverable from public sources or the model's own prior, no
// sandbox closes it and a tighter re-run yields a false pass" — in the gate sequence
// this repo deleted on branch `drop-judge-lane` (it was gate 7; SKILL.md no longer
// carries it, so the rule lives here now). The trial was designed anyway, by someone
// who had read that rule the same day.
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
const FLAGS = ['--artifact', '--section', '--to', '--check', '--sealed']
// A value that is itself an option is a MISSING value, not a value.
//
// `--check --sealed <note>` used to bind degraded = "--sealed". Both reads came
// back truthy, the arity guard below passed, and the leak search ran against a
// filename nobody supplied — printing "ok: no reachable copy of the removed text".
// A false pass, from the one tool in this repo whose entire job is to refuse false
// passes, on the path an operator runs deliberately to verify isolation before
// spending a run. One rule for all five options rather than a guard per option:
// the seed path has the same hole and merely happens to die on ENOENT instead of
// reporting success.
const arg = n => {
  const i = argv.indexOf(n)
  if (i === -1) return null
  const v = argv[i + 1]
  return v === undefined || FLAGS.includes(v) ? null : v
}
const has = n => argv.includes(n)

// Where a builder plausibly looks. Not "the whole machine" — a check that takes
// ten minutes is a check nobody runs.
// GAUNTLET_TRIAL_ROOTS replaces the default roots, colon-separated. It exists so
// the failure path below can be tested: "grep could not search this root" has to
// be distinguishable from "grep found nothing", and inducing a real search failure
// needs a root the test controls. Not for normal use — the defaults are the places
// a builder actually reaches.
// The same resolution the two command files use, and it has to stay the same: this
// searches where a run's tokens and degraded copies actually land, and `/tmp` is
// neither writable everywhere nor where a Windows shell puts scratch files. A
// drift-guard scan pins all three surfaces together, because a token written
// somewhere the cancel command does not look is a circuit breaker that silently
// does nothing.
const TMPROOT = process.env.TMPDIR || process.env.TMP || process.env.TEMP || '/tmp'

const SEARCH_ROOTS = (process.env.GAUNTLET_TRIAL_ROOTS
  ? process.env.GAUNTLET_TRIAL_ROOTS.split(':')
  : [
      process.cwd(),
      join(process.env.HOME || '', '.claude', 'plugins'),
      join(TMPROOT, 'gauntlet-loop'),
    ]).filter(p => p && existsSync(p))

// A needle long and distinctive enough that finding it means finding the text,
// not finding a coincidence. Shortest useful line over 40 chars, else the
// longest line there is.
function needleFrom(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 40 && !/^[#\-*|`\s]*$/.test(l))
  // REDUNDANT BY CONSTRUCTION, and kept for readability rather than behaviour.
  // Removing it yields [].sort()[0] === undefined, which every caller's `!needle`
  // check refuses with the same message and the same exit code — verified by
  // running a markup-only section both ways. So a mutation sweep reports it NOT
  // CAUGHT and that is the right answer, not a coverage hole: there is no test
  // that could distinguish the two, and writing one would pin nothing.
  if (!lines.length) return null
  return lines.sort((a, b) => b.length - a.length)[0]
}

function copiesOf(needle, ignore) {
  const found = []
  for (const root of SEARCH_ROOTS) {
    let out = ''
    try {
      // `--` terminates options. Without it a needle that begins with a dash is
      // read as flags: grep exits 2 with a usage error, and the old catch treated
      // every non-zero exit as "nothing matched" — so the search that exists to
      // find the leak silently found nothing and the trial was written as
      // isolated. A Markdown list item over forty characters produces exactly such
      // a needle, so it takes an ordinary document, not a crafted one.
      out = execFileSync('grep', ['-rlF', '--binary-files=without-match', '--', needle, root], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    } catch (e) {
      // grep: 0 = matched, 1 = no match, >=2 = it could not do the search.
      // Only 1 means clean. Anything else is an unanswered question, and this
      // script exists to refuse those rather than guess at them.
      if (e && e.status === 1) continue
      console.error(`check: could not search ${root} (grep exited ${e && e.status}). A leak check that ` +
                    'could not run is not a leak check that passed, so this trial is refused rather than ' +
                    'recorded as isolated.')
      process.exit(1)
    }
    for (const f of out.split('\n').filter(Boolean)) {
      if (!ignore.some(i => resolve(f) === resolve(i))) found.push(f)
    }
  }
  return [...new Set(found)]
}

if (has('--check')) {
  const degraded = arg('--check')
  const sealedPath = arg('--sealed')
  if (!degraded || !sealedPath) { console.error('usage: node scripts/seed-loop-trial.mjs --check <degraded-file> --sealed <sealed-note>'); process.exit(2) }
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
  // Names the script, like every other usage line here: this text is what an
  // operator sees in a terminal or a log, and one that cannot be copied and run
  // makes them go looking for the invocation instead of reading the message.
  console.error('usage: node scripts/seed-loop-trial.mjs --artifact <path> --section "## Heading" --to <dir>')
  console.error('   or: node scripts/seed-loop-trial.mjs --check <degraded-file> --sealed <sealed-note>')
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
