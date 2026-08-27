// THE REPRODUCIBLE for #55 — containment finds spawners with the same regex the
// spawn refusals use, so the detector and the thing detected cannot disagree.
//
//   node test/spawn-discovery.test.mjs
//
// COMMITTED FAILING.
//
// `test/containment.test.mjs:35` declares
//
//   const MODEL_SHAPED = /\b(claude|anthropic|openai|gpt|llm|ollama|gemini)\b/i
//
// byte-identical to `scripts/oracle-add.mjs:297` and `scripts/constructed-verify.mjs:55`.
// Those two use it to REFUSE. Containment uses it to DISCOVER WHAT NEEDS A REFUSAL: it
// matches the binary literal of every spawn-family call and calls a file a spawner when
// the binary is model-shaped, then asserts each spawner carries a GAUNTLET_SUITE guard
// reached before any spawn, a timeout, and an enforced ceiling.
//
// One regex, two roles. Add a spawner whose binary is `codex` and containment finds
// nothing to contain, oracle-add fails to refuse the same binary, and one omission
// disarms the guard and the thing it guards in the same edit. This is the fork-bomb guard
// (docs/runs/2026-08-25-oracle-fork-bomb/: depth 13, 22 live agents).
//
// HOW THIS TESTS IT WITHOUT PLANTING A SPAWNER IN THIS REPOSITORY. It writes a fixture
// tree under tmpdir — `scripts/` holding one spawner, `test/` holding an UNMODIFIED COPY
// of containment.test.mjs — and runs the copy there. Containment resolves ROOT from its
// own location, so the copy audits the fixture tree and nothing else. The real file is
// never edited and never given a parameter it did not have; what runs is the deployed
// check, over a tree chosen to make it speak. Re-running beats pinning.
//
// NOTHING IS EVER EXECUTED. The fixture spawner is read as text by containment and is
// never imported, never run, and its binary does not have to exist. `run-all` scans only
// the real test/ directory, so the fixture is unreachable from the suite by construction.
//
// AND THE BINARY NAMES ARE BUILT BY CONCATENATION, so this file's own source never places
// a model-shaped literal next to a spawn-family call. Otherwise a fix that widens the
// pattern would turn THIS file into a spawner and demand a GAUNTLET_SUITE guard in it —
// a trap set for whoever closes the issue.
//
// WHAT IS COMPUTED RATHER THAN ASSERTED. One fixture shape, thirteen binary names, and
// the only thing that varies is the name. An instrument that detects SPAWNING scores
// 13/13. An instrument reading its own registry scores 7/13 — and 7/13 is what the set is
// arranged to expose, rather than a single hand-picked miss that proves only that a miss
// can be built.

import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }

// Split so the literal never sits beside a spawn call in this file's source.
const IN_PATTERN = ['clau' + 'de', 'anthro' + 'pic', 'open' + 'ai', 'g' + 'pt', 'l' + 'lm', 'olla' + 'ma', 'gemi' + 'ni']
const NOT_IN_PATTERN = ['cod' + 'ex', 'gr' + 'ok', 'lla' + 'ma', 'mist' + 'ral', 'qw' + 'en', 'deep' + 'seek']

// AN UNGUARDED SPAWNER, and unguarded in the way containment names first: no top-level
// GAUNTLET_SUITE refusal at all. Every case in containment's rule 2 should fire on this.
// The binary is the only thing that changes between runs.
function spawnerSource(binary) {
  const call = `${'spawn'}Sync(${JSON.stringify(binary)}, ['-p', 'hello'])`
  return [
    `import { ${'spawn'}Sync } from 'node:child_process'`,
    `const MAX_FIXTURE_SPAWNS = 1`,
    `${call}`,
    ``,
  ].join('\n')
}

// Runs the DEPLOYED containment check over a tree containing zero or one spawner.
function runContainmentOver(binary) {
  const dir = mkdtempSync(join(tmpdir(), 'spawn-discovery-'))
  try {
    mkdirSync(join(dir, 'scripts'), { recursive: true })
    mkdirSync(join(dir, 'test'), { recursive: true })
    copyFileSync(join(HERE, 'containment.test.mjs'), join(dir, 'test', 'containment.test.mjs'))
    if (binary) writeFileSync(join(dir, 'scripts', 'fixture-runner.mjs'), spawnerSource(binary))
    const r = spawnSync(process.execPath, [join(dir, 'test', 'containment.test.mjs')], {
      encoding: 'utf8', timeout: 30_000, env: { ...process.env, GAUNTLET_SUITE: '1' },
    })
    return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// --------------------------------------------------------------------------
// 1. THE HARNESS ITSELF CAN CATCH SOMETHING. A crossing whose positive side
//    never fires measures nothing, and this repository has shipped that twice:
//    a trial asking only `exit !== 0` reported CAUGHT against a script that did
//    not parse. So the deployed check is shown failing on a spawner it DOES see,
//    with its own words quoted, before anything is concluded from a pass.
// --------------------------------------------------------------------------
console.log('spawn-discovery: the deployed check fails on an unguarded spawner it recognises')
{
  const r = runContainmentOver(IN_PATTERN[0])
  ok(r.code !== 0,
     `containment passed on a fixture that spawns a recognised model binary with no GAUNTLET_SUITE refusal (exit ${r.code}). If it cannot catch that, nothing below is evidence of anything.`)
  ok(/GAUNTLET_SUITE/.test(r.out),
     `containment failed on the recognised spawner but not for the guard — its output never mentions GAUNTLET_SUITE, so this fixture is failing for some other reason and the positive control is not controlling. Output: ${JSON.stringify(r.out.slice(-300))}`)
}

// --------------------------------------------------------------------------
// 2. AN EMPTY TREE, so the two ways of finding nothing can be told apart below.
// --------------------------------------------------------------------------
console.log('spawn-discovery: a tree with no spawner is reported as nothing to contain')
const EMPTY = runContainmentOver(null)
{
  ok(EMPTY.code === 0, `containment failed on a tree with no spawner at all (exit ${EMPTY.code}) — then it is not the absence of a spawner it is reporting`)
  ok(/nothing to contain/.test(EMPTY.out), `containment's zero-spawner branch did not print its own message; the rest of this file reads that branch and needs it to be identifiable`)
}

// --------------------------------------------------------------------------
// 3. THE CROSSING. Same fixture, same absent guard, only the binary's name
//    differs. Detection of SPAWNING is invariant under the name; detection by
//    REGISTRY is not, and that is the whole difference between the two readings.
// --------------------------------------------------------------------------
console.log('spawn-discovery: an unguarded spawner is caught whatever its binary is called')
{
  const caught = [], missed = []
  for (const bin of [...IN_PATTERN, ...NOT_IN_PATTERN]) {
    const r = runContainmentOver(bin)
      ; (r.code !== 0 ? caught : missed).push(bin)
  }
  const all = IN_PATTERN.length + NOT_IN_PATTERN.length
  console.log(`          caught ${caught.length}/${all}: ${caught.join(', ') || '(none)'}`)
  console.log(`          missed ${missed.length}/${all}: ${missed.join(', ') || '(none)'}`)
  ok(missed.length === 0,
     `containment caught ${caught.length} of ${all} unguarded spawners. The ${missed.length} it missed differ from the ones it caught in NOTHING but the binary's name (${missed.join(', ')}) — it is not detecting a spawn, it is matching the same registry that scripts/oracle-add.mjs and scripts/constructed-verify.mjs use to refuse one. A detector that shares its definition with the thing it audits cannot disagree with it, and one omission disarms both in the same edit.`)
}

// --------------------------------------------------------------------------
// 4. AND THE MISS IS INDISTINGUISHABLE FROM AN EMPTY REPOSITORY. This is the
//    half that makes it a guard gap rather than a coverage gap: containment's
//    zero-spawner branch prints "(if that is a surprise, the discovery pattern
//    has gone blind, not the risk away)" — it names the failure mode exactly —
//    and then exits 0 with every case sitting inside the `else`. A residual
//    stated on a branch that decides nothing is stated where it cannot act.
// --------------------------------------------------------------------------
console.log('spawn-discovery: a repository it cannot see into does not read as an empty one')
{
  const blind = runContainmentOver(NOT_IN_PATTERN[0])
  const sameVerdict = blind.code === EMPTY.code
  const sameWords = /nothing to contain/.test(blind.out) && /nothing to contain/.test(EMPTY.out)
  ok(!(sameVerdict && sameWords),
     `a tree holding an unguarded spawner and a tree holding none produce the same exit code (${blind.code}) and the same "nothing to contain" line. Containment cannot distinguish "there is nothing to guard" from "there is something I cannot see", and it reports the safe one.`)
}

if (failures) {
  console.error(`\nspawn-discovery: ${failures} failure(s) — the containment guard is bounded by a list of names, and the list is shared with what it audits.`)
  process.exit(1)
}
console.log('\nspawn-discovery: OK — an unguarded spawner is caught by what it does, not by what its binary is called.')
