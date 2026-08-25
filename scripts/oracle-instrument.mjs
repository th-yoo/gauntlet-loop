// Which instrument SHIPS today — the one fact the ledger cannot supply about itself.
//
//   import { liveInstrument } from './oracle-instrument.mjs'
//
// WHY THIS IS NOT READ OUT OF THE LEDGER. Every observation in results.jsonl carries
// the template hash it was made against, so the ledger can say which instruments have
// been measured. It cannot say which one loop.js sends right now, and that is the
// question a reader of the numbers is actually asking. A quantity derived downstream
// of the decision under test cannot audit that decision, so this reads loop.js — via
// oracle-extract.mjs, which captures the live prompt rather than retyping it.
//
// TWO PROBES, AND THEY MUST AGREE. A template hash is the live prompt with the
// probe's own goal and artifact path blanked out of it. If either string happened to
// occur in the prompt for some other reason, the blanking would cut text that was
// never interpolated and the hash would move — reporting a prompt change that never
// happened, and sending someone to look for an edit nobody made. Two probes with
// unrelated goals and unrelated paths cannot collide the same way, so agreement
// over-determines the answer and disagreement is reported as a collision rather than
// as drift.
//
// NO --inspect. loop.js's prompt carries an inspect block that is absent when the run
// supplies no inspect instruction, so a probe passing one measures a different
// template. Every corpus row to date has `inspect: null`, and this reads that shape.
// If an inspect-carrying row is ever added it is a SECOND instrument, not a stale one.

import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const EXTRACT = join(ROOT, 'scripts', 'oracle-extract.mjs')

// Paths that must exist for anything here to run at all, so a missing probe artifact
// is never the reason this fails. oracle-extract refuses a path that is not there.
const PROBES = [
  { artifact: join(ROOT, 'skills', 'gauntlet-loop', 'loop.js'), goal: 'ORACLE-INSTRUMENT-PROBE-ALPHA-9f3c' },
  { artifact: join(ROOT, 'test', 'harness.mjs'), goal: 'ORACLE-INSTRUMENT-PROBE-BETA-2b71' },
]

// The USEFUL lines, not the last three. A stack tail names the module loader, which
// is true and tells nobody anything; the sentence that says what went wrong is either
// oracle-extract's own refusal (it prefixes them "extract:") or the thrown Error. A
// wrong diagnosis here costs more than no diagnosis, because it sends someone to
// re-draw a corpus over what is actually a broken loop.js.
function diagnose(e) {
  // De-duplicated: a spawn failure reports the child's stderr and repeats it in the
  // Error message, and the same sentence printed twice reads as two problems.
  const lines = [...new Set(String(e.stderr || '').split('\n').concat(String(e.message || '').split('\n'))
    .map(l => l.trim()).filter(Boolean))]
  const own = lines.filter(l => l.startsWith('extract:'))
  const errs = lines.filter(l => /^[A-Za-z]*Error\b/.test(l))
  const pick = own.length ? own : errs.length ? errs : lines
  return pick.slice(0, 3).map(l => '  ' + l).join('\n')
}

function extract(probe) {
  let out
  try {
    out = execFileSync(process.execPath,
      [EXTRACT, '--artifact', probe.artifact, '--goal', probe.goal, '--json'],
      { encoding: 'utf8', cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (e) {
    throw new Error(`oracle-extract could not capture the live prompt (probe ${probe.goal}):\n${diagnose(e)}`)
  }
  try { return JSON.parse(out) } catch {
    throw new Error(`oracle-extract printed something other than JSON (probe ${probe.goal}). Its --json contract changed.`)
  }
}

export function liveInstrument() {
  const [a, b] = PROBES.map(extract)
  if (a.template_hash !== b.template_hash) {
    throw new Error(
      'two probes of the same prompt produced different template hashes:\n' +
      `  ${a.template_hash}  (${PROBES[0].goal})\n` +
      `  ${b.template_hash}  (${PROBES[1].goal})\n` +
      'The prompt did not change between them — one probe\'s goal or artifact path collided with text\n' +
      'already in the prompt, so blanking it cut more than was interpolated. Change the probe, not the prompt.')
  }
  if (a.schema_fingerprint !== b.schema_fingerprint) {
    throw new Error(`two probes of the same prompt produced different schema fingerprints: ${a.schema_fingerprint} vs ${b.schema_fingerprint}`)
  }
  return { template_hash: a.template_hash, schema_fingerprint: a.schema_fingerprint }
}
