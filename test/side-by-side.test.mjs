// The instrument decision 0008's falsifier needs, and what it refuses.
//
//   node test/side-by-side.test.mjs
//
// 0008 found that the loop fixes ONE condition of a comparison — play.mjs's window — and
// leaves the rest to the critic: keys, strategies, session count, whether either side was
// driven to game over. scripts/side-by-side.mjs renders both artifacts through the same
// probe, at the same size, with the same keys, into one image, so a crossing can ask
// whether holding those constant moves any verdict. It is NOT wired into the loop and this
// file does not claim it should be.
//
// MOST OF THIS RUNS WITHOUT CHROME. The refusals all fire before a browser is spawned,
// which is what makes them cheap to assert; one real render is done at the end because a
// script whose refusals work and whose happy path does not is a script that never ran.
//
// THE DEFECT THIS FILE EXISTS FOR, found by looking at pixels and not at an exit code: the
// first version rendered the composite at play.mjs's default 520 width, so the two-panel
// page did not fit and the image contained ONLY the left artifact, scrollbars included.
// Exit code 0, output file present, every assertion anyone would naturally write: green.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SBS = join(ROOT, 'scripts', 'side-by-side.mjs')
const PLAY = join(ROOT, 'scripts', 'play.mjs')

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }

const run = (args, env = {}) =>
  spawnSync(process.execPath, [SBS, ...args], { encoding: 'utf8', env: { ...process.env, ...env } })

const dir = mkdtempSync(join(tmpdir(), 'sbs-test-'))
const A = join(dir, 'a.html')
const B = join(dir, 'b.html')
// Two artifacts that differ visibly and neither of which names its role.
writeFileSync(A, '<!doctype html><meta charset="utf-8"><title>t</title><body style="background:#111;color:#eee"><h1>ALPHA</h1></body>')
writeFileSync(B, '<!doctype html><meta charset="utf-8"><title>t</title><body style="background:#111;color:#eee"><h1>BETA</h1></body>')

console.log('side-by-side: a file cannot be compared with itself')
{
  const r = run([A, A, join(dir, 'x.png')])
  ok(r.status === 2, `expected refusal exit 2, got ${r.status}`)
  ok(/same file/.test(r.stderr), `and it must say why — got: ${r.stderr.slice(0, 160)}`)
}

console.log('side-by-side: an unopenable artifact is refused before a browser is spawned')
{
  const r = run([A, join(dir, 'nope.html'), join(dir, 'x.png')])
  ok(r.status === 2, `expected refusal exit 2, got ${r.status}`)
  ok(/cannot open/.test(r.stderr), `and it must name the path — got: ${r.stderr.slice(0, 160)}`)
}

console.log('side-by-side: usage is refused rather than guessed at')
{
  const r = run([A])
  ok(r.status === 2, `expected refusal exit 2, got ${r.status}`)
  ok(/usage:/.test(r.stderr), 'and it prints the usage line')
}

// ---------------------------------------------------------------------------
// PLAY_WINDOW. Added for this instrument and for the viewport crossing the Tetris record
// names. The DEFAULT is the property that matters most: changing it would silently move
// every verdict the probe has ever produced, so it is asserted rather than assumed.
// ---------------------------------------------------------------------------
console.log('side-by-side: PLAY_WINDOW defaults to the size every prior run used, and refuses garbage')
{
  const src = spawnSync(process.execPath, ['-e', `
    const s = require('fs').readFileSync(${JSON.stringify(PLAY)}, 'utf8')
    const m = /return '(\\d+,\\d+)'/.exec(s)
    process.stdout.write(m ? m[1] : 'NOT FOUND')
  `], { encoding: 'utf8' })
  ok(src.stdout === '520,760',
     `the probe's default window must stay 520,760 — every verdict on record was captured at it — got ${src.stdout}`)

  // A malformed value must REFUSE, not fall back. A fallback would capture at the default
  // while the caller believed otherwise, and the only evidence would be pixels.
  const bad = spawnSync(process.execPath, [PLAY, A, join(dir, 'y.png')],
    { encoding: 'utf8', env: { ...process.env, PLAY_WINDOW: 'huge' } })
  ok(bad.status === 2, `a malformed PLAY_WINDOW must refuse, got exit ${bad.status}`)
  ok(/refusing PLAY_WINDOW/.test(bad.stderr), `and say so — got: ${bad.stderr.slice(0, 160)}`)
  ok(!existsSync(join(dir, 'y.png')), 'and it must not have captured anything')
}

// ---------------------------------------------------------------------------
// THE REAL RENDER. Skipped with a stated reason when Chrome is absent, rather than
// silently passing: a suite that reports OK on a machine where the instrument never ran
// has said nothing about it.
// ---------------------------------------------------------------------------
// NO SHELL. The first version asked `bash -lc 'command -v google-chrome'`, and
// test/containment.test.mjs refused the file: a shell is a spawn of whatever it is handed,
// so a site running an unreadable command needs a model-name barrier or a suite refusal.
// The guard was right, and the fix is not to add a barrier but to stop needing one —
// existsSync over the same candidates play.mjs uses, plus a PATH scan, spawns nothing.
const CHROME_NAMES = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']
const haveChrome = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(existsSync) || (process.env.PATH || '').split(':').flatMap(d =>
  CHROME_NAMES.map(n => join(d, n))).find(existsSync) || ''
if (!haveChrome) {
  console.log('side-by-side: NOT RUN — no chrome on this machine, so the render path is unmeasured here')
} else {
  console.log('side-by-side: it renders both artifacts into one image, and says what it holds constant')
  const out = join(dir, 'pair.png')
  const r = run([A, B, out, 'ArrowLeft'])
  ok(r.status === 0, `the render failed: ${r.stderr.slice(0, 300)}`)
  ok(existsSync(out), 'the composite image exists')

  // BOTH ARTIFACTS MUST BE IN IT, and this is the assertion the clipping bug demands.
  // "The file exists" was true when the image held one artifact and a scrollbar. The PNG's
  // real width is read from its IHDR — bytes 16..20, big-endian, no decoder needed — so
  // this measures the rendered pixels rather than what the script intended to render.
  //
  // The first draft of this block asserted `X === false || 1104 > 520`, which is true for
  // every input: a check that cannot fail, in the file whose whole subject is a bug that
  // every natural assertion passed over.
  const png = readFileSync(out)
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  ok(width >= 520 * 2,
     `the composite is ${width}px wide — narrower than two panels, so one artifact is clipped out of it (the exact defect this file exists for)`)
  ok(height > 200, `the composite is ${height}px tall, which is not a rendered page`)

  ok(/identical by construction/.test(r.stdout),
     'the output states what was held constant, since that is the instrument\'s whole claim')
  ok(/same key sequence ArrowLeft/.test(r.stdout), 'and names the key sequence both sides got')
  ok(/page errors during capture — left \d+, right \d+/.test(r.stdout),
     'and reports page errors PER SIDE, since an uneven error count is itself an asymmetry')
  ok(/NOT ESTABLISHED/.test(r.stdout),
     'and states what it cannot establish on the branch that produced the image, not only on failure')
  ok(/attention is not a\s+capture condition/.test(r.stdout),
     'naming the specific thing it cannot hold: a critic can still read one half harder')

  // The labels must not leak roles. This image goes to a blind critic, so the caption may
  // say which SIDE a panel is on and must never say which ROLE it holds.
  ok(/LEFT.*a\.html/.test(r.stdout), 'the operator-facing line says which file is which side')
  const sbsSrc = readFileSync(SBS, 'utf8')
  const caption = /<figcaption>([^<]*)<\/figcaption>/.exec(sbsSrc)
  ok(caption && /^(LEFT|RIGHT)$/.test(caption[1]),
     `the image caption is positional, never a role name — got ${caption && caption[1]}`)
  ok(!/figcaption>\s*(candidate|reference)/i.test(sbsSrc),
     'and no caption names candidate or reference')
}

rmSync(dir, { recursive: true, force: true })

console.log('side-by-side: stating what this suite cannot establish')
console.log('          NOT CHECKED: that a side-by-side verdict differs from a two-paths verdict. That is')
console.log('          decision 0008\'s crossing and it needs spawned critics, which nothing here does.')
console.log('          This file establishes the instrument runs, refuses what it should, and holds the')
console.log('          capture conditions it claims to hold — not that holding them changes any outcome.')

if (failures) {
  console.error(`\nside-by-side: ${failures} failure(s) — an instrument built for a crossing that cannot be trusted to render it.`)
  process.exit(1)
}
console.log('\nside-by-side: OK — refusals fire before a browser, the default window is unmoved, and the render states its own limits.')
