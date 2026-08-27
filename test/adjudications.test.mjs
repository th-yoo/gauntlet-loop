// AN ADJUDICATION MUST BE SPENT, and this is where that can be watched failing.
//
//   node test/adjudications.test.mjs
//
// Three instruments here excuse something they cannot settle by recording a human
// reading with a reason. None of the three checked the other direction, and a row
// naming a ledger, a disclosure key or a trial that exists NOWHERE left all three
// green while counting toward how much accounting had been done.
//
// THE FIRST PROBE OF THIS WAS A FALSE NEGATIVE, and it is worth the sentence: the
// disclosure file appeared to reject a stale row. It rejected it for the LENGTH of
// its reason — the rubber-stamp floor firing on a short probe string — and with a
// full-length reason it passed like the other two. A check that rejects for the
// wrong reason reads exactly like one that works. Every case below carries a
// full-length reason for that reason.
//
// NOTHING HERE SPAWNS and nothing here reads a tracked file: the ledger is text in,
// verdict out, so every branch can be produced on demand.

import { adjudicationLedger, unspentMessage } from '../scripts/adjudications.mjs'

let failures = 0
const fail = m => { console.error(`  FAIL  ${m}`); failures++ }
const ok = (cond, m) => { if (!cond) fail(m) }
const eq = (got, want, m) => ok(got === want, `${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)

const WHY = 'a reason written at full length, so that a rubber-stamp length floor somewhere else cannot be what decides any case in this file'
const line = o => JSON.stringify(o)
const FILE = [
  line({ key: 'alpha', verdict: 'undrivable', why: WHY }),
  line({ key: 'beta', verdict: 'undrivable', why: WHY }),
].join('\n') + '\n'

console.log('adjudications: a row is spent by the lookup that consults it')
{
  const led = adjudicationLedger(FILE, a => a.key ?? null)
  eq(led.size, 2, 'both rows were read')
  eq(led.unspent().length, 2, 'before anything is looked up, every row is unspent')
  led.get('alpha')
  eq(led.unspent().length, 1, 'a row that was looked up is still reported as unspent')
  eq(led.unspent()[0].key, 'beta', 'the wrong row was reported as unspent')
  led.has('beta')
  eq(led.unspent().length, 0, 'has() does not count as consulting a row, so a consumer that only asks whether a key is present reports every row it used')
}

console.log('adjudications: a lookup that MISSES still spends nothing')
{
  // The consumer asks about subjects it found; a subject with no adjudication is
  // a miss. That must not mark some other row as spent, and it must not mark
  // itself — there is no row to mark.
  const led = adjudicationLedger(FILE, a => a.key ?? null)
  eq(led.get('gamma'), undefined, 'a key with no row returned something')
  eq(led.unspent().length, 2, 'looking up a key that has no adjudication spent a row that was never consulted')
}

console.log('adjudications: a row whose key cannot be read is reported, not dropped')
{
  const led = adjudicationLedger(FILE + line({ verdict: 'accepted', why: WHY }) + '\n', a => a.key ?? null)
  eq(led.size, 2, 'a keyless row was admitted to the map, where no lookup can ever reach it')
  eq(led.malformed.length, 1, 'a keyless row was dropped in silence — invisible to every lookup and to every report')
  ok(unspentMessage('thing', [], led.malformed).some(m => /UNREADABLE ADJUDICATION/.test(m)),
     'the keyless row produced no message')
}

console.log('adjudications: a line that is not JSON is reported, not dropped')
{
  const led = adjudicationLedger(FILE + '{"key": "truncated", "why":\n', a => a.key ?? null)
  eq(led.size, 2, 'a truncated line was parsed')
  eq(led.malformed.length, 1, 'a truncated line vanished inside a catch, which is how an adjudication someone wrote stops existing without anyone being told')
}

console.log('adjudications: an empty or missing file is empty, not an error')
{
  for (const [what, text] of [['empty string', ''], ['undefined', undefined], ['blank lines', '\n\n  \n']]) {
    const led = adjudicationLedger(text, a => a.key ?? null)
    eq(led.size, 0, `${what}: rows appeared out of nothing`)
    eq(led.unspent().length, 0, `${what}: an unspent row appeared out of nothing`)
    eq(led.malformed.length, 0, `${what}: a blank line was reported as malformed, which would make every file with a trailing newline a finding`)
  }
}

console.log('adjudications: the message names the row and says what to do')
{
  const msgs = unspentMessage('constant', [{ key: 'runs/gone.jsonl some_field', row: { why: WHY } }])
  ok(msgs.length === 1, 'one unspent row produced no message, or more than one')
  ok(/runs\/gone\.jsonl some_field/.test(msgs[0]), 'the message does not name the row, so a reader cannot find what to delete')
  ok(/Delete the row or fix its key/.test(msgs[0]), 'the message states a finding with no remedy — the row will be read again next run and left alone again')
  ok(/constant/.test(msgs[0]), 'the message does not say what kind of subject went missing, and the same sentence serves three different files')
}

console.log('adjudications: a duplicate key is one row, and the later one wins')
{
  const led = adjudicationLedger(FILE + line({ key: 'alpha', verdict: 'accepted', why: 'the later reading of the same subject, ' + WHY }) + '\n', a => a.key ?? null)
  eq(led.size, 2, 'a repeated key produced two rows, so which one a lookup gets depends on iteration order')
  ok(/later reading/.test(led.get('alpha').why), 'an earlier adjudication shadowed a later one — the file is append-only, so the last word must be the one that counts')
}

if (failures) {
  console.error(`\nadjudications: ${failures} failure(s) — a row that matches nothing counts as accounting that did not happen.`)
  process.exit(1)
}
console.log('\nadjudications: OK — spent by lookup, unreadable rows reported, empty is empty, the message names the row and the remedy.')
