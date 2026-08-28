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
// Moved to test/inert-binaries.mjs for issue #61: ci-workflow.test.mjs discovers
// spawners too, and was doing it with a private one-name regex. One rule, two
// askers — a second copy is what #55 was about.
import { isInert } from './inert-binaries.mjs'
// THE LOOKBEHIND IS LOAD-BEARING. `\b` happily matches the `exec` in `/re/.exec(str)`, so
// every regex test in the tree read as a spawn whose binary was the haystack. The old rule
// never noticed because MODEL_SHAPED filtered the nonsense out; under a rule that treats an
// unrecognised binary as suspicious, that noise becomes failures. A spawn call is not a
// method on something else.
const SPAWN_CALL = /(?<![.\w$])(spawnSync|spawn|execFileSync|execFile|execSync|exec)\s*\(\s*['"`]([^'"`\n]+)['"`]/g

// A SHELL IS A SPAWN OF WHATEVER IT IS HANDED, and that is the second way the old rule
// went blind. `sh` reads no prompt and starts no agent, so it belongs on INERT — but
// `sh -c "<runner> -p ..."` is a spawn of that runner wearing `sh` as a name. Three
// shapes exist in this repository and the third is not matched by SPAWN_CALL at all,
// because its binary is a variable rather than a string literal:
//
//   sh -c '<runner> -p hi'          the command is a literal
//   sh -c cmd                       the command is computed
//   spawnSync(cmd, { shell: true }) the BINARY is computed
//
// So a shell call is judged by the COMMAND, not by the shell. A rule that flagged every
// shell call would catch all three and be worthless — test/loop.test.mjs shells out to
// `printf` and test/corpus-portability.test.mjs to a git/xargs/tar pipeline, and both are
// in test/spawn-discovery.test.mjs as negative controls precisely so that a rule which has
// stopped reading the command scores 3 of 5 rather than passing.
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh'])
// Anything reached by a spawn whose command is not statically legible. `exec`/`execSync`
// take the command as the first argument, so their literal IS the command; the shell
// family takes it after `-c`.
const ANY_SPAWN_CALL = /(?<![.\w$])(spawnSync|spawn|execFileSync|execFile|execSync|exec)\s*\(/g

// AND THE NAME MUST BE THE IMPORTED ONE. `spawn(s)` inside the log line
// `${spawned} spawn(s) this invocation` matched ANY_SPAWN_CALL and reported two of this
// repository's own drawers as spawning a computed binary. A word followed by a bracket is
// not a call to child_process; what makes it one is that the file imported it.
function spawnNames(src) {
  const names = new Set()
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]node:child_process['"]/g)) {
    for (const part of m[1].split(',')) {
      const n = part.split(/\s+as\s+/).pop().trim()
      if (n) names.add(n)
    }
  }
  return names
}

// The statically visible command words of a shell argument: the first word of each
// pipeline or list segment, up to the first interpolation. Returns null when nothing is
// legible — a bare identifier says nothing about what will run and must not be waived.
function commandWords(argText) {
  if (argText === null) return null
  const staticPart = argText.split('${')[0]
  if (!staticPart.trim()) return null
  const words = staticPart.split(/\||&&|\|\||;|\n/).map(seg => seg.trim().split(/\s+/)[0]).filter(Boolean)
  return words.length ? words : null
}

// A bare identifier after `-c` is not automatically unreadable: scripts/staleness-trial.mjs
// builds its command as a same-file `const` two lines earlier. Resolving one hop is the
// difference between reading what is there and demanding a barrier in front of a command
// that is plainly `sh <fixture> | grep -qx ok`. Narrow on purpose — exactly one initializer
// in the file, and its right-hand side has to start with a quote. Anything else is unknown.
function resolveConst(src, ident) {
  if (!/^[A-Za-z_$][\w$]*$/.test(ident)) return null
  const decls = [...src.matchAll(new RegExp(`\\b(?:const|let|var)\\s+${ident}\\s*=\\s*(['"\`])`, 'g'))]
  if (decls.length !== 1) return null
  const q = decls[0][1]
  const start = decls[0].index + decls[0][0].length
  let out = ''
  for (let i = start; i < src.length; i++) {
    if (src[i] === '\\') { out += src[i + 1] || ''; i++; continue }
    if (src[i] === q) return out
    out += src[i]
  }
  return null
}

// Does this identifier name a path built from ROOT? Follows `const X = join(Y, ...)` a few
// hops, because test/push-gate.test.mjs writes it in two — `HOOK_DIR = join(ROOT, ...)`
// then `HOOK = join(HOOK_DIR, ...)` — and a rule that reads one hop and not two is a rule
// about how somebody happened to break the line.
function rootedInRepo(src, ident, depth = 0) {
  if (depth > 4) return false
  const m = new RegExp(`\\b(?:const|let|var)\\s+${ident}\\s*=\\s*join\\s*\\(\\s*([A-Za-z_$][\\w$]*)`).exec(src)
  if (!m) return false
  return m[1] === 'ROOT' || rootedInRepo(src, m[1], depth + 1)
}

// The literal handed to a shell after `-c`, or null when it is an expression. Deliberately
// narrow: anything it cannot read confidently comes back null and is treated as unknown.
function shellCommandLiteral(callText, src) {
  const dashC = /['"`]-c['"`]\s*,\s*/.exec(callText)
  if (!dashC) return null
  const rest = callText.slice(dashC.index + dashC[0].length)
  const q = rest[0]
  if (q !== "'" && q !== '"' && q !== '`') {
    const ident = /^([A-Za-z_$][\w$]*)\s*[,)\]]/.exec(rest)
    return ident ? resolveConst(src, ident[1]) : null
  }
  let out = ''
  for (let i = 1; i < rest.length; i++) {
    if (rest[i] === '\\') { out += rest[i + 1] || ''; i++; continue }
    if (rest[i] === q) return out
    out += rest[i]
  }
  return null
}

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
  const imported = spawnNames(src)
  for (const m of src.matchAll(ANY_SPAWN_CALL)) {
    if (!imported.has(m[1])) continue
    const callText = src.slice(m.index, m.index + 600)
    const lit = /^[a-zA-Z]+\s*\(\s*(['"`])([^'"`\n]*)\1/.exec(callText)
    const binary = lit ? lit[2] : null

    // THE BINARY IS AN EXPRESSION. Nothing is known about what runs, so nothing can be
    // waived. scripts/oracle-add.mjs:320 is this shape and executes a caller-supplied
    // string; the old scan did not match it at all.
    if (binary === null) {
      if (/process\.execPath/.test(callText.slice(0, 40))) continue
      // A BINARY THAT IS A FILE IN THIS REPOSITORY is covered by this scan already:
      // whatever it spawns is audited here too, so executing it adds no reach. That is a
      // compositional argument, not an exemption — it holds only because the target is
      // inside the tree being scanned. test/push-gate.test.mjs runs `.githooks/pre-push`
      // this way, in a throwaway repo against a stub suite.
      const arg = /^[a-zA-Z]+\s*\(\s*([A-Za-z_$][\w$]*)\s*[,)]/.exec(callText)
      if (arg && rootedInRepo(src, arg[1])) continue
      hits.push({ index: m.index, binary: '(computed)', kind: 'command', why: 'the binary is an expression' })
      continue
    }
    if (!isInert(binary)) { hits.push({ index: m.index, binary, kind: 'agent' }); continue }

    // AN INERT BINARY THAT IS A SHELL still runs something. Read the command.
    if (SHELLS.has(String(binary).trim().split(/[\s/]+/).pop())) {
      const words = commandWords(shellCommandLiteral(callText, src))
      if (words === null) {
        hits.push({ index: m.index, binary, kind: 'command', why: 'the shell command is an expression' })
        continue
      }
      const unvouched = words.filter(w => !isInert(w))
      if (unvouched.length) {
        hits.push({ index: m.index, binary, kind: 'command', why: `the shell runs ${unvouched.join(', ')}` })
        continue
      }
      dismissed.set(`${binary} -c ${words.join(' ')}`, 1)
      continue
    }
    dismissed.set(binary, (dismissed.get(binary) || 0) + 1)
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
const agents = spawners.filter(sp => sp.hits.some(h => h.kind === 'agent'))
      .map(sp => ({ ...sp, hits: sp.hits.filter(h => h.kind === 'agent') }))
const executors = spawners.filter(sp => sp.hits.some(h => h.kind === 'command'))
      .map(sp => ({ ...sp, hits: sp.hits.filter(h => h.kind === 'command') }))

// ── 4. AND A SHELL IS A SPAWN OF WHATEVER IT IS HANDED ─────────────────────────────
//
// A site whose command is not statically legible is not an agent spawn — it is a site
// that BECOMES one depending on data. Rules 1-3 are the wrong barrier for it: rule 1
// would forbid the suite from importing scripts/constructed-verify.mjs for its pure
// functions, and a top-level GAUNTLET_SUITE exit in a module that is imported would kill
// the importer rather than guard anything.
//
// What these sites carry instead is a CONTENT refusal — the command is checked for a
// model before it runs (scripts/constructed-verify.mjs and scripts/oracle-add.mjs both do
// this, via scripts/model-shaped.mjs). Either barrier is accepted here; what is not
// accepted is neither.
//
// THE RESIDUAL, and it is stated here rather than in a comment because this is the branch
// that carries the verdict: this checks that a refusal EXISTS in the file, not that the
// value it refuses is the value that reaches the spawn, and not that it is positioned
// before it. Position is meaningless for a spawn defined as a helper at the top of a file
// and invoked later — scripts/constructed-verify.mjs:50 is exactly that shape. Proving the
// refusal guards the value would take dataflow this file does not do. What is closed here
// is the visibility gap: these sites were not found at all.
{
  const CONTENT_REFUSAL = /MODEL_SHAPED|namesAModel/
  if (!executors.length) {
    console.log('containment: no spawn runs a command this scan cannot read')
  } else {
    for (const { rel, src, hits } of executors) {
      const why = [...new Set(hits.map(h => h.why))].join('; ')
      const guarded = /^if \(process\.env\.GAUNTLET_SUITE\)/m.test(src)
      const refuses = CONTENT_REFUSAL.test(src)
      // A THIRD BARRIER, and it is the mechanism the whole design rests on: a call that
      // sets GAUNTLET_SUITE in the CHILD's env marks every descendant, so any spawner the
      // command reaches refuses before it spawns. scripts/mutate.mjs runs a gate's check
      // command — a computed binary — and does exactly this.
      const marks = hits.some(h => /GAUNTLET_SUITE:\s*'1'/.test(src.slice(h.index, h.index + 600)))
      ok(guarded || refuses || marks,
         `${rel} spawns a command this scan cannot read (${why}) and carries neither barrier: no top-level GAUNTLET_SUITE refusal, and nothing that checks the command for a model before running it. A shell is a spawn of whatever it is handed, so a site that runs an unreadable command needs one of the two.`)
      console.log(`          ${rel} — ${why} — ${guarded ? 'suite-guarded' : refuses ? 'refuses a model-named command' : 'marks its child with the suite flag'}`)
    }
    console.log(`containment: every spawn of an unreadable command carries a barrier OK`)
    console.log('          NOT CHECKED: that the refused value is the value that reaches the spawn, or that')
    console.log('          it is positioned before it. That needs dataflow this file does not do; what is')
    console.log('          established is that these sites are found at all, which they previously were not.')
  }
}

if (!agents.length) {
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
    for (const { rel } of agents) {
      const stem = basename(rel, '.mjs')
      for (const r of reachable) {
        if (!existsSync(join(ROOT, r))) continue
        ok(!readFileSync(join(ROOT, r), 'utf8').includes(stem),
           `${r} names the model-spawner ${rel}. Anything the suite or a mutation sweep runs must not be able to reach one — that is how this repo reached depth 13. Assert on its refusal in SOURCE, as this file does, rather than by invoking it.`)
      }
    }
    console.log(`containment: no file the suite or a sweep runs names any of the ${agents.length} agent-spawner(s) — ${agents.map(s => s.hits[0].binary).join(', ')} OK`)
  }

  // ── 2. THE REFUSAL IS REACHED BEFORE ANY SPAWN CAN BE ──────────────────────────────
  //
  // Position, not presence. A guard that sits below the spawn it protects is not a guard,
  // and a guard nested inside a function nobody calls is decoration — so it must also be
  // at top level, which is what the unindented match tests.
  {
    for (const { rel, src, hits } of agents) {
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
    for (const { rel, src, hits } of agents) {
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
