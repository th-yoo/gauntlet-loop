// THE REFUSALS' NAME LIST CAN LOSE A NAME, AND NOTHING NOTICED. Issue #57.
//
//   node test/model-shaped.test.mjs
//
// COMMITTED FAILING. `scripts/model-shaped.mjs` is one regex of fourteen runner
// names, and three sites refuse a model-backed command through it:
//
//   scripts/oracle-add.mjs:298        a corpus row whose acceptance command names a model
//   scripts/constructed-verify.mjs:60 a probe whose command does
//   scripts/oracle-report.mjs:128     a stored acceptance command, re-run at read time
//
// A role settled by a model cannot audit a model — that is what those refusals
// are for. Measured with the whole suite run each time:
//
//   the regex drops `deepseek`        NOT CAUGHT
//   the regex drops `codex`           NOT CAUGHT
//   the regex matches nothing at all  CAUGHT (oracle, constructed-oracle)
//
// So the refusal PATH was pinned and the REACH of the list was not: thirteen of
// fourteen names could leave one at a time in silence. No test fed any runner but
// `claude` to any of the three.
//
// WHY THE CROSSING CANNOT BE DERIVED FROM THE LIST. A test that built its cases
// out of `MODEL_SHAPED` could never see a name leave — the case would leave with
// it. The battery in test/model-names.mjs is held apart from the regex for that
// reason, and it is the same battery #55 used to measure containment's blindness,
// so it was not chosen to make this pass.
//
// AND IT CARRIES AN ARM THE REGEX MUST NOT MATCH. Without `ON_NO_LIST_AT_ALL` the
// check is satisfied by a rule that refuses everything, which would disarm the
// corpus rather than protect it — the same one-sided-set failure this repository
// names most often.
//
// NOTHING HERE SPAWNS.

import { MODEL_SHAPED, namesAModel } from '../scripts/model-shaped.mjs'
import { ON_THE_OLD_LIST, ADDED_LATER, ON_NO_LIST_AT_ALL, RUNNERS } from './model-names.mjs'

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }

// The shape a refusal actually sees: a command line, not a bare word.
const command = bin => `/usr/local/bin/${bin} -p "grade this artifact"`

console.log('model-shaped: every runner the discovery battery names is refused')
{
  const missed = RUNNERS.filter(b => !MODEL_SHAPED.test(command(b)))
  console.log(`          ${RUNNERS.length - missed.length}/${RUNNERS.length} runner name(s) matched`)
  ok(missed.length === 0,
     `${missed.length} runner name(s) are not matched by MODEL_SHAPED (${missed.join(', ')}). An acceptance command built on one of those is recorded as mechanical ground truth by scripts/oracle-add.mjs, re-run by scripts/oracle-report.mjs, and accepted as a probe by scripts/constructed-verify.mjs — a role settled by a model auditing a model, which is the one thing those refusals exist to stop.`)
}

console.log('model-shaped: and a name no registry holds is NOT refused')
{
  const overreach = ON_NO_LIST_AT_ALL.filter(b => MODEL_SHAPED.test(command(b)))
  console.log(`          0/${ON_NO_LIST_AT_ALL.length} expected, ${overreach.length} matched`)
  ok(overreach.length === 0,
     `MODEL_SHAPED matched ${overreach.join(', ')}, which name no model runner. Without this arm the check above is satisfied by a rule that refuses every command, and a refusal that fires on everything disarms the corpus instead of guarding it.`)
}

console.log('model-shaped: the two halves of the battery are both represented')
{
  // THE ADDED_LATER HALF IS THE POINT. Those six are exactly the names the regex
  // missed before #55, so a battery holding only the original seven would pass
  // against the very list that was found wanting.
  ok(ON_THE_OLD_LIST.length >= 5 && ADDED_LATER.length >= 5,
     `the battery has ${ON_THE_OLD_LIST.length} original and ${ADDED_LATER.length} later name(s) — with either arm empty this crossing tests one kind of name and reports it as coverage`)
  ok(ON_NO_LIST_AT_ALL.length >= 3,
     `only ${ON_NO_LIST_AT_ALL.length} name(s) in the negative arm; a placebo of one is an anecdote`)
  const overlap = RUNNERS.filter(b => ON_NO_LIST_AT_ALL.includes(b))
  ok(overlap.length === 0, `${overlap.join(', ')} is in both arms, so the crossing contradicts itself`)
}

console.log('model-shaped: the rule reads a command, not a bare word')
{
  ok(namesAModel(command(RUNNERS[0])) === true, 'namesAModel does not agree with MODEL_SHAPED on a command that names a runner')
  ok(namesAModel(command(ON_NO_LIST_AT_ALL[0])) === false, 'namesAModel refuses a command naming nothing model-shaped')
  ok(namesAModel(null) === false && namesAModel(undefined) === false && namesAModel(7) === false,
     'namesAModel returned a verdict on a non-string — a refusal that throws on bad input stops the run for the wrong reason')
}

console.log('model-shaped: stating what this cannot establish')
console.log('          NOT MEASURED: the runner nobody has heard of. This crosses the list against a')
console.log('          battery someone wrote, so it proves the names present are load-bearing and says')
console.log('          nothing about the name that is absent from both. That residual is why')
console.log('          test/containment.test.mjs no longer decides what needs a spawn guard from this')
console.log('          list at all — a guard whose reach is a list must not also define what it guards.')
console.log('          NOT COVERED HERE: that each of the three refusal sites reaches this rule.')
console.log('          oracle-add and constructed-verify each drive it end to end; scripts/oracle-report.mjs')
console.log('          has no test of its own refusal, and this file cannot supply one.')

if (failures) {
  console.error(`\nmodel-shaped: ${failures} failure(s) — a refusal whose reach nobody measured is a refusal that can be narrowed in silence.`)
  process.exit(1)
}
console.log(`\nmodel-shaped: OK — ${RUNNERS.length} runner name(s) refused, ${ON_NO_LIST_AT_ALL.length} non-runner(s) not.`)
