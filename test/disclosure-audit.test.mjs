// Every pinned disclosure is either driven against the loop, or recorded as undrivable.
//
//   node test/disclosure-audit.test.mjs
//
// ISSUE 54. loop.js asserted "the source gets width by decomposing the goal, WHICH
// THIS LOOP DOES NOT DO", and the loop decomposes. That sentence was pinned:
// drift-facts held it, drift-guard failed if it vanished, guard-sweep confirmed
// the pin bit. All of it protected a false statement, because a disclosure is
// pinned for PRESENCE and nothing checked it was TRUE. Worse than an unpinned
// false claim — the pin reads as verification.
//
// THE FIX IS A PARTITION, NOT NINETEEN TRUTH-CHECKS. One assertion per sentence
// is the 1:1 growth this project calls cheating and goes stale at the twentieth.
// Every pinned disclosure must be EXERCISED (a behavioural test names it in live
// code) or ADJUDICATED (recorded as undrivable, with the reason). Which one is
// DISCOVERED, so a new disclosure has to declare itself and the unaccounted count
// can only go down.
//
// NOTHING HERE SPAWNS.

import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { LOOP_DISCLOSURES } from './drift-facts.mjs'
import { auditDisclosures, disclosureKey } from '../scripts/disclosure-audit.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }

const run = (env = {}) => {
  const r = spawnSync(process.execPath, ['scripts/disclosure-audit.mjs'],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env }, timeout: 120_000 })
  return { status: r.status, out: String(r.stdout || '') + String(r.stderr || '') }
}

console.log('disclosure-audit: every pinned disclosure is accounted for')
{
  const r = run()
  const m = r.out.match(/(\d+) exercised, (\d+) adjudicated, (\d+) neither/)
  ok(m, 'the audit produced its summary line')
  if (m) {
    const [, ex, adj, none] = m.map(Number)
    console.log(`          ${ex} exercised, ${adj} adjudicated, ${none} neither (of ${LOOP_DISCLOSURES.length} pinned)`)
    ok(none === 0,
       `${none} pinned disclosure(s) are neither driven against the loop nor recorded as undrivable. Each is a sentence nobody has checked and nobody has admitted cannot be checked — which is the state that let "this loop does not decompose" sit pinned and false.`)
    ok(ex + adj === LOOP_DISCLOSURES.length,
       `${ex + adj} accounted for against ${LOOP_DISCLOSURES.length} pinned — the audit is not seeing every disclosure`)
    ok(ex > 0, 'at least one disclosure is actually driven — an audit that adjudicated everything would be a way of writing prose about prose')
  }
  ok(r.status === 0, 'the audit passes')
}

console.log('disclosure-audit: it can still FAIL — the adjudications are load-bearing')
{
  // WITHOUT THIS the check above is satisfied by an audit that never fires.
  const r = run({ DISCLOSURE_ADJUDICATIONS: join(ROOT, 'test', 'no-such-file.jsonl') })
  ok(r.status !== 0, 'with adjudications withheld the audit still passed — then it is not reading them')
  const m = r.out.match(/(\d+) neither/)
  ok(m && Number(m[1]) > 0, 'and it reported nothing unaccounted, so the detection is inert')
  if (m) console.log(`          with adjudications withheld: ${m[1]} unaccounted`)
}

console.log('disclosure-audit: a COMMENT mention, and a non-behavioural test, are not evidence')
{
  // THE FIRST VERSION OF THIS CASE CHECKED THAT THE SOURCE CONTAINED THE WORD
  // `stripLineComments`. That is a presence check — the exact defect this whole
  // issue is about, committed one level down — and two mutations that removed
  // the behaviour while leaving the identifier in place survived it.
  //
  // So the distinctions are driven instead: synthetic test files are handed to
  // the audit and its answer is read.
  const d = 'A DISCLOSURE THAT SAYS SOMETHING PARTICULAR ABOUT THE LOOP'
  const key = d.slice(0, 40)

  const commentOnly = {
    name: 'test/pretend.test.mjs',
    raw: `// discusses ${d} in prose only`,
    live: '',
    behavioural: true,
  }
  const notBehavioural = {
    name: 'test/static.test.mjs',
    raw: `ok(x, "${d}")`,
    live: `ok(x, "${d}")`,
    behavioural: false,
  }
  const proper = {
    name: 'test/real.test.mjs',
    raw: `ok(x, "${d}")`,
    live: `ok(x, "${d}")`,
    behavioural: true,
  }

  const only = auditDisclosures([d], [commentOnly])[0]
  ok(only.exercised_by.length === 0,
     'a disclosure quoted only in a comment was counted as exercised — that is the presence-for-truth substitution this issue exists for, inside the check built to stop it')
  ok(only.mentioned_only_by.includes('test/pretend.test.mjs'),
     'and the audit must still SAY it was mentioned, or the reader cannot tell an untested claim from an unnoticed one')

  const stat = auditDisclosures([d], [notBehavioural])[0]
  ok(stat.exercised_by.length === 0,
     'a test that never drives the loop was counted as exercising a claim about the loop — it cannot have checked it')

  const good = auditDisclosures([d], [proper])[0]
  ok(good.exercised_by.includes('test/real.test.mjs'),
     'a behavioural test naming the disclosure in live code is not counted, so nothing could ever be exercised and the audit would demand an adjudication for everything')

  // The key must be long enough to identify one disclosure. A short key matches
  // every sentence and reports the whole set as exercised by whatever is nearby.
  ok(disclosureKey('SOME QUITE LONG DISCLOSURE SENTENCE ABOUT THE LOOP').length >= 24,
     'the audit key is short enough to collide between disclosures, which would credit one sentence with another sentence test')
  console.log('          comment-only and non-behavioural both rejected; a real one is accepted')
}

// NOT_EVIDENCE (excluding drift-facts/drift-guard) is deliberately NOT given a
// case here, and the reason is worth recording rather than hiding: it is
// redundant with the behavioural filter above. Neither file imports the harness,
// so neither can be counted as exercising anything regardless of the exclusion.
// A mutation removing NOT_EVIDENCE therefore changes no answer, and a case
// written to catch it would have to contrive a pin that also drives the loop.
// It stays as defence in depth, and it is not claimed to be tested.
console.log('disclosure-audit: an adjudication states WHY, not merely that')
{
  const path = join(ROOT, 'docs', 'disclosure-adjudications.jsonl')
  ok(existsSync(path), 'docs/disclosure-adjudications.jsonl exists')
  if (existsSync(path)) {
    const rows = readFileSync(path, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
    for (const a of rows) {
      ok(a.key && a.verdict, 'each entry names a disclosure and a verdict')
      ok(a.why && a.why.length > 150,
         `${a.key}: the reason is ${a.why ? a.why.length : 0} characters. "Cannot be tested" with nothing after it is a rubber stamp, and a rubber stamp is worse than no check because it looks like one.`)
    }
    console.log(`          ${rows.length} adjudication(s), each naming a verdict and a reason`)
  }
}

console.log('disclosure-audit: stating what this cannot establish')
console.log('          NOT ESTABLISHED: that an EXERCISED disclosure is TRUE. This confirms a')
console.log('          behavioural test names it in live code — evidence a human wired the sentence to')
console.log('          a run, not evidence the assertion checks the claim. It is a floor, and it sits')
console.log('          one level down from the defect that produced it: a test could quote a')
console.log('          disclosure and assert something else entirely, and this would call it covered.')
console.log('          NOT ESTABLISHED: that an ADJUDICATED disclosure is true either. It records that')
console.log('          someone looked and said why it cannot be driven — nothing more.')

if (failures) {
  console.error(`\ndisclosure-audit: ${failures} failure(s) — a pinned sentence nobody checked is a claim with a guard in front of it.`)
  process.exit(1)
}
console.log('\ndisclosure-audit: OK — every pinned disclosure is driven or recorded as undrivable.')
