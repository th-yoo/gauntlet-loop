// Drive an HTML game headlessly and screenshot it, so a reader can look at the
// RUNNING thing rather than its source. Generic: it presses the arrow keys and
// space, which is what every keyboard game binds, and knows nothing about the
// page it is driving.
//
//   node scripts/play.mjs <file.html> <out.png> [keySequence]
//
// keySequence is comma-separated CDP key names, default a short left/right/rotate/drop
// run. No npm dependencies: Node 22 has fetch and WebSocket built in. PLAY_WARMUP
// overrides the keys pressed before the measured sequence (default Enter,Space; empty
// disables); PLAY_CHROME names the browser binary (default google-chrome).
//
// WHY IT LIVES HERE — issue 66. It began as a scratch file beside the Tetris run's
// artifacts, and every defect in it was found by reading its output during a live run,
// at the cost of a verdict each time: the file:// CORS block, the favicon 404 charged as
// a page error, the start screen eating every measured key, and a warm-up label that
// claimed a verdict it could not have. test/play.test.mjs builds a page for each of
// those and requires this probe to say the right thing about it, so the next defect is
// found by a test and not by a critic.
//
// WHAT IT REPORTS, AND WHAT IT DOES NOT. Observations: the screenshot, the page's
// document.title after the keys (the one channel a page has to state a number without
// the reader parsing pixels), whether the warm-up changed the screen, and every page
// error. Not conclusions: it never says a start screen was dismissed, because a hard
// drop changes the screen exactly as a closing menu does, and a label that fires on
// both names neither.
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { extname, dirname, basename } from 'node:path'
import { namesAModel } from './model-shaped.mjs'

const [file, out, seqArg] = process.argv.slice(2)
if (!file || !out) { console.error('usage: node scripts/play.mjs <file.html> <out.png> [keys]'); process.exit(2) }
const KEYS = (seqArg || 'ArrowLeft,ArrowLeft,ArrowUp,ArrowRight,ArrowDown,ArrowDown,Space,ArrowRight,ArrowUp,Space,ArrowLeft,Space').split(',')

const CODES = {
  ArrowLeft:  { key: 'ArrowLeft',  code: 'ArrowLeft',  keyCode: 37, windowsVirtualKeyCode: 37 },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, windowsVirtualKeyCode: 39 },
  ArrowUp:    { key: 'ArrowUp',    code: 'ArrowUp',    keyCode: 38, windowsVirtualKeyCode: 38 },
  ArrowDown:  { key: 'ArrowDown',  code: 'ArrowDown',  keyCode: 40, windowsVirtualKeyCode: 40 },
  Space:      { key: ' ',          code: 'Space',      keyCode: 32, windowsVirtualKeyCode: 32, text: ' ' },
  Enter:      { key: 'Enter',      code: 'Enter',      keyCode: 13, windowsVirtualKeyCode: 13, text: '\r' },
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

// SERVED OVER HTTP, NOT file://. Under file:// the browser refuses fetch() and
// manifest loads on CORS grounds, so a page that fetches anything looks broken
// through no fault of its own — and a builder told about it would "fix" a defect
// that belongs to this harness. Both sides are observed the same way.
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript',
  '.css':'text/css', '.json':'application/json', '.webmanifest':'application/manifest+json',
  '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon',
  '.mp3':'audio/mpeg', '.wav':'audio/wav', '.ogg':'audio/ogg' }
const root = dirname(resolve(file))
const server = createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '')
  // The browser asks for /favicon.ico unprompted. One side happens to ship one and
  // the other does not, so a 404 here would be reported as a page error against
  // whichever artifact did not think to include an icon — a difference this harness
  // invented. Answer it with 204 for both.
  if (rel === 'favicon.ico' && !existsSync(join(root, rel))) { res.writeHead(204); return res.end() }
  const p = join(root, rel)
  if (!p.startsWith(root) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); return res.end('not found') }
  res.writeHead(200, { 'content-type': MIME[extname(p).toLowerCase()] || 'application/octet-stream' })
  res.end(readFileSync(p))
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const httpPort = server.address().port
const profile = mkdtempSync(join(tmpdir(), 'play-'))
// PLAY_CHROME still wins. Without it, the first installed path from a short per-platform
// list, falling back to the Linux binary name. `google-chrome` is not on PATH on darwin —
// Chrome lives inside an .app bundle — so test/play.test.mjs was red on every Mac, and a
// probe that cannot start reports "the page never loaded" against whichever artifact it
// was pointed at. Discovered, not assumed: each candidate is checked with existsSync, and
// a bare name is left for PATH to resolve.
const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
]
const CHROME = process.env.PLAY_CHROME
  || CHROME_CANDIDATES.find(p => existsSync(p))
  || 'google-chrome'
// The binary is caller-supplied, so test/containment.test.mjs cannot read what runs
// here and requires the barrier every such site carries: the value is checked for a
// model runner before it is spawned. A browser is inert; a PLAY_CHROME naming an
// agent would make this file a spawner, and it refuses.
if (namesAModel(CHROME)) { server.close(); console.error(`play: refusing PLAY_CHROME=${CHROME} — it names a model runner, and this probe drives a browser`); process.exit(2) }
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, '--window-size=520,760', 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] })

// A missing browser is an environment failure, named as one. Without this the spawn
// error is unhandled and the process dies with a stack trace that names nothing.
chrome.on('error', e => { server.close(); console.error(`play: cannot start ${CHROME} (${e.code || e.message}) — install it or set PLAY_CHROME`); process.exit(2) })
let port = null
chrome.stderr.on('data', d => { const m = /ws:\/\/127\.0\.0\.1:(\d+)\//.exec(String(d)); if (m && !port) port = m[1] })
// SIXTY SECONDS, NOT TEN, and the reason is the one this file already documents twice.
// Chrome's FIRST launch on a host takes longer than ten and every launch after it takes
// two; test/play.test.mjs starts six concurrently. A probe that gives up reports nothing,
// and nothing is read as "the page never loaded" against whichever artifact it happened to
// be pointed at — a difference invented by the harness, exactly like the file:// block and
// the favicon 404 above it.
for (let i = 0; i < 600 && !port; i++) await sleep(100)
if (!port) { chrome.kill(); console.error('play: chrome never announced a debugging port'); process.exit(1) }

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = targets.find(t => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise(r => ws.addEventListener('open', r, { once: true }))
let id = 0
const pending = new Map()
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
})
const send = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })

const errors = []
await send('Runtime.enable')
await send('Log.enable')
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data)
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || ''))
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(m.params.entry.text)
})
await send('Page.enable')
await send('Page.navigate', { url: `http://127.0.0.1:${httpPort}/${basename(resolve(file))}` })
await sleep(1500)

// START GATE. Measured, not assumed: a page that boots into a menu eats every key
// the sequence sends, and the reader concludes the artifact does not respond to
// them. That happened — the reference scored 0 under a sequence ending in Space and
// 34 under the same keys with Space first, so its piece control was never exercised
// and a critic judged it on the difference.
//
// So the warm-up runs on BOTH artifacts and is REPORTED rather than hidden: a page
// with no gate is unchanged by it, and one with a gate is dismissed by it. The
// screenshot comparison is what makes it a measurement instead of a guess.
const WARMUP = (process.env.PLAY_WARMUP ?? 'Enter,Space').split(',').filter(Boolean)
const shotNow = async () => (await send('Page.captureScreenshot', { format: 'png' })).result.data
let gate = 'not probed'
if (WARMUP.length) {
  const before = await shotNow()
  for (const k of WARMUP) {
    const c = CODES[k.trim()]
    if (!c) continue
    await send('Input.dispatchKeyEvent', { type: 'keyDown', ...c })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...c })
    await sleep(250)
  }
  await sleep(500)
  const after = await shotNow()
  // REPORT THE OBSERVATION, NOT AN INTERPRETATION OF IT. The first version of this
  // line said "gate dismissed" whenever the screen changed — and the seed artifact,
  // which has no start screen at all, reported dismissed too, because Space
  // hard-drops a piece and that changes the screen as surely as a menu closing
  // does. A label that fires on both cases names neither. What is actually
  // observed is whether the warm-up changed anything; what it MEANS is the
  // reader's to decide with the artifact in front of them.
  gate = before === after
    ? `the warm-up changed nothing on screen (no start screen, and no key effect either)`
    : `the warm-up changed the screen — that is a start screen being dismissed OR the keys simply playing the game, and this probe cannot tell those apart`
}

for (const k of KEYS) {
  const c = CODES[k.trim()]
  if (!c) continue
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...c })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...c })
  await sleep(220)
}
await sleep(1200)

const shot = await send('Page.captureScreenshot', { format: 'png' })
const { writeFileSync } = await import('node:fs')
writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
// The title is reported verbatim: it is the page's own statement, and a page that puts
// its score there has given the reader a number that does not need pixels to read.
const title = await send('Runtime.evaluate', { expression: 'String(document.title)', returnByValue: true })
console.log(`play: wrote ${out} after ${KEYS.length} key(s)`)
console.log(`play: title ${JSON.stringify((title.result && title.result.result && title.result.result.value) || '')}`)
console.log(`play: warm-up ${WARMUP.join(',')} ran BEFORE the measured keys, on this and every artifact: ${gate}`)
console.log('play: NOTE — a warm-up press can consume the first piece in a game that has no start screen. Both sides get the same warm-up, so the comparison is level; a single artifact read in isolation is one piece further on than a human would be.')
console.log(errors.length ? `play: ${errors.length} page error(s):\n  ${errors.slice(0, 5).join('\n  ')}` : 'play: no page errors')
ws.close(); chrome.kill()
// Chrome flushes its profile on the way out, so the rmdir races it. The profile
// is a temp dir either way; failing to remove it is not a failed observation.
server.close()
await sleep(400)
try { rmSync(profile, { recursive: true, force: true }) } catch {}
process.exit(0)
