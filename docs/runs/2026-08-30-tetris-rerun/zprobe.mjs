import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const prof = mkdtempSync(join(tmpdir(),'z-'))
const ch = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new','--disable-gpu','--no-sandbox','--remote-debugging-port=0',`--user-data-dir=${prof}`,'about:blank'],
  { stdio:['ignore','ignore','pipe'] })
let port=null; ch.stderr.on('data',d=>{const m=/ws:\/\/127\.0\.0\.1:(\d+)\//.exec(String(d)); if(m&&!port)port=m[1]})
for(let i=0;i<600&&!port;i++) await sleep(100)
const t=(await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.addEventListener('open',r,{once:true}))
let id=0; const pend=new Map()
ws.addEventListener('message',e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}})
const send=(method,params={})=>new Promise(r=>{const n=++id;pend.set(n,r);ws.send(JSON.stringify({id:n,method,params}))})
await send('Runtime.enable'); await send('Page.enable')
await send('Page.navigate',{url:`http://127.0.0.1:8731/${process.argv[2]}`}); await sleep(1200)
const ev = async expr => (await send('Runtime.evaluate',{expression:expr,returnByValue:true})).result.result.value
const key = async (k,code,kc) => {
  for (const type of ['keyDown','keyUp'])
    await send('Input.dispatchKeyEvent',{type,key:k,code,keyCode:kc,windowsVirtualKeyCode:kc,text:type==='keyDown'?k:undefined})
  await sleep(150)
}
console.log('game over flag :', await ev('typeof over!=="undefined" ? over : "(no `over` binding)"'))
for (const [label,k,code,kc] of [['Z  (US layout)','z','KeyZ',90],['Z  (Korean IME)','\u314b','KeyZ',90],['X  (Korean IME)','\u3160','KeyX',88]]) {
  const before = await ev('typeof piece!=="undefined" ? JSON.stringify([piece.t,piece.r]) : "(no piece)"')
  await key(k,code,kc)
  const after = await ev('typeof piece!=="undefined" ? JSON.stringify([piece.t,piece.r]) : "(no piece)"')
  console.log(`${label}: piece[type,rot] ${before} -> ${after}   ${before===after?'NO CHANGE':'rotated'}`)
}
ws.close(); ch.kill(); process.exit(0)
