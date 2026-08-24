// One command a reviewer runs. Exits nonzero if anything fails.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const suites = ['drift-guard.mjs', 'smoke.mjs', 'orchestration.test.mjs', 'loop.test.mjs', 'canary.test.mjs']

let failed = 0
for (const s of suites) {
  const r = spawnSync(process.execPath, [join(HERE, s)], { stdio: 'inherit' })
  if (r.status !== 0) { console.error(`FAILED: ${s}`); failed++ }
}
process.exit(failed ? 1 : 0)
