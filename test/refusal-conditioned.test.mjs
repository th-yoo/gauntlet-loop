// THE REPRODUCIBLE for S5 of the #28 suspect list — the refusal's authority is
// unconditioned.
//
//   node test/refusal-conditioned.test.mjs
//
// IT FAILS TODAY, ON PURPOSE, and it is committed failing.
//
// WHAT #28 ACTUALLY ASKS FOR. The comparability probe is the only component in
// this plugin that can stop a run. #28's remedy, in its own words, is that if the
// probe's verdicts turn out to be noise, "the refusal must be downgraded to a
// warning until it is stable". That remedy has nowhere to attach:
//
//     $ grep -c 'oracle\|corpus\|results.jsonl' skills/gauntlet-loop/loop.js
//     0
//
// Whatever the corpus measures, it measures somewhere the instrument cannot hear.
// If tomorrow's false-refusal rate were 40%, loop.js would refuse exactly as it
// does now, and the operator's only recourse would be to edit the loop.
//
// WHY A GREP IS NOT ENOUGH, and why this file exists at all. That grep is what S5
// rested on until now, and this project's own rule says reading the source finds
// nothing — a fact established by inspection is not thereby a cause. The counter
// -factual S5 asserts is behavioural: THE OPERATOR CANNOT MAKE A REFUSED RUN
// PROCEED. So it is asserted the way behaviour has to be, by running the loop and
// watching what it does, through the same stubbed harness every other loop test
// uses.
//
// THE PROPERTY, in two halves, because a switch alone would be worse than nothing:
//
//   1. An operator-supplied input can downgrade the refusal to a warning, and a
//      run given it PROCEEDS rather than stopping.
//   2. A run that proceeded over a refusal SAYS SO in its record. A comparison the
//      probe called meaningless, handed back with a clean verdict, is the false
//      all-clear this repository keeps finding in other instruments. The downgrade
//      has to cost the record something, or it launders the refusal.
//
// ON THE INTERFACE NAME. `args.on_refusal` is a PROPOSAL, held in one constant
// below so it can be renamed in one place. The assertions are about behaviour, not
// about the spelling: a fix that calls it something else changes this line and
// nothing under it. What the test refuses to accept is the shape where the switch
// exists and the record stays silent.
//
// WHAT THIS TEST CANNOT DO, stated here because the branch that carries it is the
// one that passes once the fix lands: making the refusal ANSWERABLE is not making
// it CORRECT. Nothing here measures whether refusing was right — that is the
// corpus's job, and the corpus is not wired to this decision either way. A
// downgrade switch lets an operator overrule an instrument they have reason to
// distrust; it supplies no reason.

import { runLoop } from './harness.mjs'

const CANDIDATE = '/tmp/x/mybuild.html'
const REFERENCE = '/tmp/x/theoriginal.html'
const TOKEN = '/tmp/x/run.token'
const GOAL = 'a goal worth looping over'
const base = { goal: GOAL, candidate: CANDIDATE, reference: REFERENCE, token: TOKEN }

const WORKER = { role: 'does-the-work', what_it_is: 'a runbook', reasoning: 'it names the commands' }
const WRITER = { role: 'produces-an-instruction', what_it_is: 'a meta-prompt', reasoning: 'its output is a prompt' }

// The proposed operator input. One constant, so a fix may rename it freely.
const DOWNGRADE = { on_refusal: 'warn' }

let failures = 0
const ok = (cond, m) => { if (cond) console.log(`  ok    ${m}`); else { console.error(`  FAIL  ${m}`); failures++ } }

// A REFUSED RUN, ESTABLISHED FIRST. If this stopped being a refusal the two
// assertions below would pass vacuously — the run would proceed because nothing
// objected, not because anything was downgraded. That is the failure mode this
// repository calls a PASS condition satisfied by the thing being broken, so the
// refusal is confirmed before anything is asked of it.
console.log('refusal-conditioned: the pairing under test really is refused today')
let refusedMessage = null
try {
  await runLoop({ args: base, breaker: rd => rd <= 2, rounds: [], roles: [WRITER, WORKER] })
} catch (e) { refusedMessage = e.message }
ok(refusedMessage !== null, 'one instruction-writer against one worker stops the run')
ok(refusedMessage !== null && /GENERATOR/.test(refusedMessage),
   'and it stops for the reason under test — the pairing is a category error, not some other refusal')

console.log('refusal-conditioned: an operator can downgrade the refusal to a warning')
let downgraded = null
let downgradeError = null
try {
  downgraded = await runLoop({ args: { ...base, ...DOWNGRADE }, breaker: rd => rd <= 2, rounds: [], roles: [WRITER, WORKER] })
} catch (e) { downgradeError = e.message }

ok(downgradeError === null,
   `a run given ${JSON.stringify(DOWNGRADE)} proceeds instead of stopping. Today it does not: the loop reads no such input, so the refusal is unconditional and #28's own remedy — "downgrade the refusal to a warning until it is stable" — has nowhere to attach. Got: ${downgradeError ? downgradeError.slice(0, 120) : '(no error)'}`)

console.log('refusal-conditioned: a run that proceeded over a refusal says so in its record')
const rec = downgraded && downgraded.result
ok(rec !== null && rec !== undefined,
   'the downgraded run produced a record at all')
if (rec) {
  const verdict = rec.comparability && rec.comparability.verdict
  ok(verdict && verdict !== 'comparable',
     `the record keeps what the probe actually said (${JSON.stringify(verdict)}) — a downgrade that rewrites the verdict to "comparable" destroys the evidence it is overruling`)
  const text = JSON.stringify(rec)
  ok(/proceeded_over_refusal|refusal_downgraded|on_refusal/.test(text),
     'and the record names the downgrade, so a reader of this run cannot mistake it for a comparison nothing objected to. A switch that leaves the record clean launders the refusal, which is worse than having no switch')
}

console.log('refusal-conditioned: stating what this file does NOT establish')
console.log('          NOT MEASURED: whether refusing was RIGHT. This asserts that the refusal can be')
console.log('          answered, never that it should be. The rate that would justify overruling it lives')
console.log('          in oracle/, which loop.js still does not read — making the authority conditional on')
console.log('          an OPERATOR is not making it conditional on EVIDENCE, and the second is what S5')
console.log('          names. A fix that lands only the switch closes half of this.')

if (failures) {
  console.error(`\nrefusal-conditioned: ${failures} failure(s) — the only component that can stop a run cannot be answered.`)
  process.exit(1)
}
console.log('\nrefusal-conditioned: OK — the refusal can be downgraded, and a downgraded run admits it.')
