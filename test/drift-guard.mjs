// Drift guard for loop.js: the loop carries its contract in two prompt surfaces
// — the round prompts inside the script, and the standing agent definitions it
// spawns — and either can be edited without the other. This pins them together,
// checks the tool allowlists the verdict claims, and scans for the runtime APIs
// and round-cap names that would silently change what the loop is.
//
//   node test/drift-guard.mjs
//
// Exit 0 = pinned. Exit 1 = drift. No dependencies.

// ADDING A CHECK HERE — one rule, learned five times in a row.
//
// **Match as precisely as the claim you are making.** Every failure this file has
// had was a check whose matching was looser than its sentence, and every one of
// them PASSED on the exact case it existed to catch — which is the only way a
// checker can fail that matters, because green is what people read.
//
//   "loop.js has no round cap"        → an IDENTIFIER. Substring matched the name
//                                       inside a quoted refusal list.
//   "this status is documented"       → a WHOLE WORD. `includes('BUDGET')` is
//                                       satisfied by "BUDGETX".
//   "this disclosure is present"      → LIVE CODE. Against raw source, commenting
//                                       it out passes.
//   "this schema field is read"       → the CALL SITE. File-wide, one schema's
//                                       `evidence` covered another's.
//   "this argument is documented"     → the ARGUMENT TABLE. Any-table matched a
//                                       verdict-field row.
//   "this directory is inventoried"   → BOUNDED. `docs/` is inside `mydocs/`.
//
// The dividing line: a long distinctive phrase can be matched loosely, because
// collision is implausible. A NAME cannot — names nest inside other names and
// inside ordinary prose. If your needle is short and name-shaped, bound it.
//
// And when you add one: break the thing it checks and watch it fail. A guard that
// has never been seen to fail is a guard nobody has tested. `scripts/mutate.mjs`
// does this without the three mistakes doing it by hand kept producing.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKILLDIR = join(ROOT, 'skills', 'gauntlet-loop')
const loop = readFileSync(join(SKILLDIR, 'loop.js'), 'utf8')

// Comment-stripped source, defined here because nearly every scan below needs it.
// A string that survives only inside a comment is not code and is not a prompt:
// commenting out the only spawn of an agent type left that type looking spawned,
// so an orphaned definition passed. Same shape as issue #16.
function stripLineComments(src) {
  return src.split('\n').map(line => {
    const idx = line.indexOf('//')
    return idx === -1 ? line : line.slice(0, idx)
  }).join('\n')
}

const loopCode = stripLineComments(loop)

// The stripper is a HEURISTIC: it cuts at the first `//` on a line, which also
// truncates a regex literal like /^\/\// — line 216 of loop.js loses its second
// half this way. Nothing pinned currently lives on such a line, and this asserts
// that stays true. Without it, a needle added to a line containing `//` would
// vanish from the stripped source and every check below would report it as
// "removed or left in a comment" — the wrong diagnosis, sending someone to look
// for a deletion that never happened.
function assertStripperKept(needles, where) {
  for (const n of needles) {
    if (loop.includes(n) && !loopCode.includes(n)) {
      fail(`"${n}" (${where}) is in loop.js but disappears when comments are stripped — it sits on a line containing "//", so the scans below cannot see it. Move it to its own line; this is a limit of the stripper, not a missing disclosure.`)
    }
  }
}


// The three agent types loop.js spawns. Each entry quotes the claim in the run's
// `enforced` list that goes false if the tool comes back.
const ALLOWLIST = [
  { agent: 'gauntlet-ab-critic', forbidden: ['Write', 'Edit', 'Agent', 'ListAgents', 'SendMessage'], buys: 'is claimed to have "no Write or Edit — it could not use those TOOLS to alter either artifact", and to be unable to reach the builder or another critic' },
  { agent: 'gauntlet-builder', forbidden: ['Agent', 'ListAgents', 'SendMessage'], buys: 'is claimed to be an agent type "with no Agent/ListAgents/SendMessage — it could not reach or spawn a critic"' },
  { agent: 'gauntlet-goal-check', forbidden: ['Write', 'Edit', 'Agent', 'ListAgents', 'SendMessage'], buys: 'is the only party that never sees both sides — it reports whether the reference attempts the goal at all, and cannot be swayed by what the candidate is good at' },
  { agent: 'gauntlet-lead', forbidden: ['Write', 'Edit', 'Agent', 'ListAgents', 'SendMessage'], buys: 'divides the goal but cannot build, judge, or spawn either party' },
  { agent: 'gauntlet-breaker', forbidden: ['Read', 'Grep', 'Glob', 'Agent', 'ListAgents', 'SendMessage', 'WebSearch', 'WebFetch', 'Write', 'Edit'], buys: 'is claimed to be an agent type "whose whole tool allowlist is Bash and which never saw the goal, either artifact, or any verdict"' },
]

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }

// Every agentType loop.js actually spawns must have a definition file AND an
// entry above. ALLOWLIST is hand-written, so without this the two drift the
// moment someone adds a spawn: the new type gets no tool assertion, and if its
// file is missing the loop calls an agent that does not exist.
//
// What this CANNOT check, and it cost a 40-minute run to learn: a file on disk
// is not a registered agent. Types are registered when the session loads the
// plugin, so one added mid-session does not exist yet, and issue #14 means the
// loop cannot tell that from an agent that returned nothing. A green result here
// means the definition is present, not that a running session can spawn it.
// And the reverse: a definition nothing spawns is dead weight that still reads as
// part of the instrument. One was created and orphaned in a single session here —
// written, pointed at, then repointed away — and only noticed by hand.
console.log('drift-guard: every agent definition is actually spawned by loop.js')
{
  const defined = readdirSync(join(ROOT, 'agents')).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''))
  const spawnedNames = new Set([...loopCode.matchAll(/agentType:\s*'gauntlet-loop:([a-z-]+)'/g)].map(m => m[1]))
  for (const d of defined) {
    if (!spawnedNames.has(d)) {
      fail(`agents/${d}.md exists and loop.js never spawns it — an orphaned agent definition reads as part of the instrument while doing nothing. Delete it, or spawn it.`)
    }
  }
}

// SAYS WHAT IT CANNOT SEE. Registration happens when the session loads the plugin;
// nothing static observes it, so a green line here is not evidence the types are
// live. That gap is issue #14, and a run resolves what it can at runtime by
// recording which types actually returned something.
console.log('drift-guard: every agentType loop.js spawns has a definition FILE and a tool assertion (a file on disk is not a registered agent — see #14)')
const spawned = [...new Set([...loopCode.matchAll(/agentType:\s*'gauntlet-loop:([a-z-]+)'/g)].map(m => m[1]))].sort()
if (!spawned.length) fail('no agentType strings found in loop.js — the scan pattern has drifted from the code')
for (const name of spawned) {
  let def = null
  try {
    def = readFileSync(join(ROOT, 'agents', `${name}.md`), 'utf8')
  } catch {
    fail(`loop.js spawns "${name}" but agents/${name}.md does not exist — that call returns nothing at runtime, and per #14 the loop reports it as an agent that stayed silent`)
  }
  // The plugin registers an agent under the name DECLARED IN ITS FRONTMATTER, not
  // under its filename. loop.js spawns by the filename-shaped type, so a rename on
  // either side alone gives file-present-but-type-missing: the guard above passes
  // and the runtime says "agent type not found". That is exactly how a probe
  // failed silently on a live run this session.
  if (def) {
    const declared = (def.match(/^name:\s*(.+)$/m) || [])[1]
    if (!declared) fail(`agents/${name}.md has no name: in its frontmatter — nothing registers it, so loop.js spawning "${name}" finds no such type`)
    else if (declared.trim() !== name) {
      fail(`agents/${name}.md declares name: "${declared.trim()}" but loop.js spawns "${name}" — the plugin registers the declared name, so that spawn resolves to no agent and the loop reports it as one that returned nothing`)
    }
  }
  if (!ALLOWLIST.some(a => a.agent === name)) {
    fail(`loop.js spawns "${name}" and no ALLOWLIST entry asserts its tools — whatever the verdict claims that agent cannot do is unchecked`)
  }
}

console.log('drift-guard: agent allowlists still deny what the verdict claims they deny')
for (const a of ALLOWLIST) {
  let text
  try {
    text = readFileSync(join(ROOT, 'agents', `${a.agent}.md`), 'utf8')
  } catch {
    fail(`${a.agent}.md is missing — loop.js names it as an agentType`)
    continue
  }
  const m = text.match(/^tools:\s*(.+)$/m)
  if (!m) { fail(`${a.agent}.md has no tools: line — an unrestricted agent enforces nothing`); continue }
  const granted = m[1].split(',').map(t => t.trim()).filter(Boolean)
  for (const bad of a.forbidden) {
    if (granted.includes(bad)) fail(`${a.agent} was granted "${bad}" — it ${a.buys}, and that property is now only a promise`)
  }
}

// Every repo-relative path a LIVE file cites must exist. Deleting a file does not
// delete the sentences that name it, and a citation a reader cannot open is the
// same defect whether it points at a deleted module or a renamed one.
//
// Three instances of exactly this shipped on this branch: `docs/README.md` cited
// `skills/gauntlet-loop/critic-prompt.md` as the live authority for its own rule
// after that file was deleted, and two scripts cited "gate 7" of a sequence that
// no longer exists. Grep found them only because someone went looking.
//
// Only paths containing a slash are checked — a bare `doc-1.md` in prose is an
// illustrative name, not a citation.
//
// EXEMPTIONS, and why each was verified rather than assumed. An exemption is a
// claim like any other: the root README's inventory check once skipped `docs/` on
// the assumption it was mentioned, and it was not — the run records, the only
// evidence here about whether the method works, went unlinked from the front page.
//
//   * docs/ and runs/ — these describe what the repo WAS. Checked: every
//     unresolvable citation in them sits in a "what used to be here" or "was
//     deleted on branch drop-judge-lane" sentence. Naming a deleted path while
//     saying it is deleted is correct, and rewriting it would falsify the record.
//   * test/ — same shape: drift-guard.mjs cites critic-prompt.md inside a comment
//     explaining the bug where a live file cited it after deletion. A test that
//     cited a MOVED path would fail on execution anyway, which is a stronger check
//     than this one.
//
// The distinction this scan cannot make is live-reference versus named-as-deleted,
// which is why the exemption is per file rather than per citation.
const LIVE_SURFACES = [
  'README.md',
  ...readdirSync(join(ROOT, 'commands')).filter(f => f.endsWith('.md')).map(f => join('commands', f)),
  ...readdirSync(SKILLDIR).map(f => join('skills', 'gauntlet-loop', f)),
  ...readdirSync(join(ROOT, 'scripts')).filter(f => f.endsWith('.mjs')).map(f => join('scripts', f)),
  ...readdirSync(join(ROOT, 'agents')).filter(f => f.endsWith('.md')).map(f => join('agents', f)),
]

// A test that feeds a field the loop never reads is VACUOUS: it passes because
// its input never arrived, not because the behaviour holds. This repo's most
// repeated defect — `dependencies:` where PIECE_SCHEMA says `depends_on:` looked
// exactly like a working dependency test, and the graph it was asserting about
// was empty. The allowed set is DERIVED from PIECE_SCHEMA so it cannot drift from
// what the loop actually accepts.
console.log('drift-guard: piece stubs in tests only use fields PIECE_SCHEMA defines')
{
  const seg = loop.slice(loop.indexOf('PIECE_SCHEMA'), loop.indexOf('PIECE_SCHEMA') + 3000)
  const allowed = new Set([...seg.matchAll(/^\s{8,}([a-z_]+): \{ type:/gm)].map(m => m[1]))
  if (!allowed.size) fail('no piece fields found in PIECE_SCHEMA — this scan has drifted from the schema')
  const tests = readFileSync(join(ROOT, 'test', 'loop.test.mjs'), 'utf8')
  for (const lit of tests.match(/\{ name: [^}]*\}/g) || []) {
    for (const f of new Set([...lit.matchAll(/([a-z_]+):/g)].map(m => m[1]))) {
      if (!allowed.has(f)) {
        fail(`a test piece stub sets "${f}", which PIECE_SCHEMA does not define — the loop never reads it, so whatever that test asserts is not being exercised`)
      }
    }
  }
}

// `enforced` claims the critic "was never TOLD which artifact was the candidate —
// sides alternate by round parity and the prompt never uses the word 'candidate'".
// The second half is a fact about a specific string, so it is checkable, and a
// verdict that asserts a property the prompt has quietly lost is this repo's
// disqualifying class. The blind A/B is the whole mechanism; the word that gives
// it away is one careless edit from appearing.
console.log("drift-guard: the critic prompt never uses the word 'candidate'")
{
  const i = loop.indexOf('function criticPrompt(')
  if (i === -1) fail('criticPrompt not found in loop.js — this scan has drifted from the code')
  else {
    const rest = loop.slice(i)
    const end = rest.indexOf('\n}')
    const body = end === -1 ? rest : rest.slice(0, end)
    const hit = /candidate/i.exec(body)
    if (hit) {
      const line = body.slice(0, hit.index).split('\n').length
      fail(`criticPrompt contains "candidate" (about line ${line} of the function) — the enforced list claims the prompt never uses that word, and a critic told which side is which is not judging blind`)
    }
  }
}

// `enforced` claims the builder "was handed the gap STRING and nothing else from
// the verdict — the critic's `why` field is not forwarded". loop.js explains at
// length why: `why` is in practice a LIST of differences, so forwarding it hands
// the builder a menu of other things to fix under four lines insisting it fix one,
// and a round that changes five things makes the next verdict uninterpretable.
// That was issue #11. It is one interpolation away from coming back, and nothing
// would notice, because the run would still finish and still print the claim.
console.log('drift-guard: the build prompt carries the gap and nothing else from the verdict')
{
  // Every agent call goes through the `spawn()` wrapper (issue #14), which records
  // which types have proven themselves live. Matching the wrapper rather than
  // `agent(` is the precise form: a direct call would BYPASS that recording.
  const i = loop.indexOf('const built = await spawn(')
  if (i === -1) fail('the builder dispatch was not found in loop.js — this scan has drifted from the code')
  else {
    const body = loop.slice(i, loop.indexOf('agentType:', i))
    const interpolated = [...body.matchAll(/\$\{([^}]+)\}/g)].map(m => m[1].trim())
    const fromVerdict = interpolated.filter(x => /^(primary|verdict|entry|v)\./.test(x))
    for (const x of fromVerdict) {
      if (x !== 'primary.gap') {
        fail(`the build prompt interpolates ${x} — the enforced list claims the builder gets the gap and nothing else from the verdict, and every extra field is a second, unbounded gap channel aimed at the one control this loop has (issue #11)`)
      }
    }
    if (!interpolated.includes('primary.gap')) {
      fail('the build prompt no longer interpolates primary.gap — the builder is being told to fix a gap it was never given')
    }
  }
}

// Two more `enforced` claims that are facts about specific structures, and so are
// checkable rather than merely stated.
console.log('drift-guard: the gap slot is schema-required, and the breaker sees only the token')
{
  // "one gap SLOT is required per round by the schema (AB_SCHEMA.gap is in `required`)"
  const ab = loop.slice(loop.indexOf('const AB_SCHEMA'), loop.indexOf('const AB_SCHEMA') + 1200)
  const req = (ab.match(/required: \[([^\]]*)\]/) || [])[1] || ''
  if (!/'gap'/.test(req)) {
    fail("AB_SCHEMA no longer requires 'gap', and the enforced list claims the critic cannot omit one — a round with no gap gives the builder nothing to fix and the loop nothing to iterate on")
  }

  // "...by an agent type whose whole tool allowlist is Bash and which never saw
  // the goal, either artifact, or any verdict". The breaker is the cancel path; a
  // breaker that can see an artifact could leak which side is which, and one that
  // sees a verdict could have opinions about whether the run should continue.
  const i = loop.indexOf('async function tokenPresent(')
  if (i === -1) fail('tokenPresent not found in loop.js — this scan has drifted from the code')
  else {
    const body = loop.slice(i, loop.indexOf('agentType:', i))
    for (const forbidden of ['GOAL', 'CANDIDATE', 'REFERENCE', 'PC', 'PR']) {
      if (new RegExp(`\\$\\{${forbidden}[.}]`).test(body)) {
        fail(`the breaker prompt interpolates \${${forbidden}} — the enforced list claims it never saw the goal, either artifact, or any verdict, and a breaker that can see an artifact can leak which side is which`)
      }
    }
  }
}

// Every outcome status the loop can EMIT must be documented where an operator
// reads. SPLIT_UNSOUND shipped undocumented, and BUDGET and ERROR were never
// documented at all — so a run could end in a state whose name appears nowhere the
// person reading the verdict would look. Derived from the code, so adding a status
// and forgetting to explain it fails here rather than in front of an operator.
console.log('drift-guard: every outcome status the loop emits is documented')
{
  const statuses = [...new Set([...loop.matchAll(/status: '([A-Z_]+)'/g)].map(m => m[1]))]
  if (!statuses.length) fail('no outcome statuses found in loop.js — this scan has drifted from the code')
  const docs = ['README.md', join('skills', 'gauntlet-loop', 'SKILL.md'), join('commands', 'loop.md')]
    .map(f => { try { return readFileSync(join(ROOT, f), 'utf8') } catch { return '' } }).join('\n')
  for (const st of statuses) {
    // Matched as a WORD, not a substring. `docs.includes('BUDGET')` is satisfied by
    // "BUDGETX", so renaming the documented entry still passed — the same
    // substring-for-token mistake that once disabled the round-cap tripwire.
    if (!new RegExp(`\\b${st}\\b`).test(docs)) {
      fail(`loop.js can end a run with status "${st}" and no operator-facing doc mentions it — a verdict naming a state the reader cannot look up`)
    }
  }
}

// Every field a schema DEMANDS must be read somewhere, or be listed below as
// deliberately dropped with a reason. A schema field is a thing the loop makes an
// agent produce on every call: unread, it is wasted work and — worse — silently
// lost signal. Two shipped that way. `failed` ("anything you tried that did not
// work") was collected every round and thrown away, so a dead end could repeat
// with nothing in the verdict showing it. `evidence` ("the command plus its
// literal output") was demanded of both probes and never read, leaving the
// verdict asserting a cancel and a byte count with the proof discarded.
//
// Read means read off a RESULT — `probe.evidence`, `built.failed`. The field name
// appearing in prompt text does not count, which is exactly the mistake an ad-hoc
// version of this check made: it reported everything as used.
const DELIBERATELY_UNREAD = {
  // 'SCHEMA_NAME.field': 'why it is collected but not used',
}

console.log('drift-guard: every schema field the loop demands is read somewhere')
{
  const schemas = [...loopCode.matchAll(/const ([A-Z_]+_SCHEMA) = \{/g)].map(m => m[1])
  if (!schemas.length) fail('no schemas found in loop.js — this scan has drifted from the code')
  for (const name of schemas) {
    const start = loopCode.indexOf(`const ${name} = {`)
    const end = loopCode.indexOf('\n}', start)
    const block = loopCode.slice(start, end)
    const outside = loopCode.slice(0, start) + loopCode.slice(end)
    for (const f of [...block.matchAll(/^\s{4}([a-z_]+): \{ type:/gm)].map(m => m[1])) {
      if (DELIBERATELY_UNREAD[`${name}.${f}`]) continue
      // Scoped to the call sites that USE this schema, not the whole file. Two
      // schemas both demand `evidence`; a file-wide search saw the breaker reading
      // its own and reported the size probe's as read too. A guard whose matching
      // is looser than its claim reports success for the case it exists to catch.
      const sites = [...loopCode.matchAll(new RegExp(`schema: ${name}\\b`, 'g'))].map(m => m.index)
      if (!sites.length) fail(`${name} is defined and never used in a spawn() call`)
      // FORWARD from the call site only. A result is read after the call that
      // produces it, and a window reaching backwards spanned the neighbouring
      // probe — which reads its own `evidence` — so the size probe's dropped field
      // still looked read. Adjacent functions are why this has to be directional.
      const windows = sites.map(i => loopCode.slice(i, i + 1200)).join('\n')
      if (!new RegExp(`\\.${f}\\b`).test(windows)) {
        fail(`${name} demands "${f}" and nothing reads it — every call makes an agent produce that field and the loop drops it. Read it, remove it from the schema, or record it in DELIBERATELY_UNREAD with a reason.`)
      }
    }
  }
}

// The network disclosure and the tool grants have to agree. If someone removes
// WebSearch/WebFetch from the critic and builder — a real narrowing, and the right
// one if nobody needs them — the disclosure becomes false in the other direction,
// telling an operator the run is weaker than it is. Both halves are derived.
console.log('drift-guard: the network disclosure matches who can actually reach the network')
{
  const netAgents = ['gauntlet-ab-critic', 'gauntlet-builder'].filter(a => {
    try {
      const t = (readFileSync(join(ROOT, 'agents', `${a}.md`), 'utf8').match(/^tools:\s*(.+)$/m) || [])[1] || ''
      return /WebSearch|WebFetch/.test(t)
    } catch { return false }
  })
  const discloses = loopCode.includes('THE BLINDNESS PROBE MODELS THE FILESYSTEM ONLY')
  if (netAgents.length && !discloses) {
    fail(`${netAgents.join(' and ')} can reach the network and no disclosure says so — the blindness probe searches this disk only, so a "clean" result would read as broader than it is`)
  }
  if (!netAgents.length && discloses) {
    fail('the verdict discloses a network channel that no agent still holds — an operator reading it would discount a run that is actually tighter than described')
  }
  // PER AGENT, not "somebody has it". The disclosure names the critic and the
  // builder; if only one loses the tools it becomes half false, and an "any agent
  // still has network" check passes right through that.
  if (discloses) {
    const namedInDisclosure = { 'gauntlet-ab-critic': /critic and builder/.test(loopCode), 'gauntlet-builder': /critic and builder/.test(loopCode) }
    for (const a of ['gauntlet-ab-critic', 'gauntlet-builder']) {
      const has = netAgents.includes(a)
      if (namedInDisclosure[a] && !has) {
        fail(`the disclosure says the critic and builder both hold WebSearch/WebFetch, but ${a}.md no longer grants them — the sentence is now half wrong, and the half that is still true is the one an operator would discount`)
      }
    }
  }
}

// The mirror of the citation check: a README that INVENTORIES a directory must
// name everything in it. A citation to a missing path misleads a reader who
// follows it; an omission misleads one who trusts the list. Both shipped —
// README.md named one of four scripts, and docs/README.md named one of its two
// subdirectories, leaving a whole plans folder invisible to anyone reading it.
console.log('drift-guard: README inventories name everything actually present')
{
  const inventories = [
    { readme: 'README.md', dir: '.', skip: new Set(['node_modules']) },
    { readme: join('docs', 'README.md'), dir: 'docs', skip: new Set() },
  ]
  for (const { readme, dir, skip } of inventories) {
    let text
    try { text = readFileSync(join(ROOT, readme), 'utf8') } catch { continue }
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || skip.has(entry.name)) continue
      // Bounded so a longer name cannot satisfy a shorter one: a README that
      // mentions `mydocs/` would otherwise count as naming `docs/`. Same
      // substring-for-token defect that has already hidden gaps in four other
      // scans here.
      if (!new RegExp(`(^|[^A-Za-z0-9_-])${entry.name}/`).test(text)) {
        fail(`${dir}/${entry.name}/ exists and ${readme} never mentions it — an inventory that omits a directory misleads the reader who trusts it`)
      }
    }
  }
}

// Every line a suite prints as a pass must have an assertion behind it. A case
// that logs "OK" with nothing asserted between it and the previous one is a case
// that ran no check, and the count it inflates is the number everyone reads. This
// repo's most repeated defect is a figure that says more than it can support —
// verdicts recorded, critic spawns, token checks — and the suite's own pass count
// was the last one still unguarded: a skip branch ended its message with OK, so on
// a machine where that case could not run the total stayed the same.
console.log('drift-guard: every reported test case has an assertion behind it')
{
  for (const f of readdirSync(join(ROOT, 'test')).filter(x => x.endsWith('.test.mjs'))) {
    const lines = readFileSync(join(ROOT, 'test', f), 'utf8').split('\n')
    let prev = 0
    lines.forEach((line, i) => {
      if (!/console\.log\(['"`].*OK/.test(line)) return
      // COMMENTS ARE STRIPPED FIRST. Without this the scan counted an `eq(` written
      // inside a comment as an assertion — test/corpus-portability.test.mjs passed
      // this very check on the strength of the sentence "oracle.test.mjs:371 asserts
      // `eq(r.code, 1)`", which asserts nothing. A guard against a figure that says
      // more than it can support was itself satisfied by prose, which is the same
      // defect one level up. Same fix as 65fc73f made in containment.
      const between = stripLineComments(lines.slice(prev, i).join('\n'))
      if (!/\b(ok|eq|fail)\(/.test(between)) {
        fail(`test/${f}:${i + 1} reports a passing case with no assertion between it and the previous one — it inflates the count with a check that never ran`)
      }
      prev = i
    })
  }
}

// Every field the verdict CARRIES must be explained where an operator reads. The
// verdict is the loop's entire output and eight of its eighteen fields were
// documented nowhere — someone reading `position_balance` or `goal_fitted` had to
// open loop.js to learn what they meant. Derived from the returned object, so a
// new field cannot ship unexplained.
console.log('drift-guard: every verdict field is explained in the docs')
{
  const ret = loopCode.lastIndexOf('\nreturn {')
  if (ret === -1) fail('the verdict object was not found in loop.js — this scan has drifted from the code')
  else {
    // SHORTHAND COUNTS. This required a COLON, so a field written as the ES6
    // shorthand `comparability,` was invisible to the scan and the guard reported
    // every field documented while never having seen one of them. Found by adding
    // a field in shorthand form and noticing the guard stayed silent when it had
    // just failed for a field added with a colon. A guard reporting success while
    // guarding nothing is the failure this file exists to prevent, and that has
    // now happened here twice.
    const fields = [...new Set([...loopCode.slice(ret).matchAll(/^  ([a-z_]+)[,:]/gm)].map(m => m[1]))]
    const docs = ['README.md', join('skills', 'gauntlet-loop', 'SKILL.md'), join('commands', 'loop.md')]
      .map(f => { try { return readFileSync(join(ROOT, f), 'utf8') } catch { return '' } }).join('\n')
    // Matched as a BACKTICKED TOKEN, not a substring. Fields are named `rounds`,
    // `goal`, `history` — words the prose uses constantly — so a substring check
    // passes for a field documented nowhere. Same defect as the argument table
    // scan above, in the guard written to replace it.
    for (const f of fields) {
      if (!new RegExp('`' + f + '`').test(docs)) {
        fail(`the verdict carries "${f}" and no operator-facing doc names it — a field nobody can look up is a field nobody reads`)
      }
    }
  }
}

// THE TOKEN'S HOME IS AGREED BY THREE FILES OR IT IS AGREED BY NONE.
//
// `commands/loop.md` WRITES the run token, `commands/cancel-loop.md` LOOKS for it,
// and `scripts/seed-loop-trial.mjs` SEARCHES there for leaked answers. All three
// used a hardcoded /tmp, which agreed by accident rather than by construction.
// Resolve the root in one of them and not the others and the circuit breaker stops
// working SILENTLY: the token lands somewhere the cancel command never lists, so
// cancel reports "No gauntlet loop token found" while the run keeps going.
//
// Matched as the whole chain, not as "TMPDIR". A file that fell back to a shorter
// form — `${TMPDIR:-/tmp}` — resolves differently from the others on a machine
// where only TEMP is set, which is exactly the machine this change exists for.
console.log('drift-guard: the token root is resolved the same way everywhere it is used')
{
  const SH_CHAIN = '${TMPDIR:-${TMP:-${TEMP:-/tmp}}}'
  const JS_CHAIN = "process.env.TMPDIR || process.env.TMP || process.env.TEMP || '/tmp'"
  const users = [
    { file: join('commands', 'loop.md'), needle: SH_CHAIN, does: 'writes the run token' },
    { file: join('commands', 'cancel-loop.md'), needle: SH_CHAIN, does: 'lists tokens to cancel one' },
    { file: join('scripts', 'seed-loop-trial.mjs'), needle: JS_CHAIN, does: 'searches there for a leaked answer' },
  ]
  for (const u of users) {
    let text = ''
    try { text = readFileSync(join(ROOT, u.file), 'utf8') } catch { fail(`${u.file} could not be read, and it ${u.does}`); continue }
    if (!text.includes(u.needle)) {
      fail(`${u.file} ${u.does}, but does not resolve the temp root through the full chain. All three must agree; a token written where the cancel command does not look is a circuit breaker that silently does nothing.`)
    }
    if (/["'\s]\/tmp\/gauntlet-loop/.test(text)) {
      fail(`${u.file} still hardcodes /tmp/gauntlet-loop somewhere. That agrees with the others only by accident, and stops agreeing on any machine where the temp root is elsewhere.`)
    }
  }
}

// THE TYPE NAMES THE #14 FIX ASKS ABOUT MUST BE TYPES THE SCRIPT ACTUALLY SPAWNS.
//
// `typeProven(t)` and `silenceNote(t)` decide whether an empty result is blamed on
// the agent or reported as possibly-a-missing-type. Both take a hand-written string.
// A string that matches no spawned type can never be recorded, so `typeProven`
// returns false forever and the loop permanently reports the ambiguity it was built
// to resolve — while looking cautious and passing every test that only checks the
// unproven branch.
//
// That is this fix's own failure mode: a hand-written name duplicating something
// derivable. BOTH sides are derived here — the names asked about, and the names
// spawned — so neither is a list anyone maintains.
console.log('drift-guard: every agent type the silence check asks about is one the script spawns')
{
  const spawned = new Set([...loopCode.matchAll(/agentType:\s*'([^']+)'/g)].map(m => m[1]))
  const asked = [...loopCode.matchAll(/(?:typeProven|silenceNote)\(\s*'([^']+)'/g)].map(m => m[1])
  if (!spawned.size) fail('no agentType literals were found in loop.js — this scan has drifted from the code')
  if (!asked.length) fail('nothing asks typeProven/silenceNote about any agent type — the #14 disambiguation is present but unused, which reads as fixed and is not')
  for (const t of new Set(asked)) {
    if (!spawned.has(t)) {
      fail(`the silence check asks about "${t}", which loop.js never spawns. That name can never be recorded, so it is permanently unproven: every empty result from it would be reported as "possibly a missing agent type" forever. Spawned types are: ${[...spawned].sort().join(', ')}`)
    }
  }
}

// THE ORACLE REPORT'S DISCLOSURES, pinned the same way loop.js's are.
//
// These sentences are what stops a number being read as more than it is: that the
// corpus is whoever built it chose, that one draw per row is not stability, that the
// classification rule is one rule but the coverage is only the corpus. They are cheap
// to delete and they get cheaper to delete exactly as the numbers start looking good,
// which is when they matter most.
//
// Checked against RAW SOURCE, so commenting one out fails too — the same rule the
// loop.js disclosure scan learned. Matched on a distinctive phrase rather than a
// name-shaped needle, because these are long sentences and collision is implausible.
console.log('drift-guard: the oracle report still discloses what it cannot establish')
{
  const ORACLE_DISCLOSURES = [
    // Deleting this makes a corpus of six rows read as a sample of the world.
    'Selection bias is not corrected',
    // Deleting this makes one observation per row read as a measured accuracy.
    'Answer stability',
    // Deleting this lets "one rule" be heard as "covers everything".
    'which artifacts were put in',
    // The refusal itself. Without it the tool prints a rate at any n.
    'CANNOT BE POSED',
    // The independence assumption behind the derived per-run figure, which is not
    // measured anywhere and is probably false — same model, same run.
    'ASSUMING the two sides fail independently',
    // The distinct-artifact count. Without it, one artifact measured twice reads as n=2 —
    // the error the #33 investigation made in its own write-up.
    'distinct artifacts',
  ]
  const reportPath = join(ROOT, 'scripts', 'oracle-report.mjs')
  let report = ''
  try { report = readFileSync(reportPath, 'utf8') } catch { fail('scripts/oracle-report.mjs could not be read, and it is the file that states what the oracle cannot establish') }
  for (const d of ORACLE_DISCLOSURES) {
    if (report && !report.includes(d)) {
      fail(`scripts/oracle-report.mjs no longer says "${d}". That sentence is what keeps a small-sample number from being read as a measurement, and it is easiest to drop exactly when the numbers look good.`)
    }
  }
}

console.log('drift-guard: every repo-relative path cited in a live file still exists')
for (const rel of LIVE_SURFACES) {
  let text
  try { text = readFileSync(join(ROOT, rel), 'utf8') } catch { continue }
  const cited = new Set([...text.matchAll(/`([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+\.(?:md|js|mjs|jsonl))`/g)].map(m => m[1]))
  for (const c of cited) {
    if (c.startsWith('http') || c.startsWith('~') || c.startsWith('/')) continue
    if (!existsSync(join(ROOT, c))) {
      fail(`${rel} cites \`${c}\` and that path does not exist — a reader following it finds nothing`)
    }
  }
}

// loop.js is a second Workflow script under the same runtime constraints as
// the Workflow runtime's constraints (no import/require, no filesystem, no Node
// APIs; Date.now(),
// Math.random() and argless new Date() THROW in the real runtime). Nothing
// previously guarded it. This is a static scan, not execution — the offline
// harness in test/harness.mjs runs scripts via AsyncFunction, which happily
// executes these calls, so a passing test there is not evidence they are
// runtime-safe. Comments are stripped first: loop.js legitimately DISCUSSES
// Math.random() in prose (explaining why alternation replaces it), and that
// mention must not itself trip the guard.

const RUNTIME_FORBIDDEN = ['import ', 'require(', 'Date.now', 'Math.random', 'new Date()']

console.log('drift-guard: loop.js runtime-safety scan (no import/require/Date.now/Math.random/new Date())')
for (const forbidden of RUNTIME_FORBIDDEN) {
  if (loopCode.includes(forbidden)) fail(`loop.js contains "${forbidden}" outside a comment — this throws in the real Workflow runtime`)
}

// NO ROUND CAP. The primary source contains no round language at all — its
// stop clauses are "it should keep going", "Don't stop until…" and "/loop until
// it's utterly perfect" — and the meta-prompt forbids the parameter by name:
// "Do not prescribe the architecture, exact decomposition, or a fixed number of
// rounds." A cap is the easiest thing in this file to reintroduce, because it
// makes tests terminate and makes runs feel safe, and it would be the one
// change that quietly turns the loop back into a bounded pipeline.
//
// This scans STRIPPED source, so the comments that explain the absence do not
// trip it. It cannot catch every possible cap — someone determined could write
// `if (round > n) break` with a computed n — so it is a tripwire on the known
// names, not a proof. The behavioural proof is in test/loop.test.mjs, where an
// unbounded run must run past the old default until the harness stops it.
// Every argument loop.js READS must be documented, and everything documented must
// be read. An undocumented argument is one an operator cannot know to pass; a
// documented one the loop ignores is worse, because they will pass it and believe
// it took effect — which is precisely how a silently-ignored round cap would have
// left someone thinking their run was bounded. Both sides are derived, so neither
// list can drift.
console.log('drift-guard: args loop.js reads and args SKILL.md documents are the same set')
{
  // UNDERSCORES COUNT. This pattern was /([a-z][a-zA-Z]*)/ and read `args.on_refusal`
  // as `args.on` — so it demanded documentation for an argument that does not exist
  // while never checking the one that does, and `on` documented in the table would
  // have satisfied it. Found by adding the first underscored argument, which is the
  // only way a naming assumption ever surfaces.
  const read = new Set([...loopCode.matchAll(/\bargs\.([a-z][a-zA-Z_]*)/g)].map(m => m[1]))
  const skill = readFileSync(join(SKILLDIR, 'SKILL.md'), 'utf8')
  // Scoped to the ARGUMENT table, not every table in the file. SKILL.md also
  // carries a verdict-field table in the same shape, and a file-wide row scan read
  // `enforced` as a documented argument — the guard claiming "documented
  // arguments" while matching "any backticked first cell". The table is bounded by
  // its `goal` row and the next blank line.
  const argTableStart = skill.indexOf('| `goal` |')
  const argTable = argTableStart === -1 ? '' : skill.slice(argTableStart, skill.indexOf('\n\n', argTableStart))
  if (!argTable) fail('the argument table was not found in SKILL.md — this scan has drifted from the doc')
  const documented = new Set([...argTable.matchAll(/^\| `([a-z][a-zA-Z_]*)` \|/gm)].map(m => m[1]))
  if (!read.size) fail('no args.* reads found in loop.js — this scan has drifted from the code')
  if (!documented.size) fail("no argument table found in SKILL.md — this scan has drifted from the doc")
  for (const a of read) {
    if (!documented.has(a)) fail(`loop.js reads args.${a} and SKILL.md's argument table does not list it — an operator cannot know to pass it`)
  }
  for (const a of documented) {
    if (!read.has(a)) fail(`SKILL.md documents args.${a} and loop.js never reads it — an operator will pass it and believe it took effect`)
  }
  // commands/loop.md carries the same fact a THIRD time, in the JSON block an
  // operator copies from. That is the surface most likely to be used verbatim, so
  // it is the one where a stale argument does the most damage.
  const cmd = readFileSync(join(ROOT, 'commands', 'loop.md'), 'utf8')
  // THE THIRD PARSER OF THE SAME NAMES, and the underscore fix had to be made in all
  // three. Two were repaired and this one was not, so the guard went from wrong-in-one
  // -direction to wrong-in-another: it now read the argument correctly out of loop.js
  // and still could not see it in the block an operator copies.
  const shown = new Set([...cmd.matchAll(/^\s*"([a-z][a-zA-Z_]*)":/gm)].map(m => m[1]))
  if (!shown.size) fail('no args JSON block found in commands/loop.md — this scan has drifted from the command')
  for (const a of shown) {
    if (!read.has(a)) fail(`commands/loop.md's args block shows "${a}" and loop.js never reads it — an operator copying that block passes a setting that does nothing`)
  }
  for (const a of read) {
    if (!shown.has(a)) fail(`loop.js reads args.${a} and commands/loop.md's args block omits it — the block is copied verbatim, so the argument is invisible to whoever uses it`)
  }
}

const CAP_NAMES = ['maxRounds', 'MAX_ROUNDS', 'HARD_CAP', 'ROUND_CAP', 'maxIterations']

// Matched as an IDENTIFIER, not as a substring. loop.js now REFUSES a cap
// argument by name — `for (const cap of ['maxRounds', ...])` — which is the
// opposite of having one, and a bare-substring scan cannot tell those apart.
// Quote-delimited occurrences are the refusal list; everything else (`const
// maxRounds`, `args.maxRounds`) is a real use and still trips this.
//
// An earlier attempt stripped all string literals first. That silently DISABLED
// the tripwire: loop.js is full of template literals containing apostrophes, so
// quote-pairing swallowed whole spans of code — including a planted cap. Caught
// only by mutating in a real cap and watching the guard stay quiet.
//
// Residue, unchanged: `args['maxRounds']` would evade this. It is a tripwire on
// known names, not a proof — the behavioural proof is the no-round-cap test.
const usedAsIdentifier = name => new RegExp(`(?<!['"\`])\\b${name}\\b(?!['"\`])`).test(loopCode)

console.log('drift-guard: loop.js has no round cap (the source forbids a fixed round count)')
for (const name of CAP_NAMES) {
  if (usedAsIdentifier(name)) {
    fail(`loop.js contains "${name}" outside a comment — the loop's terminators are a win, an operator cancel and a budget. A round cap is "the arbitrary final round" the source forbids.`)
  }
}

// ---------------------------------------------------------------------------
// loop.js carries its contract in TWO prompt surfaces: the standing agent
// definitions under agents/ (the system prompt each spawn is born with) and the
// round prompts rendered inside loop.js. Either can be edited without the other
// — a prompt duplicated across two surfaces drifts unless something pins it.
//
// Issue #16 is what the failure looks like: the source's one requirement on the
// judge — "a really harsh critic" — was present in loop.js only inside a comment
// quoting the source, while the live prompt asked for a neutral comparison. So
// the loop.js side is checked against COMMENT-STRIPPED source. A clause that
// survives only in a comment fails here, which is the point: a comment is not a
// prompt, and no agent ever reads one.
//
// Needles are per-file because the two surfaces legitimately differ in case and
// wording (a prompt shouts "BE A REALLY HARSH CRITIC"; a system prompt does not).
// ---------------------------------------------------------------------------
const LOOP_PINNED = [
  { loop: 'BE A REALLY HARSH CRITIC', agent: 'gauntlet-ab-critic', needle: 'really harsh critic',
    what: "the source's one requirement on the judge (\"That separate sub-agent should be a really harsh critic\")" },
  { loop: 'a tie is a critic declining to look closely enough', agent: 'gauntlet-ab-critic', needle: 'critic declining to look closely enough',
    what: 'the forced binary — no "they are comparable" exit' },
  { loop: 'the single largest thing', agent: 'gauntlet-ab-critic', needle: 'the single largest thing',
    what: 'ONE gap comes back, and it is the largest' },
  { loop: 'matte plastic under the same light', agent: 'gauntlet-ab-critic', needle: 'matte plastic under the same light',
    what: 'the concrete-enough-to-act-on example that defines what a gap must look like' },
  { loop: 'the next verdict uninterpretable', agent: 'gauntlet-builder', needle: 'the next verdict uninterpretable',
    what: 'the builder fixes exactly one gap, because a five-change round cannot be read' },
  { loop: 'Do not assess your own work', agent: 'gauntlet-builder', needle: 'grade your own work',
    what: 'the builder never judges what it just made — a fresh critic decides next round, and a builder that grades itself is the loop marking its own homework' },
  { loop: 'what would be inspected to judge it alone', agent: 'gauntlet-lead', needle: 'inspected to judge it',
    what: 'what makes a piece a piece — a named observable. Without it a "split" is topical, every piece can win, and the artifact as a whole is unjudged' },
  { loop: 'SPLIT_UNSOUND', agent: 'gauntlet-lead', needle: 'SPLIT_UNSOUND',
    what: "the one check standing behind the lead's judgement. The lead is told a bad split still gets through and that this catches only one shape of it — if the check goes and the prompt does not, the lead is being reassured about something that no longer runs" },
  { loop: 'breaker that cannot be read', agent: 'gauntlet-breaker', needle: 'breaker that cannot be read',
    what: 'the circuit breaker fails SAFE — an unreadable probe stops the run rather than continuing it' },
]

// Same rule as DISCLOSURES above, for loop.js: a residual that can be deleted
// without failing a test is not a disclosure.
const LOOP_DISCLOSURES = [
  'Nothing verifies that a harsh INSTRUCTION produced a harsh CRITIC',
  // REPOINTED when the measuring half of the ratchet landed. The disclosure changed
  // from "there is none" to "it is measured and not reverted", which is a different
  // claim, and the pin has to move with it or it guards a sentence nobody ships.
  'REGRESSIONS ARE MEASURED AND NOT REVERTED',
  // k>1 is ours, not the source's. Both primary texts say one critic per piece.
  // If this line goes, the verdict starts implying a precedent that does not
  // exist — which is the exact class this tracker files most.
  'ADDITION, not source fidelity',
  // Deleting the panel deleted the only calibration mechanism. If this line goes,
  // the plugin stops telling anyone that nothing checks its critics.
  'NO CALIBRATION ANYWHERE',
  // A builder that answers every absence by appending grows the artifact while
  // every round is locally correct. If this goes, nothing reports it. Pinned on
  // the stable half: the message names WHICH piece grew once a run is split, so
  // it can no longer say "THE ARTIFACT" — but the detector going away must still
  // fail here.
  'GREW EVERY ROUND',
  // The lead chooses what gets judged. A split that WON is now checked once more
  // against the whole artifact, and one that did not is still unverified — both
  // branches must survive, so both phrases are pinned.
  'THE SPLIT IS NOT CHECKED',
  'THE SPLIT IS CHECKED ONE WAY ONLY',
  // Content blindness: the run withholds its blindness claim when an artifact
  // gives away its origin. If this goes, a leaking run silently claims blindness.
  'NOT blind on content',
  // The blindness probe's criterion is the whole check. If this goes, the probe
  // silently reverts to pattern-matching for repo names and misses every other
  // way one artifact can stand apart from the other.
  'DIFFERENT relationship to this machine',
  'FIND THOSE ORIGINALS AND DIFF BOTH',
  // A goal fitted to the candidate cannot discriminate, and the first live run of
  // this build was decided by exactly that. Both halves of the residual are
  // pinned: the reference-side finding, and the candidate-side hole nothing checks.
  // Both goal probes read TEXT. Neither can see when the goal was written or by
  // whom, which is the failure that actually decided the first live run.
  'can see when the goal was written or by whom',
  'not independent judgments',
  // The judge and the judged are the same model. This is the deepest limitation
  // the method has — a critic cannot be counted on to catch the mistakes it would
  // make itself — and it is disclosed nowhere else.
  'Critic and builder share a model family',
  // Cancellation is the operator's only control in a loop with no round cap, so
  // what it does NOT do has to survive: removing the token stops the run at the
  // next round boundary, it does not abort an agent already in flight.
  'The breaker is checked at ROUND BOUNDARIES, not continuously',
  // The blindness probe searches this disk; two agents can reach the network. If
  // that disclosure goes while the tools remain, a `clean` probe result reads as
  // broader than it is — see the tool-grant check below, which pins the pair.
  'THE BLINDNESS PROBE MODELS THE FILESYSTEM ONLY',
]

console.log('drift-guard: loop.js round prompts pinned to the agent definitions they spawn')
for (const pin of LOOP_PINNED) {
  let text
  try {
    text = readFileSync(join(ROOT, 'agents', `${pin.agent}.md`), 'utf8')
  } catch {
    fail(`${pin.agent}.md is missing — loop.js names it as an agentType`)
    continue
  }
  const inLoop = loopCode.includes(pin.loop)
  const inAgent = text.includes(pin.needle)
  if (inLoop && inAgent) continue
  if (!inLoop && !inAgent) fail(`${pin.what}: gone from BOTH loop.js and ${pin.agent}.md`)
  else if (!inLoop) fail(`${pin.what}: ${pin.agent}.md still says "${pin.needle}", but loop.js has no LIVE "${pin.loop}" — if it is only in a comment now, no agent reads it`)
  else fail(`${pin.what}: loop.js still renders "${pin.loop}", but ${pin.agent}.md no longer says "${pin.needle}" — the standing prompt is stale`)
}

assertStripperKept(LOOP_DISCLOSURES, 'a pinned disclosure')
assertStripperKept(LOOP_PINNED.map(x => x.loop), 'a pinned prompt clause')

console.log('drift-guard: required disclosures present in loop.js')
for (const needle of LOOP_DISCLOSURES) {
  // COMMENT-STRIPPED, like the prompt-clause check beside it. Against the raw
  // source, commenting out a disclosure passes: the phrase is still in the file
  // and no longer in the verdict. That is issue #16's exact shape — a clause
  // surviving only as a comment while the live text loses it — in the guard
  // written to prevent it. Nobody reads a comment out of a not_enforced list.
  if (!loopCode.includes(needle)) fail(`"${needle}" — not present in LIVE loop.js code; a not_enforced disclosure was removed, reworded away, or left behind in a comment`)
}

// ---------------------------------------------------------------------------
// CROSS-LANE CONTRACT — the first check in this file whose subject is the
// RELATION between lanes rather than any one file.
//
// Everything above pins loop.js against its own agent definitions — one lane,
// checked against itself. This check is the other kind: it asks what the
// DIRECTORY contains and holds every comparer lane it finds to the same
// contract, including lanes that do not exist yet.
//
// That distinction was learned the expensive way. When this repo had two lanes,
// the same defect — a blind comparer losing its instruction not to reason about
// provenance — was caught in one lane and invisible in the other, because only
// one of them happened to have a paired prompt-authority file. Placement, not
// importance, decided whether anything noticed. A check that lists the lanes it
// guards reproduces that hole the moment a lane is added; a check that discovers
// them does not.
//
//   a LANE            = a .js in the skill dir that spawns agents
//   a BLIND COMPARER  = a lane declaring a side-naming field whose domain is a
//                       closed two-option enum. That is the structural signature
//                       of a forced binary choice and does not depend on the
//                       naming convention any particular lane uses.
//
// Checked against COMMENT-STRIPPED source, same rule as LOOP_PINNED: a clause
// surviving only in a comment reaches no agent.
const LANE_IS_COMPARER = /(winner|ours_side|side)\s*:\s*\{[^}]*enum:\s*\[\s*'[^']+'\s*,\s*'[^']+'\s*\]/

const COMPARER_CONTRACT = [
  { test: /provenance/i, what: 'tells its comparer not to reason about provenance — without it the blind A/B is blind in name only' },
  { test: /\btie\b/i, what: 'forces the choice, with no tie available — a tie is the "seems fine" exit this comparison exists to refuse' },
]

console.log('drift-guard: every blind-comparer lane carries the shared comparer contract')
const laneFiles = readdirSync(SKILLDIR).filter(f => f.endsWith('.js')).sort()
let comparerLanes = 0
for (const f of laneFiles) {
  const src = stripLineComments(readFileSync(join(SKILLDIR, f), 'utf8'))
  // What makes a file a LANE is that it dispatches typed agents, not the syntax it
  // dispatches them with. This matched `await agent(` and went silent the day those
  // calls moved behind a wrapper — the detector reported zero comparer lanes in a
  // directory containing one, which its own closing check caught. `agentType:` is
  // the property being relied on and survives any call-site refactor.
  if (!/agentType\s*:/.test(src)) continue             // not a lane: dispatches no typed agent
  if (!LANE_IS_COMPARER.test(src)) continue            // a lane, but runs no forced two-sided choice
  comparerLanes++
  for (const c of COMPARER_CONTRACT) {
    if (!c.test.test(src)) {
      fail(`${f} runs a blind two-sided comparison but no longer ${c.what}. This is a CROSS-LANE property: ` +
           'every comparing lane owes it, and a lane is covered here because it was discovered in the directory, not because it was listed.')
    }
  }
}
if (comparerLanes === 0) {
  fail('no blind-comparer lane was discovered in ' + SKILLDIR + ' — either both lanes lost their forced-choice schema, or the detector needs updating. A check that matches nothing cannot fail informatively.')
}

// The line of critics is a CONCURRENCY claim: k critics judging the same
// artifact must be spawned together, not walked one at a time. Sequential
// spawning would still pass every behavioural test in loop.test.mjs — the
// verdicts and the split would be identical — while quietly turning one round
// into k round-lengths of wall clock. So the claim is tied to something
// checkable rather than trusted, in the same style as the AT-map scan below.
console.log('drift-guard: loop.js escalates the critic line through parallel(), not a sequential walk')
if (!/await parallel\(/.test(loopCode)) {
  fail('loop.js no longer calls parallel() outside a comment — a line of k critics spawned sequentially costs k times the wall clock and nothing in the behavioural tests would notice')
}

if (failures) {
  console.error(`\ndrift-guard: ${failures} failure(s) — the script and its prompt authority have diverged.`)
  process.exit(1)
}
console.log(`\ndrift-guard: OK — ${LOOP_PINNED.length} prompt clauses pinned between loop.js and its agent definitions, ${comparerLanes} comparer lane(s) holding the cross-lane contract, ${ALLOWLIST.length} allowlists still denying, ${LOOP_DISCLOSURES.length} disclosure(s) present, loop.js clean of ${RUNTIME_FORBIDDEN.length} forbidden runtime APIs and ${CAP_NAMES.length} round-cap names.`)
