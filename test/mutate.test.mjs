// The mutation tool decides whether a check can fail, so its own failure modes
// matter more than most. Each case here is a mistake that was actually made by
// hand during the session that motivated the script.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MUTATE = join(ROOT, 'scripts', 'mutate.mjs')
function ok(cond, msg) { if (!cond) throw new Error(`ASSERT FAILED: ${msg}`) }
function run(args) {
  try { return { code: 0, out: execFileSync('node', [MUTATE, ...args], { encoding: 'utf8', stdio: 'pipe' }) } }
  catch (e) { return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') } }
}

function fixture(body) {
  const dir = mkdtempSync(join(tmpdir(), 'mutate-'))
  const target = join(dir, 'target.mjs')
  const suite = join(dir, 'suite.mjs')
  writeFileSync(target, body)
  writeFileSync(suite, `import { value } from './target.mjs'\nif (value !== 1) { console.error('bad'); process.exit(1) }\n`)
  return { dir, target, suite }
}

// A find string that never matches leaves the file untouched, and the suite then
// passes for the most misleading possible reason. Reported as NOT CAUGHT it
// condemns a working test — which is exactly what happened by hand.
{
  const { dir, target, suite } = fixture('export const value = 1\n')
  const r = run([target, 'this text is not present', 'x', '--', 'node', suite])
  ok(r.code === 2, `a non-matching find string is refused, not answered — got ${r.code}`)
  ok(/does not appear/.test(r.out), 'and it says the file was never changed')
  ok(!/NOT CAUGHT/.test(r.out), 'it must not report a verdict it has no basis for')
  rmSync(dir, { recursive: true, force: true })
  console.log('mutate: a mutation that does not apply is refused, not scored OK')
}

// A mutant that cannot parse fails for a reason unrelated to the check.
{
  const { dir, target, suite } = fixture('export const value = 1\n')
  const r = run([target, 'export const value = 1', 'export const value = ((', '--', 'node', suite])
  ok(r.code === 2, `an unparseable mutant is refused — got ${r.code}`)
  ok(/does not parse/.test(r.out), 'and says so, rather than crediting the syntax error as a catch')
  rmSync(dir, { recursive: true, force: true })
  console.log('mutate: an unparseable mutant is refused rather than scored as caught OK')
}

// The verdict is the exit code. A suite that dies without printing the expected
// failure text is still a suite that noticed.
{
  const { dir, target, suite } = fixture('export const value = 1\n')
  const caught = run([target, 'value = 1', 'value = 2', '--', 'node', suite])
  ok(caught.code === 0 && /CAUGHT/.test(caught.out), `a change the suite depends on is CAUGHT — got ${caught.code}: ${caught.out}`)
  const missed = run([target, '// nothing', '// nothing', '--', 'node', suite])
  ok(missed.code === 2, 'a no-op find is still refused even when it would have been NOT CAUGHT')
  rmSync(dir, { recursive: true, force: true })
  console.log('mutate: the verdict comes from the exit code OK')
}

// A check command that never ran is not a check that noticed. spawnSync reports
// status null when it cannot spawn, and `null !== 0` is true — so a typo in the
// check command scored as CAUGHT.
{
  const { dir, target } = fixture('export const value = 1\n')
  const r = run([target, 'value = 1', 'value = 2', '--', 'this-command-does-not-exist'])
  ok(r.code === 2, `an unspawnable check is refused, not scored — got ${r.code}: ${r.out}`)
  ok(/did not run/.test(r.out), 'and it says the check never ran')
  ok(!/CAUGHT/.test(r.out), 'it must not claim the mutation was noticed')
  rmSync(dir, { recursive: true, force: true })
  console.log('mutate: a check command that cannot run is refused, not counted as a catch OK')
}

// Every path restores the file, including the ones that exit early. The first
// version restored in a `finally` and exited inside the `try` — and process.exit()
// does not run finally blocks in Node, so it corrupted the file it was testing.
{
  const { dir, target, suite } = fixture('export const value = 1\n')
  const before = readFileSync(target, 'utf8')
  run([target, 'nope', 'x', '--', 'node', suite])
  run([target, 'export const value = 1', 'export const value = ((', '--', 'node', suite])
  run([target, 'value = 1', 'value = 2', '--', 'node', suite])
  ok(readFileSync(target, 'utf8') === before,
     'the target is byte-identical after a refused mutation, an unparseable one, and a real one')
  rmSync(dir, { recursive: true, force: true })
  console.log('mutate: every exit path restores the file OK')
}
