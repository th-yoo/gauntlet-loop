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

// THE LEDGER'S LEGACY ROWS — REPORTED, NOT REWRITTEN.
//
// oracle/results.jsonl carries 40 observations whose `artifact` field is still an
// absolute path from the authoring machine, and some whose `reasoning` contains one
// because the model said it. Neither is rewritten here.
//
// `reasoning` is the model's verbatim output. It is the evidence, and editing
// evidence to make a scan quiet is the worst thing in this file's reach.
//
// `artifact` could be rewritten, and rewriting it would buy nothing. An observation
// is tied to its instrument by `prompt_hash`, and that hash contains the resolved
// absolute path, so these 40 can only be re-validated on the machine that recorded
// them whatever their pointer field says. A rewrite would make this scan green while
// changing no fact — which is the shape of fix this repo exists to refuse.
//
// What IS enforced below: a newly recorded observation inherits the row's relative
// path. That is the half that can be fixed, so that is the half that gets a check.
console.log('corpus-portability: a new observation inherits the row\'s relative path')
{
  const legacy = readFileSync(join(ROOT, 'oracle', 'results.jsonl'), 'utf8')
    .split('\n').filter(l => l.trim()).map(l => JSON.parse(l))
    .filter(o => o.artifact && isAbsolute(o.artifact)).length
  console.log(`          ${legacy} legacy observation(s) carry an absolute pointer — machine-bound through prompt_hash regardless, so left as recorded`)

  // Both probe rows above are refusals, so the sandbox ledger may not exist at all.
  // Say that, rather than letting an unwritten file read as a clean result — a check
  // whose PASS condition is "nothing was written" measures nothing.
  const ledger = join(SANDBOX, 'results.jsonl')
  if (!existsSync(ledger)) {
    console.log('          NOT MEASURED: no observation was recorded in this run (both probe rows are refusals by design),')
    console.log('          so the write-side shape is asserted by oracle-record copying row.artifact and by RC1 above.')
  } else {
    for (const line of readFileSync(ledger, 'utf8').split('\n').filter(l => l.trim())) {
      const o = JSON.parse(line)
      if (o.artifact && isAbsolute(o.artifact)) {
        fail(`a newly recorded observation stored an absolute artifact path (${o.artifact}) — oracle-record copies row.artifact, so a row got in with the wrong shape`)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// RC4 — THE COHORT KEY EMBEDS THE CHECKOUT PATH.
//
// Predicted by RC1's own root cause rather than found by an incident: if the defect is
// "a filesystem path leaked into something that is supposed to be portable", then fixing
// the STORED path leaves every fact DERIVED from a path unfixed — and one of those decides
// which cohort an observation is filed under.
//
// oracle-extract renders the prompt with the artifact resolved to an absolute path — which
// is right, because loop.js receives one — and then blanks the artifact out of the text by
// splitting on the string the CALLER passed. For a repo-relative row that substring sits at
// the tail of the absolute path, so what is left in the "template" is
// `/wherever/the/repo/is/{{ARTIFACT}}`. The template hash therefore depends on where the
// checkout lives and on how the caller spelled the path, and two callers reading the same
// loop.js disagree: oracle-instrument probes with absolute paths and gets one hash, every
// corpus row gets another.
//
// What that costs: oracle-report labels a cohort by comparing the stored template hash with
// the live one, so every observation recorded since the corpus went repo-relative is filed
// as "SUPERSEDED — no run sends this prompt any more" about the prompt that ships. The
// numbers do not move, which is what makes it quiet.
//
// Both checks below fail identically on the authoring machine, per this file's rule.
console.log('corpus-portability: the cohort key does not depend on where the checkout is')
{
  const EXTRACT = join(ROOT, 'scripts', 'oracle-extract.mjs')
  const probe = rows.find(r => r.arm !== 'could-not-open' && !r.inspect)
  if (!probe) {
    console.log('          NOT MEASURED: no corpus row is an ordinary present-artifact row, so there is nothing to spell two ways')
  } else {
    const th = extra => {
      const r = run(EXTRACT, ['--artifact', extra, '--goal', probe.goal, '--json'])
      if (r.code !== 0) { fail(`extraction failed for ${extra}: ${String(r.out).split('\n')[0]}`); return null }
      return JSON.parse(r.out).template_hash
    }
    const relative = th(probe.artifact)
    const absolute = th(resolve(ROOT, probe.artifact))
    if (relative && absolute) {
      // THE SAME ARTIFACT, THE SAME GOAL, THE SAME loop.js — two spellings of one path.
      // A template is the part of the prompt that is the same for every row; if it moves
      // when the caller types the path differently, it is not a template.
      if (relative !== absolute) {
        fail(`the template hash depends on how the artifact path is spelled: ${relative.slice(0, 23)}… relative vs ${absolute.slice(0, 23)}… absolute. The path is resolved into the prompt and blanked by the caller's spelling, so the repo's location is left inside the "template".`)
      } else {
        console.log(`          both spellings of ${probe.id} give ${relative.slice(0, 23)}…`)
      }
    }
  }
}

// AND THE TWO READERS OF loop.js MUST AGREE. The check above is about one tool; this is
// about the pair that actually decides a cohort label — oracle-record files an observation
// under oracle-extract's template hash, and oracle-report compares it with
// oracle-instrument's. If those two can disagree, a fresh draw is mislabelled stale no
// matter how the extraction is spelled, so this asserts the property the report rests on
// rather than the mechanism underneath it.
console.log('corpus-portability: a fresh observation lands in the live cohort')
{
  const probe = rows.find(r => r.arm !== 'could-not-open' && !r.inspect)
  if (!probe) {
    console.log('          NOT MEASURED: no ordinary present-artifact row to extract')
  } else {
    const EXTRACT = join(ROOT, 'scripts', 'oracle-extract.mjs')
    const r = run(EXTRACT, ['--artifact', probe.artifact, '--goal', probe.goal, '--json'])
    let live = null
    try { live = (await import(join(ROOT, 'scripts', 'oracle-instrument.mjs'))).liveInstrument() }
    catch (e) { fail(`the live instrument could not be read at all: ${String(e.message).split('\n')[0]}`) }
    if (r.code === 0 && live) {
      const rowHash = JSON.parse(r.out).template_hash
      if (rowHash !== live.template_hash) {
        fail(`a row extracted today keys to ${rowHash.slice(0, 23)}… but the live instrument is ${live.template_hash.slice(0, 23)}… — so every observation recorded now is filed under a cohort oracle-report will call SUPERSEDED, about the prompt that ships`)
      } else {
        console.log(`          ${probe.id} and oracle-instrument agree on ${rowHash.slice(0, 23)}…`)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// RC5 — AN OBSERVATION CANNOT BE VALIDATED ANYWHERE BUT HERE.
//
// The remaining half of #47. `oracle-extract` renders the prompt with the artifact
// resolved to an absolute path — which is right, because loop.js receives one — and hashes
// that text. So `prompt_hash`, the pin `oracle-record` matches to refuse an observation
// made against a different prompt, is a function of where the repository happens to sit.
//
// What that costs: an observation recorded on one machine can never be re-validated on
// another. CI re-runs every acceptance command in the corpus and cannot check a single
// observation's instrument pin. The 2026-08-26 re-key of twelve records worked only
// BECAUSE it ran on the machine that recorded them; the same repair run anywhere else
// would have established nothing.
//
// THE CHECK IS A SECOND CHECKOUT, not a formula. Asserting that the hash equals
// sha(prompt with ROOT stripped) would pass against any implementation that computes it
// that way and says nothing about whether the claim — same row, same loop.js, different
// location, same pin — actually holds. So this copies every tracked file to a temp
// directory and runs the extractor there. Tracked files rather than `git archive HEAD`,
// deliberately: an uncommitted edit to loop.js or to the extractor must be measured, not
// silently compared against the last commit.
console.log('corpus-portability: an observation recorded here can be validated elsewhere')
{
  const probe = rows.find(r => r.arm !== 'could-not-open' && !r.inspect)
  const away = mkdtempSync(join(tmpdir(), 'corpus-elsewhere-'))
  try {
    if (!probe) {
      console.log('          NOT MEASURED: no ordinary present-artifact row to extract')
    } else {
      const copied = execFileSync('sh', ['-c', 'git ls-files -z | xargs -0 tar -cf - | tar -xf - -C "$1"', 'sh', away],
                                  { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      void copied
      const here = run(join(ROOT, 'scripts', 'oracle-extract.mjs'), ['--artifact', probe.artifact, '--goal', probe.goal, '--json'])
      let there = { code: 1, out: '' }
      try {
        there = { code: 0, out: execFileSync(process.execPath, [join(away, 'scripts', 'oracle-extract.mjs'),
          '--artifact', probe.artifact, '--goal', probe.goal, '--json'],
          { cwd: away, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 }) }
      } catch (e) { there = { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') } }

      if (here.code !== 0 || there.code !== 0) {
        fail(`the same row could not be extracted in both places (here ${here.code}, there ${there.code}): ${String(there.out).split('\n')[0]}`)
      } else {
        const H = JSON.parse(here.out), T = JSON.parse(there.out)
        // The TEMPLATE has to match — that is RC4, re-proved from a genuinely different
        // path rather than by spelling one path two ways.
        if (H.template_hash !== T.template_hash) {
          fail(`the same row keys to a different cohort in a second checkout: ${H.template_hash.slice(0, 23)}… here, ${T.template_hash.slice(0, 23)}… there`)
        }
        // And so does the PROMPT pin, or no observation is portable.
        if (H.prompt_hash !== T.prompt_hash) {
          fail(`the same row's prompt_hash differs by checkout location: ${H.prompt_hash.slice(0, 23)}… here, ${T.prompt_hash.slice(0, 23)}… there — so oracle-record can only ever validate an observation on the machine that made it, and the pin CI cannot check is the one that says which prompt an observation belongs to`)
        }
        if (H.template_hash === T.template_hash && H.prompt_hash === T.prompt_hash) {
          console.log(`          ${probe.id}: same template and same prompt pin from a second checkout`)
        }
        // The prompt SENT still names this machine's path, and must — loop.js receives an
        // absolute path in production. Only the pin is portable, and if the prompt itself
        // ever stops differing, this check is measuring nothing.
        if (H.prompt === T.prompt) {
          fail('the rendered prompts are identical in two different checkouts, so this case is no longer testing portability — the artifact path is supposed to be absolute in the text that is SENT, and only the pin is supposed to be portable')
        }
      }
    }
  } catch (e) {
    fail(`the second-checkout comparison could not run: ${String(e.message).split('\n')[0]}`)
  }
  rmSync(away, { recursive: true, force: true })
}

// RC3, SECOND FACE — REMOVED, and why.
//
// While the suite was red this file spawned oracle.test.mjs and reported how many
// of its checkpoints ran before it threw: 13 of 24, then 16 of 24 as fixes landed.
// That number was the diagnosis — it said how much of the suite a green run was
// not covering. It is 24 of 24 now, so the measurement has no signal left, and
// test/run-all.mjs discovers every *.test.mjs, which means keeping it would run
// the oracle suite twice on every invocation and put a suite inside a suite for
// no reading.
//
// The underlying property is unchanged and is NOT fixed here: oracle.test.mjs
// throws on its first failed assertion rather than accumulating, so the first red
// check still hides every later one. Making it accumulate is a real change to a
// file this one does not own. Recorded rather than absorbed.

rmSync(SANDBOX, { recursive: true, force: true })

if (failures) {
  console.error(`\ncorpus-portability: ${failures} failure(s) — the corpus cannot be read on a machine that did not author it, and one guard cannot tell two refusals apart.`)
  process.exit(1)
}
console.log(`\ncorpus-portability: OK — ${rows.length} rows portable, refusals distinguishable.`)
