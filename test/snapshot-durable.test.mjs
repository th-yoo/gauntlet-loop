// THE REPRODUCIBLE for decision 0003's named follow-up — the snapshot's location is the
// builder's choice, and the builder chose /tmp.
//
//   node test/snapshot-durable.test.mjs
//
// COMMITTED FAILING.
//
// docs/decisions/0003-no-automatic-revert.md, in its own words: "'Recoverable by hand' is
// as durable as the snapshot's location. The three snapshot paths in that verdict are
// under /tmp and a session scratchpad ... the files outlive the session only if something
// keeps them." And under what would reopen it: "Snapshots at a durable path ... A snapshot
// beside the artifact would make 'recoverable by hand' true past the session. That is a
// change to the builder's instruction."
//
// THE PROPERTY, in three parts, because an instruction with no required value is a
// preference and a report nothing compares is a word:
//
//   1. the build prompt REQUIRES one computed path, beside the artifact, unique to the
//      run and the round — "a plain cp beside it is enough" named no path, and the
//      builder complied with the letter of it from /tmp;
//   2. the loop COMPARES the reported path against the required one and records the
//      answer as `snapshot_durable` — the bytes stay the builder's word (a Workflow
//      script has no filesystem), but WHERE the copy is claimed to be is two strings
//      the script can compare itself;
//   3. every branch states its case: required path echoed -> true; some other path ->
//      false, with the why naming both paths; no snapshot at all -> null, and the
//      existing `regression_why_not` carries the reason.
//
// WHAT THE REQUIRED PATH COSTS, so it is weighed rather than discovered: a
// `.gauntlet-snapshots` directory sits beside the CANDIDATE only. The content-blindness
// probe runs before round 1 and cannot see what rounds create, so from round 2 a critic
// with a shell can identify the iterated side by listing its directory. The loop's remedy
// for leak classes is disclosure, not prevention, and the pinned ratchet disclosure must
// say this — asserted below.

import { runLoop } from './harness.mjs'

const CANDIDATE = '/tmp/x/mybuild.html'
const REFERENCE = '/tmp/x/theoriginal.html'
const TOKEN = '/tmp/x/run.token'
const base = { goal: 'a goal worth looping over', candidate: CANDIDATE, reference: REFERENCE, token: TOKEN }
const SNAP_DIR = '/tmp/x/.gauntlet-snapshots/mybuild.html.'

let failures = 0
const ok = (cond, m) => { if (cond) console.log(`  ok    ${m}`); else { console.error(`  FAIL  ${m}`); failures++ } }

const ROUNDS = {
  args: base,
  breaker: rd => rd <= 4,
  rounds: [
    { candidateWins: false, gap: 'round 1 gap' },
    { candidateWins: false, gap: 'round 2 gap' },
    { candidateWins: true, gap: 'round 3 gap', margin: 'clear' },
    { candidateWins: true, gap: 'round 4 confirms the win', margin: 'clear' },
  ],
}

// The same reading a real builder performs: the prompt names the required path, the
// builder copies to it and reports it. Echoing FROM THE PROMPT rather than recomputing
// the path is the point — if the prompt stops carrying it, this builder reports nothing,
// exactly as a live one would have nowhere to read it from.
const requiredIn = prompt => {
  const m = String(prompt).match(/COPY THE ARTIFACT to exactly this path[^]*?\n\s*(\S+)\n/)
  return m ? m[1] : null
}

console.log('snapshot-durable: the build prompt requires one computed path beside the artifact')
const prompts = []
const compliant = await runLoop({
  ...ROUNDS,
  builder: (round, prompt) => {
    prompts.push(String(prompt))
    const req = requiredIn(prompt)
    return { changed: `did round ${round}`, where: 'candidate.js', ...(req ? { snapshot: req } : {}) }
  },
  regressionCheck: () => ({ prefers: 'new', why: 'stub: better' }),
})
const builtRounds = (compliant.result.history || []).filter(h => h.built)
ok(builtRounds.length >= 2, `the run built at least twice (got ${builtRounds.length}) — with fewer, durability across rounds is not a question`)
ok(prompts.every(p => p.includes(SNAP_DIR)),
   `every build prompt names a required copy path under ${SNAP_DIR}* — beside the artifact, not wherever the builder likes. "A plain cp beside it is enough" required nothing, and the Tetris run's three snapshots went to /tmp and a session scratchpad`)
{
  const paths = prompts.map(requiredIn)
  ok(paths.every(Boolean) && new Set(paths).size === paths.length,
     `each round requires a DISTINCT path (got ${JSON.stringify(paths)}) — one name per round, or round 2's copy overwrites round 1's and the recoverable version is the wrong one`)
  ok(paths.every((p, i) => p && p.endsWith(`round-${i + 1}`)),
     'and the round is readable in the name, so an operator recovering by hand does not have to map timestamps to rounds')
}

console.log('snapshot-durable: a builder that echoes the required path is recorded as durable')
ok(builtRounds.every(h => h.snapshot_durable === true),
   'each built round carries snapshot_durable: true when the reported path IS the required one. The bytes remain the builder\'s word; the location is two strings the script compares itself')
ok(builtRounds.every(h => h.regression && h.regression.prefers),
   'and the regression check still ran against it — durability is bookkeeping on the same copy, not a second copy')

console.log('snapshot-durable: a builder that chose its own path is recorded, compared, and named non-durable')
const offpath = await runLoop({
  ...ROUNDS,
  builder: round => ({ changed: `did round ${round}`, where: 'candidate.js', snapshot: `/tmp/somewhere-else/prev-${round}` }),
  regressionCheck: () => ({ prefers: 'new', why: 'stub: better' }),
})
const off = (offpath.result.history || []).filter(h => h.built)
ok(off.length >= 2 && off.every(h => h.snapshot === `/tmp/somewhere-else/prev-${h.round}`),
   'the reported path is still recorded — the copy is where it is, and pretending otherwise loses the one pointer that exists')
ok(off.every(h => h.regression && h.regression.prefers),
   'and the regression check still ran against the reported path — a non-durable copy answers "did this round regress" exactly as well')
ok(off.every(h => h.snapshot_durable === false),
   'but the round is marked snapshot_durable: false — the builder\'s path, not the required one, and the record says so instead of reading like compliance')
ok(off.every(h => /somewhere-else/.test(String(h.snapshot_durable_why)) && /\.gauntlet-snapshots/.test(String(h.snapshot_durable_why))),
   'and snapshot_durable_why names BOTH paths — the one the copy is at and the one it was required at — so an operator recovering by hand knows where to look and how long it is likely to live')

console.log('snapshot-durable: a round with no snapshot claims nothing about durability')
{
  const nosnap = await runLoop({ ...ROUNDS, snapshots: false, regressionCheck: () => ({ prefers: 'new', why: 'stub' }) })
  const b = (nosnap.result.history || []).filter(h => h.built)
  ok(b.length >= 2 && b.every(h => h.snapshot_durable === null),
     'snapshot_durable is null when there is no copy — a durability verdict about a copy that does not exist would be the check grading its own absence')
}

console.log('snapshot-durable: the pinned disclosure carries what the required path costs')
{
  const pinned = JSON.stringify(compliant.result.not_enforced || []) + JSON.stringify(compliant.result.enforced || [])
  ok(/\.gauntlet-snapshots/.test(pinned),
     'the ratchet disclosure names the required location, so "where the builder put it" stops being the record\'s only answer')
  ok(/before round 1|cannot see what rounds create|probe runs before/.test(pinned),
     'and it states the blindness cost: the content-blindness probe runs before round 1, the snapshot directory appears after, so the probe cannot see the asymmetry this instruction creates beside the candidate')
}

console.log('snapshot-durable: stating what this file does NOT establish')
console.log('          NOT MEASURED: whether the copy exists or matches — a Workflow script has no')
console.log('          filesystem, so the bytes are the builder\'s word exactly as before; this file')
console.log('          pins WHERE that word points. NOT MEASURED: piece runs — the required path is')
console.log('          computed from each piece\'s own candidate, but no decomposed fixture asserts it')
console.log('          here. NOT MEASURED: whether a critic actually exploits the directory the')
console.log('          disclosure warns about; the claim is withdrawn, not tested.')

if (failures) {
  console.error(`\nsnapshot-durable: ${failures} failure(s) — a snapshot whose location is the builder's choice is recoverable only until the session ends.`)
  process.exit(1)
}
console.log('\nsnapshot-durable: OK — the path is required, the report is compared against it, and every branch says what it established.')
