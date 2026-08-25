// The pairing verdict loop.js would reach for two roles — obtained by RUNNING loop.js,
// never by retyping its rule.
//
//   import { verdictFor } from './oracle-derive.mjs'
//   verdictFor('does-the-work', 'does-the-work')  // -> 'comparable'
//
// The rule is three lines in loop.js:
//
//     const verdict = shut ? 'unreadable' : (writers.length === 1 ? 'generator' : 'comparable')
//
// and copying those three lines here is the whole trap. Five of the pairing check's seven
// early observations were invalidated at a stroke because the oracle held a second copy of
// something already written down once, and it drifted. oracle-extract.mjs exists so the
// PROMPT is never retyped; this exists so the DERIVATION is never retyped either.
//
// So the roles are stubbed and loop.js is executed through test/harness.mjs, which loads
// it as a real AsyncFunction. The verdict comes back from the script that ships. Change the
// rule and this follows; there is nothing here to keep in sync.
//
// A script under scripts/ importing from test/ is unusual and deliberate, for the reason
// oracle-extract gives: the alternative is the duplicate this file exists to avoid.

import { runLoop } from '../test/harness.mjs'

const ROLES = ['does-the-work', 'produces-an-instruction', 'could-not-open']

// THE TWO REFUSING VERDICTS THROW, because refusing is what production does with them.
// loop.js reaches `unreadable` and `generator` and then stops the run, so the verdict never
// comes back in a result — it comes back in the refusal. Each branch is keyed on the
// verdict directly (loop.js: `comparability.verdict === 'unreadable'` and `=== 'generator'`)
// and opens with a sentence unique to that branch, so the mapping below is one marker per
// branch rather than a guess at prose.
//
// This is the weakest joint in this file and it is worth saying so: it reads a message
// where the other case reads a value. The alternative was worse — deciding the verdict here
// from the two roles, which is the retyped rule. A message that changes is a loud failure
// (no marker matches, and this throws); a retyped rule that drifts is a silent one.
const REFUSAL_VERDICT = [
  { marker: 'REFUSED: an artifact could not be opened', verdict: 'unreadable' },
  { marker: 'REFUSED: one of these two artifacts is a GENERATOR', verdict: 'generator' },
]

export async function verdictFor(roleA, roleB) {
  for (const r of [roleA, roleB]) {
    if (!ROLES.includes(r)) throw new Error(`derive: "${r}" is not a role the schema allows (${ROLES.join(', ')})`)
  }
  const opts = {
    args: { goal: 'derive the pairing verdict', candidate: '/oracle-derive/side-a', reference: '/oracle-derive/side-b', token: '/oracle-derive/unused' },
    roles: [{ role: roleA, what_it_is: 'stub', reasoning: 'stub' }, { role: roleB, what_it_is: 'stub', reasoning: 'stub' }],
    breaker: round => round <= 1,
    rounds: [],
  }
  let r
  try {
    r = await runLoop(opts)
  } catch (e) {
    const hit = REFUSAL_VERDICT.find(x => String(e.message).includes(x.marker))
    if (hit) return hit.verdict
    throw new Error(`derive: loop.js refused these two roles with a message this does not recognise, so the verdict cannot be read from it:\n${String(e.message).split('\n')[0]}`)
  }
  const v = r.result && r.result.comparability && r.result.comparability.verdict
  if (!v) {
    // UNTESTED BY CONSTRUCTION and not redundant: reaching it means loop.js stopped
    // producing a comparability verdict, and the useful failure is that sentence rather
    // than a TypeError three lines later. Do NOT repair this by writing the rule in here.
    throw new Error('derive: loop.js produced no comparability verdict for two stubbed roles. Its shape changed; fix the capture, do not retype the rule.')
  }
  return v
}
