// The headless probe says the right thing about pages built to make it say the wrong one.
//
//   node test/play.test.mjs
//
// ISSUE 66. scripts/play.mjs drives an HTML artifact in headless Chrome and reports what
// it saw. It began as a scratch file beside the Tetris run's artifacts, and each of its
// four defects was found by reading its output during a live run, at the cost of a
// verdict per defect. Each is a fixture here:
//
//   1. file:// — the browser blocks fetch() on CORS grounds, so a page that fetches
//      anything looked broken. The fixture fetches a sibling JSON and writes the value
//      into its title; served wrong, that is a page error and no title.
//   2. favicon — Chrome requests /favicon.ico unprompted, and a 404 was charged to the
//      artifact as a page error. No fixture ships an icon; every clean one must report
//      "no page errors".
//   3. the start gate — a page that boots into a menu ate every measured key, and a critic
//      judged the reference on the difference (0 with the keys first, 34 with Space first).
//      The gated fixture counts arrows only after Enter/Space: with the warm-up the count
//      is the key count, without it the count is zero. Same page, same keys; the warm-up
//      is the only thing that moves, and it moves the result from nothing to everything.
//   4. the over-claiming label — "start gate dismissed" fired on a page with no gate
//      because Space hard-dropped a piece. Two gate-less fixtures, one whose screen the
//      warm-up leaves alone and one whose screen it changes: the report may state which
//      happened and may not say "dismissed" of either.
//
// WHAT IS COMPUTED. Every expected count is the length of the key list the test chose,
// read back from the page's title, never typed as a number that happens to match.
//
// NOTHING HERE SPAWNS A MODEL. The subprocesses are node running the probe, which spawns
// Chrome. A missing Chrome is reported as an environment failure by the probe itself.
// The runs go in parallel because each costs a few seconds of sleeps and the coverage
// sweep runs this suite once per property.

import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PLAY = join(ROOT, 'scripts', 'play.mjs')

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }

const KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowLeft']

// One page per defect. Each shows its state on screen (so a screenshot changes when the
// state does) and states its count in the title (so the test reads a number, not pixels).
const page = body => `<!doctype html><title>keys:0</title><body style="margin:0"><div id=s style="font:48px monospace;padding:40px">boot</div><script>${body}</script></body>`
const show = `const el=document.getElementById('s');const paint=(t)=>{el.textContent=t;document.title='keys:'+n}`
const FIXTURES = {
  // Arrows count only after Enter or Space; before that every key is eaten by the menu.
  gated: page(`let n=0,started=false;${show};paint('PRESS START');addEventListener('keydown',e=>{if(!started){if(e.key==='Enter'||e.key===' '){started=true;paint('PLAYING')}return}if(e.key.startsWith('Arrow')){n++;paint('n='+n)}})`),
  // No gate. Arrows count; Enter and Space do nothing at all, so the warm-up leaves the
  // screen exactly as it found it.
  open: page(`let n=0;${show};paint('n=0');addEventListener('keydown',e=>{if(e.key.startsWith('Arrow')){n++;paint('n='+n)}})`),
  // No gate, and Space changes the screen — a hard drop. The case that made the first
  // label lie.
  dropping: page(`let n=0,d=0;${show};paint('n=0 d=0');addEventListener('keydown',e=>{if(e.key.startsWith('Arrow'))n++;if(e.key===' ')d++;paint('n='+n+' d='+d)})`),
  // Fetches a sibling file. Under file:// this throws before the title is written.
  fetching: `<!doctype html><title>unfetched</title><body><script type=module>const r=await fetch('data.json');const j=await r.json();document.title='fetched:'+j.v</script></body>`,
  // Throws at load. The probe must report it and still deliver the screenshot.
  throwing: `<!doctype html><title>t</title><body><script>throw new Error('boom from the fixture')</script></body>`,
}

function run(name, { keys = KEYS, warmup } = {}) {
  const dir = mkdtempSync(join(tmpdir(), `play-${name}-`))
  writeFileSync(join(dir, 'index.html'), FIXTURES[name])
  writeFileSync(join(dir, 'data.json'), '{"v":41}')
  const png = join(dir, 'out.png')
  const env = { ...process.env }
  if (warmup !== undefined) env.PLAY_WARMUP = warmup
  return new Promise(resolve => {
    const p = spawn(process.execPath, [PLAY, join(dir, 'index.html'), png, keys.join(',')], { env })
    let out = ''
    p.stdout.on('data', d => { out += d }); p.stderr.on('data', d => { out += d })
    const t = setTimeout(() => { p.kill('SIGKILL'); out += '\n[test: killed after 60s]' }, 60_000)
    p.on('close', status => {
      clearTimeout(t)
      const title = (/^play: title (".*")$/m.exec(out) || [, '""'])[1]
      resolve({ status, out, png, title: JSON.parse(title), dir })
    })
  })
}

const dirs = []
const results = await Promise.all([
  run('gated'),
  run('gated', { warmup: '' }),
  run('open'),
  run('dropping'),
  run('fetching'),
  run('throwing'),
])
for (const r of results) dirs.push(r.dir)
const [gated, gatedCold, open, dropping, fetching, throwing] = results

try {
  console.log('play: every run finished and left a PNG')
  for (const [i, r] of results.entries()) {
    ok(r.status === 0, `run ${i} exited ${r.status}:\n${r.out}`)
    ok(existsSync(r.png) && readFileSync(r.png).subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])), `run ${i} wrote a PNG (magic bytes) at ${r.png}`)
  }

  console.log('play: the start gate — the warm-up is the difference between every key landing and none')
  ok(gated.title === `keys:${KEYS.length}`, `gated page with the warm-up: ${KEYS.length} arrows counted — title was ${JSON.stringify(gated.title)}\n${gated.out}`)
  ok(gatedCold.title === 'keys:0', `gated page WITHOUT the warm-up: the menu eats every key, count stays 0 — title was ${JSON.stringify(gatedCold.title)}`)
  ok(/warm-up .* ran BEFORE the measured keys/.test(gated.out), 'the report says the warm-up ran before the measured keys, on every artifact')
  ok(/changed the screen/.test(gated.out), 'and that on this page it changed the screen')
  ok(/not probed/.test(gatedCold.out), 'with PLAY_WARMUP empty the report says the gate was not probed, not that there was none')
  console.log(`          gated: ${gated.title} with warm-up, ${gatedCold.title} without`)

  console.log('play: the label states the observation and not a verdict — two gate-less pages, one screen change')
  ok(open.title === `keys:${KEYS.length}`, `open page counts every arrow — title was ${JSON.stringify(open.title)}`)
  ok(/changed nothing on screen/.test(open.out), `a page the warm-up cannot affect reports "changed nothing" — got:\n${open.out}`)
  ok(dropping.title === `keys:${KEYS.length}`, `dropping page counts every arrow — title was ${JSON.stringify(dropping.title)}`)
  ok(/changed the screen/.test(dropping.out), 'a page whose Space hard-drops reports "changed the screen"')
  ok(/cannot tell those apart/.test(dropping.out) && /cannot tell those apart/.test(gated.out),
     'and the changed-screen line says it cannot separate a dismissed menu from a key that played — the same line for the page with a gate and the page without one')
  for (const [n, r] of [['gated', gated], ['open', open], ['dropping', dropping]]) {
    ok(!/gate dismissed|screen dismissed|menu dismissed/i.test(r.out), `${n}: the report never asserts a gate was dismissed — got:\n${r.out}`)
  }

  console.log('play: served over http — a page that fetches a sibling gets it, and is charged no error')
  ok(fetching.title === 'fetched:41', `the page fetched data.json and wrote its value into the title — title was ${JSON.stringify(fetching.title)}\n${fetching.out}`)
  ok(/no page errors/.test(fetching.out), `no page error charged to a page that fetches — got:\n${fetching.out}`)

  console.log('play: an absent favicon is not a page error')
  for (const [n, r] of [['gated', gated], ['open', open], ['dropping', dropping], ['fetching', fetching]]) {
    ok(/no page errors/.test(r.out), `${n} ships no favicon and must report "no page errors" — got:\n${r.out}`)
  }

  console.log('play: a page that throws is reported, verbatim, and still screenshotted')
  ok(/1 page error\(s\)/.test(throwing.out) && /boom from the fixture/.test(throwing.out), `the thrown error is counted and quoted — got:\n${throwing.out}`)
  ok(throwing.status === 0, 'and reporting an error is not itself a failure of the probe')

  console.log('play: the residual is printed on every run')
  for (const r of results) ok(/NOTE — a warm-up press can consume the first piece/.test(r.out), 'every run states that the warm-up may have consumed a piece')
} finally {
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
}

console.log('play: stating what this cannot establish')
console.log('          NOT MEASURED: whether a real artifact binds the keys this probe presses, or whether the')
console.log('          screenshot a critic reads is the one that matters. The fixtures answer in their title;')
console.log('          a game answers in pixels, and reading those is the critic\'s job, not this file\'s.')

if (failures) { console.error(`\nplay: ${failures} FAILURE(S)`); process.exit(1) }
console.log('\nplay: OK — five pages built to break the probe, six runs in parallel, every count read from the page.')
