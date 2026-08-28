// A DISCLOSURE THAT SAYS WHAT THE SOURCE SAYS MUST QUOTE THE SOURCE.
//
// Issue #59, carried out of #56. That issue built the rule for a FIGURE — a rate,
// a ratio, an `n=` — which must cite a file that contains it. Its stated residual
// was the other half: a factual claim with no digits in it is invisible to that
// rule, and the loop emits four of them.
//
// Measured before this was built, on the disclosures a run actually emits: four
// assert what the SOURCE says.
//
//   "the source's one requirement on the judge"        (harsh critic)
//   "Both primary texts say one critic per piece"      (k>1 is ours)
//   "The source divides a goal into pieces…"           (not decomposed)
//   "That is the source's design, not an oversight"    (no budget ceiling)
//
// And the reproducible: adding "The source demands an automatic ratchet" to a
// shipped disclosure passes run-all and drift-guard. A claim about two documents
// this repository ships verbatim was checkable by nothing.
//
// THE ANCHOR ALREADY EXISTS AND WAS BUILT FOR THIS. `references.md` quotes both
// source prompts in full and carries a provenance table — "claim made here | the
// sentence" — whose entire purpose is that every claim about the sources has
// somewhere to be checked against. Nothing connected the two.
//
// THE RULE: a disclosure sentence that refers to the source must be accompanied,
// somewhere in the same disclosure, by a QUOTED fragment that appears in
// references.md. Not a paraphrase — the words. A paraphrase is what let "one
// critic per piece" and "an automatic ratchet" read the same to every check in
// this repository.
//
// WHY DETECTION IS DELIBERATELY BROAD. `refersToSource` matches the word source
// or "primary text" anywhere in the sentence, which over-detects: a sentence
// mentioning the source in passing is asked for a quote it may not need. That is
// the direction to fail in. #55 made exactly this inversion for spawners — a
// binary is suspicious unless vouched for, rather than safe unless listed —
// because the alternative punishes forgetting with silence.
//
// WHAT IT STILL CANNOT DO, and this is the same residual the figure rule ships
// with: it checks that the words are in the source, never that the inference from
// them is sound. "Both texts say X, therefore Y is ours" can quote X correctly
// and be wrong about Y. What it removes is the class where the quoted words are
// not in the source at all.

const SOURCE_REF = /\b(?:source|primary text|primary source)\b/i

// A fragment the author marked as quoted: double quotes, curly quotes, or
// backticks. An unmarked phrase is a paraphrase, and paraphrase is the thing this
// rule exists to stop being treated as citation.
const QUOTED = /"([^"]{4,400})"|“([^”]{4,400})”|`([^`]{4,400})`/g

// Whitespace and quote shape are not part of a quotation: a sentence wrapped
// across lines in references.md and quoted inline here is the same sentence.
export const canonQuote = s => String(s)
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/[–—]/g, '-')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()

// SIXTEEN, AND THE NUMBER WAS MEASURED RATHER THAN PICKED — the same crossing
// that set MIN_NEEDLE in detection-parse. The placebo is spans of the loop's OWN
// disclosure prose with the quotations stripped out: text that is not a citation
// of anything. If a window of that length turns up in references.md anyway, a
// quotation of that length proves nothing.
//
//   len   placebo found in references.md   the four real quotations still clearing
//     8        54/705  = 7.7%                          4/4
//    12         5/692  = 0.7%                          4/4
//    16         2/692  = 0.3%                          4/4     <- the knee
//    24         2/694  = 0.3%                          4/4
//    32         1/719  = 0.1%                          3/4     a real quote drops
//
// Sixteen is where the placebo stops improving and no real quotation has been
// lost. test/disclosure-truth.test.mjs re-runs that crossing on every suite run,
// so the floor cannot go stale as the disclosures are rewritten.
export const MIN_QUOTE = 16

export function sentences(text) {
  return String(text).split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)
}

export function refersToSource(sentence) {
  return SOURCE_REF.test(String(sentence))
}

export function quotedFragments(text, min = MIN_QUOTE) {
  const out = []
  for (const m of String(text).matchAll(QUOTED)) {
    const body = m[1] ?? m[2] ?? m[3] ?? ''
    const c = canonQuote(body)
    if (c.length >= min) out.push(c)
  }
  return [...new Set(out)]
}

// Returns the problems with one disclosure. `references` is the text of
// references.md, passed in so nothing here reads a file and every branch can be
// produced from constructed input.
export function auditSourceClaims(text, references) {
  const claims = sentences(text).filter(refersToSource)
  if (!claims.length) return []
  const refs = canonQuote(references)
  const quotes = quotedFragments(text)
  const grounded = quotes.filter(q => refs.includes(q))
  if (grounded.length) return []
  return [{
    kind: quotes.length ? 'quotes-not-in-source' : 'unquoted-source-claim',
    claims: claims.map(c => c.slice(0, 160)),
    quotes,
  }]
}

export function describeSourceProblem(p, where) {
  if (p.kind === 'unquoted-source-claim') {
    return `${where} says what the source says and quotes none of it: ${JSON.stringify(p.claims[0])}. ` +
      `references.md ships both prompts verbatim and a provenance table built for exactly this. ` +
      `Quote the sentence the claim rests on — a paraphrase is what let "the source demands an automatic ratchet" ` +
      `pass every check in this repository.`
  }
  return `${where} says what the source says and quotes ${JSON.stringify(p.quotes)}, none of which appears in references.md. ` +
    `Either the quotation is wrong or the claim is about something the sources do not contain.`
}
