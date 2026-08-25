// THE REPRODUCIBLE for the red suite on `main` (issue #42).
//
//   node test/corpus-portability.test.mjs
//
// `node test/run-all.mjs` fails at test/oracle.test.mjs:373 with
// "ASSERT FAILED: and names the mismatch". That symptom is machine-specific — it
// appears on a machine that is not the one the corpus was authored on. This file
// is deliberately NOT machine-specific: every check below fails identically on the
// authoring machine, because a reproducible that only fires off-machine reports
// green to the author and hides the defect it was built to catch.
//
// Three root causes, at three layers. Each gets its own check group.
//
// RC1 — the corpus stores whatever path shape the operator typed.
//   oracle-add.mjs:113 computes a resolved `abs` for its OWN existence checks, then
//   writes the raw `--artifact` argument into the row. Nothing normalises the shape
//   and nothing rejects an absolute one. `git log -p --follow -- oracle/corpus.jsonl`
//   shows 14 additions containing "/home/th-yoo" and 0 containing "/Users/": the
//   corpus has never been portable, on any commit.
//
// RC2 — the portability idiom is a silent no-op on the shape actually stored.
//   oracle-add.mjs, oracle-record.mjs and oracle-extract.mjs all share:
//       existsSync(resolve(ROOT, x)) ? resolve(ROOT, x) : x
//   which handles a RELATIVE stored path. resolve(base, ABSOLUTE) returns the
//   absolute path and ignores the base, so for the shape actually stored the idiom
//   degrades to verbatim and can never help. The code reads as portable and is not.
//
// RC3 — two different refusals share an exit code, so a guard on the code alone
//   cannot tell them apart. oracle.test.mjs:371 asserts `eq(r.code, 1)` for the
//   STALENESS refusal and got the MISSING-ARTIFACT refusal, which also exits 1. The
//   assertion passed against an unrelated failure; only the message check one line
//   later caught it. This repo already wrote that rule down in CLAUDE.md — "A check
//   whose PASS condition is satisfied by the thing being broken measures nothing" —
//   and the oracle harness header repeats it. It is restated here as an executable
//   check rather than as prose.
//
// This file computes its keys rather than asserting them: it reports HOW MANY rows
// are unportable and WHICH, and it reports the two refusals' actual exit codes. A
// one-sided check that only says "something is wrong" cannot come back against you.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, isAbsolute, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RECORD = join(ROOT, 'scripts', 'oracle-record.mjs')
const CORPUS = join(ROOT, 'oracle', 'corpus.jsonl')

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }

// Every invocation writes to a THROWAWAY ledger. The oracle suite's own header
// records why: a mutation run once appended a fabricated row into the tracked
// corpus, where it survived the mutation restore and was staged as data.
const SANDBOX = mkdtempSync(join(tmpdir(), 'corpus-portability-'))
const SANDBOX_ENV = {
  ...process.env,
  ORACLE_CORPUS: join(SANDBOX, 'corpus.jsonl'),
  ORACLE_RESULTS: join(SANDBOX, 'results.jsonl'),
}

function run(script, args, extraEnv) {
  try {
    return { code: 0, out: execFileSync(process.execPath, [script, ...args], { encoding: 'utf8', cwd: ROOT, env: { ...SANDBOX_ENV, ...(extraEnv || {}) }, stdio: ['ignore', 'pipe', 'pipe'], timeout: 20_000 }) }
  } catch (e) {
    return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') }
  }
}

const rows = readFileSync(CORPUS, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l))

// ---------------------------------------------------------------------------
// RC1 — no stored path may be absolute.
//
// Machine-independence is the whole point of this check. `isAbsolute` is a fact
// about the STRING, not about this filesystem, so this fails on the authoring
// machine too. Checking `existsSync` instead would pass there and report the bug
// fixed — which is the failure mode that let 14 rows ship.
// ---------------------------------------------------------------------------

console.log('corpus-portability: no stored artifact path is absolute')
const absolutes = rows.filter(r => r.artifact && isAbsolute(r.artifact))
if (absolutes.length) {
  fail(`${absolutes.length} of ${rows.length} rows store an absolute artifact path — a row grounded on one machine cannot be re-grounded on any other, and the corpus is the ground truth six open measurement issues rest on`)
  for (const r of absolutes.slice(0, 3)) console.error(`          ${r.id} -> ${r.artifact}`)
  if (absolutes.length > 3) console.error(`          ... and ${absolutes.length - 3} more`)
}

// ---------------------------------------------------------------------------
// RC2 — every stored path must resolve from the repo root alone.
//
// This is the property the readers' idiom was written to provide. It is checked
// separately from RC1 because the two can fail independently: a relative path
// pointing at a deleted fixture passes RC1 and fails here, and that is a
// different defect with a different fix.
// ---------------------------------------------------------------------------

console.log('corpus-portability: every stored artifact path resolves from the repo root')
const unresolvable = rows.filter(r => {
  if (!r.artifact) return false
  // The absence arm's whole claim is that nothing is there, so a missing file is
  // its ground truth rather than a defect. It still must not be absolute (RC1).
  if (r.arm === 'could-not-open') return false
  return !existsSync(resolve(ROOT, r.artifact))
})
if (unresolvable.length) {
  fail(`${unresolvable.length} of ${rows.length} rows name an artifact that does not exist under the repo root — oracle-record refuses these, so no observation can be recorded against them`)
  for (const r of unresolvable.slice(0, 3)) console.error(`          ${r.id} -> ${r.artifact}`)
}

// ---------------------------------------------------------------------------
// RC3 — a missing artifact and a stale hash must be distinguishable by exit code.
//
// Both are deliberate refusals and both are correct; the defect is that a caller
// cannot tell which fired. Two purpose-built rows are constructed here rather than
// borrowed from the tracked corpus, so this check measures the REFUSALS and not
// whichever way the tracked rows happen to be broken today — including after RC1
// and RC2 are fixed, when the tracked corpus will no longer produce a missing
// artifact at all.
// ---------------------------------------------------------------------------

console.log('corpus-portability: the missing-artifact and stale-hash refusals are distinguishable')

const realFixture = 'oracle/fixtures/make-hello/Makefile'
if (!existsSync(resolve(ROOT, realFixture))) {
  fail(`the fixture this check is built on is missing at ${realFixture} — the check itself cannot run, which is not the same as passing`)
} else {
  const template = rows.find(r => r.arm !== 'could-not-open') || rows[0]

  // Row A: the artifact is genuinely absent. Nothing about the hash is wrong.
  const missingRow = { ...template, id: 'probe-missing-artifact', artifact: 'oracle/fixtures/no-such-dir/nothing.md' }
  // Row B: the artifact is present and readable; only the pinned hash disagrees.
  const staleRow = { ...template, id: 'probe-stale-hash', artifact: realFixture, artifact_hash: 'sha256:' + '0'.repeat(64) }

  writeFileSync(join(SANDBOX, 'corpus.jsonl'), [JSON.stringify(missingRow), JSON.stringify(staleRow)].join('\n') + '\n')

  const pin = ['--predicted', 'does-the-work', '--prompt-hash', 'sha256:0000', '--schema-fingerprint', 'sha256:0000']
  const a = run(RECORD, ['--row', 'probe-missing-artifact', ...pin])
  const b = run(RECORD, ['--row', 'probe-stale-hash', ...pin])

  // COMPUTED, not asserted. If both refusals are ever made to fire on the same
  // code again, this line says so with the codes in hand.
  console.log(`          missing-artifact exits ${a.code}; stale-hash exits ${b.code}`)

  if (a.code === 0) fail('the missing-artifact case was ACCEPTED — a row whose artifact is gone cannot be re-grounded, so an observation against it means nothing')
  if (b.code === 0) fail('the stale-hash case was ACCEPTED — the artifact pin is what makes an observation describe the artifact it was grounded against')

  if (a.code !== 0 && b.code !== 0 && a.code === b.code) {
    fail(`both refusals exit ${a.code}, so a guard asserting only the exit code passes for either one. That is exactly how oracle.test.mjs:371 came to assert the staleness refusal while receiving the missing-artifact refusal.`)
  }
}

// ---------------------------------------------------------------------------
// RC3, second face — the suite aborts on the first failure, so a red run hides
// how much else is red. This is reported rather than asserted: it is a property
// of the runner, and turning it into a failure here would be this file grading a
// file it does not own.
// ---------------------------------------------------------------------------

console.log('corpus-portability: reporting how much the first failure masks')
{
  const oracleSrc = readFileSync(join(ROOT, 'test', 'oracle.test.mjs'), 'utf8')
  const checkpoints = (oracleSrc.match(/console\.log\('oracle: /g) || []).length
  const r = run(join(ROOT, 'test', 'oracle.test.mjs'), [])
  const reached = (r.out.match(/ OK$/gm) || []).length
  console.log(`          oracle.test.mjs: ${reached}/${checkpoints} checkpoints reached before it threw`)
  if (r.code !== 0 && reached < checkpoints) {
    console.log(`          ${checkpoints - reached} checkpoint(s) did not run — a fix verified against this suite is verified against ${reached} of ${checkpoints} checks`)
  }
}

rmSync(SANDBOX, { recursive: true, force: true })

if (failures) {
  console.error(`\ncorpus-portability: ${failures} failure(s) — the corpus cannot be read on a machine that did not author it, and one guard cannot tell two refusals apart.`)
  process.exit(1)
}
console.log(`\ncorpus-portability: OK — ${rows.length} rows portable, refusals distinguishable.`)
