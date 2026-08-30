// Loads a Workflow script from skills/gauntlet-loop/ into a stubbed agent
// runtime so the orchestration can be exercised offline. Scripts are plain JS
// meant to run inside an async function with injected globals, which is
// exactly what AsyncFunction gives us.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKILLS_DIR = join(ROOT, 'skills', 'gauntlet-loop')

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

export function ok(cond, msg) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

export function eq(actual, expected, msg) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`ASSERT FAILED: ${msg}\n  expected: ${e}\n  actual:   ${a}`)
}

// ---------------------------------------------------------------------------
// Generic loader — the one place the AsyncFunction wiring lives. Any script
// in skills/gauntlet-loop/ is plain top-level code sharing the same five
// injected globals (agent, parallel, pipeline, log, phase) plus args/budget.
// `export const meta` is stripped because these are not ES modules at
// runtime; the Workflow harness loads them as scripts, not imports.
// ---------------------------------------------------------------------------
// `transform`, when given, rewrites the SOURCE before it is compiled. It exists for
// one kind of test: a constant loop.js carries as a copy of a record it cannot read
// (REFUSAL_EVIDENCE, a copy of the corpus's false-refusal cell) has branches that
// only a different record reaches, and the only way to drive those is to hand the
// script a different record. A test that uses it must say which constant it
// replaced, and must not use it to patch behaviour.
function loadWorkflowScript(filename, transform) {
  let src = readFileSync(join(SKILLS_DIR, filename), 'utf8').replace('export const meta', 'const meta')
  if (transform) {
    const out = transform(src)
    if (typeof out !== 'string' || out === src) throw new Error('opts.source must return a changed source string — an unchanged source means the transform matched nothing')
    src = out
  }
  return new AsyncFunction('agent', 'parallel', 'pipeline', 'log', 'phase', 'args', 'budget', src)
}

// ---------------------------------------------------------------------------
// loop.js — drives a SEQUENCE of rounds rather than a single pass. The test
// controls what each round's critic returns (does the candidate win, and
// what gap comes back), and optionally what the builder returns and how the
// budget behaves.
//
// opts.args    - passed straight through as the script's `args` global
// opts.rounds  - array, one entry per round, 0-indexed by round-1:
//                  { candidateWins: bool, gap, why, inspected, margin }
//                Rounds beyond the array's length (or when the array is
//                omitted/empty) get opts.roundFallback, defaulting to a
//                critic that never picks the candidate — this is what lets a
//                cap/budget test run N rounds without enumerating each one.
// opts.critic  - optional function(round, {candidateSide, referenceSide})
//                -> verdict-shaped object (or null), overriding opts.rounds
//                entirely. Use this when a test needs logic opts.rounds can't
//                express (e.g. returning nothing to simulate a dead critic).
// opts.builder - optional function(round, prompt) -> BUILD_SCHEMA-shaped
//                object (or null). Defaults to a fixed, harmless report.
// opts.breaker - optional function(round) -> true/'PRESENT' | false/'ABSENT'
//                | null (a dead probe) | a raw BREAKER_SCHEMA object. Defaults
//                to the token always being present. This is how a test bounds a
//                run now that loop.js has no round cap: `r => r <= 2` runs
//                exactly two rounds and then reports the operator's cancel.
// opts.runawayGuard - optional int, default 50. The harness throws if the loop
//                reaches a round beyond it. Protects the suite from hanging;
//                it is not a cap on loop.js.
// opts.budget  - optional budget stub ({ total, remaining() }), forwarded
//                as-is. Defaults to no budget target (remaining => Infinity),
//                matching runGauntlet's default.
//
// The critic side is resolved by reading the ACTUAL prompt text for which
// path was rendered as "ARTIFACT A: <path>" — not by recomputing loop.js's
// alternation formula here. Duplicating that formula in the stub would let a
// broken alternation in loop.js sail through undetected.
// ---------------------------------------------------------------------------

const DEFAULT_ROUND_FALLBACK = { candidateWins: false, gap: 'fallback gap — the critic never picks the candidate', why: 'fallback why', inspected: 'fallback inspected' }

export async function runLoop(opts) {
  opts = opts || {}
  const prompts = []
  const CANDIDATE = opts.args && opts.args.candidate

  function roundOf(label) {
    const m = /(?:^|-)round-(\d+):/.exec(label)
    return m ? Number(m[1]) : null
  }

  // Only used when opts.critic is not supplied — see the branch in agent()
  // below, which handles opts.critic directly against the real prompt.
  function specForRound(round) {
    const rounds = opts.rounds || []
    if (round - 1 < rounds.length && rounds[round - 1] !== undefined) return rounds[round - 1]
    if (opts.roundFallback) return opts.roundFallback

    // A SPECIFIED WIN KEEPS WINNING PAST THE END OF THE ARRAY.
    //
    // Added for #18's second half, and it preserves what ~40 existing fixtures
    // already meant rather than changing any of them. `rounds: [{ candidateWins:
    // true }]` says "a run that wins" — the test then inspects fairness, sizes,
    // disclosures, whatever it is actually about. How MANY wins a run needs is
    // loop.js's decision, not the fixture's, and it just became two: the exit
    // arms on the first win and fires on a second from a fresh critic.
    //
    // Without this, every such fixture arms at its last specified round, meets a
    // lose-forever fallback, disarms, builds, and spins to the runaway guard —
    // ~40 tests failing for a policy change none of them was asserting about.
    //
    // The lose-forever default is kept for fixtures that never won, because that
    // is what makes the runaway guard able to fire at all: a test that forgot to
    // bound its run still hits it.
    // A round spec is either one critic (an object) or k critics (an array).
    // At k>1 loop.js needs EVERY critic to pick the candidate for the round to
    // win, so the array form only counts as a win when all of them do — the
    // same rule the loop applies, rather than a second one written here.
    const last = rounds.length ? rounds[rounds.length - 1] : null
    const lastWon = Array.isArray(last)
      ? last.length > 0 && last.every(c => c && c.candidateWins)
      : !!(last && last.candidateWins)
    if (lastWon) return last

    return DEFAULT_ROUND_FALLBACK
  }

  // loop.js has no round cap by design, so a stub whose breaker never trips and
  // whose critic never picks the candidate would spin forever. This guard is
  // the HARNESS protecting itself, not a cap on the thing under test: it throws
  // loudly rather than ending a run quietly, so "the loop did not stop" shows up
  // as a failure with a name instead of a hung suite. Raise it per test with
  // opts.runawayGuard when a test legitimately needs more rounds.
  const RUNAWAY_GUARD = opts.runawayGuard || 50
  let runaway = null
  let schemaViolation = null

  // The real runtime VALIDATES a schema'd result and makes the model retry until
  // it conforms, so a stub missing a required field is an input production can
  // never deliver — and a test asserting on it is asserting about nothing. This
  // repo has already been bitten by that exact shape once ("margin: asserted the
  // stub, not the schema"). Enforced here so unrealistic stubs fail loudly
  // instead of quietly exercising dead branches.
  // Recorded as well as thrown, exactly like the runaway guard. loop.js now
  // legitimately catches agent errors — a size probe or lead that throws must
  // degrade rather than kill the verdict — and those handlers swallow this one
  // too, so a stub feeding the loop an impossible shape passed silently. The
  // script under test cannot be allowed to suppress the harness's own guards.
  function enforceSchema(label, o, value) {
    // opts.illegalStubIsThePoint opts a test out. A few cases exist to prove the
    // loop survives an agent that IGNORED its schema — the breaker check is
    // `!== 'PRESENT'` rather than `=== 'ABSENT'` exactly so an out-of-enum answer
    // still stops the run — and for those the impossible shape is the experiment,
    // not an oversight. Enforcement stays on by default so the distinction has to
    // be stated rather than assumed.
    if (opts.illegalStubIsThePoint) return value
    const violate = m => { schemaViolation = schemaViolation || m; return Object.assign(new Error(m), { __harness: true }) }
    const req = o && o.schema && o.schema.required
    if (!req || value === null || value === undefined) return value
    // Enums too: the runtime rejects a value outside the declared set exactly as it
    // rejects a missing field, so a stub returning one is another shape production
    // cannot deliver.
    const props = (o.schema && o.schema.properties) || {}
    for (const [k, spec] of Object.entries(props)) {
      if (spec && spec.enum && value[k] !== undefined && !spec.enum.includes(value[k])) {
        throw violate(`harness: the stub for "${label}" returned ${k}="${value[k]}", which is not in the schema's enum [${spec.enum.join(', ')}]. The runtime rejects that and retries, so this input cannot occur in production.`)
      }
    }
    // Types, for the same reason as enums: the runtime validates against the
    // schema and retries, so a stub whose field is the wrong type is a shape
    // production cannot deliver — `bytes: "1000"` would be rejected there and was
    // accepted here.
    for (const [k, spec] of Object.entries(props)) {
      if (!spec || !spec.type || value[k] === undefined || value[k] === null) continue
      const actual = Array.isArray(value[k]) ? 'array' : typeof value[k]
      const want = spec.type === 'integer' ? 'number' : spec.type
      if (actual !== want) {
        throw violate(`harness: the stub for "${label}" returned ${k} as ${actual}, and the schema declares ${spec.type}. The runtime rejects that and retries, so this input cannot occur in production.`)
      }
    }
    const missing = req.filter(k => value[k] === undefined)
    if (missing.length) {
      throw violate(`harness: the stub for "${label}" returned an object missing required field(s) ${missing.join(', ')}. The real runtime rejects that and retries the model, so this input cannot occur in production — a test built on it exercises a branch the loop never reaches. Add the field to the stub.`)
    }
    return value
  }

  async function agent(prompt, o) {
    const label = (o && o.label) || '(unlabeled)'
    prompts.push({ label, prompt, agentType: o && o.agentType, phase: o && o.phase, schema: o && o.schema })

    const guardRound = roundOf(label)
    if (guardRound != null && guardRound > RUNAWAY_GUARD) {
      // Recorded as well as thrown. loop.js legitimately catches agent errors now
      // (a breaker or lead that throws must degrade rather than kill the verdict),
      // and a guard the script under test can swallow is not a guard — a runaway
      // would come back as a quiet CANCELLED. The flag is checked after the script
      // returns, where nothing can intercept it.
      runaway = runaway || `the loop reached round ${guardRound} (> ${RUNAWAY_GUARD})`
      throw Object.assign(new Error(
        `harness runaway guard: the loop reached round ${guardRound} (> ${RUNAWAY_GUARD}) without stopping. ` +
        'Either the test forgot to bound the run with opts.breaker/opts.budget/a winning round, or loop.js ' +
        'stopped honouring one of its terminators.'
      ), { __harness: true })
    }

    // The circuit breaker. Default: the token is always present, so a test that
    // says nothing about it runs until something else stops it.
    // opts.breaker(round) -> true/'PRESENT' | false/'ABSENT' | null (dead probe)
    //                        | a raw BREAKER_SCHEMA-shaped object
    // opts.lead -> PIECE_SCHEMA object, or null (no lead / refuses). Default
    // null, so every existing test runs the artifact whole exactly as before.
    // opts.fairness -> FAIRNESS_SCHEMA object, or null (unchecked). Default
    // null, so an existing test's run reports verdict 'unchecked'.
    if (label === 'goal-fairness') return enforceSchema(label, o, opts.fairness || null)
    if (label === 'goal-fitted') return enforceSchema(label, o, opts.fitted || null)
    // opts.selfid -> SELFID_SCHEMA object, or null (unchecked). Default null,
    // so every existing test runs with content-blindness unchecked exactly as before.
    // opts.selfid === 'throw' models the agent ERRORING rather than returning
    // nothing — the real shape of an unregistered agent type. parallel() turns
    // that into null, so the loop must degrade, not crash.
    // opts.comparability -> COMPARABILITY_SCHEMA object, or null (unchecked).
    // Default null, so every existing test runs with the pairing unchecked and
    // the refusal dormant, exactly as before. 'throw' models the agent ERRORING;
    // it runs inside parallel(), so the loop must degrade rather than refuse — a
    // probe that died measured nothing and must not be read as a verdict.
    // The pairing check asks about each artifact SEPARATELY — comparability:1 is
    // the candidate, comparability:2 the reference — and derives the verdict in
    // loop.js from the two answers. opts.roles is [candidateRole, referenceRole];
    // a bare object applies to both sides, which is the common case.
    // 'throw' models the agent ERRORING. It runs inside parallel(), so the loop
    // must degrade to "not measured" rather than refuse — a probe that died is not
    // a verdict.
    if (label === 'comparability:1' || label === 'comparability:2') {
      if (opts.roles === 'throw') throw new Error("agent type 'gauntlet-loop:gauntlet-goal-check' not found")
      const which = label.endsWith(':1') ? 0 : 1
      const spec = Array.isArray(opts.roles) ? opts.roles[which] : (opts.roles || null)
      return enforceSchema(label, o, spec || null)
    }
    if (label === 'blindness') {
      if (opts.selfid === 'throw') throw new Error("agent type 'gauntlet-loop:gauntlet-blindness' not found")
      return enforceSchema(label, o, opts.selfid || null)
    }

    // 'throw' models the agent ERRORING rather than returning nothing. These two
    // are awaited directly at top level, outside any parallel(), so a throw there
    // destroys the run's whole verdict rather than degrading.
    if (label === 'decompose') {
      if (opts.lead === 'throw') throw new Error("agent type 'gauntlet-loop:gauntlet-lead' not found")
      return enforceSchema(label, o, opts.lead || null)
    }

    // opts.pieceThrows: <piece name> — that piece's run raises, modelling an
    // agent error inside the per-piece parallel(). The runtime turns it into a
    // null piece outcome; the loop must not read that as a win.
    // Fires on that piece's CRITIC, not its breaker: a throwing breaker now fails
    // safe to CANCELLED by design, which is a different event from a piece whose
    // run dies mid-round.
    if (opts.pieceThrows && label.startsWith(`${opts.pieceThrows}-round-`) && /:ab(:\d+)?$/.test(label)) {
      throw new Error(`simulated agent failure in piece ${opts.pieceThrows}`)
    }

    // opts.sizes -> function(round) -> bytes, or a fixed number. Default: no
    // measurement, so a test that says nothing about size records none.
    if (label.endsWith(':size')) {
      const round = roundOf(label)
      if (opts.sizes === 'throw') throw new Error("agent type 'gauntlet-loop:gauntlet-breaker' not found")
      if (opts.sizes === undefined) return null
      // The piece name is the label prefix (`${piece.name}-round-N:size`), so a
      // test can give each piece its own size series — which is the only way to
      // exercise size accounting across a decomposition.
      const pm = /^(.*)-round-\d+:size$/.exec(label)
      const pieceName = pm ? pm[1] : null
      const b = typeof opts.sizes === 'function' ? opts.sizes(round, pieceName) : opts.sizes
      return b == null ? null : enforceSchema(label, o, { bytes: b, evidence: 'stub size probe' })
    }

    if (label.endsWith(':breaker')) {
      const round = roundOf(label)
      if (typeof opts.breaker !== 'function') return { token: 'PRESENT', evidence: 'stub: token present' }
      const v = opts.breaker(round)
      if (v === 'throw') throw new Error("agent type 'gauntlet-loop:gauntlet-breaker' not found")
      if (v === null) return null
      if (v && typeof v === 'object') return enforceSchema(label, o, v)
      const token = (v === true || v === 'PRESENT') ? 'PRESENT' : 'ABSENT'
      return enforceSchema(label, o, { token, evidence: `stub: ${token} at round ${round}` })
    }

    // The whole-artifact split check. Runs once, after every piece has won, and
    // is judged on the WHOLE candidate against the WHOLE reference — so its side
    // is resolved from the real prompt exactly as the per-round critics' is.
    // opts.whole -> { candidateWins | winner, why, gap, margin }, or null (probe
    // did not return). Default undefined, so tests that say nothing get null.
    if (/:whole$/.test(label)) {
      // opts.whole === 'throw' simulates the agent runtime raising rather than
      // returning null. This call is a bare await outside parallel(), so an
      // uncaught throw would discard a completed run's entire verdict.
      if (opts.whole === 'throw') throw new Error('simulated agent runtime failure')
      if (!opts.whole) return null
      const spec = opts.whole
      const candidateIsA = prompt.includes(`ARTIFACT A: ${CANDIDATE}`)
      const winner = spec.winner !== undefined
        ? spec.winner
        : (spec.candidateWins ? (candidateIsA ? 'A' : 'B') : (candidateIsA ? 'B' : 'A'))
      return enforceSchema(label, o, {
        winner,
        why: spec.why !== undefined ? spec.why : 'whole-artifact why',
        gap: spec.gap !== undefined ? spec.gap : 'whole-artifact gap',
        inspected: spec.inspected !== undefined ? spec.inspected : 'read both whole artifacts',
        margin: spec.margin !== undefined ? spec.margin : 'clear',
      })
    }

    // THE REGRESSION CHECK — #18's measuring half. A fresh critic asked whether this round's build
    // is better than the version that existed before it, which is the comparison the
    // loop has never had: every other A/B here is against the REFERENCE, so a round
    // that made the artifact worse is invisible and becomes the next round's baseline.
    //
    // opts.regressionCheck -> function(round) -> the critic's answer, or null (no answer).
    // Default undefined, so every existing test runs with no regression check asked for and
    // behaves exactly as before.
    if (/:regression-check$/.test(label)) {
      const round = roundOf(label)
      if (opts.regressionCheck === 'throw') throw new Error("agent type 'gauntlet-loop:gauntlet-ab-critic' not found")
      if (opts.regressionCheck === undefined) return null
      // The stub is TOLD which side the new version landed on, read from the real
      // prompt, so a test can assert the alternation instead of trusting it. Without
      // this a check pinned to one side passes every test in the suite — which is
      // what the coverage sweep reported the first time these properties were pinned.
      const newIsA = /ARTIFACT A: (?!.*\.prev-)/.test(prompt)
      const spec = typeof opts.regressionCheck === 'function' ? opts.regressionCheck(round, { newIsA }) : opts.regressionCheck
      if (spec == null) return null
      // A test says which VERSION the critic preferred; which SIDE that is comes from
      // the real prompt, never from re-deriving loop.js's parity here. A check whose
      // alternation broke would otherwise sail through, which is the mistake the A/B
      // branch above already refuses to make.
      if (spec.prefers) {
        const winner = spec.prefers === 'new' ? (newIsA ? 'A' : 'B') : (newIsA ? 'B' : 'A')
        return enforceSchema(label, o, { winner, why: spec.why || 'stub regression-check why' })
      }
      return enforceSchema(label, o, spec)
    }

    if (/:ab(:\d+)?$/.test(label)) {
      const round = roundOf(label)
      const idxMatch = /:ab:(\d+)$/.exec(label)
      const criticIndex = idxMatch ? Number(idxMatch[1]) : 1
      // Which side is ours is read from the ACTUAL prompt, never recomputed from
      // loop.js's parity formula — duplicating that formula here would let a
      // broken alternation sail through. With decomposition a piece is judged
      // against its OWN paths, so the set of "ours" paths is the whole-artifact
      // candidate plus every piece candidate the lead named.
      const ourPaths = [CANDIDATE, ...((opts.lead && opts.lead.pieces) || []).map(x => x && x.candidate)].filter(Boolean)
      const candidateIsA = ourPaths.some(path => prompt.includes(`ARTIFACT A: ${path}`))
      const candidateSide = candidateIsA ? 'A' : 'B'
      const referenceSide = candidateIsA ? 'B' : 'A'

      if (typeof opts.critic === 'function') {
        // The piece name comes from the label prefix. Without it a test cannot make
        // ONE piece behave differently, so anything about per-piece interaction —
        // which piece stops a run, which is released afterwards — was unreachable.
        const pm = /^(.*)-round-\d+:/.exec(label)
        const spec = await opts.critic(round, { candidateSide, referenceSide, criticIndex, piece: pm ? pm[1] : null })
        return spec
      }

      // A round's spec may be a single object (broadcast to every critic in
      // the line, which is what a k=1 test has always done) or an ARRAY, one
      // entry per critic, indexed by criticIndex.
      let spec = specForRound(round)
      if (Array.isArray(spec)) spec = spec[criticIndex - 1]
      if (spec === null || spec === undefined) return spec
      const winner = spec.winner !== undefined ? spec.winner : (spec.candidateWins ? candidateSide : referenceSide)
      return enforceSchema(label, o, {
        winner,
        why: spec.why !== undefined ? spec.why : 'why',
        gap: spec.gap !== undefined ? spec.gap : `gap-round-${round}`,
        inspected: spec.inspected !== undefined ? spec.inspected : 'inspected',
        // Defaulted, not omitted: AB_SCHEMA requires `margin`, so a verdict without
        // one cannot reach the loop in production. A test that does not care about
        // margin should still hand the loop a shape the runtime could produce.
        margin: spec.margin !== undefined ? spec.margin : 'clear',
      })
    }

    if (label.endsWith(':build')) {
      const round = roundOf(label)
      // AWAITED. A stub may be async — one deliberately is, to make concurrent
      // pieces interleave — and validating the Promise instead of what it resolves
      // to fails every time, on a stub that is perfectly correct.
      if (typeof opts.builder === 'function') return enforceSchema(label, o, await opts.builder(round, prompt))
      // The default stub models a builder that DID take the snapshot the prompt asks
      // for and reported where it put it. opts.snapshots === false models one that
      // did not — the loop must then say the comparison could not be made rather
      // than skip it silently. `snapshot` is optional in BUILD_SCHEMA on purpose:
      // making it required would mean every existing builder stub in this suite is
      // an input production cannot deliver.
      const snap = opts.snapshots === false ? {} : { snapshot: `${CANDIDATE}.prev-${round}` }
      return enforceSchema(label, o, { changed: `did round ${round}`, where: 'candidate.js', ...snap })
    }

    return null
  }

  // The Workflow runtime's contract: "A thunk that throws (or whose agent errors)
  // resolves to null in the result array — the call itself never rejects."
  // Promise.all REJECTS instead, which diverged from the runtime on exactly the
  // failure that matters: an agent erroring inside parallel(). The real runtime
  // hands loop.js a null it already handles; this used to crash the test, so the
  // whole class was untestable — and it is the class that produced a silent
  // "content blindness was NOT checked" on a live run (agent type not found).
  // The harness's OWN runaway guard must still escape — it is a test-rig failure,
  // not an agent error, and swallowing it would turn a hung loop into a quiet
  // pass. Everything else follows the runtime contract.
  const parallel = async thunks =>
    Promise.all(thunks.map(async t => {
      try { return await t() } catch (e) { if (e && e.__harness) throw e; return null }
    }))
  const pipeline = async () => []
  const logs = []
  const log = m => logs.push(m)
  const phase = () => {}
  const budget = opts.budget || { total: null, remaining: () => Infinity }

  const fn = loadWorkflowScript('loop.js', opts.source)
  const result = await fn(agent, parallel, pipeline, log, phase, opts.args, budget)

  if (schemaViolation) throw Object.assign(new Error(schemaViolation + ' (raised after the script returned: the script caught the in-flight throw.)'), { __harness: true })

  if (runaway) {
    throw Object.assign(new Error(
      `harness runaway guard: ${runaway} without stopping. Either the test forgot to bound the run ` +
      'with opts.breaker/opts.budget/a winning round, or loop.js stopped honouring one of its terminators. ' +
      '(Raised after the script returned: the script caught the in-flight throw.)'
    ), { __harness: true })
  }

  return { result, prompts, labels: prompts.map(p => p.label), logs }
}
