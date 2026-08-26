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

const STAGE_DIR = val('--to', join(ROOT, 'runs', 'detection-trials'))
const LEDGER = join(ROOT, 'runs', 'detection.jsonl')
const RAW_DIR = join(ROOT, 'runs', 'detection-raw')
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
      const dir = join(STAGE_DIR, id)
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'degraded.md'), out.text)
      writeFileSync(join(dir, 'original.md'), text)
      const note = {
        trial_id: id, source: src, defect_class: cls,
        degraded_side: seq % 2 === 0 ? 'A' : 'B',
        removed: out.removed, inserted: out.inserted, where: out.where,
        degraded_hash: sha(out.text), original_hash: sha(text),
      }
      writeFileSync(join(dir, 'sealed.json'), JSON.stringify(note, null, 2))
      trials.push(note)
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
    const dir = join(STAGE_DIR, id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'degraded.md'), text)
    writeFileSync(join(dir, 'original.md'), text)
    const note = {
      trial_id: id, source: src, defect_class: 'none',
      degraded_side: 'none',
      removed: '', inserted: '', where: 'nothing was planted',
      degraded_hash: sha(text), original_hash: sha(text),
    }
    writeFileSync(join(dir, 'sealed.json'), JSON.stringify(note, null, 2))
    trials.push(note)
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

  const ids = readdirSync(STAGE_DIR).filter(d => existsSync(join(STAGE_DIR, d, 'sealed.json'))).sort()
  const done = existsSync(LEDGER)
    ? new Set(readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).trial_id))
    : new Set()

  const todo = ids.filter(id => !done.has(id)).slice(0, LIMIT)
  if (!todo.length) { console.log('draw: every staged trial already has an observation'); return }
  if (todo.length > MAX_SPAWNS_PER_RUN) {
    console.error(`draw: ${todo.length} trials exceeds the ${MAX_SPAWNS_PER_RUN}-spawn ceiling for one invocation. Use --limit.`)
    process.exit(2)
  }

  for (const id of todo) {
    const note = JSON.parse(readFileSync(join(STAGE_DIR, id, 'sealed.json'), 'utf8'))
    const degradedPath = join(STAGE_DIR, id, 'degraded.md')
    const originalPath = join(STAGE_DIR, id, 'original.md')

    // The degraded copy is the CANDIDATE when the sealed note says side A, and the
    // reference otherwise. That is what crosses the position.
    const aPath = note.degraded_side === 'B' ? originalPath : degradedPath
    const bPath = note.degraded_side === 'B' ? degradedPath : originalPath

    const prompt = await capturePrompt(aPath, bPath)
    if (!prompt) { console.error(`draw: could not capture the deployed prompt for ${id} — skipping rather than judging under a prompt nobody ships`); continue }

    if (spawned >= MAX_SPAWNS_PER_RUN) { console.error('draw: spawn ceiling reached'); break }
    spawned++
    const r = spawnSync('claude', ['-p', prompt], { encoding: 'utf8', cwd: ROOT, timeout: SPAWN_TIMEOUT_MS })
    const out = String(r.stdout || '') + String(r.stderr || '')
    if (r.status !== 0 && !out.trim()) { console.error(`draw: ${id} produced nothing (status ${r.status})`); continue }

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
      trial_id: id,
      defect_class: note.defect_class,
      degraded_side: note.degraded_side,
      source: note.source,
      picked,
      // The critic detected iff it picked the side that was NOT degraded.
      // `neither` is not a detection: on a degraded pair one side really is
      // worse, and answering that nothing separates them is a miss with a
      // different shape. It is recorded as itself so the two never merge.
      detected: note.degraded_side === 'none'
        ? null
        : (picked === 'A' || picked === 'B') && picked !== note.degraded_side,
      named_defect: null,
      prompt_hash: sha(prompt),
      response: rawRel,
      degraded_hash: note.degraded_hash,
    }
    appendFileSync(LEDGER, JSON.stringify(rec) + '\n')
    console.log(`draw: ${id} — picked ${picked || '(unparsed)'} · degraded ${note.degraded_side} · ${rec.detected === null ? 'control' : rec.detected ? 'DETECTED' : 'missed'}`)
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

// A control where the critic said the sides are identical, or picked one while
// disclaiming that the pick carries no signal, is NOT a false alarm — it is the
// difference-seeking confound scoring zero. Recorded separately from the pick,
// because "picked A" and "picked A and said so meaninglessly" are different
// observations and merging them is how a control set stops controlling.
function declaredNoDifference(text) {
  return /byte-identical|identical byte|no dimension separates|carries zero signal|coin-flip|coin flip|\bidentical\b/i.test(String(text))
}

// REPARSE. Rebuilds the ledger from the raw responses already on disk. No spawns.
function reparse() {
  if (!existsSync(RAW_DIR)) { console.error('reparse: no raw responses on disk'); process.exit(2) }
  const files = readdirSync(RAW_DIR).filter(f => f.endsWith('.txt')).sort()
  const out = []
  for (const f of files) {
    const id = f.replace(/\.txt$/, '')
    const sealedPath = join(STAGE_DIR, id, 'sealed.json')
    if (!existsSync(sealedPath)) { console.error(`reparse: ${id} has no sealed note — skipping`); continue }
    const note = JSON.parse(readFileSync(sealedPath, 'utf8'))
    const text = readFileSync(join(RAW_DIR, f), 'utf8')
    const picked = parseWinner(text)
    out.push({
      trial_id: id, defect_class: note.defect_class, degraded_side: note.degraded_side,
      source: note.source, picked,
      detected: note.degraded_side === 'none' ? null : (picked === 'A' || picked === 'B') && picked !== note.degraded_side,
      declared_no_difference: declaredNoDifference(text),
      named_defect: null,
      prompt_hash: PROMPT_HASHES.get(id) || null,
      response: join('runs', 'detection-raw', f),
      degraded_hash: note.degraded_hash,
    })
  }
  writeFileSync(LEDGER, out.map(r => JSON.stringify(r)).join('\n') + '\n')
  const unparsed = out.filter(r => r.picked === null).length
  console.log(`reparse: ${out.length} trial(s) rebuilt from raw responses — ${unparsed} unparsed`)
}

// Prompt hashes are recorded per trial at draw time; on a bare --reparse they are
// read back out of the existing ledger so a re-parse never invents one.
const PROMPT_HASHES = new Map()
if (existsSync(LEDGER)) {
  for (const l of readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean)) {
    try { const r = JSON.parse(l); if (r.trial_id && r.prompt_hash) PROMPT_HASHES.set(r.trial_id, r.prompt_hash) } catch {}
  }
}

if (!has('--stage') && !has('--draw') && !has('--reparse')) {
  console.error('usage: node scripts/detection-draw.mjs --stage [--to <dir>] | --draw [--limit N] | --reparse')
  process.exit(2)
}
if (has('--stage')) stage()
if (has('--draw')) await draw()
if (has('--reparse')) reparse()
