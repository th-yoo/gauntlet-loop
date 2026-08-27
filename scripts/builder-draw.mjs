// Measure the BUILDER arm: can it repair a defect it cannot look up?
//
//   node scripts/builder-draw.mjs --stage [--to <dir>]   # build trials, no spawns
//   node scripts/builder-draw.mjs --draw  [--limit N]    # run the builder, LIVE
//   node scripts/builder-draw.mjs --rescore              # re-score from disk, no spawns
//
// THIS SPAWNS LIVE AGENTS on --draw. Everything below is arranged around that.
//
// #25: the only builder trial ever run was void. A copy of SKILL.md with a
// section removed was placed in /tmp, the builder was asked to close the gap, and
// it recovered the text from skills/gauntlet-loop/SKILL.md in the working tree —
// stating so itself: "using the wording and position that appear in the real,
// undegraded SKILL.md for this same plugin". It produced a perfect fix that
// measured a lookup.
//
// TWO LEAK CHANNELS, AND ONLY ONE CAN BE CLOSED.
//
//   1. FILESYSTEM — closed by staging outside this repository and confining each
//      spawn's cwd to its own trial directory, then SEARCHING what is reachable
//      for the text that was removed, before spending anything on the trial.
//   2. THE MODEL'S OWN PRIOR — not closable, by anyone. Gate 7 said so before the
//      panel carrying it was deleted. So it is crossed against rather than
//      claimed shut: see DERIVABILITY in builder-parse.mjs. The underivable class
//      is the leak detector and must read at chance for the derivable number to
//      mean anything.
//
// NO TWO TRIALS SHARE A SOURCE DOCUMENT, and that is not tidiness.
//
// The first version of this file staged one trial per (source, class) pair and
// said in this comment that each trial was isolated. Measured: every one of the
// ten trials had its answer sitting verbatim in exactly one sibling. Two trials
// planted in the SAME document damage different lines, so the
// factual-substitution copy still carries the inverted-constraint trial's
// undamaged answer. That is #25's defect rebuilt by the instrument meant to
// measure it, and the comment claiming isolation was written before the code
// that would have had to provide it — this repository's own "the word outruns the
// mechanism", in a file about not trusting words.
//
// Relying on cwd confinement to keep siblings unreachable would be an assumption
// of exactly the kind #25 is about. So the channel is closed by absence instead:
// sources are DISCOVERED (every tracked markdown file big enough that both
// transforms find a site), each is used by at most one trial, and the
// cross-exposure is then MEASURED and printed rather than asserted.

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, appendFileSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { runLoop } from '../test/harness.mjs'
import { CLASSES } from './defect-transforms.mjs'
import { scoreRepair, wasEdited, leakNeedle, DERIVABILITY, originalRecoverableFromContext, editFootprint, scoreLocated, unitKey, recoverableByShape } from './builder-parse.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// BARRIER: refuse before anything else if this descends from a suite run.
if (process.env.GAUNTLET_SUITE) {
  console.error('builder-draw: refusing — GAUNTLET_SUITE is set, so this process descends from a test suite or a mutation sweep.')
  console.error('This file spawns live agents. The fork bomb of 2026-08-25 was exactly this: a spawner reached from inside a suite run.')
  process.exit(2)
}

// BARRIER: the name is the convention test/containment.test.mjs enforces — it
// looks for `const MAX_<something> = <n>` and then a COMPARISON against it before
// the first spawn, because an identifier that only appears in an error message is
// not a ceiling.
const MAX_SPAWNS_PER_RUN = 20
// How many sites to try before giving up on a document. Bounded so a document
// with no qualifying site costs a loop rather than a scan of every line.
const MAX_SITE_ATTEMPTS = 40
const SPAWN_TIMEOUT_MS = 300_000
let spawned = 0

const argv = process.argv.slice(2)
const has = f => argv.includes(f)
const val = (f, d) => { const i = argv.indexOf(f); return i === -1 ? d : argv[i + 1] }

const STAGE_ROOT = val('--to', join(tmpdir(), 'gauntlet-builder-trials'))
const LEDGER = join(ROOT, 'runs', 'builder.jsonl')
const RAW_DIR = join(ROOT, 'runs', 'builder-raw')
// OUTSIDE every trial tree: the sealed note is the answer key and the builder
// holds Read, Grep, Glob and Bash.
const SEALED_DIR = join(ROOT, 'runs', 'builder-sealed')
const LIMIT = Number(val('--limit', '999'))
// A BATCH TAG, because re-staging without one DESTROYS THE EVIDENCE OF THE LAST
// BATCH. Sealed notes are keyed by a hash of the trial id; a second staging run
// produces the same ids with different plants, overwrites the notes, and every
// row already drawn silently loses the answer key it was scored against.
// Nothing downstream would report that — the ledger would keep its scores and a
// re-score would quietly grade old artifacts against new plants.
//
// The tag enters the trial id, so a tagged batch cannot collide with an
// untagged one, and staging refuses outright if a sealed note already exists.
const TAG = val('--tag', '')
const sha = s => 'sha256:' + createHash('sha256').update(s).digest('hex')

// DISCOVERED, NOT LISTED. A list of five files is a list someone typed, and it
// caps the trial count at the number of names on it — which is how this batch
// ended up reusing documents in the first place. The floor is a size, not a
// judgement about which documents are interesting.
const MIN_SOURCE_BYTES = 1500
function discoverSources() {
  const out = spawnSync('git', ['ls-files', '*.md'], { cwd: ROOT, encoding: 'utf8' })
  const files = String(out.stdout || '').split('\n').filter(Boolean).sort()
  return files.filter(f => {
    const p = join(ROOT, f)
    if (!existsSync(p)) return false
    const t = readFileSync(p, 'utf8')
    if (t.length < MIN_SOURCE_BYTES) return false
    // Usable only if EVERY scored class can find a site in it, so the choice of
    // class for a document is never forced by the document.
    return CLASSES.every(([cls, fn]) => DERIVABILITY[cls] === null || DERIVABILITY[cls] === undefined || fn(t, 0))
  })
}

// ONE GOAL AND ONE GAP FOR EVERY TRIAL, and that is what makes the crossing
// readable. If the gap named the site, or differed by class, the derivable and
// underivable arms would not be comparable and the leak detector would measure
// the prompt instead of the channel. The cost is that this is not the gap a real
// critic writes — recorded in the verdict as a limitation, not papered over.
const GOAL = 'the document is accurate and does not contradict itself'
const GAP = 'Somewhere in this document one statement is wrong: either it contradicts what the rest ' +
  'of the document says, or it states a fact incorrectly. Find it and correct it. Do not rewrite ' +
  'anything else.'

function trialDir(opaque) { return join(STAGE_ROOT, opaque) }

// THE LEAK SEARCH. Runs before the trial is worth anything, and its result is
// RECORDED rather than assumed — a search that silently found nothing and a
// search that never ran are indistinguishable in a ledger that stores only a
// boolean, and this repository has already shipped one leak search that could not
// fire.
function isolationHits(dir, needle) {
  if (!needle) return null
  try {
    const out = spawnSync('grep', ['-rlF', '--binary-files=without-match', '--', needle, dir],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return String(out.stdout || '').split('\n').filter(Boolean).map(p => relative(dir, p) || p)
  } catch { return null }
}

function stage() {
  if (existsSync(STAGE_ROOT)) rmSync(STAGE_ROOT, { recursive: true, force: true })
  mkdirSync(STAGE_ROOT, { recursive: true })
  mkdirSync(SEALED_DIR, { recursive: true })
  const sources = discoverSources()
  const scored = CLASSES.map(([c]) => c).filter(c => DERIVABILITY[c] === true || DERIVABILITY[c] === false)
  const staged = []
  // One document per trial, class assigned by position so nothing chooses which
  // document gets which damage.
  sources.forEach((src, k) => {
    const cls = scored[k % scored.length]
    const fn = CLASSES.find(([c]) => c === cls)[1]
    const text = readFileSync(join(ROOT, src), 'utf8')
    // AN UNDERIVABLE PLANT MUST ACTUALLY BE UNDERIVABLE, and the first batch
    // proved that planting one is not enough to make it so. factual-substitution
    // moves a number, and numbers recur: 9 of 15 plants left the original value
    // sitting elsewhere in the same document, so a builder could read it off
    // another line. Two of those were repaired and the leak detector fired on
    // trials where nothing had leaked.
    //
    // So the site is CHOSEN against that condition rather than checked after the
    // fact: walk the transform's own site sequence until one lands on a value the
    // document does not repeat, and skip the document if none does. The condition
    // is computed from the artifact, never from a list of good sites.
    let out = null
    const wantUnderivable = DERIVABILITY[cls] === false
    for (let attempt = 0; attempt < MAX_SITE_ATTEMPTS; attempt++) {
      const cand = fn(text, k + attempt * scored.length)
      if (!cand) break
      if (!wantUnderivable) { out = cand; break }
      // Clean means BOTH: the value does not recur in the artifact, and its shape
      // does not hand it over (a list ordinal, an impossible fraction).
      // BOTH checks get the same shaped note. The first version passed the mapped
      // object to one and the bare candidate to the other, so the shape check read no
      // document and never fired.
            const asNote = { ...cand, degraded_text: cand.text }
            if (originalRecoverableFromContext(asNote) === false && recoverableByShape(asNote) === false) { out = cand; break }
    }
    if (!out) { console.error(`stage: ${src} has no ${wantUnderivable ? 'underivable ' : ''}site for ${cls}`); return }
    const id = `b${TAG}${String(staged.length + 1).padStart(2, '0')}-${cls}`
    const opaque = createHash('sha256').update(id).digest('hex').slice(0, 12)
    // REFUSE rather than overwrite. A sealed note that already exists belongs to a
    // trial that may already have been drawn and scored against it, and nothing
    // downstream would report the swap: the ledger would keep its scores and a
    // re-score would quietly grade old artifacts against new plants.
    if (existsSync(join(SEALED_DIR, `${opaque}.json`)) && !has('--overwrite-sealed')) {
      console.error(`stage: REFUSING — a sealed note for ${id} already exists. Re-staging would overwrite the answer key earlier rows were scored against. Use --tag <name> for a new batch, or --overwrite-sealed to discard it deliberately.`)
      process.exit(1)
    }
    const dir = trialDir(opaque)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'subject.md'), out.text)
    const note = {
      trial_id: id, opaque, source: src, defect_class: cls,
      derivable: DERIVABILITY[cls],
      removed: out.removed, inserted: out.inserted, where: out.where,
      degraded_hash: sha(out.text), original_hash: sha(text),
      degraded_text: out.text,
    }
    const needle = leakNeedle(note)
    const hits = isolationHits(dir, needle)
    note.leak_needle = needle
    note.isolation_hits = hits
    note.isolation_checked = Array.isArray(hits)
    writeFileSync(join(SEALED_DIR, `${opaque}.json`), JSON.stringify(note, null, 2))
    staged.push(note)
  })

  // THE CROSS-EXPOSURE, MEASURED. Every trial's answer is searched for in every
  // OTHER trial's directory. This is the check whose absence produced ten leaking
  // trials while a comment overhead claimed isolation.
  let cross = 0
  for (const n of staged) {
    if (!n.leak_needle) continue
    for (const other of staged) {
      if (other.opaque === n.opaque) continue
      const p = join(trialDir(other.opaque), 'subject.md')
      if (existsSync(p) && readFileSync(p, 'utf8').includes(n.leak_needle)) {
        cross++
        console.error(`stage: ${n.trial_id}'s answer is reachable inside ${other.trial_id} — both were planted in ${other.source === n.source ? 'the same document' : 'different documents'}`)
      }
    }
  }

  const clean = staged.filter(n => n.isolation_checked && n.isolation_hits.length === 0)
  const dirty = staged.filter(n => !n.isolation_checked || n.isolation_hits.length > 0)
  console.log(`stage: ${staged.length} trial(s) under ${STAGE_ROOT}, from ${new Set(staged.map(t => t.source)).size} distinct document(s)`)
  for (const cls of scored) {
    const n = staged.filter(t => t.defect_class === cls).length
    if (n) console.log(`       ${cls}: ${n} (${DERIVABILITY[cls] ? 'derivable' : 'UNDERIVABLE — the leak detector'})`)
  }
  console.log(`stage: ${clean.length} isolated within their own directory, ${dirty.length} not`)
  console.log(`stage: ${cross} cross-trial answer exposure(s) — measured, not assumed`)
  for (const d of dirty) console.error(`       ${d.trial_id}: ${d.isolation_checked ? 'reachable at ' + JSON.stringify(d.isolation_hits) : 'the leak search could not run — no line distinctive enough'}`)
  if (cross > 0) {
    console.error('stage: REFUSING — a trial whose answer sits in another trial measures a lookup, which is exactly what #25 records.')
    process.exit(1)
  }
  return staged
}

// THE DEPLOYED PROMPT, captured by driving loop.js rather than retyped. The stub
// loses round 1 so a build happens, then wins, so the run terminates at once.
async function capturePrompt(candidatePath) {
  const r = await runLoop({
    args: { goal: GOAL, candidate: candidatePath, reference: join(STAGE_ROOT, '.unused-reference.md'), token: '/builder-draw/unused-token' },
    rounds: [{ candidateWins: false, gap: GAP, margin: 'clear' }, { candidateWins: true, gap: 'g', margin: 'clear' }],
  }).catch(() => null)
  if (!r) return null
  const b = r.prompts.find(p => /:build$/.test(p.label))
  return b ? b.prompt : null
}

function templateHash(prompt, candidatePath) {
  return sha(String(prompt).split(candidatePath).join('<CANDIDATE>').split(STAGE_ROOT).join('<STAGE>'))
}

async function draw() {
  if (!existsSync(SEALED_DIR)) { console.error('draw: nothing staged — run --stage first'); process.exit(2) }
  mkdirSync(RAW_DIR, { recursive: true })
  const done = existsSync(LEDGER)
    ? new Set(readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l).opaque } catch { return null } }).filter(Boolean))
    : new Set()
  const ids = readdirSync(SEALED_DIR).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')).sort()
  const todo = ids.filter(id => !done.has(id)).slice(0, LIMIT)
  if (!todo.length) { console.log('draw: every staged trial already has an observation'); return }
  if (todo.length > MAX_SPAWNS_PER_RUN) {
    console.error(`draw: ${todo.length} trials exceeds the ${MAX_SPAWNS_PER_RUN}-spawn ceiling for one invocation. Use --limit.`)
    process.exit(2)
  }

  for (const id of todo) {
    const note = JSON.parse(readFileSync(join(SEALED_DIR, `${id}.json`), 'utf8'))
    const dir = trialDir(id)
    const subject = join(dir, 'subject.md')
    if (!existsSync(subject)) { console.error(`draw: ${id} is not staged — re-run --stage`); continue }

    // THE ARTIFACT MUST STILL BE THE ONE THAT WAS STAGED, and this is checked
    // before the leak search because it names the real problem when it fires.
    // A trial directory that has already been drawn holds a REPAIRED artifact,
    // and a repaired artifact contains the original line — so the leak search
    // reports "the answer is reachable", which is true and completely misleading.
    // Observed: clearing the ledger without re-staging left one trial holding the
    // output of an earlier probe run, and it voided with a message about
    // isolation rather than about contamination.
    const staged_now = readFileSync(subject, 'utf8')
    if (sha(staged_now) !== note.degraded_hash) {
      console.error(`draw: ${id} VOID before spawning — subject.md is not the artifact that was staged (already drawn, or edited since). Re-stage before drawing.`)
      appendFileSync(LEDGER, JSON.stringify({
        trial_id: note.trial_id, opaque: id, defect_class: note.defect_class, derivable: note.derivable,
        source: note.source, isolation_checked: true, isolation_hits: [],
        void: true, repaired: null, edited: null, response: null, prompt_template_hash: null,
        why_void: 'the staged artifact had been modified before the trial ran — its hash does not match the sealed note',
      }) + '\n')
      continue
    }

    // RE-CHECKED HERE, not trusted from the sealed note. Staging and drawing can
    // be separated by anything at all, including an operator copying a reference
    // into the trial directory to "help".
    const hits = isolationHits(dir, note.leak_needle)
    const isolated = Array.isArray(hits) && hits.length === 0
    if (!isolated) {
      console.error(`draw: ${id} VOID before spawning — ${Array.isArray(hits) ? 'the removed text is reachable at ' + JSON.stringify(hits) : 'the leak search could not run'}`)
      appendFileSync(LEDGER, JSON.stringify({
        trial_id: note.trial_id, opaque: id, defect_class: note.defect_class, derivable: note.derivable,
        source: note.source, isolation_checked: Array.isArray(hits), isolation_hits: hits || [],
        void: true, repaired: null, edited: null, response: null, prompt_template_hash: null,
        why_void: 'the removed text was reachable from the trial directory',
      }) + '\n')
      continue
    }

    // A REPEAT IS NOT A NEW UNIT, so it is not worth a live agent. The transforms
    // are deterministic: re-staging a document reproduces the same plant unless the
    // site moved, and 22 of 31 plants in the second batch matched the first. Drawing
    // one again adds a row and no information, and a rate over rows rather than units
    // is how a confidence interval gets halved for free — which has happened here once.
    const seenUnits = new Set(existsSync(LEDGER)
      ? readFileSync(LEDGER, 'utf8').split(String.fromCharCode(10)).filter(Boolean)
          .map(l => { try { return JSON.parse(l).unit_key } catch { return null } }).filter(Boolean)
      : [])
    if (seenUnits.has(unitKey(note)) && !has('--allow-repeats')) {
      console.log(`draw: ${id} skipped — same (source, class, defect) as a row already in the ledger. Pass --allow-repeats to measure draw-to-draw stability deliberately.`)
      continue
    }

    const prompt = await capturePrompt(subject)
    if (!prompt) { console.error(`draw: could not capture the deployed builder prompt for ${id} — skipping rather than building under a prompt nobody ships`); continue }

    if (spawned >= MAX_SPAWNS_PER_RUN) { console.error('draw: spawn ceiling reached'); break }
    spawned++
    // CWD IS THE TRIAL'S OWN DIRECTORY. That is what closes the filesystem
    // channel: `claude -p` is sandboxed to its working directory, so from here
    // this repository is not reachable and neither is any other trial.
    const r = spawnSync('claude', ['-p', '--permission-mode', 'acceptEdits', prompt],
      { encoding: 'utf8', cwd: dir, timeout: SPAWN_TIMEOUT_MS })
    const out = String(r.stdout || '') + String(r.stderr || '')
    const rawRel = join('runs', 'builder-raw', `${id}.txt`)
    writeFileSync(join(ROOT, rawRel), out)

    const after = readFileSync(subject, 'utf8')
    writeFileSync(join(ROOT, 'runs', 'builder-raw', `${id}.subject.md`), after)
    const repaired = scoreRepair(after, note)
    const rec = {
      trial_id: note.trial_id, opaque: id, defect_class: note.defect_class, derivable: note.derivable,
      source: note.source,
      isolation_checked: true, isolation_hits: [],
      void: false,
      repaired, edited: wasEdited(after, note),
      // THE LEAK ARM'S OWN CONFOUND, recorded per row. An underivable trial whose
      // original is still sitting in the damaged document is not a leak detector,
      // and reading a repair of it as a breach would report the confound as the
      // signal.
      recoverable_from_context: originalRecoverableFromContext(note),
      recoverable_by_shape: recoverableByShape(note),
      footprint: editFootprint(after, note),
      located: scoreLocated(after, note),
      unit_key: unitKey(note),
      response: rawRel, artifact_after: join('runs', 'builder-raw', `${id}.subject.md`),
      prompt_template_hash: templateHash(prompt, subject),
      degraded_hash: note.degraded_hash, after_hash: sha(after),
      spawn_status: r.status,
    }
    appendFileSync(LEDGER, JSON.stringify(rec) + '\n')
    console.log(`draw: ${id} — ${note.defect_class} (${note.derivable ? 'derivable' : 'UNDERIVABLE'}) · edited ${rec.edited} · repaired ${repaired}`)
  }
  console.log(`draw: ${spawned} spawn(s) this invocation`)
}

// RE-SCORE from the artifacts already on disk. No spawns — the same property the
// detection ledger has, and the reason a scoring defect there cost a re-parse
// rather than twenty live agents.
async function rescore() {
  if (!existsSync(LEDGER)) { console.error('rescore: no ledger'); process.exit(2) }
  const rows = readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  const out = []
  for (const r of rows) {
    if (r.void) { out.push(r); continue }
    const notePath = join(SEALED_DIR, `${r.opaque}.json`)
    const afterPath = join(ROOT, r.artifact_after || '')
    if (!existsSync(notePath) || !existsSync(afterPath)) { out.push(r); continue }
    const note = JSON.parse(readFileSync(notePath, 'utf8'))
    const after = readFileSync(afterPath, 'utf8')
    out.push({ ...r, repaired: scoreRepair(after, note), edited: wasEdited(after, note), recoverable_from_context: originalRecoverableFromContext(note), recoverable_by_shape: recoverableByShape(note), footprint: editFootprint(after, note), located: scoreLocated(after, note), unit_key: unitKey(note) })
  }
  writeFileSync(LEDGER, out.map(r => JSON.stringify(r)).join('\n') + '\n')
  console.log(`rescore: ${out.length} row(s) re-scored from the artifacts on disk`)
  console.log(`rescore: ${out.filter(r => r.void).length} void, ${out.filter(r => r.repaired === null && !r.void).length} unscorable`)
}

if (!has('--stage') && !has('--draw') && !has('--rescore')) {
  console.error('usage: node scripts/builder-draw.mjs --stage [--to <dir>] | --draw [--limit N] | --rescore')
  process.exit(2)
}
if (has('--stage')) stage()
if (has('--draw')) await draw()
if (has('--rescore')) await rescore()
