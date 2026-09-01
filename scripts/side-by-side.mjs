// Render two artifacts into ONE image, under conditions identical by construction.
//
//   node scripts/side-by-side.mjs <a.html> <b.html> <out.png> [key ...]
//
// THE FALSIFIER DECISION 0008 NAMED, and nothing more. That record found that the loop
// leaves the comparison's conditions to the critic: the harness fixes the viewport and
// nothing else, so how many keys each side got, which strategies, how many sessions and
// whether either was driven to game over are all chosen per side, per round, and never
// recorded. The Tetris run showed it happening — one critic ran four 254-key batteries
// against one side and reported no comparable battery for the other.
//
// This does not change the loop and is not wired into it. It exists so the crossing 0008
// specifies can be run: one arm of critics under the current two-paths procedure, one arm
// shown a single image produced here, verdicts compared against the split ledger's d as
// the noise floor.
//
// WHY IT SHELLS OUT TO play.mjs INSTEAD OF DRIVING CHROME ITSELF. The obvious build is one
// page with two iframes, keys dispatched into each. It was rejected: keys delivered that
// way are synthetic `KeyboardEvent`s with `isTrusted: false`, while play.mjs uses CDP's
// Input domain, which the page cannot distinguish from a person. A comparison arm that
// feeds the two sides weaker input than the arm it is being compared against would measure
// the input method, not the side-by-side property — the confound would be built into the
// instrument that exists to detect one.
//
// So each side is rendered by the SAME probe, at the SAME window size, with the SAME key
// sequence, and only the composition is new. The composite is itself rendered by play.mjs
// pointed at a generated page holding the two stills, so there is one code path to Chrome
// and no PNG decoder here.
//
// WHAT THIS MAKES IDENTICAL, and it is worth being exact because the whole point is which
// conditions are held: window size, key sequence, warm-up, page-error handling, and the
// moment of capture. WHAT IT DOES NOT: anything about how a critic then reads the image.
// A critic given this can still think harder about one half.

import { spawnSync } from 'node:child_process'
import { writeFileSync, existsSync, mkdtempSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve, basename } from 'node:path'
import { tmpdir } from 'node:os'

const HERE = dirname(fileURLToPath(import.meta.url))
const PLAY = join(HERE, 'play.mjs')

const [a, b, out, ...keys] = process.argv.slice(2)
if (!a || !b || !out) {
  console.error('usage: node scripts/side-by-side.mjs <a.html> <b.html> <out.png> [key ...]')
  process.exit(2)
}
for (const f of [a, b]) {
  if (!existsSync(f)) { console.error(`side-by-side: cannot open ${f}`); process.exit(2) }
}
// A file cannot be compared with itself, for the same reason the loop refuses it: the
// verdict is decided before anything is rendered.
if (resolve(a) === resolve(b)) {
  console.error('side-by-side: both paths are the same file — a side-by-side of one artifact answers nothing')
  process.exit(2)
}

// LABELS ARE POSITIONAL AND CARRY NO ROLE. "LEFT"/"RIGHT", never "candidate"/"reference"
// and never the filenames: this image is handed to a blind critic, and a caption naming a
// side is the leak the loop's whole staging discipline exists to prevent.
const play = (file, png, env = {}) => {
  const r = spawnSync(process.execPath, [PLAY, file, png, ...(env.__nokeys ? [] : keys)],
    { encoding: 'utf8', env: { ...process.env, ...(env.PLAY_WINDOW ? { PLAY_WINDOW: env.PLAY_WINDOW } : {}) } })
  const errs = (r.stdout || '').split('\n').filter(l => /^play: page error/.test(l))
  return { code: r.status, out: r.stdout || '', err: r.stderr || '', pageErrors: errs.length }
}

const work = mkdtempSync(join(tmpdir(), 'side-by-side-'))
const leftPng = join(work, 'left.png')
const rightPng = join(work, 'right.png')

const L = play(a, leftPng)
const R = play(b, rightPng)
for (const [name, res, file] of [['left', L, a], ['right', R, b]]) {
  if (res.code !== 0 || !existsSync(name === 'left' ? leftPng : rightPng)) {
    console.error(`side-by-side: the probe failed on the ${name} artifact (${file}) — exit ${res.code}\n${res.err.slice(0, 400)}`)
    process.exit(2)
  }
}

// The composite page. Both stills at their natural size, side by side, no styling that
// could distinguish them: same border, same background, same caption shape.
const page = join(work, 'composite.html')
writeFileSync(page, `<!doctype html>
<meta charset="utf-8">
<title>side by side</title>
<style>
  body { margin:0; background:#111; font:12px system-ui, sans-serif; color:#ddd }
  .row { display:flex; align-items:flex-start; gap:16px; padding:16px }
  figure { margin:0 }
  figcaption { text-align:center; padding:6px 0; letter-spacing:.08em }
  img { display:block; border:1px solid #333 }
</style>
<div class="row">
  <figure><figcaption>LEFT</figcaption><img src="left.png"></figure>
  <figure><figcaption>RIGHT</figcaption><img src="right.png"></figure>
</div>
`)

// Rendered by the same probe, with no keys — a still page has nothing to drive — and at a
// window wide enough to hold both panels. The first version left the composite at the
// default 520 and produced an image containing ONLY the left artifact, scrollbars and all:
// the exit code was 0 and the file existed, so nothing but looking at the pixels would
// have caught it. Widening here does not touch how the two sides were CAPTURED, which is
// the property this instrument exists to hold constant; it only affects the sheet they are
// pasted onto.
const [w, h] = [520 * 2 + 64, 760 + 80]
const C = play(page, resolve(out), { PLAY_WINDOW: `${w}x${h}`, __nokeys: true })
if (C.code !== 0 || !existsSync(resolve(out))) {
  console.error(`side-by-side: composing the pair failed — exit ${C.code}\n${C.err.slice(0, 400)}`)
  process.exit(2)
}

const keyNote = keys.length ? keys.join(' ') : '(none — both captured at rest)'
console.log(`side-by-side: wrote ${resolve(out)}`)
console.log(`              LEFT  ${basename(a)}   RIGHT ${basename(b)}`)
console.log(`              identical by construction: same probe, same window size, same key sequence ${keyNote}`)
console.log(`              page errors during capture — left ${L.pageErrors}, right ${R.pageErrors}`)

// STATED ON THE BRANCH THAT PRODUCED THE IMAGE, not only on a failure. What this fixes is
// the CAPTURE. It cannot fix what a reader does afterwards, and an image that looks even
// invites the assumption that the comparison is.
console.log('side-by-side: NOT ESTABLISHED — that a critic reading this image weighs the two halves')
console.log('              equally. This holds the capture conditions constant; attention is not a')
console.log('              capture condition. It also freezes ONE moment per side: a defect that only')
console.log('              appears after longer play is outside the frame, and a still cannot show')
console.log('              responsiveness, audio, or anything else that is not a pixel at this instant.')
