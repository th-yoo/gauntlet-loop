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
import { appendFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MUTATE = join(ROOT, 'scripts', 'mutate.mjs')
const L = 'skills/gauntlet-loop/loop.js'
const S = 'scripts/seed-loop-trial.mjs'
const OA = 'scripts/oracle-add.mjs'
const OR = 'scripts/oracle-record.mjs'
const OE = 'scripts/oracle-extract.mjs'
const OP = 'scripts/oracle-report.mjs'
const DP = 'scripts/detection-parse.mjs'
const DT = 'scripts/defect-transforms.mjs'
const BP = 'scripts/builder-parse.mjs'
const AJ = 'scripts/adjudications.mjs'
const DF = 'scripts/disclosure-figures.mjs'
const DS = 'scripts/disclosure-sources.mjs'
const MS = 'scripts/model-shaped.mjs'
const CV = 'scripts/constructed-verify.mjs'
const SL = 'scripts/split-ledger.mjs'
const SE = 'scripts/split-extract.mjs'
const PV = 'scripts/plugin-version-check.mjs'
const PL = 'scripts/play.mjs'

export const PROPERTIES = [
  ['verdict counts recorded verdicts, not rounds', L, '), 0) + (split_check.ran ? 1 : 0)', '), 0)'],
  ['position balance counts the whole-artifact critic', L, '  .concat(split_check.ran ? [split_check.candidateSide] : [])', ''],
  ['a content leak withdraws the blindness claim', L, "selfid.verdict === 'self-identifying' || LEAKING_FILES.length > 0", 'false'],
  ['a working sibling probe narrows a null result', L, "const GOAL_CHECK_SPAWNABLE = typeProven('gauntlet-loop:gauntlet-goal-check')", 'const GOAL_CHECK_SPAWNABLE = true'],
  ['a split whose whole loses is SPLIT_UNSOUND', L, '    if (!candidateWon) {', '    if (false) {'],
  ['the split check only judges what the pieces edited', L, 'const PIECES_EDIT_THE_WHOLE = PIECES.every(p => (p.candidate || CANDIDATE) === CANDIDATE)', 'const PIECES_EDIT_THE_WHOLE = true'],
  ['a cancel after rounds is not reported as a bad token path', L, '        : history.length === 0', '        : round === 1'],
  ['a silent breaker is not reported as an absent token', L, '      why: breakerSilent !== null', '      why: false'],
  // --- issue 68's class: agents/ changed, version not ---------------------------------
  // Both applied and the suite watched to go red before being pinned. The first blinds the
  // check to the one case `git diff <commit>` cannot see; the second is the verdict itself.
  ['an untracked agent counts as a change to the shipped set', PV, "const untracked = git('ls-files', '--others', '--exclude-standard', '--', SCOPE).stdout.split('\\n').filter(Boolean)", 'const untracked = []'],
  ['an agent set that differs from its record fails', PV, 'if (changes.length) {', 'if (false) {'],
  // --- issue 66: the headless probe, one needle per defect it was caught with live ----
  ['artifacts are served over http, not file://', PL, "await send('Page.navigate', { url: `http://127.0.0.1:${httpPort}/${basename(resolve(file))}` })", "await send('Page.navigate', { url: `file://${resolve(file)}` })"],
  ['an absent favicon is not charged as a page error', PL, "  if (rel === 'favicon.ico' && !existsSync(join(root, rel))) { res.writeHead(204); return res.end() }", ''],
  ['the warm-up runs before the measured keys', PL, 'if (WARMUP.length) {', 'if (false) {'],
  ['the warm-up line reports the observation', PL, '  gate = before === after\n', '  gate = true\n'],
  // --- issue 67: the goal's clauses, and which the pieces never reached -----------------
  ['a clause no piece cited is reported as uncovered', L, '  const uncovered = clauses.filter(c => coveredBy(c.n).length === 0).map(c => c.n)', '  const uncovered = []'],
  ['a clause cited only by pieces that never ran is reported', L, '    .filter(x => x.pieces.length && x.pieces.every(name => !ran.has(name)))', '    .filter(x => false)'],
  // --- issue 63: the lead can raise a piece's line and cannot lower it ------------------
  ['the lead cannot lower the line below the floor', L, "const lineFor = piece => Math.max(CRITICS, (piece && piece.critics_asked) || 0)", "const lineFor = piece => (piece && piece.critics_asked) || CRITICS"],
  ['a lead-raised line is reserved for before the round starts', L, 'ROUND_RESERVE = BUILD_RESERVE + K_MAX * CRITIC_RESERVE\n', ''],
  ['a citation naming no clause is dropped in code', L, "    p.invalid_citations = p.covers.filter(n => !valid.has(n))\n    p.covers = [...new Set(p.covers.filter(n => valid.has(n)))].sort((a, b) => a - b)", "    p.invalid_citations = []\n    p.covers = [...new Set(p.covers)].sort((a, b) => a - b)"],
  ['size growth is measured per piece', L, '      const k = x.piece || null', '      const k = null'],
  ['an empty artifact is a measurement, not a failure', L, 'Number.isFinite(m.bytes) && m.bytes >= 0', 'Number.isFinite(m.bytes) && m.bytes > 0'],
  ['concurrent pieces cannot each spend the last round', L, 'budgetLeft() < ROUND_RESERVE * (roundsInFlight + 1)', 'budgetLeft() < ROUND_RESERVE'],
  ['the in-flight budget reservation is released', L, '  } finally { roundsInFlight-- }', '  } finally { }'],
  ['an unreadable budget stops the run', L, 'treating the budget as exhausted rather than guessing`)\n    return 0', 'treating the budget as exhausted rather than guessing`)\n    return Infinity'],
  ['a critic that throws cannot shorten the line', L, 'for (const p of rest) { if (p) positions.push(p); else critic_died = true }', 'for (const p of rest) if (p) positions.push(p)'],
  ['a piece whose run dies is not counted as a win', L, '  if (!o && !outcome) {', '  if (false) {'],
  ['a skipped piece is not blamed for crashing', L, '    if (!skippedNames.has(name)) {', '    if (true) {'],
  ['pieces must have distinct names', L, '    if (seenNames.has(key)) return false', '    if (false) return false'],
  ['the unreadable refusal names a remedy specific to the missing side', L, '  const remedy = missing.includes(CANDIDATE)', '  const remedy = false && missing.includes(CANDIDATE)'],
  // --- issue 71: the estimand is k-free, and q follows from it only under a stated assumption
  ['the estimand is discordant pairs, not the minority', SE, '  return pairs ? (t.for_candidate * t.against_candidate) / pairs : null', '  return pairs ? Math.min(t.for_candidate, t.against_candidate) / (t.for_candidate + t.against_candidate) : null'],
  ['q is the root below one half', SE, '  return (1 - Math.sqrt(1 - 2 * d)) / 2', '  return (1 + Math.sqrt(1 - 2 * d)) / 2'],
  ['a row without both counts is not a panel', SE, "  const usable = trials.filter(t => Number.isInteger(t.for_candidate) && Number.isInteger(t.against_candidate) && t.for_candidate + t.against_candidate >= 2)", '  const usable = trials.slice()'],
  ['the position claim follows the interval rather than being asserted', SL, '    const overlap = aLo <= bHi && bLo <= aHi', '    const overlap = true'],
  // --- the constructed oracle's role derivation ---------------------------------
  // Added with issue 33's second goal. Both mutations were APPLIED and the suite
  // watched to go red before being pinned here. Note the rest of
  // scripts/constructed-verify.mjs is still unpinned: its four earlier refusals are
  // driven by test/constructed-oracle.test.mjs but a rename would disarm nothing
  // here, because nothing here points at them yet.
  ['a deliverable already present is not credited to the artifact', CV, `  if (runner.ok(probe.deliverable_present)) {\n    return { role: null, why: 'the deliverable was already present`, `  if (false) {\n    return { role: null, why: 'the deliverable was already present`],
  ['a pairing crossing two goals is refused', CV, '  if (ga !== gb) {', '  if (false) {'],
  // --- the refusal can be answered, and only where answering is coherent -------
  // Added with the on_refusal switch (#28 S5). Each mutation was APPLIED and the
  // suite watched to go red, not assumed from the fact that a test mentions it.
  ['an unrecognised on_refusal is refused, not ignored', L, 'if (!ON_REFUSAL_VALUES.includes(ON_REFUSAL)) throw new Error(', 'if (false) throw new Error('],
  ['a downgraded refusal is recorded, not laundered', L, 'proceeded_over_refusal = { verdict: comparability.verdict, side, reasoning: comparability.reasoning }', 'proceeded_over_refusal = null'],
  ['an unopenable artifact is not downgradable', L, "if (comparability && comparability.verdict === 'unreadable') {", "if (comparability && comparability.verdict === 'unreadable' && ON_REFUSAL !== 'warn') {"],
  // --- the regression check, #18's measuring half (NOT a ratchet) ------------------------------------
  ['a round with no snapshot is named, not silently skipped', L, '  if (!snapshot) {', '  if (false) {'],
  ['a regressed round is marked', L, "entry.regressed = prefers === 'previous'", "entry.regressed = false"],
  ['the regression check does not always see the new version on the same side', L, 'const rs = sides(round, 0, PC, snapshot)', 'const rs = { A: PC, B: snapshot, candidateSide: \'A\' }'],
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
  ['the escalation line is only bought on a winning round', L, 'if (firstVerdict && firstVerdict.candidateWon && K > 1) {', 'if (firstVerdict && K > 1) {'],
  ['the exit requires every critic, not most', L, 'const candidateWon = dissenters.length === 0', 'const candidateWon = dissenters.length < positions.length'],


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
  ['an unreadable refusal keeps them too', L, "'against nothing. ' + remedy + probeFindings())", "'against nothing. ' + remedy)"],
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
  ['a model-backed acceptance command is refused', OA, "if (grounding === 'mechanical' && namesAModel(acceptance)) {", "if (false) {"],
  ['an acceptance command that fails is not ground truth', OA, 'if (res.error || res.status !== 0) {', 'if (false) {'],
  ['an observation from a stale instrument is refused', OR, 'if (live.prompt_hash !== promptHash || live.schema_fingerprint !== schemaFp) {', 'if (false) {'],
  ['an observation against a changed artifact is refused', OR, 'if (nowHash !== row.artifact_hash) {', 'if (false) {'],

  ['the cohort key blanks the goal out of the prompt', OE, "  .split(goal).join('{{GOAL}}')", "  .split('\\u0000never').join('{{GOAL}}')"],
  ['the cohort key blanks the inspect text out', OE, "  .split(inspect || '\\u0000never').join('{{INSPECT}}')", "  .split('\\u0000never').join('{{INSPECT}}')"],
  ['the cohort key blanks the artifact path out', OE, "  .split(candidatePath).join('{{ARTIFACT}}')", "  .split('\\u0000never').join('{{ARTIFACT}}')"],
  ['the report groups by template, not by filled-in prompt', OP, "r.template_hash || 'template-unknown:'", "r.prompt_hash || 'template-unknown:'"],

  ['a generator row without its emission is refused', OA, '  if (!emissions.length) {', '  if (false) {'],
  ['a disputed row is excluded from any rate', OP, '    const a = all.filter(r => !r.disputed)', '    const a = all'],

  ['a small corpus refuses to state a rate', OP, 'if (distinct < 5) {', 'if (false) {'],
  // Added with the trivial-confound baseline (#22). The mutation makes a saturated set
  // report as clean, which is exactly the reassurance the issue is about.
  ['a set a trivial confound separates is reported as uninformative', OP, 'if (bhit >= ihit) {', 'if (false) {'],
  ['a stated rate carries its interval, not a point estimate', OP, 'console.log(`     per-side error    ${wrongUnits}/${distinct}, 95% CI [${pct(ci[0])}, ${pct(ci[1])}]  <- PRIMARY`)', 'console.log(`     per-side error    ${pct(wrongUnits/distinct)}  <- PRIMARY`)'],
  // REPOINTED 2026-08-26 when the interval moved from observations to distinct artifacts.
  // The property is unchanged — a stated rate carries its interval — and only the text it
  // is pinned to moved. Re-run after repointing, not assumed: the mutation was applied and
  // the suite went red.
  ['a rate is computed over units, not over repeats of a unit', OP, 'const ci = wilson(wrongUnits, distinct)', 'const ci = wilson(wrong.length, n)'],
  ['the derived refusal figure carries the interval, not the point', OP, 'const pts = [ci[0], ci[1], ...(ci[0] <= 0.5 && 0.5 <= ci[1] ? [0.5] : [])].map(f2)', 'const pts = [f2(wrong.length / n)]'],
  ['the derived refusal figure states its assumption', OP, 'ASSUMING the two sides fail independently', 'assuming nothing in particular'],

  ['a hanging acceptance command is killed', OA, "if (res.error?.code === 'ETIMEDOUT' || res.signal === 'SIGKILL') {", 'if (false) {'],
  ['a row whose artifact was deleted takes no observation', OR, 'if (!existsSync(abs)) {', 'if (false) {'],
  ['an all-disputed arm reports the disagreement', OP, '    if (!a.length) {', '    if (false) {'],

  ['the report keeps its selection-bias disclosure', OP, 'Selection bias is not corrected', 'REMOVED'],
  ['the report keeps its small-sample refusal', OP, 'CANNOT BE POSED', 'REMOVED'],
  ['the report keeps the independence caveat', OP, 'ASSUMING the two sides fail independently', 'REMOVED'],

  // --- the shipped tools refuse a wrong invocation (#98) --------------------
  // The three canary.mjs entries that stood here went with the script itself on
  // 2026-08-27 — see docs/decisions/0002-the-canary-has-no-consumer.md. They
  // pinned real behaviour of a file that no longer exists, so this is a coverage
  // reduction rather than a regression, and the count moving 144 -> 141 is the
  // reason it is written down.
  ['--check refuses a half-given invocation', S, 'if (!degraded || !sealedPath) {', 'if (false) {'],
  ['an option value that is itself an option is a missing value', S, 'return v === undefined || FLAGS.includes(v) ? null : v', 'return v === undefined ? null : v'],
  // --- the defect's class and size are DERIVED, and stay derived (issue 29) ---
  // Added with the size cut. `defect_class` is stored on the ledger row and in
  // the sealed note, and two stored copies agree with each other by
  // construction: a trial relabelled in both places passed the whole suite, and
  // moved a row from one column of the verdict's per-class table to another.
  // Each mutation below was APPLIED and the suite watched to go red.
  ['a mislabelled defect class disagrees with its own bytes', DT, '  if (cls !== null && cls !== note.defect_class) {', '  if (false) {'],
  ['the ledger row\'s class is crossed against the bytes, not against the note', DT, '  if (cls !== null && cls !== row.defect_class) {', '  if (false) {'],
  ['two stored copies of the class must agree with each other too', DT, '  if (row.defect_class !== note.defect_class) {', '  if (false) {'],
  ['a defect\'s size is the span that differs, not the line it sits in', DT, '  const mag = d.out.length + d.in.length', "  const mag = String(note.removed ?? '').length"],
  ['every miss falls at or below the size cut\'s threshold', DP, '  const thr = Math.max(...misses.map(x => x.mag))', '  const thr = Math.min(...misses.map(x => x.mag))'],
  // --- the builder ledger is re-derived, so its scorers are pinnable at all ---
  // Before that, runs/builder.jsonl was compared against nothing: flipping one
  // row's `repaired` moved the published figure from 8/12 to 9/12 and the whole
  // suite stayed green. These four are the scorers whose output the ledger now
  // has to agree with, and each mutation was APPLIED and watched to go red.
  ['a builder repair needs the damaged text gone, not only the original present', BP, '  return hay.includes(original) && !hay.includes(damaged)', '  return hay.includes(original)'],
  ['a builder located verdict reads the artifact, not a constant', BP, '  return !norm(fileText).includes(damaged)', '  return true'],
  ['an untouched builder artifact is not an edit', BP, "  return norm(fileText) !== norm(note.degraded_text || '')", '  return true'],
  ['a builder unit is the defect, not the document it was planted in', BP, "  return [note.source, note.defect_class, String(note.removed || '').trim()].join(' ')", '  return [note.source].join(\' \')'],
  // --- the sealed notes are the anchor, and are themselves re-run -------------
  // Added when both ledgers became re-derivations OF THE NOTES: an anchor nothing
  // checks is a stored fact one level down. Every mutation was APPLIED.
  ['a sealed note must reproduce, not merely resemble', DT, '      if (r.removed === removed && r.inserted === inserted) return { cls, n, text: r.text }', '      if (r.removed === removed) return { cls, n, text: r.text }'],
  ['a note whose recorded degraded hash is wrong is not reproduced', DT, "  if (note.degraded_hash && hash(r.text) !== note.degraded_hash) return { status: 'hash-mismatch', cls: r.cls, n: r.n }", '  if (false) return null'],
  ['a note reproduced by another transform is a class mismatch', DT, "  if (note.defect_class && r.cls !== note.defect_class) return { status: 'class-mismatch', cls: r.cls, n: r.n }", '  if (false) return null'],
  ['a drifted source makes a note unverifiable, not verified', DT, "  if (note.original_hash && hash(sourceText) !== note.original_hash) return { status: 'drifted' }", '  if (false) return null'],
  // --- an adjudication must be SPENT, or it is accounting that did not happen ---
  // Three files here record a human reading to excuse what a check cannot settle,
  // and all three accepted a row naming a subject that exists nowhere. The lookup
  // is what marks a row spent, so these pin the tracking rather than a registry
  // of valid keys.
  ['a row is spent only by the lookup that consults it', AJ, '    get(key) { consulted.add(key); return rows.get(key) },', '    get(key) { return rows.get(key) },'],
  ['a presence test consults the row it asks about', AJ, '    has(key) { consulted.add(key); return rows.has(key) },', '    has(key) { return rows.has(key) },'],
  ['adjudications nothing consulted are reported', AJ, '    unspent() { return [...rows.entries()].filter(([k]) => !consulted.has(k)).map(([key, row]) => ({ key, row })) },', '    unspent() { return [] },'],
  ['a row with no readable key is reported, not dropped', AJ, "    if (k === null || k === undefined || k === '') { malformed.push(JSON.stringify(a).slice(0, 80)); continue }", "    if (k === null || k === undefined || k === '') { continue }"],
  ['an unreadable line is reported, not swallowed', AJ, '    try { a = JSON.parse(line) } catch { malformed.push(line.trim().slice(0, 80)); continue }', '    try { a = JSON.parse(line) } catch { continue }'],
  ['an unspent adjudication names its remedy', AJ, 'Delete the row or fix its key; a row that matches nothing counts as accounting that did not happen.`)', '`)'],
  // --- a disclosure that states a figure says where the figure comes from -----
  // Issue #56. loop.js emitted "detection rate is n=1" for a day after the rate
  // was measured at 12/15, and changing that number to 99, or replacing the tail
  // of the sentence with fruit taxonomy, was caught by nothing: the pin reaches
  // 62 characters of 1205.
  ['a figure with nowhere to point is a finding', DF, "    problems.push({ kind: 'unsourced', figures })", '    return problems'],
  ['a figure absent from the file it cites is a finding', DF, "    if (!found) problems.push({ kind: 'not-in-source', figure: f, paths: live })", '    if (!found) { /* nothing */ }'],
  ['a citation that does not resolve is a finding', DF, "    else problems.push({ kind: 'missing-path', path: p })", '    else live.push(p)'],
  ['spacing and dash shape are not part of a figure', DF, "  .replace(/[–—]/g, '-')                      // an en-dash and a hyphen are one number written twice", '  '],
  ['a run configuration is not a measurement', DF, '/\\bn\\s*=\\s*\\d+\\b|', '/\\b\\w\\s*=\\s*\\d+\\b|'],
  // --- a disclosure that says what the source says quotes the source ---------
  // Issue #59. "The source demands an automatic ratchet" passed run-all and
  // drift-guard: a claim about two documents this repository ships verbatim was
  // checkable by nothing.
  ['a source claim with no quotation is a finding', DS, "    kind: quotes.length ? 'quotes-not-in-source' : 'unquoted-source-claim',", "    kind: 'ignored',\n    ok: (() => { throw new Error('unreachable') })(),"],
  ['a quotation absent from references.md is a finding', DS, '  const grounded = quotes.filter(q => refs.includes(q))', '  const grounded = quotes'],
  ['a paraphrase is not a quotation', DS, '  for (const m of String(text).matchAll(QUOTED)) {', '  for (const m of [...String(text).matchAll(QUOTED), [text, text]]) {'],
  ['a quotation below the floor grounds nothing', DS, '    if (c.length >= min) out.push(c)', '    out.push(c)'],
  ['a sentence naming the source is a source claim', DS, '  const claims = sentences(text).filter(refersToSource)', '  const claims = []'],
  // --- the refusals' name list cannot be narrowed in silence (issue #57) ------
  // Dropping `deepseek` from this regex passed the whole suite: three refusals
  // run off it and no test fed any runner but `claude` to any of them. Both
  // mutations were applied and watched.
  ['a runner name cannot leave the refusal list in silence', MS, '|deepseek|copilot)', '|copilot)'],
  ['a refusal that fires on everything is not a refusal', MS, 'export const MODEL_SHAPED = ', 'export const MODEL_SHAPED = /./i || '],
  // --- the read-time model refusal, and that it refuses BEFORE it runs (#60) --
  // 8ee787b added this refusal on the path that executes a stored acceptance
  // command through a shell, and it shipped with no case: disabling it entirely
  // passed the whole suite. The second property is the one that makes it a
  // refusal rather than a log line.
  ['a stored acceptance command naming a model is refused at read time', OP, '    if (namesAModel(cmd)) {', '    if (false) {'],
  ['and it is refused BEFORE the shell runs it', OP, '      ungrounded.push(`row ${JSON.stringify(row.id)}: its acceptance command names a model', "      spawnSync(cmd, { shell: true, cwd: ROOT, stdio: 'ignore', timeout: 60_000 }); ungrounded.push(`row ${JSON.stringify(row.id)}: its acceptance command names a model"],
  // --- who wrote the goal first is asked, recorded, and disclosed (issue #41) --
  // The ordering is a temporal fact the loop cannot reach — #27's direction trial
  // ran at chance for that reason — so the operator is asked and the answer is
  // recorded as an attestation. Both mutations were applied and watched.
  ['an attestation the loop cannot read is refused, not dropped', L, 'if (GOAL_AUTHORED !== null && !GOAL_AUTHORED_VALUES.includes(GOAL_AUTHORED)) throw new Error(', 'if (false) throw new Error('],
  ['not asked and answered-no are different disclosures', L, "    GOAL_AUTHORED === null\n      ? 'NOBODY WAS ASKED", "    true\n      ? 'NOBODY WAS ASKED"],
]

// THE LIST IS EXPORTED AND THE SWEEP RUNS ONLY WHEN INVOKED, and that is not tidiness.
//
// Three files were reading this list by RE-PARSING this file's text — coverage-cadence with
// a regex that went blind once (114 against 117, three entries opening with a double
// quote), and two written since. They all did it because importing this file used to start
// a whole sweep (cost: test/coverage-cadence.test.mjs OBSERVED), so the list could
// not be read any other way. One list, imported,
// cannot be misparsed by anyone. #46 RC4.
const INVOKED = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

// WHERE A FINDING GOES WHEN IT IS NOT FATAL. The harness watches this script's exit code;
// its findings are in stdout, and nothing points at stdout. The run this issue was filed on
// concluded `success` while its log carried two defects — so the summary is rendered for
// the run page, and it is rendered whether or not anything was found. A summary that
// appeared only on failure would have been absent for exactly that run. #46 RC1.
//
// Exported so it can be tested by CALLING it. A check that scanned this file for
// "GITHUB_STEP_SUMMARY" would pass on a mention, which is the false pass this repo has
// fixed three times.
export function renderSummary({ total, missed, refused, findings }) {
  const lines = [
    '## coverage sweep',
    '',
    `**${total} properties** — ${missed} unpinned, ${refused} could not be tested`,
  ]
  if (findings.length) {
    lines.push('', '| verdict | property |', '| --- | --- |')
    for (const f of findings) lines.push(`| ${f.verdict} | ${f.name} |`)
    lines.push('', 'An unpinned property is code that is still correct with nothing to notice if it stops being.',
                   'One that could not be tested is a mutation whose target text no longer exists — `test/sweep-needles.test.mjs` catches that at push time.')
  } else {
    lines.push('', 'Every property was broken and something failed. No coverage regression.')
  }
  return lines.join('\n') + '\n'
}

if (INVOKED) {
  const filter = process.argv[2]
  const chosen = filter ? PROPERTIES.filter(p => p[0].includes(filter)) : PROPERTIES
  if (!chosen.length) { console.error(`no property matches "${filter}"`); process.exit(2) }

  let missed = 0, refused = 0
  const findings = []
  for (const [name, file, find, replace] of chosen) {
    const r = spawnSync(process.execPath, [MUTATE, file, find, replace], { encoding: 'utf8' })
    const verdict = r.status === 0 ? 'CAUGHT' : r.status === 1 ? 'NOT CAUGHT' : 'COULD NOT RUN'
    if (r.status === 1) missed++
    if (r.status === 2) refused++
    if (r.status !== 0) findings.push({ verdict, name })
    console.log(`${verdict.padEnd(14)} ${name}`)
    if (r.status === 2) console.log(`               ${String(r.stdout || r.stderr).split('\n')[0]}`)
  }
  console.log(`\n${chosen.length} properties — ${missed} unpinned, ${refused} could not be tested`)

  const summary = renderSummary({ total: chosen.length, missed, refused, findings })
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
  process.exit(missed || refused ? 1 : 0)
}
