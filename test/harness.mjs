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
function loadWorkflowScript(filename) {
  const src = readFileSync(join(SKILLS_DIR, filename), 'utf8').replace('export const meta', 'const meta')
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
    const m = /^round-(\d+):/.exec(label)
    return m ? Number(m[1]) : null
  }

  // Only used when opts.critic is not supplied — see the branch in agent()
  // below, which handles opts.critic directly against the real prompt.
  function specForRound(round) {
    const rounds = opts.rounds || []
    if (round - 1 < rounds.length && rounds[round - 1] !== undefined) return rounds[round - 1]
    return opts.roundFallback || DEFAULT_ROUND_FALLBACK
  }

  // loop.js has no round cap by design, so a stub whose breaker never trips and
  // whose critic never picks the candidate would spin forever. This guard is
  // the HARNESS protecting itself, not a cap on the thing under test: it throws
  // loudly rather than ending a run quietly, so "the loop did not stop" shows up
  // as a failure with a name instead of a hung suite. Raise it per test with
  // opts.runawayGuard when a test legitimately needs more rounds.
  const RUNAWAY_GUARD = opts.runawayGuard || 50

  async function agent(prompt, o) {
    const label = (o && o.label) || '(unlabeled)'
    prompts.push({ label, prompt, agentType: o && o.agentType, phase: o && o.phase })

    const guardRound = roundOf(label)
    if (guardRound != null && guardRound > RUNAWAY_GUARD) {
      throw new Error(
        `harness runaway guard: the loop reached round ${guardRound} (> ${RUNAWAY_GUARD}) without stopping. ` +
        'Either the test forgot to bound the run with opts.breaker/opts.budget/a winning round, or loop.js ' +
        'stopped honouring one of its terminators.'
      )
    }

    // The circuit breaker. Default: the token is always present, so a test that
    // says nothing about it runs until something else stops it.
    // opts.breaker(round) -> true/'PRESENT' | false/'ABSENT' | null (dead probe)
    //                        | a raw BREAKER_SCHEMA-shaped object
    if (label.endsWith(':breaker')) {
      const round = roundOf(label)
      if (typeof opts.breaker !== 'function') return { token: 'PRESENT', evidence: 'stub: token present' }
      const v = opts.breaker(round)
      if (v === null) return null
      if (v && typeof v === 'object') return v
      const token = (v === true || v === 'PRESENT') ? 'PRESENT' : 'ABSENT'
      return { token, evidence: `stub: ${token} at round ${round}` }
    }

    if (/:ab(:\d+)?$/.test(label)) {
      const round = roundOf(label)
      const idxMatch = /:ab:(\d+)$/.exec(label)
      const criticIndex = idxMatch ? Number(idxMatch[1]) : 1
      const candidateIsA = CANDIDATE != null && prompt.includes(`ARTIFACT A: ${CANDIDATE}`)
      const candidateSide = candidateIsA ? 'A' : 'B'
      const referenceSide = candidateIsA ? 'B' : 'A'

      if (typeof opts.critic === 'function') {
        const spec = opts.critic(round, { candidateSide, referenceSide, criticIndex })
        return spec
      }

      // A round's spec may be a single object (broadcast to every critic in
      // the line, which is what a k=1 test has always done) or an ARRAY, one
      // entry per critic, indexed by criticIndex.
      let spec = specForRound(round)
      if (Array.isArray(spec)) spec = spec[criticIndex - 1]
      if (spec === null || spec === undefined) return spec
      const winner = spec.winner !== undefined ? spec.winner : (spec.candidateWins ? candidateSide : referenceSide)
      return {
        winner,
        why: spec.why !== undefined ? spec.why : 'why',
        gap: spec.gap !== undefined ? spec.gap : `gap-round-${round}`,
        inspected: spec.inspected !== undefined ? spec.inspected : 'inspected',
        margin: spec.margin,
      }
    }

    if (label.endsWith(':build')) {
      const round = roundOf(label)
      if (typeof opts.builder === 'function') return opts.builder(round, prompt)
      return { changed: `did round ${round}`, where: 'candidate.js' }
    }

    return null
  }

  const parallel = async thunks => Promise.all(thunks.map(t => t()))
  const pipeline = async () => []
  const logs = []
  const log = m => logs.push(m)
  const phase = () => {}
  const budget = opts.budget || { total: null, remaining: () => Infinity }

  const fn = loadWorkflowScript('loop.js')
  const result = await fn(agent, parallel, pipeline, log, phase, opts.args, budget)

  return { result, prompts, labels: prompts.map(p => p.label), logs }
}
