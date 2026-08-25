// The trial seeder's one job: refuse to set up a seeded-defect trial whose
// answer is readable. A trial that measures nothing is worse than no trial,
// because it produces a number.
//
//   node test/trial.test.mjs

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync, chmodSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SEED = join(ROOT, 'scripts', 'seed-loop-trial.mjs')

function ok(cond, msg) { if (!cond) throw new Error(`ASSERT FAILED: ${msg}`) }
function eq(actual, expected, msg) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`ASSERT FAILED: ${msg}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`)
  }
}
// HERMETIC BY DEFAULT. The script's real search roots include ~/.claude/plugins
// and /tmp/gauntlet-loop, so without this a stray file anywhere on the machine
// containing this fixture's needle turns a clean trial into a reported leak — a
// safety-critical test failing for a reason that has nothing to do with the code.
// A test that can fail on unrelated machine state is a test whose failures get
// waved through. Cases that mean to exercise the DEFAULT roots pass env
// explicitly; everything else is confined to its own temp directory.
function hermetic(cwd, env) {
  return env && env.GAUNTLET_TRIAL_ROOTS !== undefined ? env : { ...(env || {}), GAUNTLET_TRIAL_ROOTS: cwd }
}

function run(args, cwd, env) {
  try { return { code: 0, out: execFileSync('node', [SEED, ...args], { encoding: 'utf8', cwd, env: { ...process.env, ...hermetic(cwd, env) }, stdio: ['ignore', 'pipe', 'pipe'] }) } }
  catch (e) { return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') } }
}

const DISTINCT = 'the calibration harness dials the interlock to seventeen before every measured pass'
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'trial-'))
  const art = join(dir, 'doc.md')
  writeFileSync(art, [
    '# Doc', '', '## Intro', 'Some ordinary opening text that carries no particular weight at all.', '',
    '## Procedure', DISTINCT, 'and then a second line of that same procedure for good measure.', '',
    '## After', 'Closing text that stays put and is not part of the removed section.', '',
  ].join('\n'))
  return { dir, art }
}

// It refuses when the original is still readable — the exact failure that voided
// the first real trial (#25).
{
  const { dir, art } = fixture()
  const out = join(dir, 'scratch')
  const r = run(['--artifact', art, '--section', '## Procedure', '--to', out], dir)
  ok(r.code === 1, 'it exits non-zero when the removed text is still reachable')
  ok(/REFUSING TO CALL THIS A TRIAL/.test(r.out), 'and says so in those terms')
  ok(r.out.includes(art), 'naming the original as the leak')
  console.log('trial: refuses when the original is still readable OK')
}

// It accepts once nothing reachable holds the text.
{
  const { dir, art } = fixture()
  const out = join(dir, 'scratch')
  run(['--artifact', art, '--section', '## Procedure', '--to', out], dir)
  rmSync(art)                                    // the original is gone
  const sealed = join(out, 'SEALED-doc.md.txt')
  const degraded = join(out, 'doc.md')
  const r = run(['--check', degraded, '--sealed', sealed], dir)
  ok(r.code === 0, 'it accepts when no reachable copy holds the removed text')
  ok(/no reachable copy/.test(r.out), 'and says which conclusion it reached')
  console.log('trial: accepts once the original is gone OK')
}

// The degraded artifact really is degraded, and the sealed note really holds
// what was taken.
{
  const { dir, art } = fixture()
  const out = join(dir, 'scratch')
  run(['--artifact', art, '--section', '## Procedure', '--to', out], dir)
  const degraded = readFileSync(join(out, 'doc.md'), 'utf8')
  const sealed = readFileSync(join(out, 'SEALED-doc.md.txt'), 'utf8')
  ok(!degraded.includes(DISTINCT), 'the degraded copy does not contain the removed text')
  ok(sealed.includes(DISTINCT), 'the sealed note does')
  ok(degraded.includes('## Intro') && degraded.includes('## After'), 'and the sections either side survive')
  console.log('trial: the degraded copy is degraded and the sealed note holds the answer OK')
}

// --check is the OTHER refusal, and the one an operator runs deliberately to
// verify isolation before spending a run on a trial. It has its own leak check,
// separate from the seed path's, and nothing exercised it: disabling it left the
// whole suite green. A safety check nobody tests is a safety check nobody has.
{
  const { dir, art } = fixture()
  const out = join(dir, 'scratch')
  // seed somewhere the original is NOT reachable, so the trial is written
  const hidden = mkdtempSync(join(tmpdir(), 'orig-'))
  const moved = join(hidden, 'doc.md')
  writeFileSync(moved, readFileSync(art, 'utf8'))
  rmSync(art)
  const seeded = run(['--artifact', moved, '--section', '## Procedure', '--to', out], dir)
  ok(seeded.code === 0, `the trial is written when nothing leaks — got ${seeded.code}: ${seeded.out}`)
  const degraded = join(out, 'doc.md')
  const sealed = join(out, 'SEALED-doc.md.txt')

  // clean: the answer lives only in the sealed note
  const clean = run(['--check', degraded, '--sealed', sealed], dir)
  ok(clean.code === 0, `--check passes when nothing else holds the answer — got ${clean.code}: ${clean.out}`)

  // now put the answer back within reach and check again
  writeFileSync(join(dir, 'leaked-copy.md'), readFileSync(sealed, 'utf8'))
  const leaky = run(['--check', degraded, '--sealed', sealed], dir)
  ok(leaky.code === 1, '--check exits non-zero once the removed text is readable again')
  ok(/LEAK/.test(leaky.out), 'and says LEAK')
  ok(/leaked-copy\.md/.test(leaky.out), 'naming the file that holds the answer')
  rmSync(hidden, { recursive: true, force: true })
  console.log('trial: --check refuses a trial whose answer became readable again OK')
}

// The leak search passes the needle to grep as a pattern. A needle that STARTS
// WITH A DASH is read as options: grep exits 2 with a usage error, the caller
// treats any non-zero exit as "nothing matched", and the trial is written as
// isolated. A Markdown list item over forty characters produces exactly such a
// needle, so this is an ordinary document, not a crafted one — and the failure is
// the same false pass that voided the first real trial.
{
  const dir = mkdtempSync(join(tmpdir(), 'dash-'))
  const art = join(dir, 'doc.md')
  const DASHED = '- the calibration harness dials the interlock to seventeen before every measured pass'
  writeFileSync(art, [
    '# Doc', '', '## Intro', 'Some ordinary opening text that carries no particular weight at all.', '',
    '## Procedure', DASHED, 'and then a second line of that same procedure for good measure.', '',
    '## After', 'Closing text that stays put.', '',
  ].join('\n'))
  const out = join(dir, 'scratch')
  const r = run(['--artifact', art, '--section', '## Procedure', '--to', out], dir)
  ok(r.code === 1, `the original is plainly still readable, so this must be refused — got exit ${r.code}: ${r.out}`)
  ok(/REFUSING TO CALL THIS A TRIAL/.test(r.out),
     'a needle beginning with a dash must not silently disable the search that would have found the leak')
  rmSync(dir, { recursive: true, force: true })
  console.log('trial: a needle starting with a dash does not silently disable the leak search OK')
}

// grep exits 0 for a match, 1 for no match, and 2+ when it could not do the
// search at all. Only 1 means clean. Reading every non-zero exit as "nothing
// found" turns an unanswered question into a pass.
{
  const dir = mkdtempSync(join(tmpdir(), 'unreadable-'))
  const blocked = join(dir, 'no-entry')
  mkdirSync(blocked)
  chmodSync(blocked, 0o000)
  let readable = true
  try { readdirSync(blocked) } catch { readable = false }
  if (!readable) {
    const { dir: d2, art } = fixture()
    const hidden = mkdtempSync(join(tmpdir(), 'orig3-'))
    const moved = join(hidden, 'doc.md')
    writeFileSync(moved, readFileSync(art, 'utf8'))
    rmSync(art)
    const out = join(d2, 'scratch')
    const r = run(['--artifact', moved, '--section', '## Procedure', '--to', out], d2, { GAUNTLET_TRIAL_ROOTS: blocked })
    ok(r.code === 1, `a root that cannot be searched refuses the trial — got exit ${r.code}: ${r.out}`)
    ok(/could not search/.test(r.out), 'and says the search failed rather than reporting it as clean')
    rmSync(hidden, { recursive: true, force: true })
    console.log('trial: a leak search that could not run is not treated as a pass OK')
  } else {
    console.log('trial: SKIPPED — this user can read a 000 directory, so no search failure can be induced')
  }
  chmodSync(blocked, 0o700)
  rmSync(dir, { recursive: true, force: true })
}

// Seeding a section that is not in the artifact must be refused: whatever the
// tool then treats as "removed" is not what the operator named.
{
  const { dir, art } = fixture()
  const out = join(dir, 'scratch')
  const r = run(['--artifact', art, '--section', '## Nonexistent', '--to', out], dir)
  ok(r.code === 1, `a section that is not in the artifact is refused — got exit ${r.code}: ${r.out}`)
  ok(/no section starting/.test(r.out), 'and names the section it could not find')
  rmSync(dir, { recursive: true, force: true })
  console.log('trial: seeding a section the artifact does not contain is refused OK')
}

// LONGEST needle, not first. A shorter line from the same section also appears in
// an unrelated file: choose the longest (unique) and the trial is clean; choose
// the first (shared) and it reports a leak that is not one.
{
  const dir = mkdtempSync(join(tmpdir(), 'needle-'))
  const art = join(dir, 'doc.md')
  const SHARED = 'a shared sentence that is comfortably over forty characters long'
  const UNIQUE = 'the calibration harness dials the interlock to seventeen before every single measured pass'
  writeFileSync(art, ['# Doc', '', '## Intro', 'Opening text of no weight whatsoever at all here.', '',
    '## Procedure', SHARED, UNIQUE, '', '## After', 'Closing text that stays.', ''].join('\n'))
  writeFileSync(join(dir, 'unrelated.md'), `something else entirely\n${SHARED}\nand more\n`)
  const hidden = mkdtempSync(join(tmpdir(), 'orig4-'))
  const moved = join(hidden, 'doc.md')
  writeFileSync(moved, readFileSync(art, 'utf8'))
  rmSync(art)
  const out = join(dir, 'scratch')
  const r = run(['--artifact', moved, '--section', '## Procedure', '--to', out], dir)
  ok(r.code === 0, `the needle must be the line unique to the section, not the first one — got exit ${r.code}: ${r.out}`)
  rmSync(hidden, { recursive: true, force: true })
  rmSync(dir, { recursive: true, force: true })
  console.log('trial: the needle is the longest line, so a shared shorter line causes no false leak OK')
}

// NOT MARKUP. A long rule of dashes clears forty characters and is not a
// sentence: as a needle it matches every markdown file on the machine.
{
  const dir = mkdtempSync(join(tmpdir(), 'markup-'))
  const art = join(dir, 'doc.md')
  writeFileSync(art, ['# Doc', '', '## Intro', 'Opening text of no weight whatsoever at all here.', '',
    '## Procedure', '-'.repeat(60), '*'.repeat(55), '', '## After', 'Closing text.', ''].join('\n'))
  const out = join(dir, 'scratch')
  const r = run(['--artifact', art, '--section', '## Procedure', '--to', out], dir)
  ok(r.code === 1, `a section of pure markup cannot be leak-checked and is refused — got exit ${r.code}: ${r.out}`)
  ok(/cannot be leak-checked|distinctive/.test(r.out),
     'and the reason is that nothing in it is distinctive enough to search for, not that it leaked')
  rmSync(dir, { recursive: true, force: true })
  console.log('trial: a section of pure markup is refused rather than searched with a rule of dashes OK')
}

// The isolation check is only as wide as the places it looks, so narrowing it
// would weaken the check silently — the refusal still "works", it just stops
// finding things. That is two separate properties, and conflating them made the
// test depend on the machine being clean:
//
//   1. it searches every root it is GIVEN that exists (and skips ones that do not)
//   2. the roots it is given by DEFAULT are the three a builder actually reaches
//
// (1) is behaviour and is tested hermetically below. (2) is a fact about the
// source, and asserting it by running the tool required a pristine filesystem —
// any stray file containing the fixture's needle turned it into a reported leak.
{
  const dir = mkdtempSync(join(tmpdir(), 'roots-'))
  const a = join(dir, 'root-a'); mkdirSync(a)
  const b = join(dir, 'root-b'); mkdirSync(b)
  const missing = join(dir, 'never-created')
  const { dir: d2, art } = fixture()
  const hidden = mkdtempSync(join(tmpdir(), 'orig5-'))
  const moved = join(hidden, 'doc.md')
  writeFileSync(moved, readFileSync(art, 'utf8'))
  rmSync(art)
  const out = join(d2, 'scratch')
  run(['--artifact', moved, '--section', '## Procedure', '--to', out], d2, { GAUNTLET_TRIAL_ROOTS: `${a}:${b}:${missing}` })
  const chk = run(['--check', join(out, 'doc.md'), '--sealed', join(out, 'SEALED-doc.md.txt')], d2,
                  { GAUNTLET_TRIAL_ROOTS: `${a}:${b}:${missing}` })
  const m = /under (\d+) search root\(s\)/.exec(chk.out)
  ok(m, `--check reports how many roots it searched — got: ${chk.out}`)
  eq(Number(m[1]), 2, 'it searches the roots that exist and silently skips the one that does not')
  rmSync(hidden, { recursive: true, force: true }); rmSync(d2, { recursive: true, force: true }); rmSync(dir, { recursive: true, force: true })
  console.log('trial: the search covers every root given that exists, and no others OK')
}
{
  // The default list itself. Dropping one narrows the isolation check without any
  // refusal changing — and ~/.claude/plugins is where the reference lived in the
  // run whose leak voided the first real trial.
  const src = readFileSync(join(ROOT, 'scripts', 'seed-loop-trial.mjs'), 'utf8')
  const defaults = src.slice(src.indexOf('GAUNTLET_TRIAL_ROOTS'), src.indexOf('].filter'))
  for (const root of ['process.cwd()', "'.claude', 'plugins'", "join(TMPROOT, 'gauntlet-loop')"]) {
    ok(defaults.includes(root), `the default search roots still include ${root} — dropping one narrows the check with nothing else changing`)
  }
  ok(/const TMPROOT = process\.env\.TMPDIR \|\| process\.env\.TMP \|\| process\.env\.TEMP \|\| '\/tmp'/.test(src),
     'and TMPROOT resolves through the full chain — pinning the roots list alone would let the root it is built from change underneath it')
  console.log('trial: the default search roots are still the three a builder reaches OK')
}

// A section with nothing distinctive cannot be leak-checked, so it is refused
// rather than run — a pass on an unverifiable trial is not evidence.
{
  const dir = mkdtempSync(join(tmpdir(), 'trial-'))
  const art = join(dir, 'thin.md')
  writeFileSync(art, '# T\n\n## Short\nok\n\n## After\nmore\n')
  const r = run(['--artifact', art, '--section', '## Short', '--to', join(dir, 's')], dir)
  ok(r.code === 1, 'a section with no distinctive line is refused')
  ok(/cannot be leak-checked/.test(r.out), 'and the reason is that it could not be checked, not that it leaked')
  console.log('trial: a defect that cannot be leak-checked is refused OK')
}

// Missing arguments and absent sections are refused, not guessed at.
{
  const { dir, art } = fixture()
  ok(run(['--artifact', art, '--section', '## Nope', '--to', join(dir, 's')], dir).code === 1, 'a section that does not exist is refused')
  ok(run(['--artifact', art], dir).code === 2, 'missing arguments are refused')
  console.log('trial: bad input is refused rather than guessed at OK')
}

// --check has its OWN arity guard, and it is the path an operator runs
// deliberately to verify isolation before launching a run. It took both
// arguments untested: with the guard gone the script calls readFileSync(null)
// and dies with a TypeError, which also exits non-zero — so the code alone does
// not say the guard answered.
//
// The two usage lines are what distinguishes the branches. The seed branch
// prints its own line AND an "or:" line naming --check, so matching "--check"
// alone cannot tell which branch spoke; the check branch prints one line and
// never mentions --artifact.
{
  const { dir, art } = fixture()
  const cases = [
    ['--sealed omitted entirely', ['--check', art]],
    ['--sealed given with no value', ['--check', art, '--sealed']],
    ['--check given with no value', ['--check', '--sealed', art]],
  ]
  for (const [what, argv] of cases) {
    const r = run(argv, dir)
    eq(r.code, 2, `${what}: refused with the bad-input code 2 — got ${r.code}: without the guard it reads a null path and throws`)
    ok(/usage: node scripts\/seed-loop-trial\.mjs --check <degraded-file> --sealed <sealed-note>/.test(r.out),
       `${what}: prints the --check usage line — got: ${r.out.slice(0, 200)}`)
    ok(!/--artifact/.test(r.out), `${what}: it is the CHECK branch that refused, not the seed branch falling through — got: ${r.out.slice(0, 200)}`)
    ok(!/ERR_INVALID_ARG_TYPE|at ModuleJob|ENOENT/.test(r.out), `${what}: refused rather than crashing deeper in — got: ${r.out.slice(0, 200)}`)
  }
  rmSync(dir, { recursive: true, force: true })
  console.log('trial: --check refuses a half-given invocation instead of reading a null path OK')
}
