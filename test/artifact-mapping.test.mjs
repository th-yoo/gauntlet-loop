// THE REPRODUCIBLE for #52: the detection ledger compares two different
// coordinate systems, and the rate it reports is the complement of the rate it
// claims.
//
//   node test/artifact-mapping.test.mjs
//
// COMMITTED FAILING.
//
// #52 reports that the critic quotes the planted defect and then picks the
// degraded side anyway — on 8 of the 10 trials it got wrong — and concludes the
// gap is "conversion, not perception". Both halves of that rest on `detected`,
// and `detected` is computed as
//
//     detected = picked !== degraded_side
//
// where `picked` is the letter the CRITIC answered and `degraded_side` is the
// letter of the DIRECTORY the degraded bytes were staged under. Those are the
// same letter only if the prompt put `a/subject.md` on the `ARTIFACT A` line.
//
// It does not. `loop.js` alternates which side the candidate occupies by
// (round + critic index) parity, so the round the runner captures renders
//
//     ARTIFACT A: <trial>/b/subject.md
//     ARTIFACT B: <trial>/a/subject.md
//
// and the comparison is inverted for every trial in the batch. The critic said
// so in its own words and nothing read it: four of the twenty responses annotate
// the mapping explicitly — "`b/subject.md` (ARTIFACT A, 318 lines)" — and two
// name the file they picked beside the letter, "WINNER — **B** (`a/subject.md`)".
//
// WHAT THIS FILE ASSERTS, and it is deliberately not "the mapping is b-then-a":
// that would be a constant standing in for a derivation, right until the parity,
// the round index or `args.critics` changes it. It asserts that the mapping is
// DERIVED from the prompt each trial was actually judged under, that the ledger
// records the degraded copy's ARTIFACT letter, and that `detected` agrees with a
// recomputation from the row's own fields.
//
// THE GENERAL RULE, which is what makes this more than a patch at the incident:
// a fact that is derivable from the artifact must not be stored beside it
// unchecked. `degraded_side` was derivable, was stored, and disagreed with the
// prompt for twenty trials. The same shape has now cost this runner four
// defects — three `trial_id`-vs-`opaque` key bugs and this one.
//
// NOTHING HERE SPAWNS. It builds the prompt with the stubbed harness and reads
// text.

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { artifactSides, degradedArtifact } from '../scripts/detection-parse.mjs'
import { runLoop } from './harness.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LEDGER = process.env.DETECTION_LEDGER || join(ROOT, 'runs', 'detection.jsonl')

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }

// --------------------------------------------------------------------------
// THE READER, AND WHETHER IT CAN BE WRONG.
//
// A mapping reader that returns something plausible for every input cannot
// report a prompt it does not understand, and the only failure mode that
// matters here is the silent one. So each case below is an input built to break
// it, and null is the required answer.
// --------------------------------------------------------------------------

const A_PATH = '/stage/deadbeef0001/a/subject.md'
const B_PATH = '/stage/deadbeef0001/b/subject.md'

console.log('artifact-mapping: the reader reports the mapping the prompt states')
{
  const straight = `ARTIFACT A: ${A_PATH}\nARTIFACT B: ${B_PATH}\n`
  const swapped = `ARTIFACT A: ${B_PATH}\nARTIFACT B: ${A_PATH}\n`
  const s1 = artifactSides(straight, A_PATH, B_PATH)
  const s2 = artifactSides(swapped, A_PATH, B_PATH)
  ok(s1 && s1.A === 'a' && s1.B === 'b', `a prompt naming a/ on the ARTIFACT A line read as ${JSON.stringify(s1)}`)
  ok(s2 && s2.A === 'b' && s2.B === 'a', `a prompt naming b/ on the ARTIFACT A line read as ${JSON.stringify(s2)} — this is the case that was never read, and reading it wrong is the whole defect`)
  ok(degradedArtifact(s2, 'a') === 'B', 'a degraded copy staged under a/, rendered on the ARTIFACT B line, is ARTIFACT B')
  ok(degradedArtifact(s2, 'b') === 'A', 'a degraded copy staged under b/, rendered on the ARTIFACT A line, is ARTIFACT A')
  ok(degradedArtifact(s1, 'a') === 'A', 'and the unswapped mapping still reads straight through')
}

console.log('artifact-mapping: the reader refuses what it cannot read')
{
  const cases = [
    ['no ARTIFACT lines at all', 'Compare two artifacts and pick the better one.'],
    ['only one side named', `ARTIFACT A: ${A_PATH}\n`],
    ['a path that is neither staged file', `ARTIFACT A: ${A_PATH}\nARTIFACT B: /stage/elsewhere/subject.md\n`],
    ['both letters on the same directory', `ARTIFACT A: ${A_PATH}\nARTIFACT B: ${A_PATH}\n`],
    ['a duplicated ARTIFACT A line', `ARTIFACT A: ${A_PATH}\nARTIFACT A: ${B_PATH}\nARTIFACT B: ${B_PATH}\n`],
    ['the two paths are the same file', `ARTIFACT A: ${A_PATH}\nARTIFACT B: ${A_PATH}\n`],
  ]
  for (const [why, prompt] of cases) {
    ok(artifactSides(prompt, A_PATH, why === 'the two paths are the same file' ? A_PATH : B_PATH) === null,
       `the reader answered a mapping for a prompt with ${why} — a reader that always answers cannot refuse, and refusing is what stops the next batch being judged under an assumed mapping`)
  }
  ok(degradedArtifact(null, 'a') === null, 'no mapping yields no artifact letter')
  ok(degradedArtifact({ A: 'a', B: 'b' }, 'none') === null, 'a control has no degraded artifact letter')
}

// --------------------------------------------------------------------------
// THE DEPLOYED PROMPT. Built here the way the runner builds it — candidate on
// the first path, reference on the second — and read rather than assumed.
// --------------------------------------------------------------------------

console.log('artifact-mapping: the mapping is read from the prompt loop.js actually renders')
{
  const r = await runLoop({
    args: { goal: 'the document states how to run this tool, completely and in one place',
            candidate: A_PATH, reference: B_PATH, token: '/artifact-mapping/unused-token' },
    rounds: [{ candidateWins: true, gap: 'g', margin: 'clear' }],
  }).catch(e => { fail(`the stubbed loop threw building the prompt: ${e.message}`); return null })

  if (r) {
    const abs = r.prompts.filter(p => /:ab$/.test(p.label))
    ok(abs.length > 0, 'the stubbed loop produced at least one blind-A/B prompt to read')
    const first = abs[0] && artifactSides(abs[0].prompt, A_PATH, B_PATH)
    ok(first, `the mapping could not be read out of ${abs[0] && abs[0].label} — a trial judged under a prompt whose sides cannot be read carries no observation`)

    // NOT an assertion that the first round is swapped. That the sides ALTERNATE
    // is loop.js's documented behaviour and is the reason a constant cannot
    // stand in for this reader; what is asserted is that the rounds do not all
    // agree, so any code that hard-codes one mapping is wrong for some round.
    const seen = new Set(abs.map(p => { const s = artifactSides(p.prompt, A_PATH, B_PATH); return s ? s.A : 'unreadable' }))
    console.log(`          ARTIFACT A carries: ${[...seen].map(x => x + '/').join(' then ')} across ${abs.length} round(s)`)
    ok(!seen.has('unreadable'), 'every blind-A/B prompt states a mapping this reader can read')
    ok(seen.size > 1,
       `every round rendered the candidate on the same side (${[...seen].join(', ')}) — if that is now true, loop.js stopped alternating and the blindness argument that rests on alternation needs re-reading`)
  }
}

// --------------------------------------------------------------------------
// THE LEDGER. Every row must carry the degraded copy's ARTIFACT letter, and
// `detected` must agree with a recomputation from the row's own fields.
//
// RECOMPUTED, NOT READ. The rate test reads `detected` back from the ledger,
// which is this repository's own rule broken in its own words: a quantity
// derived downstream of the decision under test cannot audit that decision. The
// stored `detected` was the complement of the truth for twenty consecutive rows
// and every check passed.
// --------------------------------------------------------------------------

console.log('artifact-mapping: the ledger records the letter the critic could have answered')
if (!existsSync(LEDGER)) {
  fail(`${LEDGER} does not exist — there is nothing to check the coordinate system of`)
} else {
  const rows = readFileSync(LEDGER, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l))
  console.log(`          ${rows.length} row(s)`)
  let mismatched = 0, missing = 0
  for (const r of rows) {
    if (r.degraded_side === 'none') {
      ok(r.detected === null, `control ${r.trial_id} carries detected=${r.detected}; a pair with nothing planted cannot be detected or missed`)
      continue
    }
    if (r.degraded_artifact === undefined) { missing++; continue }
    if (r.artifact_a_dir === undefined) { missing++; continue }
    // The row's own mapping must place the degraded directory on the letter the
    // row records.
    const sides = { A: r.artifact_a_dir, B: r.artifact_a_dir === 'a' ? 'b' : 'a' }
    const expectLetter = degradedArtifact(sides, r.degraded_side)
    ok(expectLetter === r.degraded_artifact,
       `${r.trial_id} stages the degraded copy under ${r.degraded_side}/ and records ARTIFACT A as ${r.artifact_a_dir}/, so the degraded copy is ARTIFACT ${expectLetter} — the row says ${r.degraded_artifact}`)
    const expect = r.picked === null || r.picked === 'neither' ? null : r.picked !== r.degraded_artifact
    if (r.detected !== expect) {
      mismatched++
      fail(`${r.trial_id}: detected=${r.detected}, but picked=${r.picked} against degraded ARTIFACT ${r.degraded_artifact} recomputes to ${expect}`)
    }
  }
  // AND WHETHER THE RECORDED MAPPING IS THE ONE THE TRIAL WAS JUDGED UNDER.
  // Everything above cross-checks the row against itself, which cannot catch a
  // row whose `artifact_a_dir` is internally consistent and wrong. The only
  // thing that can is rebuilding the prompt from the paths the trial actually
  // used — so where those were recorded, they are rebuilt and read.
  let verified = 0, unverifiable = 0
  for (const r of rows) {
    if (!r.a_path || !r.b_path) { unverifiable++; continue }
    const res = await runLoop({
      args: { goal: 'the document states how to run this tool, completely and in one place',
              candidate: r.a_path, reference: r.b_path, token: '/artifact-mapping/unused-token' },
      rounds: [{ candidateWins: true, gap: 'g', margin: 'clear' }],
    }).catch(() => null)
    const ab = res && res.prompts.find(p => /:ab$/.test(p.label))
    const sides = ab && artifactSides(ab.prompt, r.a_path, r.b_path)
    ok(sides && sides.A === r.artifact_a_dir,
       `${r.trial_id} records ARTIFACT A as ${r.artifact_a_dir}/, but the prompt rebuilt from its own recorded paths puts ${sides ? sides.A + '/' : 'nothing readable'} there`)
    if (sides && sides.A === r.artifact_a_dir) verified++
  }
  console.log(`          ${verified} row(s) verified against a prompt rebuilt from their own recorded paths`)
  // THE RESIDUAL, ON THE BRANCH THAT CARRIES THE VERDICT. Rows drawn before
  // a_path/b_path were recorded cannot be re-derived from their own inputs: the
  // mapping above is recomputed from loop.js's CURRENT side alternation, so it
  // is evidence about what loop.js does today and not a receipt from the day
  // those trials were drawn. What does anchor them is prompt_template_hash,
  // which holds the mapping inside it — a batch sharing one template hash shared
  // one mapping, whatever that mapping was.
  console.log(`          ${unverifiable} row(s) record no paths, so their mapping rests on loop.js's alternation today plus the shared template hash, not on a rebuilt prompt`)

  ok(missing === 0,
     `${missing} degraded row(s) carry no degraded_artifact/artifact_a_dir — their detected flag compares the critic's ARTIFACT letter against a DIRECTORY letter, which are the same only when the prompt happened to put a/ on the ARTIFACT A line. That is the inverted #29 rate.`)
  if (!mismatched && !missing) console.log(`          detected agrees with recomputation on every row`)
}

if (failures) {
  console.error(`\nartifact-mapping: ${failures} failure(s) — a rate computed across two coordinate systems is the complement of the rate it claims to be.`)
  process.exit(1)
}
console.log('\nartifact-mapping: OK — the mapping is derived from the prompt, recorded per trial, and detected recomputes from it.')
