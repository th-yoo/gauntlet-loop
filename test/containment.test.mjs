// Nothing in this repo may spawn a live model from somewhere the suite can reach, and
// whatever does spawn one must refuse before it spawns and must be bounded when it does.
//
//   node test/containment.test.mjs
//
// WHY THIS FILE EXISTS AT ALL. A test canary here was once a live `claude -p`. A mutation
// sweep removed the guard in front of it and ran it; the agent that spawned re-entered the
// repo and re-ran this suite, which re-ran the canary. Depth 13, 22 live agents, ~3.5
// minutes (docs/runs/2026-08-25-oracle-fork-bomb/). Containment for that class was checked
// by hand afterwards, which means it was checked once.
//
// DISCOVERED, NOT LISTED, and that is the whole point. The first version of this check
// named one file. A name is a registry entry: it grows one line per spawner and says
// nothing about the spawner nobody has added yet. This finds them by what they DO — a
// spawn-family call whose binary literal is model-shaped — using the same rule
// scripts/oracle-add.mjs:111 already uses to refuse a model-backed acceptance command.
// Add a second spawner tomorrow and these cases cover it without an edit.
//
// AND NOTHING HERE INVOKES A SPAWNER. Every case is a claim about source: which files name
// it, what order its statements are in, whether its spawn call is bounded. That is
// deliberate. A test that proved the refusal by RUNNING the spawner would be safe only
// while the refusal works — and the case it exists for is the one where the refusal has
// been removed, which is exactly the mutation-sweep scenario above. The postmortem asked
// for this in as many words: "verify by mutation that removing the guard cannot reach a
// spawn of an interactive binary." Reachability is a property of the text.

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, basename } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
function ok(cond, msg) { if (!cond) throw new Error(`ASSERT FAILED: ${msg}`) }

// SUSPICIOUS BY DEFAULT, and that inversion is the whole of issue #55.
//
// This file used to discover spawners with `MODEL_SHAPED` — the same regex, byte for
// byte, that scripts/oracle-add.mjs and scripts/constructed-verify.mjs use to REFUSE a
// model-backed command. One regex in two roles: the detector and the definition of what
// is detected. It could not disagree with itself, so a spawner whose binary was `codex`
// was invisible here AND unrefused there, and one omission disarmed the guard and the
// thing it guards in the same edit. test/spawn-discovery.test.mjs runs the deployed check
// over thirteen fixture spawners identical but for the binary's name; on the old rule it
// caught seven.
//
// So the question asked here is no longer "is this binary on the model list" but "is this
// binary known to be inert". A name nobody has vouched for is a candidate spawner and has
// to carry the guard. The list still has to be maintained — but adding a model runner is
// now the case that FAILS CLOSED, and forgetting to update a list is what the old rule
// punished with silence.
//
// WHAT INERT MEANS HERE: it reads no prompt and starts no agent, so it cannot re-enter
// this repository. `sh` is on the list and is the residual — a shell carries whatever
// command it is handed, and `sh -c "<model runner> -p ..."` is invisible to a scan that
// reads the binary. That hole is not new and is not closed here; oracle-add's own
// MODEL_SHAPED refusal is what stands in front of the acceptance-command case.
const INERT = new Set(['git', 'gh', 'grep', 'ls', 'sh', 'bash', 'node', 'npm', 'cat', 'sed', 'awk', 'find', 'which', 'env', 'true', 'echo'])
const isInert = bin => INERT.has(String(bin).trim().split(/[\s/]+/).pop())
const SPAWN_CALL = /\b(spawnSync|spawn|execFileSync|execFile|execSync|exec)\s*\(\s*['"`]([^'"`\n]+)['"`]/g

// COMMENT-STRIPPED, and this file learned it the same way loop.js's guard did. The header
// of the spawner names `spawnSync('claude', ...)` while explaining what has never been
// executed — a sentence, not a call — and the raw-source scan read it as a spawn sitting
// above the guard, turning a true statement in a comment into a failing case. A string
// that survives only inside a comment is not code. drift-guard.mjs carries the same
// stripper for the same reason; issue #16 is the original.
function stripLineComments(src) {
  return src.split('\n').map(line => {
    const i = line.indexOf('//')
    return i === -1 ? line : line.slice(0, i)
  }).join('\n')
}

function scanDir(rel) {
  const dir = join(ROOT, rel)
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(f => f.endsWith('.mjs')).map(f => join(rel, f))
}
const ALL = [...scanDir('scripts'), ...scanDir('test')]

// A spawner is a file with at least one spawn-family call whose BINARY is not known
// inert. Matching the binary and not the file keeps a comment mentioning a runner from
// counting, and keeps `spawnSync(process.execPath, [...])` out of it — that is not a
// string literal, so the pattern never sees it.
const spawners = []
const dismissed = new Map()
for (const rel of ALL) {
  const raw = readFileSync(join(ROOT, rel), 'utf8')
  const src = stripLineComments(raw)
  const hits = []
  for (const m of src.matchAll(SPAWN_CALL)) {
    if (isInert(m[2])) dismissed.set(m[2], (dismissed.get(m[2]) || 0) + 1)
    else hits.push({ index: m.index, binary: m[2] })
  }
  // THE STRIPPER'S OWN BLINDNESS, asserted rather than hoped for. It cuts at the first
  // `//` on a line, so a spawn call sitting after a `//` inside a string — a URL, a regex
  // — disappears from the stripped source, this scan finds no spawner, and all three cases
  // pass having examined nothing. That is worse than the raw-source bug it replaced,
  // because it fails silent. A vanished match is legitimate ONLY when what precedes it on
  // the line is genuinely a comment.
  for (const m of raw.matchAll(SPAWN_CALL)) {
    if (isInert(m[2])) continue
    if (hits.some(h => src.slice(h.index, h.index + m[0].length) === m[0])) continue
    const lineStart = raw.lastIndexOf('\n', m.index) + 1
    const before = raw.slice(lineStart, m.index).trim()
    ok(before.startsWith('//') || before.startsWith('*'),
       `${rel} has a spawn of the unvouched binary ${m[2]} that disappears when comments are stripped, and what precedes it on the line (${JSON.stringify(before.slice(-60))}) is not a comment — a "//" inside a string is cutting live code out of this scan. Move the call to its own line; this is a limit of the stripper, not an absence of a spawner.`)
  }
  if (hits.length) spawners.push({ rel, src, hits })
}

// A scan matching nothing cannot fail informatively — the drift-guard lesson. The old
// version of this branch printed its own failure mode in as many words ("the discovery
// pattern has gone blind") and then exited 0 with every case below it inside the `else`:
// a residual stated on a branch that decides nothing is stated where it cannot act, and a
// tree holding a spawner it could not see printed the same line as a tree holding none.
//
// Under a rule that asks whether a binary is VOUCHED FOR rather than whether it is on a
// model list, those two stop being the same reading — an unrecognised runner is now found
// — so what is left to report is which calls the INERT list dismissed. That list is the
// remaining way to go blind, so it is printed rather than trusted silently, and a tree
// with no spawn calls at all is distinguished from one where every call was waved through.
if (!spawners.length) {
  const total = [...dismissed.values()].reduce((a, b) => a + b, 0)
  if (!total) {
    console.log('containment: no spawn-family call anywhere in scripts/ or test/ — nothing to contain')
  } else {
    console.log(`containment: ${total} spawn call(s) found, every one dismissed as inert — nothing to contain`)
    console.log(`  dismissed by the INERT list: ${[...dismissed.keys()].sort().join(', ')}`)
    console.log('  (that list is now the only way this scan can go blind; a runner added to it stops being seen)')
  }
} else {
  // ── 1. NOTHING THE SUITE OR A SWEEP EXECUTES MAY NAME A SPAWNER ────────────────────
  {
    const reachable = [...scanDir('test'), join('scripts', 'mutate.mjs'), join('scripts', 'coverage-sweep.mjs')]
      .filter(r => basename(r) !== basename(import.meta.url))
    for (const { rel } of spawners) {
      const stem = basename(rel, '.mjs')
      for (const r of reachable) {
        if (!existsSync(join(ROOT, r))) continue
        ok(!readFileSync(join(ROOT, r), 'utf8').includes(stem),
           `${r} names the model-spawner ${rel}. Anything the suite or a mutation sweep runs must not be able to reach one — that is how this repo reached depth 13. Assert on its refusal in SOURCE, as this file does, rather than by invoking it.`)
      }
    }
    console.log(`containment: no file the suite or a sweep runs names any of the ${spawners.length} spawner(s) — ${spawners.map(s => s.hits[0].binary).join(', ')} OK`)
  }

  // ── 2. THE REFUSAL IS REACHED BEFORE ANY SPAWN CAN BE ──────────────────────────────
  //
  // Position, not presence. A guard that sits below the spawn it protects is not a guard,
  // and a guard nested inside a function nobody calls is decoration — so it must also be
  // at top level, which is what the unindented match tests.
  {
    for (const { rel, src, hits } of spawners) {
      const guard = /^if \(process\.env\.GAUNTLET_SUITE\)/m.exec(src)
      ok(guard, `${rel} spawns a model and has no top-level GAUNTLET_SUITE refusal. run-all and mutate's check set that marker and every descendant inherits it, so it is the only barrier that survives an agent re-entering this repo from inside a suite run.`)
      const exitAfterGuard = src.indexOf('process.exit', guard.index)
      ok(exitAfterGuard !== -1 && exitAfterGuard - guard.index < 800,
         `${rel}'s GAUNTLET_SUITE check does not exit — a marker that is noticed and not acted on is not a barrier`)
      const firstSpawn = Math.min(...hits.map(h => h.index))
      ok(guard.index < firstSpawn,
         `${rel} can reach a model spawn at index ${firstSpawn} before its GAUNTLET_SUITE refusal at ${guard.index}. Order is the barrier; presence is not.`)
    }
    console.log(`containment: every model-spawner refuses on the suite marker before any spawn is reachable OK`)
  }

  // ── 3. AND WHEN IT DOES SPAWN, IT IS BOUNDED ───────────────────────────────────────
  //
  // The timeout bounds the wait and not the blast — killing a child does not kill what
  // the child spawned — so a ceiling on how many are started is the half that limits the
  // damage, and both are required.
  {
    for (const { rel, src, hits } of spawners) {
      for (const h of hits) {
        const callSite = src.slice(h.index, h.index + 400)
        ok(/timeout:/.test(callSite), `${rel} spawns ${h.binary} with no timeout at the call site — a spawn that hangs reports nothing, and nothing reads as "not run" rather than "wedged"`)
      }
      const ceiling = /const\s+(MAX_\w+)\s*=\s*\d+/.exec(src)
      ok(ceiling, `${rel} spawns a model with no ceiling constant — a timeout bounds one spawn, nothing bounds how many are started`)
      // A COMPARISON, not an appearance. The first version asked only whether the
      // identifier occurred again before the spawn, and it occurs in the refusal's own
      // error message — so replacing `planned > MAX_SPAWNS_PER_RUN` with a literal left
      // the check green. Same loose-name failure drift-guard's header catalogues: the
      // needle was short and name-shaped and was not bound to what it claimed.
      const compare = new RegExp(`(?:[<>]=?|===?)\\s*${ceiling[1]}\\b|\\b${ceiling[1]}\\s*(?:[<>]=?|===?)`, 'g')
      const enforcedAt = [...src.matchAll(compare)].map(m => m.index).filter(i => i > ceiling.index)
      const firstSpawnIdx = Math.min(...hits.map(h => h.index))
      ok(enforcedAt.some(i => i < firstSpawnIdx),
         `${rel} declares ${ceiling[1]} but never COMPARES against it before spawning — naming it in a message is not a ceiling`)
    }
    console.log(`containment: every model spawn carries a timeout, and every spawner a ceiling enforced before it spawns OK`)
  }
}
