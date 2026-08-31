// One command a reviewer runs. Exits nonzero if anything fails.
//
// --fail-fast stops at the first failing suite. It exists for the coverage sweep, where
// the exit code is the whole verdict and any red already means CAUGHT: both ways were run
// over the whole list on 2026-08-26 — 5.3x apart, identical verdicts
// (docs/runs/2026-08-26-rc5-suspects.md S3) — and it stayed unimplemented until the
// 120-minute job timeout killed sweep run 33341941280 at 151 of 185 properties graded
// (47 s per property, measured off that log). The DEFAULT stays a full run on purpose:
// a reviewer and the push-time suite need every failure named, not the first one.
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))

// DISCOVERED, not listed. A hardcoded roster means a new suite is only run if
// someone remembers to add it here, and a test file that never runs is worse than
// no test file: the run stays green and reads as coverage. drift-guard goes first
// because it is the cheapest and its failures explain the others; everything
// matching *.test.mjs follows. harness.mjs and this file are not suites.
const NOT_SUITES = new Set(['run-all.mjs', 'harness.mjs'])
const suites = [
  'drift-guard.mjs',
  ...readdirSync(HERE).filter(f => f.endsWith('.test.mjs') && !NOT_SUITES.has(f)).sort(),
]

// GAUNTLET_SUITE marks every descendant of a suite run. Tools that spawn a live model
// refuse while it is set, and env is inherited, so an agent that re-enters this repo from
// inside a suite run carries it too — which is precisely the shape the fork bomb had
// (docs/runs/2026-08-25-oracle-fork-bomb/): a spawned `claude -p` re-ran this suite, which
// re-ran the canary that spawned it. A static "no test mentions the runner" scan cannot see
// that path; this can.
const SUITE_ENV = { ...process.env, GAUNTLET_SUITE: '1' }

const FAIL_FAST = process.argv.includes('--fail-fast')

let failed = 0
for (const s of suites) {
  const r = spawnSync(process.execPath, [join(HERE, s)], { stdio: 'inherit', env: SUITE_ENV })
  if (r.status !== 0) {
    console.error(`FAILED: ${s}`)
    failed++
    if (FAIL_FAST) { console.error('run-all: --fail-fast — stopping at the first failure; suites after this one did not run.'); break }
  }
}
process.exit(failed ? 1 : 0)
