// A change to agents/ without a version bump is caught — issue 68's class.
//
//   node test/plugin-version.test.mjs
//
// THE DEFECT. The plugin cache is version-pinned, so 2548f55 could replace every agent
// while leaving 0.2.0 in plugin.json and every installed copy kept the old roster: the
// loop's first spawn failed before round 1, and the tree looked self-consistent throughout.
// The bump to 0.3.0 fixed the instance. scripts/plugin-version-check.mjs is the class
// check: it finds the commit that set the current version and diffs agents/ from there
// to the working tree.
//
// HOW IT IS TESTED WITHOUT TOUCHING THIS REPOSITORY'S AGENTS. The check reads PLUGIN_ROOT,
// so this builds throwaway git repositories under tmpdir shaped to make it speak — a
// deleted agent, an edited one, an UNTRACKED addition (the case `git diff` against a
// commit does not see), a bump left uncommitted, a second bump committed so the check
// must find the newer record, and a shallow clone that cannot reach the record at all.
// Every expected commit hash is read back from the fixture, never typed. Then the real
// tree is checked, which is the assertion CI actually needs: the working tree's agents/
// matches what the version in plugin.json shipped.
//
// NOTHING HERE SPAWNS A MODEL. The subprocesses are `git` and `node` running the check.

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CHECK = join(ROOT, 'scripts', 'plugin-version-check.mjs')

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }

const run = root => {
  const r = spawnSync(process.execPath, [CHECK], { encoding: 'utf8', env: { ...process.env, PLUGIN_ROOT: root }, timeout: 60_000 })
  return { status: r.status, out: String(r.stdout || '') + String(r.stderr || '') }
}

// A fixture repository: one manifest, two agents, one commit. Commits carry identity
// inline so the test does not depend on the machine's git config.
const GIT_ID = ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false']
const g = (dir, ...args) => execFileSync('git', [...GIT_ID, ...args], { cwd: dir, encoding: 'utf8' }).trim()
const manifest = (dir, version) => writeFileSync(join(dir, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'fixture', version, description: 'a fixture' }, null, 2) + '\n')
const commit = (dir, msg) => { g(dir, 'add', '-A'); g(dir, 'commit', '-q', '-m', msg); return g(dir, 'rev-parse', '--short=7', 'HEAD') }

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'plugin-version-'))
  g(dir, 'init', '-q')
  mkdirSync(join(dir, '.claude-plugin'))
  mkdirSync(join(dir, 'agents'))
  manifest(dir, '0.1.0')
  writeFileSync(join(dir, 'agents', 'alpha.md'), '# alpha\n')
  writeFileSync(join(dir, 'agents', 'beta.md'), '# beta\n')
  const bump = commit(dir, 'ship 0.1.0')
  return { dir, bump }
}

const dirs = []
try {
  console.log('plugin-version: an unchanged agent set passes, and names the record it was checked against')
  {
    const f = fixture(); dirs.push(f.dir)
    const r = run(f.dir)
    ok(r.status === 0, `exit 0 on an unchanged set — got ${r.status}:\n${r.out}`)
    ok(r.out.includes(`shipped at ${f.bump}`), `the pass names the bump commit ${f.bump} it compared against — got:\n${r.out}`)
    ok(/2 file\(s\)/.test(r.out), 'and counts the two shipped agents')
    ok(/NOT ESTABLISHED/.test(r.out), 'the pass branch states what it cannot establish — a residual printed only on failure is printed when it does not matter')
  }

  console.log('plugin-version: a deleted agent fails, and the failure names the file, the version and the record')
  {
    const f = fixture(); dirs.push(f.dir)
    unlinkSync(join(f.dir, 'agents', 'beta.md'))
    const r = run(f.dir)
    ok(r.status === 1, `exit 1 on a deleted agent — got ${r.status}:\n${r.out}`)
    ok(/^\s+D\s+agents\/beta\.md$/m.test(r.out), `the deleted file is listed as D — got:\n${r.out}`)
    ok(r.out.includes('0.1.0') && r.out.includes(f.bump), 'the failure names the version still in the manifest and the commit that shipped it')
    ok(/[Bb]ump the version/.test(r.out), 'and says what the remedy is')
    ok(/NOT ESTABLISHED/.test(r.out), 'the fail branch states the residual too')
  }

  console.log('plugin-version: an edited agent fails — the record is content, not a roster')
  {
    const f = fixture(); dirs.push(f.dir)
    writeFileSync(join(f.dir, 'agents', 'alpha.md'), '# alpha, reworded\n')
    const r = run(f.dir)
    ok(r.status === 1, `exit 1 on an edited agent — got ${r.status}:\n${r.out}`)
    ok(/^\s+M\s+agents\/alpha\.md$/m.test(r.out), `the edited file is listed as M — got:\n${r.out}`)
  }

  console.log('plugin-version: an UNTRACKED addition fails — the case `git diff <commit>` does not see')
  {
    const f = fixture(); dirs.push(f.dir)
    writeFileSync(join(f.dir, 'agents', 'gamma.md'), '# gamma\n')
    const r = run(f.dir)
    ok(r.status === 1, `exit 1 on an untracked new agent — got ${r.status}:\n${r.out}`)
    ok(/^\s+A\s+agents\/gamma\.md$/m.test(r.out), `the untracked file is listed as A — got:\n${r.out}`)
  }

  console.log('plugin-version: a change outside agents/ does not fail — the check is scoped, and says so')
  {
    const f = fixture(); dirs.push(f.dir)
    writeFileSync(join(f.dir, 'README.md'), 'changed\n')
    const r = run(f.dir)
    ok(r.status === 0, `exit 0 when only files outside agents/ changed — got ${r.status}:\n${r.out}`)
    ok(/rest of the plugin/.test(r.out), 'and the residual names the scope it does not cover')
  }

  console.log('plugin-version: an uncommitted bump passes — the working tree is what the new version will ship')
  {
    const f = fixture(); dirs.push(f.dir)
    unlinkSync(join(f.dir, 'agents', 'beta.md'))
    manifest(f.dir, '0.2.0')
    const r = run(f.dir)
    ok(r.status === 0, `exit 0 on a deleted agent WITH an uncommitted bump — got ${r.status}:\n${r.out}`)
    ok(/0\.2\.0 is in no commit yet/.test(r.out), `and it says the version is unshipped rather than claiming a match — got:\n${r.out}`)
  }

  console.log('plugin-version: after a committed bump, the NEWER record is the one compared against')
  {
    const f = fixture(); dirs.push(f.dir)
    unlinkSync(join(f.dir, 'agents', 'beta.md'))
    manifest(f.dir, '0.2.0')
    const bump2 = commit(f.dir, 'ship 0.2.0 without beta')
    let r = run(f.dir)
    ok(r.status === 0, `exit 0 right after the bump commit — got ${r.status}:\n${r.out}`)
    ok(r.out.includes(`shipped at ${bump2}`) && !r.out.includes(f.bump), `compared against ${bump2}, not the earlier ${f.bump}`)
    unlinkSync(join(f.dir, 'agents', 'alpha.md'))
    r = run(f.dir)
    ok(r.status === 1 && /^\s+D\s+agents\/alpha\.md$/m.test(r.out), `a deletion after the second bump fails against the second record — got ${r.status}:\n${r.out}`)
    ok(!/beta\.md/.test(r.out), 'and beta, gone before 0.2.0 shipped, is not reported — the record moved')
  }

  console.log('plugin-version: a manifest edit that is not a bump moves nothing — the 2548f55 shape')
  {
    const f = fixture(); dirs.push(f.dir)
    writeFileSync(join(f.dir, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'fixture', version: '0.1.0', description: 'reworded, version untouched' }, null, 2) + '\n')
    unlinkSync(join(f.dir, 'agents', 'beta.md'))
    commit(f.dir, 'replace the roster, reword the description, keep the version')
    const r = run(f.dir)
    ok(r.status === 1, `exit 1 when the description changed and the version did not — got ${r.status}:\n${r.out}`)
    ok(r.out.includes(`shipped at ${f.bump}`), 'and the record is still the original bump commit')
  }

  console.log('plugin-version: a shallow clone that cannot reach the record says NOT ESTABLISHED, exit 2 — never a pass')
  {
    const f = fixture(); dirs.push(f.dir)
    writeFileSync(join(f.dir, 'README.md'), 'one more commit so depth 1 hides the bump\n')
    commit(f.dir, 'unrelated')
    const shallow = mkdtempSync(join(tmpdir(), 'plugin-version-shallow-'))
    dirs.push(shallow)
    execFileSync('git', ['clone', '-q', '--depth', '1', `file://${f.dir}`, shallow], { encoding: 'utf8' })
    const r = run(shallow)
    ok(r.status === 2, `exit 2 on a shallow clone — got ${r.status}:\n${r.out}`)
    ok(/NOT ESTABLISHED/.test(r.out) && /shallow/.test(r.out) && /fetch-depth: 0/.test(r.out), `it names the cause and the remedy — got:\n${r.out}`)
  }

  console.log('plugin-version: THIS repository — agents/ matches what the manifest version shipped')
  {
    const r = run(ROOT)
    ok(r.status === 0, `the real tree passes — got ${r.status}:\n${r.out}`)
    const m = r.out.match(/plugin-version-check: .*/)
    console.log(`          ${m ? m[0].replace('plugin-version-check: ', '') : '(no verdict line)'}`)
    ok(r.status !== 2, 'and it was established, not skipped — a shallow checkout here would make CI unable to answer')
  }
} finally {
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
}

console.log('plugin-version: stating what this cannot establish')
console.log('          NOT MEASURED: whether an installed copy exists at all, or which version it holds. The')
console.log('          check reads the tree; the cache is on another machine. NOT COVERED: files outside')
console.log('          agents/ — a stale loop.js in an install runs, older, and nothing here says so.')

if (failures) { console.error(`\nplugin-version: ${failures} FAILURE(S)`); process.exit(1) }
console.log('\nplugin-version: OK — nine fixture shapes and the real tree, every record hash read back from git rather than typed.')
