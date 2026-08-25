// Generate a FALSE anchor from a true one, mechanically.
//
//   node scripts/canary.mjs <file> <line> [--mode line-shift|word-swap] [--json]
//
// A verifier's specificity is only measured if something it should reject is
// put in front of it. Until now those were written by hand, by whoever knew how
// the verifier works — exactly the contamination the deleted gate sequence tried to
// avoid by keeping a seeder away from the prompt it seeds against. A script has no knowledge to leak and no preference
// about which fabrications are catchable, so it removes the author instead of
// asking the author to be fair.
//
// Two corruptions, both deterministic — no Math.random, so a given anchor always
// yields the same canary and a failed trial can be reproduced exactly:
//
//   line-shift  cite line N, quote text that really lives at another line
//   word-swap   cite line N correctly, but exchange two words inside the quote
//               (weaker — see the note on mode selection below)
//
// word-swap is the harder case and the one hand-written canaries kept missing:
// both of the ones planted by hand changed meaning wholesale, where a plausible
// fabrication alters as little as possible.
//
// THE ONE PROPERTY THIS SCRIPT MUST HAVE: its output must actually be false. A
// canary that accidentally states the truth would be GROUNDED correctly, and the
// run would be scored as a verifier failure that never happened. So falsity is
// asserted before anything is printed, and the script exits non-zero rather than
// emit a claim it cannot prove wrong.

import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
if (args.length < 2 || args.includes('--help')) {
  console.error('usage: node scripts/canary.mjs <file> <line> [--mode line-shift|word-swap] [--json]')
  process.exit(2)
}
const file = args[0]
const lineNo = Number(args[1])
const asJson = args.includes('--json')
const modeArg = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : null

const lines = readFileSync(file, 'utf8').split('\n')
if (!Number.isInteger(lineNo) || lineNo < 1 || lineNo > lines.length) {
  console.error(`canary: ${file} has ${lines.length} lines; ${args[1]} is not a line in it`)
  process.exit(2)
}
const truth = lines[lineNo - 1]

function wordSwap(text) {
  // Swap the two longest distinct alphabetic tokens. Both words are real and
  // already in the line, so the fabrication reads plausibly — no vocabulary
  // list, which would be a registry and would drift.
  const tokens = [...text.matchAll(/[A-Za-z][A-Za-z_]{2,}/g)]
  const seen = new Set()
  const uniq = tokens.filter(t => (seen.has(t[0]) ? false : (seen.add(t[0]), true)))
  if (uniq.length < 2) return null
  const [a, b] = [...uniq].sort((x, y) => y[0].length - x[0].length || x.index - y.index).slice(0, 2)
  const [first, second] = a.index < b.index ? [a, b] : [b, a]
  return text.slice(0, first.index) + second[0] +
         text.slice(first.index + first[0].length, second.index) + first[0] +
         text.slice(second.index + second[0].length)
}

function substantive(text) {
  // A quote must be long enough to be a plausible claim. A fragment like
  // "  properties: {" is rejected on sight by anyone, so shipping one measures
  // nothing — an implausible canary is an easy canary.
  return (text.match(/[A-Za-z][A-Za-z_]{2,}/g) || []).length >= 4
}

function lineShift(n) {
  // Quote a line that really exists elsewhere in the file, cited at n. Two
  // passes: substantive lines first at several distances, then any differing
  // non-blank line rather than failing outright.
  const distances = [20, -20, 7, -7, 3, -3, 1, -1]
  for (const pass of [substantive, t => Boolean(t.trim())]) {
    for (const d of distances) {
      const src = n + d
      if (src < 1 || src > lines.length) continue
      const candidate = lines[src - 1]
      if (candidate !== truth && pass(candidate)) return { text: candidate, from: src }
    }
  }
  return null
}

// LINE-SHIFT IS THE DEFAULT, and the asymmetry is deliberate. Its quote is real,
// grammatical text from the same file — only the citation is wrong — so the only
// way to catch it is to open the cited line. word-swap exchanges the two longest
// words, which frequently yields something ungrammatical that a verifier can
// reject WITHOUT reading anything; passing that measures prose sense, not
// reading, and an easy canary is a canary whose pass means nothing. Keep it for
// lines where no shift is available, and treat a word-swap pass as weaker
// evidence than a line-shift pass.
//
// Determinism is not secrecy: the verifier is never told which of the anchors it
// was handed is the canary, so a predictable MODE gives it nothing, while
// reproducibility lets a failed trial be re-run exactly.
const modes = modeArg ? [modeArg] : ['line-shift', 'word-swap']

let out = null
for (const mode of modes) {
  if (mode === 'word-swap') {
    const text = wordSwap(truth)
    if (text) { out = { mode, claimed: text, note: 'two words exchanged within the real line' }; break }
  } else if (mode === 'line-shift') {
    const r = lineShift(lineNo)
    if (r) { out = { mode, claimed: r.text, note: `text really at line ${r.from}, cited as ${lineNo}` }; break }
  } else {
    console.error(`canary: unknown mode "${mode}"`)
    process.exit(2)
  }
}

if (!out) {
  console.error(`canary: could not build a false claim from ${file}:${lineNo} — the line has fewer than two swappable words and no differing line is available. Pick another anchor rather than shipping a canary that might be true.`)
  process.exit(1)
}

// FALSITY ASSERTION. Everything above is generation; this is the guarantee.
//
// DELIBERATELY UNREACHABLE, and it must stay here anyway. Both generators already
// refuse to return the original: lineShift takes a candidate only when
// `candidate !== truth`, and wordSwap swaps two DISTINCT tokens, so neither can
// produce text equal to the real line. Mutating this branch away therefore breaks
// no test — which reads exactly like dead code and is not.
//
// It is the backstop for a generator changing. The properties above are each
// pinned by their own case (a file whose lines repeat 20 rows apart cannot yield
// a true claim; a line with fewer than two distinct words yields nothing), and if
// one of those is ever relaxed this line is what stops a canary being emitted
// that happens to be TRUE — a "provably false" anchor that is not false, which
// would make every verifier that catches it look wrong and every verifier that
// misses it look right.
if (out.claimed === truth) {
  console.error('canary: refusing to emit — the generated claim equals the real line, so it is not false')
  process.exit(1)
}

const payload = {
  file,
  line: lineNo,
  mode: out.mode,
  fabricated_claim: out.claimed,
  actual_line: truth,
  how: out.note,
}

if (asJson) {
  console.log(JSON.stringify(payload, null, 2))
} else {
  console.log(`ANCHOR (REPO): ${file}:${lineNo}`)
  console.log(`ANCHOR-SAYS: ${JSON.stringify(out.claimed)}`)
  console.log(`FALSIFIER: line ${lineNo} of ${file} not reading that way.`)
  console.log('')
  console.error(`# canary mode=${out.mode} — ${out.note}`)
  console.error(`# EXPECTED VERDICT: NOT-GROUNDED. A GROUNDED verdict voids every anchor verdict in the run.`)
  console.error(`# actual line ${lineNo}: ${JSON.stringify(truth)}`)
}
