// Every property below is one a test is supposed to pin. Break it, and something
// must fail. Anything reported NOT CAUGHT is a coverage regression: the code is
// still correct, and nothing would notice if it stopped being.
//
//   node scripts/coverage-sweep.mjs            # all of them
//   node scripts/coverage-sweep.mjs budget     # only entries matching "budget"
//
// WHY THIS EXISTS. Mutation testing done by hand only finds a hole if someone
// happens to re-run the right mutation. A structural edit to test/trial.test.mjs
// once removed four cases beyond the one being rewritten, and the suite went green
// at a lower count — coverage for two already-fixed bugs vanished with nothing
// failing. This is slow (each entry runs a suite) and is not part of `run-all`;
// run it after touching tests, or when a fix stops feeling covered.
//
// This list is hand-written and that is not the usual sin: there is nothing to
// derive it from. "Which mutations ought to be caught" is a statement about intent
// and cannot be read off the code. Every entry names the property, not the syntax.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MUTATE = join(ROOT, 'scripts', 'mutate.mjs')
const L = 'skills/gauntlet-loop/loop.js'
const S = 'scripts/seed-loop-trial.mjs'
const C = 'scripts/canary.mjs'
const OA = 'scripts/oracle-add.mjs'
const OR = 'scripts/oracle-record.mjs'
const OE = 'scripts/oracle-extract.mjs'
const OP = 'scripts/oracle-report.mjs'

const PROPERTIES = [
  ['verdict counts recorded verdicts, not rounds', L, '), 0) + (split_check.ran ? 1 : 0)', '), 0)'],
  ['position balance counts the whole-artifact critic', L, '  .concat(split_check.ran ? [split_check.candidateSide] : [])', ''],
  ['a content leak withdraws the blindness claim', L, "selfid.verdict === 'self-identifying' || LEAKING_FILES.length > 0", 'false'],
  ['a working sibling probe narrows a null result', L, "const GOAL_CHECK_SPAWNABLE = typeProven('gauntlet-loop:gauntlet-goal-check')", 'const GOAL_CHECK_SPAWNABLE = true'],
  ['a split whose whole loses is SPLIT_UNSOUND', L, '    if (!candidateWon) {', '    if (false) {'],
  ['the split check only judges what the pieces edited', L, 'const PIECES_EDIT_THE_WHOLE = PIECES.every(p => (p.candidate || CANDIDATE) === CANDIDATE)', 'const PIECES_EDIT_THE_WHOLE = true'],
  ['a cancel after rounds is not reported as a bad token path', L, '      why: history.length === 0', '      why: round === 1'],
  ['size growth is measured per piece', L, '      const k = x.piece || null', '      const k = null'],
  ['an empty artifact is a measurement, not a failure', L, 'Number.isFinite(m.bytes) && m.bytes >= 0', 'Number.isFinite(m.bytes) && m.bytes > 0'],
  ['concurrent pieces cannot each spend the last round', L, 'budgetLeft() < ROUND_RESERVE * (roundsInFlight + 1)', 'budgetLeft() < ROUND_RESERVE'],
  ['the in-flight budget reservation is released', L, '  } finally { roundsInFlight-- }', '  } finally { }'],
  ['an unreadable budget stops the run', L, 'treating the budget as exhausted rather than guessing`)\n    return 0', 'treating the budget as exhausted rather than guessing`)\n    return Infinity'],
  ['a critic that throws cannot shorten the line', L, 'for (const p of rest) { if (p) positions.push(p); else critic_died = true }', 'for (const p of rest) if (p) positions.push(p)'],
  ['a piece whose run dies is not counted as a win', L, '  if (!o && !outcome) {', '  if (false) {'],
  ['a skipped piece is not blamed for crashing', L, '    if (!skippedNames.has(name)) {', '    if (true) {'],
  ['pieces must have distinct names', L, '    if (seenNames.has(key)) return false', '    if (false) return false'],
  ['a candidate cannot be compared against itself', L, 'if (CANDIDATE && REFERENCE && String(CANDIDATE).trim() === String(REFERENCE).trim())', 'if (false)'],
  ['artifact paths cannot forge prompt structure', L, '  if (value && /[\\r\\n]/.test(String(value))) throw new Error(', '  if (false) throw new Error('],
  ['paths reach shell-running agents single-quoted', L, 'test -e ${shq(TOKEN)}', 'test -e ${JSON.stringify(TOKEN)}'],
  ['a silent breaker stops the run', L, 'nobody can stop.`)\n    return false', 'nobody can stop.`)\n    return true'],
  ["the builder's failed-attempts note is kept", L, 'failed: built.failed || null }', '}'],
  ['probe evidence behind a cancel is kept', L, '{ stoppedByEvidence = probe.evidence || null; return false }', 'return false'],
  ['the token-check count matches the probes that ran', L, '  else { breakerSpawns++; tokenOk = await tokenPresent(round, TAG) }', '  else { tokenOk = await tokenPresent(round, TAG) }'],
  ['positions split within a round, not just across rounds', L, 'const candidateIsA = (round + i) % 2 === 0', 'const candidateIsA = round % 2 === 0'],
  ['a leak needle beginning with a dash still searches', S, "'--binary-files=without-match', '--', needle", "'--binary-files=without-match', needle"],
  ['a search that could not run is not a pass', S, '      if (e && e.status === 1) continue', '      continue'],
  ['the needle is the longest substantive line', S, 'lines.sort((a, b) => b.length - a.length)[0]', 'lines[0]'],
  ['a markup-only section is refused, not searched', S, '!/^[#\\-*|`\\s]*$/.test(l)', 'true'],
  ['the default search roots stay the three a builder reaches', S, "  join(process.env.HOME || '', '.claude', 'plugins'),", ''],
  // --- the loop degrades correctly when an agent fails ---------------------
  ['a breaker that throws stops the run', L, "treating the run as cancelled rather than continuing a loop nobody can stop`)\n    return null\n  })", "treating the run as cancelled rather than continuing a loop nobody can stop`)\n    return { token: 'PRESENT' }\n  })"],
  ['a non-PRESENT token stops the run', L, "  if (probe.token !== 'PRESENT') { stoppedByEvidence = probe.evidence || null; return false }", "  if (probe.token !== 'PRESENT') { stoppedByEvidence = probe.evidence || null; return true }"],
  ['a lead that throws runs the artifact whole', L, '  ).catch(e => {\n    // Also awaited at top level.', '  ).catch(e => { throw e\n    // Also awaited at top level.'],
  ['a split check that throws keeps the verdict', L, '  } catch (e) {\n    threw = (e && e.message) || String(e)', '  } catch (e) {\n    threw = null && ((e && e.message) || String(e))'],
  ['the split check is skipped on a run that did not win', L, "if (DECOMPOSED && outcome.status === 'WON' && PIECES_EDIT_THE_WHOLE) {", 'if (DECOMPOSED && PIECES_EDIT_THE_WHOLE) {'],
  ['a spawned-but-silent split check is distinguished', L, "split_check = { ran: false, why_not: 'the whole-artifact critic returned nothing", "split_check = { ran: true, why_not: 'the whole-artifact critic returned nothing"],
  ['why_not is always a sentence, never null', L, "    ? 'the run never reached WON, so no winning split existed to falsify — this check only runs after every piece has beaten the reference'", '    ? null'],

  // --- the record keeps what an operator reads it for -----------------------
  ['the spawn count includes the whole-artifact critic', L, '  criticSpawns++\n  // Wrapped, and not out of caution-by-habit.', '  // Wrapped, and not out of caution-by-habit.'],
  ['the gap is recorded verbatim', L, '  gap: primary.gap,', "  gap: 'x',"],
  ["the critic's account of what it inspected is kept", L, '  inspected: primary.inspected,', "  inspected: 'x',"],
  ["the builder's ambiguity note is kept", L, 'ambiguity: built.ambiguity || null', 'ambiguity: null'],
  ['each size carries the command that produced it', L, 'evidence: m.evidence || null })', '})'],
  ['gaps name their piece in a split run', L, "${h.piece ? `${h.piece} ` : ''}round", 'round'],
  ['the partly-fairness note names what was not attempted', L, "  } else if (f.verdict === 'partly') {", '  } else if (false) {'],
  ['args.inspect reaches the critic', L, 'ARTIFACT B: ${s.B}\n${INSPECT', "ARTIFACT B: ${s.B}\n${'' && INSPECT"],
  ['args.inspect reaches the lead', L, 'THE REFERENCE IT IS JUDGED AGAINST: ${REFERENCE}\n${INSPECT', "THE REFERENCE IT IS JUDGED AGAINST: ${REFERENCE}\n${'' && INSPECT"],
  ['round 1 offers to build from nothing', L, "${round === 1 ? '\\nIf it does not exist yet", "${false ? '\\nIf it does not exist yet"],
  ['dropped pieces are counted in the verdict', L, 'dropped_for_no_observable: decomposition.dropped || 0', 'dropped_for_no_observable: 0'],

  // --- inputs refused before anything is spawned ---------------------------
  ['a round-cap argument is refused, not ignored', L, "for (const cap of ['maxRounds', 'max_rounds', 'rounds', 'maxIterations', 'roundCap']) {", 'for (const cap of []) {'],
  ['critics must be a whole number of at least one', L, 'if (!Number.isInteger(CRITICS) || CRITICS < 1) throw new Error', 'if (false) throw new Error'],
  ['a reference is required', L, 'if (!REFERENCE) throw new Error', 'if (false) throw new Error'],
  ['a token is required', L, 'if (!TOKEN) throw new Error', 'if (false) throw new Error'],
  ['mismatched path shapes withdraw the blindness claim', L, "const SIDES_LOOK_ALIKE = shapeOf(REFERENCE) === 'abs-path' && shapeOf(CANDIDATE) === 'abs-path'", 'const SIDES_LOOK_ALIKE = true'],

  // --- what makes a decomposition a decomposition --------------------------
  ['a piece without an observable is dropped', L, "typeof p.observable === 'string' && p.observable.trim().length > 0", 'true'],
  ['one surviving piece is not a split', L, 'if (kept.length < 2) return', 'if (kept.length < 0) return'],
  ['a dependency cycle drops all ordering', L, 'if (PIECES.length > 1 && hasCycle()) {', 'if (false) {'],
  ['an edge to a piece that does not exist is dropped', L, 'const ok = byName.has(d) && d !== piece.name', 'const ok = true'],
  ['a piece cannot depend on itself', L, 'const ok = byName.has(d) && d !== piece.name', 'const ok = byName.has(d)'],
  ['a dependency that did not WIN releases nothing', L, "if (!r || r.status !== 'WON') {", 'if (false) {'],
  ['coupled pieces never overlap on one path', L, '    const prior = pathLock.get(key) || Promise.resolve()', '    const prior = Promise.resolve()'],
  ['the escalation line is only bought on a winning round', L, 'if (firstVerdict && firstVerdict.candidateWon && CRITICS > 1) {', 'if (firstVerdict && CRITICS > 1) {'],
  ['the exit requires every critic, not most', L, 'const candidateWon = dissenters.length === 0', 'const candidateWon = dissenters.length < positions.length'],

  ['a canary never quotes the line it cites', C, 'if (candidate !== truth && pass(candidate)) return { text: candidate, from: src }', 'if (pass(candidate)) return { text: candidate, from: src }'],

  ['a refused size measurement is reported, not dropped', L, '} else if (m) {', '} else if (false) {'],
  ['a run where nothing was measurable says so', L, 'if (sizeUnmeasured.length && !sizeByRound.length) {', 'if (false) {'],

  ['a piece judged against its own path is disclosed as unchecked', L, "DECOMPOSED && PIECES.some(p => (p.candidate", "false && PIECES.some(p => (p.candidate"],
  ['the pairing disclosure does not fire on every decomposed run', L, "DECOMPOSED && PIECES.some(p => (p.candidate", "DECOMPOSED || PIECES.some(p => (p.candidate"],
  ['an artifact that cannot be opened is refused', L, "comparability.verdict === 'unreadable'", "false"],
  ['the pairing verdict is DERIVED, not taken from the agent', L, "const verdict = shut ? 'unreadable' : (writers.length === 1 ? 'generator' : 'comparable')", "const verdict = 'comparable'"],
  ['an unopenable side outranks a generator', L, "const verdict = shut ? 'unreadable' : (writers.length === 1 ? 'generator' : 'comparable')", "const verdict = (writers.length === 1 ? 'generator' : (shut ? 'unreadable' : 'comparable'))"],
  ['two instruction-writers are comparable, not a generator', L, "writers.length === 1", "writers.length >= 1"],
  ['the side blamed is the one that writes the instruction', L, "const blamed = shut || (verdict === 'generator' ? writers[0] : null)", "const blamed = shut || (verdict === 'generator' ? sides[0] : null)"],
  ['the verdict carries what each side was found to be', L, "    sides: sides.map(x => ({ path: x.path, role: x.role, what_it_is: x.what_it_is })),\n", "    sides: [],\n"],
  ['a generator reference is refused, not judged against', L, "comparability.verdict === 'generator'", "false"],

  ['the JS side resolves the temp root through the full chain', S, "process.env.TMPDIR || process.env.TMP || process.env.TEMP || '/tmp'", "'/tmp'"],

  ['the gap reaches the operator while the run is going', L, '\\n  gap: ${gapShown', '\\n  ${"" && gapShown'],
  ['the size measured this round goes out with it', L, "${sizeLive ? \` · ${sizeLive.bytes} bytes\` : ''}", "${''}"],
  ['a truncated gap says it was truncated', L, "gapLive.slice(0, 180) + '… (full text in the verdict)'", "gapLive.slice(0, 180)"],

  ['a generator refusal keeps the findings already paid for', L, "'against a design document.' + probeFindings())", "'against a design document.')"],
  ['an unreadable refusal keeps them too', L, "'against nothing. Check the path — a typo here costs a whole run.' + probeFindings())", "'against nothing. Check the path — a typo here costs a whole run.')"],
  ['a probe that died is reported as unmeasured, not omitted', L, "    : 'goal_fairness: NOT MEASURED — the probe returned nothing, so whether the reference even attempts this goal is unknown')", "    : '')"],

  // --- an empty result vs a missing agent type (#14) ------------------------
  ['every spawn records which agent types answered', L, "if (r && opts && opts.agentType) typeSawResult.set(opts.agentType, true)", "if (false) typeSawResult.set(opts.agentType, true)"],
  ['spawnability is proven, never assumed', L, "const typeProven = t => typeSawResult.get(t) === true", "const typeProven = t => true"],
  ['spawnability uses the evidence rather than ignoring it', L, "const typeProven = t => typeSawResult.get(t) === true", "const typeProven = t => false"],
  ['spawnability is derived, not a hand-written sibling pair', L, "const GOAL_CHECK_SPAWNABLE = typeProven('gauntlet-loop:gauntlet-goal-check')", "const GOAL_CHECK_SPAWNABLE = !!(fairness || fitted)"],
  ['a silent breaker records WHICH event it was', L, "    breakerSilent = breakerSilenceNote(round)", "    breakerSilent = null"],
  ['the breaker note distinguishes the two cases', L, "  return typeProven('gauntlet-loop:gauntlet-breaker')", "  return true ? null : typeProven('gauntlet-loop:gauntlet-breaker')"],

  ['a dead critic says which of the two events it was', L, "        silenceNote('gauntlet-loop:gauntlet-ab-critic'),", "        '',"],
  ['the shared silence note reads the evidence', L, '  return typeProven(type)', '  return true ? ` — that agent type is registered and working this run` : typeProven(type)'],

  ['a typo in a silence-check type name is caught', L, "typeProven('gauntlet-loop:gauntlet-breaker')", "typeProven('gauntlet-loop:gauntlet-breakr')"],
  ['a typo in a critic silence-check name is caught', L, "silenceNote('gauntlet-loop:gauntlet-ab-critic')", "silenceNote('gauntlet-loop:gauntlet-critic')"],

  ['a silent lead is not reported as a refusal', L, 'refused: decomposition ? decomposition.why : null,', "refused: decomposition ? decomposition.why : 'no lead returned a plan',"],
  ['a dead builder says which of the two events it was', L, "+ silenceNote('gauntlet-loop:gauntlet-builder') }", ' }'],
  ['a silent split check says which it was', L, "read this run as if this check did not exist' + silenceNote('gauntlet-loop:gauntlet-ab-critic') }", "read this run as if this check did not exist' }"],

  // --- oracle ground truth for the pairing check (#33) ----------------------
  ['a model-backed acceptance command is refused', OA, "if (arm === 'does-the-work' && MODEL_SHAPED.test(acceptance)) {", "if (false) {"],
  ['an acceptance command that fails is not ground truth', OA, 'if (res.error || res.status !== 0) {', 'if (false) {'],
  ['an observation from a stale instrument is refused', OR, 'if (live.prompt_hash !== promptHash || live.schema_fingerprint !== schemaFp) {', 'if (false) {'],
  ['an observation against a changed artifact is refused', OR, 'if (nowHash !== row.artifact_hash) {', 'if (false) {'],

  ['the cohort key blanks the goal out of the prompt', OE, "  .split(goal).join('{{GOAL}}')", "  .split('\\u0000never').join('{{GOAL}}')"],
  ['the cohort key blanks the inspect text out', OE, "  .split(inspect || '\\u0000never').join('{{INSPECT}}')", "  .split('\\u0000never').join('{{INSPECT}}')"],
  ['the cohort key blanks the artifact path out', OE, "  .split(artifact).join('{{ARTIFACT}}')", "  .split('\\u0000never').join('{{ARTIFACT}}')"],
  ['the report groups by template, not by filled-in prompt', OP, "r.template_hash || 'template-unknown:'", "r.prompt_hash || 'template-unknown:'"],

  ['a generator row without its emission is refused', OA, '  if (!emission) {', '  if (false) {'],
  ['a disputed row is excluded from any rate', OP, '    const a = all.filter(r => !r.disputed)', '    const a = all'],

  ['a small corpus refuses to state a rate', OP, 'if (distinct < 5) {', 'if (false) {'],
  ['a stated rate carries its interval, not a point estimate', OP, 'console.log(`     per-side error    ${wrong.length}/${n}, 95% CI [${pct(ci[0])}, ${pct(ci[1])}]  <- PRIMARY`)', 'console.log(`     per-side error    ${pct(wrong.length/n)}  <- PRIMARY`)'],
  ['the derived refusal figure carries the interval, not the point', OP, 'const pts = [ci[0], ci[1], ...(ci[0] <= 0.5 && 0.5 <= ci[1] ? [0.5] : [])].map(f2)', 'const pts = [f2(wrong.length / n)]'],
  ['the derived refusal figure states its assumption', OP, 'ASSUMING the two sides fail independently', 'assuming nothing in particular'],

  ['a hanging acceptance command is killed', OA, "if (res.error?.code === 'ETIMEDOUT' || res.signal === 'SIGKILL') {", 'if (false) {'],
  ['a row whose artifact was deleted takes no observation', OR, 'if (!existsSync(abs)) {', 'if (false) {'],
  ['an all-disputed arm reports the disagreement', OP, '    if (!a.length) {', '    if (false) {'],

  ['the report keeps its selection-bias disclosure', OP, 'Selection bias is not corrected', 'REMOVED'],
  ['the report keeps its small-sample refusal', OP, 'CANNOT BE POSED', 'REMOVED'],
  ['the report keeps the independence caveat', OP, 'ASSUMING the two sides fail independently', 'REMOVED'],

  // --- the shipped tools refuse a wrong invocation (#98) --------------------
  // NOT listed: needleFrom's `!lines.length` guard. It sweeps NOT CAUGHT and that
  // is correct — removing it yields [].sort()[0] === undefined, which the !needle
  // check refuses with the same message and the same exit code (verified by
  // running both). It is redundant, not uncovered, and an entry here would be a
  // property no test can pin.
  ['too few arguments are refused before a file is opened', C, 'args.length < 2', 'args.length < 0'],
  ['a line number that is not an integer is refused', C, '!Number.isInteger(lineNo) || lineNo < 1', 'lineNo < 1'],
  ['--check refuses a half-given invocation', S, 'if (!degraded || !sealedPath) {', 'if (false) {'],
  ['an option value that is itself an option is a missing value', S, 'return v === undefined || FLAGS.includes(v) ? null : v', 'return v === undefined ? null : v'],
]

const filter = process.argv[2]
const chosen = filter ? PROPERTIES.filter(p => p[0].includes(filter)) : PROPERTIES
if (!chosen.length) { console.error(`no property matches "${filter}"`); process.exit(2) }

let missed = 0, refused = 0
for (const [name, file, find, replace] of chosen) {
  const r = spawnSync(process.execPath, [MUTATE, file, find, replace], { encoding: 'utf8' })
  const verdict = r.status === 0 ? 'CAUGHT' : r.status === 1 ? 'NOT CAUGHT' : 'COULD NOT RUN'
  if (r.status === 1) missed++
  if (r.status === 2) refused++
  console.log(`${verdict.padEnd(14)} ${name}`)
  if (r.status === 2) console.log(`               ${String(r.stdout || r.stderr).split('\n')[0]}`)
}
console.log(`\n${chosen.length} properties — ${missed} unpinned, ${refused} could not be tested`)
process.exit(missed || refused ? 1 : 0)
