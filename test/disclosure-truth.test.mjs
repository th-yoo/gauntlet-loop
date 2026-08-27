// THE REPRODUCIBLE for issue 19: a pinned disclosure that is false.
//
//   node test/disclosure-truth.test.mjs
//
// COMMITTED FAILING.
//
// Issue 19 says loop.js exits on ∃-one-favourable-round where the source exits on
// ∀-judges-wowed, and names four places the repository asserts "gauntlet" as a
// defined noun. Re-running its evidence: all four assertions are gone, and the
// exit is now arm-then-confirm — a win arms, a fresh critic on the opposite side
// against the unchanged artifact confirms. The issue as written is stale.
//
// What survives is one live instance of its actual complaint, in a place the
// issue could not have named. loop.js's own not_enforced list says:
//
//     "k>1 is an ADDITION, not source fidelity. Both primary texts say one critic
//      per piece, singular; the source gets width by decomposing the goal, WHICH
//      THIS LOOP DOES NOT DO."
//
// The loop does decompose. It dispatches gauntlet-lead, splits the goal into
// pieces, and judges each piece on its own — and the same verdict, forty lines
// earlier, describes that decomposition in detail. The file contradicts itself,
// and the false half is the half making the source-fidelity claim.
//
// THE STRUCTURAL POINT, which is why this file exists rather than a one-line edit:
// that sentence is PINNED. It is in test/drift-facts.mjs, drift-guard fails if it
// disappears, and scripts/guard-sweep.mjs verifies that pin still bites. All of
// that machinery was faithfully protecting a false statement, because a
// disclosure is pinned for PRESENCE and nothing checks it is TRUE.
//
// So this file checks the claim against BEHAVIOUR: run the loop, watch it
// decompose, and require that nothing shipped denies it. The denial is matched by
// pattern rather than by its exact words, so rewording the same false claim does
// not evade the check.
//
// NOTHING HERE SPAWNS.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { runLoop } from './harness.mjs'
import { LOOP_DISCLOSURES } from './drift-facts.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }

console.log('disclosure-truth: the loop decomposes — established by running it, not by reading it')
let decomposes = false
{
  const r = await runLoop({
    args: { goal: 'g', candidate: '/x/a.md', reference: '/x/b.md', token: '/t' },
    lead: { decomposes: true, split_criterion: 'two files', pieces: [
      { name: 'one', observable: 'o1', candidate: '/x/p1.md', reference: '/x/r1.md' },
      { name: 'two', observable: 'o2', candidate: '/x/p2.md', reference: '/x/r2.md' }] },
    rounds: Array.from({ length: 4 }, () => ({ candidateWins: true, gap: 'g', margin: 'clear' })),
  }).catch(e => { fail(`the stubbed loop threw: ${e.message}`); return null })
  const pieces = r ? [...new Set((r.result.history || []).map(h => h.piece).filter(Boolean))] : []
  decomposes = pieces.length > 1
  ok(decomposes,
     `the loop judged ${pieces.length} distinct piece(s) when handed a decomposing lead — if it genuinely cannot decompose, the disclosure below is true and THIS test is the thing that is wrong`)
  console.log(`          ${pieces.length} distinct piece(s) judged in one run: ${pieces.join(', ') || '(none)'}`)
}

console.log('disclosure-truth: nothing shipped denies a capability the run just demonstrated')
{
  // MATCHED BY PATTERN, not by the exact sentence. Pinning the literal string
  // would be satisfied by rewording the same false claim, which is the failure
  // mode a pin has: it guards the words rather than what they assert.
  const DENIES_DECOMPOSITION = [
    /which this loop does not do/i,
    /this loop does not (?:\w+ )*decompos/i,
    /decompos\w*[^.]{0,80}?which this loop does not/i,
  ]
  const loopSrc = readFileSync(join(ROOT, 'skills', 'gauntlet-loop', 'loop.js'), 'utf8')

  // The disclosures as pinned, and as they appear in the shipped source.
  const surfaces = [
    ...LOOP_DISCLOSURES.map(d => ({ where: 'test/drift-facts.mjs (pinned)', text: d })),
    ...loopSrc.split('\n')
      .filter(l => /ADDITION, not source fidelity/.test(l))
      .map(l => ({ where: 'skills/gauntlet-loop/loop.js (shipped)', text: l })),
  ]
  for (const s of surfaces) {
    for (const re of DENIES_DECOMPOSITION) {
      if (re.test(s.text)) {
        fail(`${s.where} asserts the loop does not decompose, and the run above judged two pieces. ` +
             `A disclosure is pinned for PRESENCE — drift-guard fails if it disappears and guard-sweep ` +
             `confirms that pin bites — and none of that notices when the sentence is false: ` +
             `"${s.text.trim().slice(0, 150)}"`)
        break
      }
    }
  }
  if (!failures) console.log(`          ${surfaces.length} surface(s) checked, none denies it`)
}

console.log('disclosure-truth: stating what this cannot establish')
console.log('          NOT CHECKED: the other 18 disclosures. Each is pinned for presence and nothing')
console.log('          verifies any of them is TRUE. Decomposition is checkable because the harness can')
console.log('          exercise it; "nothing verifies that a harsh instruction produced a harsh critic"')
console.log('          cannot be run, and its truth rests on reading alone — same as this one did.')

if (failures) {
  console.error(`\ndisclosure-truth: ${failures} failure(s) — a pinned false statement is worse than an unpinned one, because the pin reads as verification.`)
  process.exit(1)
}
console.log('\ndisclosure-truth: OK — the loop decomposes, and nothing shipped denies it.')
