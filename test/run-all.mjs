// One command a reviewer runs. Exits nonzero if anything fails.
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

let failed = 0
for (const s of suites) {
  const r = spawnSync(process.execPath, [join(HERE, s)], { stdio: 'inherit' })
  if (r.status !== 0) { console.error(`FAILED: ${s}`); failed++ }
}
process.exit(failed ? 1 : 0)
