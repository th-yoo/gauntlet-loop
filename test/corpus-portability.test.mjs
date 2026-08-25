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
import { createHash } from 'node:crypto'
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
// RC3 — the MISSING-ARTIFACT refusal and the STALE-INSTRUMENT refusal must be
// distinguishable by exit code.
//
// CORRECTED after the first version of this file tested the wrong pair. It
// compared missing-artifact against a stale artifact HASH, which is not the pair
// that broke: oracle.test.mjs:371 is aiming at the stale-INSTRUMENT refusal (the
// prompt-hash mismatch, "DIFFERENT instrument") and received missing-artifact
// instead. A stale hash never reaches the instrument check, so a guard built on
// it would have gone green while the defect stood. Building the reproducible
// first is what surfaced this; reasoning about the fix would not have.
//
// Missing-artifact and stale-hash are deliberately NOT required to differ. Both
// mean "this row no longer describes reality, re-ground it" — one remedy, so one
// code. A code earns its own value by naming a different thing for the caller to
// DO, not by marking a different internal branch.
//
// The rows are purpose-built here rather than borrowed from the tracked corpus,
// so this measures the refusals themselves and keeps measuring them after RC1
// and RC2 land, when no tracked row will produce a missing artifact at all.
// ---------------------------------------------------------------------------

console.log('corpus-portability: the missing-artifact and stale-instrument refusals are distinguishable')

const realFixture = 'oracle/fixtures/make-hello/Makefile'
if (!existsSync(resolve(ROOT, realFixture))) {
  fail(`the fixture this check is built on is missing at ${realFixture} — the check itself cannot run, which is not the same as passing`)
} else {
  const template = rows.find(r => r.arm !== 'could-not-open') || rows[0]
  const trueHash = 'sha256:' + createHash('sha256').update(readFileSync(resolve(ROOT, realFixture))).digest('hex')

  // Row A: the artifact is genuinely absent — the refusal that actually fired.
  const missingRow = { ...template, id: 'probe-missing-artifact', arm: 'does-the-work', artifact: 'oracle/fixtures/no-such-dir/nothing.md' }
  // Row B: artifact present AND correctly pinned, so the row-reality checks all
  // pass and execution reaches the instrument check — the refusal being aimed at.
  const liveRow = { ...template, id: 'probe-stale-instrument', arm: 'does-the-work', artifact: realFixture, artifact_hash: trueHash }

  writeFileSync(join(SANDBOX, 'corpus.jsonl'), [JSON.stringify(missingRow), JSON.stringify(liveRow)].join('\n') + '\n')

  const pin = ['--predicted', 'does-the-work', '--prompt-hash', 'sha256:0000', '--schema-fingerprint', 'sha256:0000']
  const a = run(RECORD, ['--row', 'probe-missing-artifact', ...pin])
  const b = run(RECORD, ['--row', 'probe-stale-instrument', ...pin])

  // COMPUTED, not asserted. If the two are ever collapsed onto one code again,
  // this line says so with the codes in hand rather than only that something broke.
  console.log(`          missing-artifact exits ${a.code}; stale-instrument exits ${b.code}`)

  if (a.code === 0) fail('the missing-artifact case was ACCEPTED — a row whose artifact is gone cannot be re-grounded, so an observation against it means nothing')
  if (b.code === 0) fail('the stale-instrument case was ACCEPTED — the prompt pin is what ties an observation to the instrument that produced it')

  // The refusal has to be identifiable by its own words too, not only by a number.
  if (b.code !== 0 && !/DIFFERENT instrument/.test(b.out)) {
    fail(`the stale-instrument row did not reach the instrument check — it was refused earlier, with: ${b.out.trim().split('\n')[0]}`)
  }

  if (a.code !== 0 && b.code !== 0 && a.code === b.code) {
    fail(`both refusals exit ${a.code}, so a guard asserting only the exit code passes for either one. That is exactly how oracle.test.mjs:371 came to assert the stale-instrument refusal while receiving the missing-artifact refusal.`)
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
