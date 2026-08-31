// --fail-fast stops the runner at the first red suite, and its ABSENCE keeps running.
//
//   node test/run-all-failfast.test.mjs
//
// Both directions are load-bearing. The flag exists because the coverage sweep's verdict
// is an exit code — any red already means CAUGHT, measured at 5.3x with identical
// verdicts (docs/runs/2026-08-26-rc5-suspects.md S3) — and it stayed unimplemented until
// the 120-minute timeout killed sweep run 33341941280 at 151 of 185 properties. The
// OTHER direction is the one that must not change quietly: the DEFAULT is a full run,
// because a reviewer and the push-time suite need every failure named, and a sweep
// optimization that leaked into the default would silently halve what a red push reports.
//
// run-all discovers suites by globbing ITS OWN directory, so it is exercised here by
// copying it into a temp directory beside three constructed suites — a green stub named
// drift-guard.mjs (run-all runs that name first; without it the missing file would be
// the first failure and this test would pass with the flag broken, satisfied by the
// wrong red), then a red suite, then one that leaves a marker on disk. Whether the
// marker exists after the run is the observable: absent under --fail-fast, present
// without it. Spawning the REAL run-all from inside a suite would recurse — the copy is
// what makes this testable at all.

import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))

let failures = 0
const ok = (cond, m) => { if (cond) console.log(`  ok    ${m}`); else { console.error(`  FAIL  ${m}`); failures++ } }

const dir = mkdtempSync(join(tmpdir(), 'run-all-failfast-'))
const marker = join(dir, 'marker-late-suite-ran')
writeFileSync(join(dir, 'run-all.mjs'), readFileSync(join(HERE, 'run-all.mjs'), 'utf8'))
writeFileSync(join(dir, 'drift-guard.mjs'), 'process.exit(0)\n')
writeFileSync(join(dir, 'mm-red.test.mjs'), 'console.error("  FAIL  constructed red suite"); process.exit(1)\n')
writeFileSync(join(dir, 'zz-late.test.mjs'), `import { writeFileSync } from 'node:fs'\nwriteFileSync(${JSON.stringify(marker)}, 'ran')\nprocess.exit(0)\n`)

try {
  console.log('run-all-failfast: with the flag, the first red suite is the last suite run')
  {
    const r = spawnSync(process.execPath, [join(dir, 'run-all.mjs'), '--fail-fast'], { encoding: 'utf8' })
    ok(r.status === 1, `exit 1 on a red suite (got ${r.status})`)
    ok(!existsSync(marker), 'the suite after the red one never ran — the sweep pays for one failure, not the full list')
    ok(/stopping at the first failure/.test(r.stderr), 'and the stop is announced, so a partial listing cannot read as a complete one')
  }

  console.log('run-all-failfast: without the flag, every suite still runs — the default did not change')
  {
    rmSync(marker, { force: true })
    const r = spawnSync(process.execPath, [join(dir, 'run-all.mjs')], { encoding: 'utf8' })
    ok(r.status === 1, `exit 1 either way (got ${r.status})`)
    ok(existsSync(marker), 'the suite after the red one RAN — a reviewer and the push gate get every failure named, and a sweep cost knob that leaked into the default would fail here')
  }
} finally {
  rmSync(dir, { recursive: true, force: true })
}

console.log('run-all-failfast: stating what this suite cannot establish')
console.log('          NOT MEASURED: the 5.3x. That figure is one recorded run over the 2026-08-26 list')
console.log('          (docs/runs/2026-08-26-rc5-suspects.md S3); the mix of CAUGHT to NOT CAUGHT decides')
console.log('          the real saving, and an all-green sweep saves nothing — the timeout, not this file,')
console.log('          is what bounds that case.')

if (failures) {
  console.error(`\nrun-all-failfast: ${failures} failure(s) — the flag must stop the sweep's check early and must not leak into the default.`)
  process.exit(1)
}
console.log('\nrun-all-failfast: OK — early stop with the flag, full run without it.')
