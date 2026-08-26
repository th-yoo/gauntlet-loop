// Measure the critic's defect-detection rate instead of citing one observation. #29.
//
//   node scripts/detection-draw.mjs --stage [--to <dir>]     # build the trial set, no spawns
//   node scripts/detection-draw.mjs --draw  [--limit N]      # judge staged trials, LIVE
//   node scripts/detection-draw.mjs --stage --draw           # both
//
// THIS SPAWNS LIVE AGENTS on --draw. Everything below is arranged around that.
//
// WHY IT EXISTS. #29: the critic's ability to find a planted defect rests on ONE
// observation, and #18's automatic revert is blocked on the missing rate, because
// handing rollback authority to an evaluator whose detection rate is unknown is a
// trade nobody can price. A rate needs a set.
//
// WHAT IS MEASURED, AND WHAT WOULD FAKE IT. Three strategies score well while
// detecting nothing, so the set is built to make each one score at chance:
//
//   POSITION BIAS      — always pick side A. Defeated by crossing which side
//                        carries the degraded copy, half and half.
//   DIFFERENCE-SEEKING — always answer "the other one is better". Defeated by
//                        UNDEGRADED CONTROL PAIRS, where nothing was planted and
//                        any claimed defect is a false alarm.
//   ONE DEFECT CLASS   — a rate over one kind of damage is a rate about that
//                        kind. Three classes, none of them interchangeable: a
//                        22-line hole and a flipped `must` are different problems.
//
// THE PLANTING IS MECHANICAL. No author chooses what to damage: each class is a
// deterministic transform over the source text, and the sealed note records the
// exact before/after strings. `scripts/seed-loop-trial.mjs` makes the same point
// for the loop arm — a trial whose answer is readable measures a lookup.
//
// THE PROMPT IS THE DEPLOYED ONE. It is captured by driving loop.js through
// test/harness.mjs, exactly as scripts/oracle-extract.mjs does, and never retyped.
// A stand-in prompt measures a critic nobody is using, which this repository has
// written down more than once and is the whole content of gate 7 as it used to be.
//
// ── CONTAINMENT ──────────────────────────────────────────────────────────────
// This repository produced a fork bomb: a live spawn sat in a test canary, a
// mutation sweep removed the guard in front of it and ran it, and the agent it
// spawned re-entered the repo and re-ran the suite that spawned it. Depth 13, 22
// live agents, ~3.5 minutes (docs/runs/2026-08-25-oracle-fork-bomb/). The same
// three barriers as scripts/oracle-draw.mjs, because each can hold while another
// does not:
//
//   1. STATIC   — no file the suite or a sweep runs may name this one.
//                 test/detection-rate.test.mjs reads the ledger by path and names
//                 no spawner, and test/containment.test.mjs finds spawners by what
//                 they DO, so this file is covered without an edit there.
//   2. DYNAMIC  — GAUNTLET_SUITE is set by run-all and by mutate's check and is
//                 inherited by every descendant. This refuses while it is set, so
//                 an agent that re-enters the repo from inside a suite run cannot
//                 spawn either.
//   3. SELF-BOUNDING — a hard ceiling on spawns per invocation, compared before
//                 any spawn, and a timeout on each. Note what the timeout does
//                 not do: killing a child does not kill what the child spawned.
//                 It bounds the wait, not the blast.

import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { runLoop } from '../test/harness.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// BARRIER 2, before anything else in this file does any work.
if (process.env.GAUNTLET_SUITE) {
  console.error('detection-draw: refusing — GAUNTLET_SUITE is set, so this process descends from a test suite or a mutation sweep.')
  console.error('This file spawns live agents. The fork bomb of 2026-08-25 was exactly this: a spawner reached from inside a suite run.')
  process.exit(2)
}

// BARRIER 3. The name is the convention test/containment.test.mjs enforces —
// it looks for `const MAX_<something> = <n>` and then for a COMPARISON against
// it before the first spawn, because an identifier that only appears in an error
// message is not a ceiling. This constant was called SPAWN_CEILING and the guard
// could not see it, which is the guard doing its job: a barrier nothing can
// discover is a barrier nobody can check.
const MAX_SPAWNS_PER_RUN = 40
const SPAWN_TIMEOUT_MS = 180_000
let spawned = 0

const argv = process.argv.slice(2)
const has = f => argv.includes(f)
const val = (f, d) => { const i = argv.indexOf(f); return i === -1 ? d : argv[i + 1] }

// THE TRIAL TREE LIVES OUTSIDE THE REPOSITORY BY DEFAULT.
//
// The sources are real repository documents, so a critic handed
// `<repo>/runs/detection-trials/<id>/a/subject.md` can walk up two directories
// and find the pristine original to diff against. Then it is not detecting a
// defect, it is doing a lookup — the exact failure seed-loop-trial.mjs exists to
// refuse, quoted from the first such trial ever run here: "I resolved this by
// using the wording and position that appear in the real, undegraded SKILL.md".
//
// Staging under the system temp directory removes the pointer. It does not close
// the channel — a critic with Bash can search a filesystem, and nothing here
// stops it — so the residual is disclosed rather than claimed shut. What it buys
// is that finding the original requires deciding to go looking for it, instead
// of it sitting two levels above the file it was handed.
//
// The trials are reproducible without the tree surviving: the transforms are
// deterministic and every sealed note records the source path and both hashes.
const STAGE_DIR = val('--to', join(tmpdir(), 'gauntlet-detection-trials'))
const LEDGER = join(ROOT, 'runs', 'detection.jsonl')
const RAW_DIR = join(ROOT, 'runs', 'detection-raw')
// OUTSIDE the trial tree: the sealed note is the answer key, and a critic holds
// Bash and can list a parent directory.
const SEALED_DIR = join(ROOT, 'runs', 'detection-sealed')
const LIMIT = Number(val('--limit', '999'))

const sha = s => 'sha256:' + createHash('sha256').update(s).digest('hex')

// ---------------------------------------------------------------------------
// THE SOURCES. Real documents from this repository, because a synthetic artifact
// measures detection on synthetic text. Chosen for length and for having the
// shapes the three transforms need — headed sections, hard constraints, numbers.
// ---------------------------------------------------------------------------

const SOURCES = [
  'skills/gauntlet-loop/SKILL.md',
  'skills/gauntlet-loop/references.md',
  'oracle/README.md',
  'runs/README.md',
  'docs/README.md',
]

// ---------------------------------------------------------------------------
// THE THREE TRANSFORMS. Each is deterministic given (text, n): the nth eligible
// site is damaged, so nothing here encodes a judgement about which damage is
// findable. Each returns the exact removed and inserted strings, which is what
// makes the sealed note checkable rather than descriptive.
// ---------------------------------------------------------------------------

function sectionRemoval(text, n) {
  const lines = text.split('\n')
  const heads = lines.map((l, i) => (/^## +\S/.test(l) ? i : -1)).filter(i => i !== -1)
  if (heads.length < 2) return null
  const start = heads[n % (heads.length - 1)]
  const end = heads[(n % (heads.length - 1)) + 1]
  const removed = lines.slice(start, end).join('\n')
  if (removed.split('\n').length < 4) return null
  return {
    text: lines.slice(0, start).concat(lines.slice(end)).join('\n'),
    removed, inserted: '',
    where: `the section beginning "${lines[start].slice(0, 60)}"`,
  }
}

// A constraint flipped to its opposite. The document still reads as prose and
// still looks complete, which is the point: this is the class a reader most
// easily misses and the one a 22-line hole says nothing about.
const FLIPS = [
  ['must not', 'must'], ['must', 'must not'],
  ['never', 'always'], ['always', 'never'],
  ['cannot', 'can'], ['is not', 'is'],
  ['no ', 'a '], ['without', 'with'],
]
function invertedConstraint(text, n) {
  const lines = text.split('\n')
  const sites = []
  lines.forEach((l, i) => {
    if (l.trim().startsWith('//') || !l.trim()) return
    for (const [from, to] of FLIPS) if (l.includes(from)) { sites.push({ i, from, to }); break }
  })
  if (!sites.length) return null
  const s = sites[n % sites.length]
  const before = lines[s.i]
  const after = before.replace(s.from, s.to)
  if (after === before) return null
  const out = lines.slice()
  out[s.i] = after
  return { text: out.join('\n'), removed: before, inserted: after, where: `line ${s.i + 1}` }
}

// A number changed to another number. Nothing else moves, so a critic that
// detects this one is reading for correctness rather than for shape.
function factualSubstitution(text, n) {
  const lines = text.split('\n')
  const sites = []
  lines.forEach((l, i) => { if (/\b\d{1,4}\b/.test(l) && !l.trim().startsWith('//')) sites.push(i) })
  if (!sites.length) return null
  const i = sites[n % sites.length]
  const before = lines[i]
  const after = before.replace(/\b(\d{1,4})\b/, (m, d) => String(Number(d) + 7))
  if (after === before) return null
  const out = lines.slice()
  out[i] = after
  return { text: out.join('\n'), removed: before, inserted: after, where: `line ${i + 1}` }
}

const CLASSES = [
  ['section-removal', sectionRemoval],
  ['inverted-constraint', invertedConstraint],
  ['factual-substitution', factualSubstitution],
]

// ---------------------------------------------------------------------------
// STAGE. Builds the trial set on disk with a sealed note per trial. No spawns.
// ---------------------------------------------------------------------------

// NOTHING IN THE TRIAL TREE MAY CARRY SIGNAL, and the first version of this
// leaked in three ways at once. Every one of the twelve responses drawn against
// it named a filename back at me — one wrote its verdict as
// "**WINNER — B** (`original.md`)", which is not a detection, it is reading the
// path it was handed. The blinding was never in place and the twelve were
// discarded.
//
//   1. FILENAMES. `degraded.md` against `original.md` hands over the answer.
//      Both sides are now `subject.md` under `a/` and `b/` — an identical
//      basename, and a directory letter that matches the ARTIFACT A / ARTIFACT B
//      the prompt already states, so it says nothing the critic was not told.
//   2. DIRECTORY NAMES. `t02-inverted-constraint` names the defect class, which
//      tells a critic what to look for and that something was planted at all.
//      Trial directories are now opaque.
//   3. THE SEALED NOTE SAT INSIDE THE TRIAL. A critic holds Bash and can list a
//      parent. The note is the answer key; it now lives outside the tree.
//
// This repository already had the rule, written twice: seed-loop-trial.mjs
// refuses a setup whose answer is readable, and the panel's own isolator was
// given identical basenames "so the filename carries no signal about which arm a
// critic is in". I wrote the second one and then staged this.
function writeTrial(id, cls, src, side, degradedText, originalText, removed, inserted, where) {
  const opaque = createHash('sha256').update(id).digest('hex').slice(0, 12)
  const dir = join(STAGE_DIR, opaque)
  mkdirSync(join(dir, 'a'), { recursive: true })
  mkdirSync(join(dir, 'b'), { recursive: true })
  // The degraded copy goes on the side the sealed note names; for a control both
  // sides are the same bytes.
  const aText = side === 'B' ? originalText : degradedText
  const bText = side === 'B' ? degradedText : originalText
  writeFileSync(join(dir, 'a', 'subject.md'), aText)
  writeFileSync(join(dir, 'b', 'subject.md'), bText)
  const note = {
    trial_id: id, opaque, source: src, defect_class: cls, degraded_side: side,
    removed, inserted, where,
    degraded_hash: sha(degradedText), original_hash: sha(originalText),
  }
  mkdirSync(SEALED_DIR, { recursive: true })
  writeFileSync(join(SEALED_DIR, `${opaque}.json`), JSON.stringify(note, null, 2))
  return note
}

function stage() {
  mkdirSync(STAGE_DIR, { recursive: true })
  const trials = []
  let seq = 0

  // Degraded trials: every (source, class) pair that a transform can actually
  // damage. Sides alternate by index, so the crossing is a property of the
  // construction rather than of a shuffle nobody can reproduce.
  for (const src of SOURCES) {
    const p = join(ROOT, src)
    if (!existsSync(p)) { console.error(`stage: skipping ${src} — not there`); continue }
    const text = readFileSync(p, 'utf8')
    for (const [cls, fn] of CLASSES) {
      const out = fn(text, seq)
      if (!out) { console.error(`stage: ${src} has no site for ${cls}`); continue }
      const id = `t${String(seq + 1).padStart(2, '0')}-${cls}`
      const side = seq % 2 === 0 ? 'A' : 'B'
      trials.push(writeTrial(id, cls, src, side, out.text, text, out.removed, out.inserted, out.where))
      seq++
    }
  }

  // Controls: the original against a byte-identical copy of itself. Nothing is
  // planted, so anything the critic reports as a difference is a false alarm —
  // and a difference-seeking strategy cannot tell these from the degraded ones.
  for (let k = 0; k < 5; k++) {
    const src = SOURCES[k % SOURCES.length]
    const p = join(ROOT, src)
    if (!existsSync(p)) continue
    const text = readFileSync(p, 'utf8')
    const id = `c${String(k + 1).padStart(2, '0')}-control`
    trials.push(writeTrial(id, 'none', src, 'none', text, text, '', '', 'nothing was planted'))
  }

  // THE ANSWER MUST NOT BE READABLE. Every degraded copy has its original beside
  // it in the same directory, which is fine for the JUDGE — it is handed two
  // paths and asked which is better — and would be fatal if a builder were
  // reading. Stated because the same directory layout would be a defect in the
  // loop arm, and seed-loop-trial.mjs refuses exactly that setup.
  const degraded = trials.filter(t => t.degraded_side !== 'none')
  const onA = degraded.filter(t => t.degraded_side === 'A').length
  console.log(`stage: ${trials.length} trial(s) in ${relative(ROOT, STAGE_DIR)} — ${degraded.length} degraded (${onA} on A, ${degraded.length - onA} on B), ${trials.length - degraded.length} control(s)`)
  for (const [cls] of CLASSES) console.log(`       ${cls}: ${degraded.filter(t => t.defect_class === cls).length}`)
  return trials
}

// ---------------------------------------------------------------------------
// THE DEPLOYED PROMPT, captured from loop.js rather than retyped.
// ---------------------------------------------------------------------------

async function capturePrompt(aPath, bPath) {
  // runLoop RETURNS the prompts it built; there is no callback hook, and the
  // first version of this function invented one. Caught by running it.
  //
  // The stub critic wins immediately so the run terminates at once — this is a
  // capture, not a run, and every spawn here is stubbed. Since #18's exit arms
  // rather than fires, "wins immediately" is two rounds rather than one, which
  // costs nothing when nothing is live.
  const r = await runLoop({
    args: { goal: 'the document states how to run this tool, completely and in one place',
            candidate: aPath, reference: bPath, token: '/detection-draw/unused-token' },
    rounds: [{ candidateWins: true, gap: 'g', margin: 'clear' }],
  }).catch(() => null)
  if (!r) return null
  const ab = r.prompts.find(p => /:ab$/.test(p.label))
  return ab ? ab.prompt : null
}

// ---------------------------------------------------------------------------
// DRAW. Live.
// ---------------------------------------------------------------------------

async function draw() {
  if (!existsSync(STAGE_DIR)) { console.error('draw: nothing staged — run --stage first'); process.exit(2) }
  mkdirSync(RAW_DIR, { recursive: true })

  const ids = readdirSync(SEALED_DIR).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')).sort()
  // KEYED ON THE OPAQUE ID, because that is what `ids` holds and what names every
  // file on disk. This read `.trial_id`, so nothing in `done` ever matched
  // anything in `ids` and the draw silently re-ran trials it had already done
  // instead of the one it had missed.
  //
  // Third instance of one root cause: `opaque` was introduced to blind the trial
  // tree, and `trial_id` kept being used as the key in places that now index by
  // file. The other two were the prompt-hash map in reparse and this. A fix
  // placed only where something broke leaves every other derivable fact
  // unguarded, so both id fields are now written on every row and the rule is
  // one line: anything indexed BY FILE uses `opaque`, anything a human reads
  // uses `trial_id`.
  const done = existsSync(LEDGER)
    ? new Set(readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean)
        .map(l => { try { return JSON.parse(l).opaque } catch { return null } }).filter(Boolean))
    : new Set()

  const todo = ids.filter(id => !done.has(id)).slice(0, LIMIT)
  if (!todo.length) { console.log('draw: every staged trial already has an observation'); return }
  if (todo.length > MAX_SPAWNS_PER_RUN) {
    console.error(`draw: ${todo.length} trials exceeds the ${MAX_SPAWNS_PER_RUN}-spawn ceiling for one invocation. Use --limit.`)
    process.exit(2)
  }

  for (const id of todo) {
    const note = JSON.parse(readFileSync(join(SEALED_DIR, `${id}.json`), 'utf8'))
    // The crossing already happened at staging time: writeTrial put the degraded
    // bytes under a/ or b/ per the sealed note. Both paths are `subject.md`, so
    // nothing here reintroduces a name the critic can read.
    const aPath = join(STAGE_DIR, id, 'a', 'subject.md')
    const bPath = join(STAGE_DIR, id, 'b', 'subject.md')
    if (!existsSync(aPath) || !existsSync(bPath)) { console.error(`draw: ${id} is not staged — re-run --stage`); continue }

    const prompt = await capturePrompt(aPath, bPath)
    if (!prompt) { console.error(`draw: could not capture the deployed prompt for ${id} — skipping rather than judging under a prompt nobody ships`); continue }

    if (spawned >= MAX_SPAWNS_PER_RUN) { console.error('draw: spawn ceiling reached'); break }
    spawned++
    // CWD IS THE TRIAL'S OWN DIRECTORY, and that is what makes the trial both
    // readable and blind.
    //
    // Staging outside the repository stopped a critic from walking up to the
    // pristine original — and, run with cwd at the repo root, also stopped it
    // reading the trial at all: `claude -p` is sandboxed to its working
    // directory, so every response in the first blinded batch was a permission
    // refusal ("Read on both paths ... you haven't granted it yet"). Two
    // channels, opposite failures, one setting.
    //
    // With cwd here the critic can open a/subject.md and b/subject.md and has no
    // pointer to this repository at all — the lookup channel is closed by
    // absence rather than by asking.
    const r = spawnSync('claude', ['-p', prompt], { encoding: 'utf8', cwd: join(STAGE_DIR, id), timeout: SPAWN_TIMEOUT_MS })
    const out = String(r.stdout || '') + String(r.stderr || '')
    if (r.status !== 0 && !out.trim()) { console.error(`draw: ${id} produced nothing (status ${r.status})`); continue }

    // Named by the opaque id, not the trial id: a raw file called
    // t02-inverted-constraint.txt sitting beside the trial tree is one more place
    // the class is written down.
    const rawRel = join('runs', 'detection-raw', `${id}.txt`)
    writeFileSync(join(ROOT, rawRel), out)

    // WHAT THE RESPONSE IS READ FOR, and this is deliberately mechanical: which
    // side it picked. Whether it NAMED the planted defect is a second question a
    // human or a second agent answers later — recorded as null rather than
    // guessed at here, because a regex over prose is not a reading.
    //
    // THE FIRST VERSION OF THIS RECORDED A FALSE OBSERVATION, and it took one
    // live trial to find. It matched `winner` followed anywhere on the line by a
    // standalone `A`, and on the very first response — a control, where the
    // critic ran `cmp`, found the files byte-identical, and answered
    // "## 1. WINNER — neither" — it matched this instead:
    //
    //   "winner. Not tie-from-laziness — tie from measurement. `cmp` returns 0…"
    //
    // and recorded `picked: "A"`. A parser that finds an answer in prose that
    // says the opposite is the defect this repository names most often: a check
    // whose PASS condition is satisfied by the thing being broken. Had it run
    // over all twenty trials first, the rate would have been computed from
    // fabricated picks and would have looked entirely reasonable.
    //
    // So the heading is parsed, not the prose, and anything that does not match
    // it is left null for a human rather than guessed.
    const picked = parseWinner(out)

    const rec = {
      trial_id: note.trial_id,
      opaque: id,
      defect_class: note.defect_class,
      degraded_side: note.degraded_side,
      source: note.source,
      picked,
      // The critic detected iff it picked the side that was NOT degraded.
      // `neither` is not a detection: on a degraded pair one side really is
      // worse, and answering that nothing separates them is a miss with a
      // different shape. It is recorded as itself so the two never merge.
      // Same rule as reparse: null means unread, not missed.
      detected: note.degraded_side === 'none' ? null
        : picked === null ? null
        : picked !== note.degraded_side,
      named_defect: namedDefect(out, note),
      prompt_hash: sha(prompt),
      prompt_template_hash: templateHash(prompt, aPath, bPath),
      response: rawRel,
      degraded_hash: note.degraded_hash,
    }
    appendFileSync(LEDGER, JSON.stringify(rec) + '\n')
    // The label reads the SIDE, not the detected flag. It used to print
    // `detected === null ? 'control'`, and since an unread response is also null
    // it announced degraded trials as controls — "degraded B · control" in the
    // same line. A log that contradicts itself is one a reader stops checking.
    const verdictWord = note.degraded_side === 'none' ? 'control'
      : rec.detected === null ? 'UNREAD'
      : rec.detected ? 'DETECTED' : 'missed'
    console.log(`draw: ${id} — picked ${picked || '(unparsed)'} · degraded ${note.degraded_side} · ${verdictWord}`)
  }
  console.log(`draw: ${spawned} spawn(s) this invocation`)
}

// ---------------------------------------------------------------------------
// PARSING IS SEPARATE FROM SPAWNING, and that is the design rather than tidiness.
//
// Every response is written to runs/detection-raw/ BEFORE it is read, so the raw
// text is the evidence and the ledger is derived from it. A parser defect
// therefore costs a re-parse and never a re-spawn — which matters because this
// parser has now been wrong twice, and both times the response was fine.
//
//   1. The first version matched `winner` followed anywhere on the line by a
//      standalone `A`, and read "winner. Not tie-from-laziness — tie from
//      measurement…" as a pick for A on a control the critic had correctly
//      called identical.
//   2. The second read only the heading line, and the critic does not always put
//      the answer there: "## 1. WINNER" followed by a blank line and then
//      "**A** — but by declared coin-flip, not by merit" parsed as nothing.
//
// So it reads the heading AND the block under it, and anything it cannot read is
// left null for a human rather than guessed at.
// THE TEMPLATE HASH — the instrument, with this trial's inputs taken out.
//
// `prompt_hash` covers the exact bytes sent, paths included, so it is unique per
// trial by construction. Pooling trials requires the opposite: evidence they were
// judged by the SAME instrument. Redacting the two artifact paths leaves exactly
// that, and a change to the critic prompt in loop.js still moves it.
//
// This repository has already fixed this once, at ab67932 — "the template hash
// had the checkout path inside it" — for oracle-extract. Same lesson, same file
// shape, learned again here because my reproducible asserted one distinct hash
// across twenty trials, which no set of twenty could ever satisfy. A check that
// cannot pass is as broken as one that cannot fail.
function templateHash(prompt, aPath, bPath) {
  const redacted = String(prompt).split(aPath).join('<ARTIFACT-A>').split(bPath).join('<ARTIFACT-B>')
  return sha(redacted)
}

function parseWinner(text) {
  const lines = String(text).split('\n')
  const h = lines.findIndex(l => /^#{1,4}\s*\d*\.?\s*WINNER\b/i.test(l))
  if (h === -1) return null
  // The heading line minus the word WINNER, plus the next few lines, stopping at
  // the following heading so a later section cannot supply the answer.
  const block = [lines[h].replace(/^.*WINNER/i, '')]
  for (let i = h + 1; i < lines.length && block.length < 6; i++) {
    if (/^#{1,4}\s/.test(lines[i])) break
    block.push(lines[i])
  }
  const t = block.join(' ')
  if (/\bneither\b|\bno winner\b|\bnot a winner\b|\btie\b/i.test(t)) return 'neither'
  const a = /(^|[^A-Za-z])A([^A-Za-z]|$)/.test(t)
  const b = /(^|[^A-Za-z])B([^A-Za-z]|$)/.test(t)
  return a && !b ? 'A' : b && !a ? 'B' : null
}

// DID IT NAME THE DEFECT, or merely land on the right side?
//
// Picking correctly is 50/50 luck on any single trial; quoting the planted text
// is not. This is the leak-check shape the deleted gate 7 used in reverse — there,
// finding the sealed strings in a critic's output proved it had reached the
// original; here it is evidence the critic actually located the damage.
//
// HEURISTIC, AND RECORDED AS ONE. It looks for a distinctive fragment of the
// changed line, or the removed section's heading. A critic that describes the
// defect in its own words without quoting scores false here, so this UNDERSTATES.
// It is a separate field, nothing gates on it, and the response is on disk for a
// reader who wants the real answer.
function namedDefect(text, note) {
  if (note.degraded_side === 'none') return null
  const hay = String(text)
  const candidates = []
  if (note.defect_class === 'section-removal') {
    const head = String(note.removed).split('\n')[0].replace(/^#+\s*/, '').trim()
    if (head.length >= 8) candidates.push(head)
  } else {
    // The changed line, minus markup, in fragments long enough not to match by
    // chance. Both directions: the critic may quote what is there or what is not.
    for (const line of [note.removed, note.inserted]) {
      const t = String(line).replace(/[`*#|]/g, ' ').replace(/\s+/g, ' ').trim()
      if (t.length >= 24) candidates.push(t.slice(0, 60))
    }
  }
  if (!candidates.length) return null
  const norm = x => x.replace(/[`*#|]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  const h = norm(hay)
  return candidates.some(c => h.includes(norm(c)))
}

// A control where the critic said the sides are identical, or picked one while
// disclaiming that the pick carries no signal, is NOT a false alarm — it is the
// difference-seeking confound scoring zero. Recorded separately from the pick,
// because "picked A" and "picked A and said so meaninglessly" are different
// observations and merging them is how a control set stops controlling.
function declaredNoDifference(text) {
  return /byte-identical|identical byte|no dimension separates|carries zero signal|coin-flip|coin flip|\bidentical\b/i.test(String(text))
}

// REPARSE. Rebuilds the ledger from the raw responses already on disk. No spawns.
async function reparse() {
  if (!existsSync(RAW_DIR)) { console.error('reparse: no raw responses on disk'); process.exit(2) }
  const files = readdirSync(RAW_DIR).filter(f => f.endsWith('.txt')).sort()
  const out = []
  for (const f of files) {
    const id = f.replace(/\.txt$/, '')
    const sealedPath = join(SEALED_DIR, `${id}.json`)
    if (!existsSync(sealedPath)) { console.error(`reparse: ${id} has no sealed note — skipping`); continue }
    const note = JSON.parse(readFileSync(sealedPath, 'utf8'))
    const text = readFileSync(join(RAW_DIR, f), 'utf8')
    const picked = parseWinner(text)
    const aP = join(STAGE_DIR, id, 'a', 'subject.md')
    const bP = join(STAGE_DIR, id, 'b', 'subject.md')
    const prompt = await capturePrompt(aP, bP)
    out.push({
      trial_id: note.trial_id, opaque: id, defect_class: note.defect_class, degraded_side: note.degraded_side,
      source: note.source, picked,
      // AN UNREAD RESPONSE IS NOT A MISS. `picked === null` means this parser
      // could not read the answer, which says nothing about whether the critic
      // found the defect — the response is on disk and a human can read it. It
      // used to fall through to `false` and be counted as a failure to detect,
      // which would have pushed the rate DOWN using trials that measured
      // nothing. Same class as the two parser defects above, one level along:
      // a value that cannot be established recorded as the negative answer.
      detected: note.degraded_side === 'none' ? null
        : picked === null ? null
        : picked !== note.degraded_side,
      declared_no_difference: declaredNoDifference(text),
      named_defect: namedDefect(text, note),
      // RECOMPUTED, not looked up. This read a map keyed on `trial_id` using the
      // OPAQUE id, so every lookup missed and every row was rewritten with
      // prompt_hash: null — silently, because `|| null` is indistinguishable
      // from "there was none". The reproducible caught it, which is the first
      // time one of my own guards caught one of my own defects rather than me
      // finding it by reading a response.
      //
      // Recomputing is strictly better than fixing the key: the prompt is a pure
      // function of the two paths and the goal, capturing it costs no live
      // spawn, and a hash derived from the artifact can never disagree with the
      // artifact the way a copied one can.
      prompt_hash: sha(prompt || ''),
      prompt_template_hash: prompt ? templateHash(prompt, aP, bP) : null,
      response: join('runs', 'detection-raw', f),
      degraded_hash: note.degraded_hash,
    })
  }
  writeFileSync(LEDGER, out.map(r => JSON.stringify(r)).join('\n') + '\n')
  const unparsed = out.filter(r => r.picked === null).length
  console.log(`reparse: ${out.length} trial(s) rebuilt from raw responses — ${unparsed} unparsed`)
}

if (!has('--stage') && !has('--draw') && !has('--reparse')) {
  console.error('usage: node scripts/detection-draw.mjs --stage [--to <dir>] | --draw [--limit N] | --reparse')
  process.exit(2)
}
if (has('--stage')) stage()
if (has('--draw')) await draw()
if (has('--reparse')) await reparse()
