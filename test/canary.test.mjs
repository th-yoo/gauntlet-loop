// The canary generator's one load-bearing property: what it emits must be
// FALSE. A canary that accidentally states the truth would be GROUNDED
// correctly, and the run would score a verifier failure that never happened.
//
//   node test/canary.test.mjs
//
// Everything else here is about not shipping an EASY canary — one a verifier
// can reject without opening the file measures prose sense, not reading.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CANARY = join(ROOT, 'scripts', 'canary.mjs')

function ok(cond, msg) { if (!cond) throw new Error(`ASSERT FAILED: ${msg}`) }
function eq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`ASSERT FAILED: ${msg}\n  expected: ${JSON.stringify(b)}\n  actual:   ${JSON.stringify(a)}`)
}
function gen(file, line, ...extra) {
  return JSON.parse(execFileSync('node', [CANARY, file, String(line), '--json', ...extra], { encoding: 'utf8' }))
}
// Returns the failure with its exit CODE and message, not merely "it failed".
// `fails` used to answer only "did this exit non-zero", which cannot tell a
// deliberate refusal from a crash: removing the range check made the script blow
// up on an undefined line instead of refusing, and every assertion still passed.
// The script uses 2 for bad input it refuses and 1 for "I could not build a false
// claim" — a distinction worth asserting, since one is the operator's mistake and
// the other is the tool declining to guess.
function fails(file, line, ...extra) {
  try { execFileSync('node', [CANARY, file, String(line), '--json', ...extra], { encoding: 'utf8', stdio: 'pipe' }); return null }
  catch (e) { return { status: e.status, out: String(e.stdout || '') + String(e.stderr || '') } }
}
// Runs the script with the argv list EXACTLY as written. `fails` cannot express
// "too few arguments": it always passes four, and `String(undefined)` is the
// literal "undefined", so `fails()` handed the script two arguments, sailed past
// the arity check and died on ENOENT opening a file named "undefined". The
// assertion then read that crash as the refusal it was meant to test. The input
// never arrived — which is why every case below also checks that the message is
// the one that branch prints.
function failsArgv(argv) {
  try { execFileSync('node', [CANARY, ...argv], { encoding: 'utf8', stdio: 'pipe' }); return null }
  catch (e) { return { status: e.status, out: String(e.stdout || '') + String(e.stderr || '') } }
}

// THE property. Across many real anchors in this repo, the fabricated claim must
// never equal the line it is attributed to.
{
  const targets = [
    ['skills/gauntlet-loop/loop.js', 254], ['skills/gauntlet-loop/loop.js', 41],
    ['skills/gauntlet-loop/SKILL.md', 41], ['skills/gauntlet-loop/SKILL.md', 116],
    ['test/drift-guard.mjs', 30], ['README.md', 12], ['docs/README.md', 35],
  ]
  for (const [f, l] of targets) {
    const c = gen(f, l)
    const real = readFileSync(join(ROOT, f), 'utf8').split('\n')[l - 1]
    eq(c.actual_line, real, `${f}:${l} — the tool reports the true line correctly`)
    ok(c.fabricated_claim !== real, `${f}:${l} — the fabricated claim differs from the real line`)
    ok(c.fabricated_claim.trim().length > 0, `${f}:${l} — the fabrication is not empty`)
  }
  console.log(`canary: ${targets.length} real anchors, every fabrication provably false at its cited line OK`)
}

// Deterministic: a failed trial must be reproducible exactly.
{
  const a = gen('skills/gauntlet-loop/SKILL.md', 41)
  const b = gen('skills/gauntlet-loop/SKILL.md', 41)
  eq(a, b, 'the same anchor yields the same canary')
  console.log('canary: deterministic — the same anchor always yields the same fabrication OK')
}

// line-shift is the default, and its quote is real text from elsewhere in the
// SAME file — so catching it requires opening the cited line, not noticing bad
// prose.
{
  const c = gen('skills/gauntlet-loop/SKILL.md', 41)
  eq(c.mode, 'line-shift', 'line-shift is the default mode')
  const all = readFileSync(join(ROOT, 'skills/gauntlet-loop/SKILL.md'), 'utf8').split('\n')
  ok(all.includes(c.fabricated_claim), 'the fabricated quote is a REAL line from the same file, just not the cited one')
  ok((c.fabricated_claim.match(/[A-Za-z][A-Za-z_]{2,}/g) || []).length >= 4, 'the quote is substantive, not a fragment a reader dismisses on sight')
  console.log('canary: the default fabrication is real text at the wrong line, so catching it requires a read OK')
}

// word-swap alters the cited line minimally, using words already in it.
{
  const c = gen('skills/gauntlet-loop/SKILL.md', 41, '--mode', 'word-swap')
  eq(c.mode, 'word-swap', 'word-swap is selectable')
  const words = t => (t.match(/[A-Za-z][A-Za-z_]{2,}/g) || []).slice().sort()
  eq(words(c.fabricated_claim), words(c.actual_line), 'the same words appear — two were exchanged, none introduced')
  ok(c.fabricated_claim !== c.actual_line, 'and the result differs from the real line')
  console.log('canary: word-swap exchanges two real words and introduces none OK')
}

// THE ADVERSARIAL CASE for the falsity guarantee. Real anchors rarely have an
// identical line exactly 20 rows away, so the assertions above hold whether or
// not the check exists — they are satisfied by luck. This file is built so that
// the naive shift lands on text IDENTICAL to the cited line: without the
// differ-check and the falsity assertion the tool emits a TRUE claim, which a
// verifier would ground correctly and the run would score as a miss that never
// happened.
{
  const dir = mkdtempSync(join(tmpdir(), 'canary-dup-'))
  const f = join(dir, 'duplicated.txt')
  const repeated = 'the critic must inspect the real artifact and never a summary'
  const filler = 'a distinct filler line carrying several substantive words here'
  // line 21 is the anchor; line 1 and line 41 are identical to it, so both the
  // +20 and -20 shifts land on the same text.
  const lines = []
  for (let i = 1; i <= 41; i++) lines.push(i === 1 || i === 21 || i === 41 ? repeated : `${filler} number ${i}`)
  writeFileSync(f, lines.join('\n') + '\n')

  const c = gen(f, 21)
  ok(c.actual_line === repeated, 'the anchor line is the repeated text')
  ok(c.fabricated_claim !== repeated, 'the tool did NOT emit the identical line as a fabrication')
  ok(c.fabricated_claim !== c.actual_line, 'the emitted claim is false at the cited line')
  console.log('canary: a file with identical lines 20 rows away cannot produce a TRUE claim OK')
}

// It refuses rather than emitting a claim it cannot prove false.
{
  const dir = mkdtempSync(join(tmpdir(), 'canary-'))
  const f = join(dir, 'tiny.txt')
  writeFileSync(f, 'ok\n')
  const e = fails(f, 1)
  ok(e, 'a file with one short line produces no canary')
  ok(e.status === 1, `refused with code 1 — "I could not build a false claim" is the tool declining to guess, not bad input (got ${e.status})`)
  ok(/could not build a false claim/.test(e.out), 'and it says why rather than emitting something unproven')
  console.log('canary: refuses to emit when it cannot prove the claim false OK')
}

// Argument validation. These are the first things a person hits when they run
// the tool wrong, and the tool is only useful if it says so rather than dying on
// an undefined path deep inside.
//
// Each case asserts the MESSAGE as well as the code, because the code alone does
// not say the input arrived: an ENOENT crash exits non-zero too, and its stack
// trace contains the words "canary", "scripts" and the script's own path, so the
// loose alternation this block used to match was satisfied by the crash it
// existed to rule out.
const USAGE = 'usage: node scripts/canary.mjs <file> <line>'
{
  for (const [what, argv] of [['no arguments', []], ['only a file', ['skills/gauntlet-loop/SKILL.md']]]) {
    const r = failsArgv(argv)
    ok(r, `running with ${what} is refused`)
    ok(r.status === 2, `${what}: refused with the bad-input code 2, not a crash — got ${r.status}`)
    ok(r.out.includes(USAGE), `${what}: prints the usage line an operator can copy — got: ${r.out.slice(0, 200)}`)
    ok(!/ENOENT|at ModuleJob/.test(r.out), `${what}: the arity check answered, rather than the script crashing further in — got: ${r.out.slice(0, 200)}`)
  }

  // A line that is not an integer. NaN fails no comparison — `NaN < 1` and
  // `NaN > lines.length` are both false — so the range check lets it through and
  // only Number.isInteger refuses it. Without that clause the script reads
  // lines[NaN] and generates against undefined.
  for (const [what, line] of [['a non-numeric line', 'twelve'], ['a fractional line', '12.5'], ['an empty line argument', '']]) {
    const r = failsArgv(['skills/gauntlet-loop/SKILL.md', line])
    ok(r, `${what} is refused`)
    ok(r.status === 2, `${what}: refused with code 2 — got ${r.status}`)
    ok(new RegExp(`${line === '' ? '' : line}`).test(r.out) && /is not a line in it/.test(r.out),
       `${what}: the message names the offending argument and says what is wrong — got: ${r.out.slice(0, 200)}`)
    ok(!/ENOENT|matchAll|at ModuleJob/.test(r.out), `${what}: refused rather than crashing on lines[NaN] — got: ${r.out.slice(0, 200)}`)
  }
  console.log('canary: too few arguments and non-integer lines are refused with the usage message, not a crash OK')
}

// Out-of-range and bad input are refused, not guessed at.
{
  const past = fails('skills/gauntlet-loop/SKILL.md', 99999)
  ok(past, 'a line past the end of the file is refused')
  ok(past.status === 2, `refused with the bad-input code 2, not merely non-zero — got ${past && past.status}: a crash also exits non-zero`)
  ok(/canary:/.test(past.out), 'and says what was wrong, rather than emitting a stack trace')
  const badMode = fails('skills/gauntlet-loop/SKILL.md', 41, '--mode', 'invent-something')
  ok(badMode, 'an unknown mode is refused')
  ok(badMode.status === 2, `refused with the bad-input code 2 — got ${badMode && badMode.status}`)
  ok(/unknown mode/.test(badMode.out), 'naming the mode as the problem')
  console.log('canary: out-of-range lines and unknown modes are refused OK')
}
