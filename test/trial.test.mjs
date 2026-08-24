// The trial seeder's one job: refuse to set up a seeded-defect trial whose
// answer is readable. A trial that measures nothing is worse than no trial,
// because it produces a number.
//
//   node test/trial.test.mjs

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SEED = join(ROOT, 'scripts', 'seed-loop-trial.mjs')

function ok(cond, msg) { if (!cond) throw new Error(`ASSERT FAILED: ${msg}`) }
function run(args, cwd) {
  try { return { code: 0, out: execFileSync('node', [SEED, ...args], { encoding: 'utf8', cwd, stdio: ['ignore', 'pipe', 'pipe'] }) } }
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
