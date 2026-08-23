// Loads gauntlet.js into a stubbed agent runtime so the orchestration can be
// exercised offline. The script is plain JS meant to run inside an async
// function with injected globals, which is exactly what AsyncFunction gives us.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'skills', 'gauntlet-loop', 'gauntlet.js')

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

export function ok(cond, msg) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

export function eq(actual, expected, msg) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`ASSERT FAILED: ${msg}\n  expected: ${e}\n  actual:   ${a}`)
}

// opts.design    - object returned for the gate2:design call
// opts.bar       - object returned for the gate5:blind-bar call
// opts.seeds     - array of SEED_SCHEMA objects, one per seeder attempt
// opts.judges    - array of CAL_JUDGE_SCHEMA objects, one per judge call
// opts.criticOut - function(label) -> string, the text a critic returns
export async function runGauntlet(opts) {
  const prompts = []
  let seedIdx = 0
  let judgeIdx = 0

  const defaultDesign = {
    need_restatement: 'a restated need',
    lenses: [
      { key: 'l1', lens: 'lens one' },
      { key: 'l2', lens: 'lens two' },
    ],
    calibration_lens: 'l1',
    calibration_reason: 'a miss here is most expensive',
    acceptance_rule: 'anchored findings only',
    findings_for_operator: 'none',
  }

  const defaultBar = {
    criteria: [
      { id: 'c1', criterion: 'must X', passes_when: 'X holds', fails_when: 'X absent' },
      { id: 'c2', criterion: 'must Y', passes_when: 'Y holds', fails_when: 'Y absent' },
    ],
    gate3_form: 'structural-prior',
    bar_text: 'FROZEN BAR: must X. must Y.',
  }

  const defaultSeed = {
    seeded_path: '/tmp/x/scratch/seeded-1.md',
    removed_verbatim: ['the removed sentence that is definitely long enough'],
    inserted_verbatim: ['a wrong sentence'],
    location: 'line 10',
    defect_kind: 'inverted-condition',
    why_in_lane: 'it is an acceptance criterion',
  }

  async function agent(prompt, o) {
    const label = (o && o.label) || '(unlabeled)'
    prompts.push({ label, prompt, agentType: o && o.agentType, phase: o && o.phase })

    if (label === 'gate2:design') return opts.design === undefined ? defaultDesign : opts.design
    if (label === 'gate5:blind-bar') return opts.bar === undefined ? defaultBar : opts.bar
    if (label.startsWith('gate7:seeder')) {
      const s = opts.seeds ? opts.seeds[seedIdx] : defaultSeed
      seedIdx++
      return s === undefined ? null : s
    }
    if (label.startsWith('gate7:judge')) {
      const j = opts.judges ? opts.judges[judgeIdx] : { caught: true, in_lane: true, reasoning: 'named it' }
      judgeIdx++
      return j === undefined ? null : j
    }
    // every remaining call returns critic-shaped text
    return opts.criticOut ? opts.criticOut(label, prompt) : `FINDING ${label}-1\nGETS-RIGHT: x\nFAILED-ATTACK: y`
  }

  const parallel = async thunks => Promise.all(thunks.map(t => t()))
  const pipeline = async () => []
  const log = () => {}
  const phase = () => {}
  const budget = { total: null, spent: () => 0, remaining: () => Infinity }

  const src = readFileSync(SRC, 'utf8').replace('export const meta', 'const meta')
  const fn = new AsyncFunction('agent', 'parallel', 'pipeline', 'log', 'phase', 'args', 'budget', src)
  const result = await fn(agent, parallel, pipeline, log, phase, opts.args, budget)

  return { result, prompts, labels: prompts.map(p => p.label) }
}
