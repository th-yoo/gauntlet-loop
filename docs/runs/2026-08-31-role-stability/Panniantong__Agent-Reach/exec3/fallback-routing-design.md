# Ordered-Fallback Routing: The Reusable Pattern

## The shape observed across every destination

Every destination that has more than one candidate backend is expressed the
same way: an **ordered list**, first choice then fallback(s), where the
selection procedure is "probe each candidate in order, actually confirm it
works right now, and use the first one that passes." Not every destination
has more than one entry — some genuinely have only one viable tool today —
but the *procedure* is uniform even when the list has length one.

Restating the observed instances in a single table makes the pattern
explicit:

| Destination | Ordered candidates (first → last) |
|---|---|
| Generic web page | A single hosted "reader" service |
| Twitter/X | A dedicated CLI → a general browser-session tool → a third named fallback |
| YouTube | A single general-purpose downloader |
| GitHub | A single official CLI |
| A strictly anti-bot-defended video platform | A dedicated CLI (no login) → a general browser-session tool → a plain search API |
| Reddit | A general browser-session tool (desktop, logged-in) → a dedicated CLI (cookie-based) |
| Facebook | A general browser-session tool only |
| Instagram | A general browser-session tool only, with an official approval-gated API named as a candidate that was not chosen |
| A cookie-gated content-discovery platform | A general browser-session tool → a hosted MCP service (server-friendly) → a dedicated CLI |
| LinkedIn | A dedicated MCP service → the same generic "reader" service used for plain web pages |
| RSS/Atom | A single parsing library |
| Full-web search | A single semantic search service, reached through a generic MCP connector manager |

## The health-check contract this depends on

The routing list is only trustworthy if the thing selecting from it actually
exercises each candidate rather than checking for the candidate's mere
presence. The stated contract is: **each destination's selector really
probes each candidate backend in order (not just checking whether a command
exists), and the first one that is fully functional is the one selected; a
broken one gets a description of how to fix it rather than being silently
skipped.**

This is the piece worth generalizing on its own, independent of which
specific tools appear in the table: a routing list without an active,
periodic health probe degrades into documentation that nobody re-validates.
The distinguishing feature of a genuinely self-healing setup is not that it
lists more than one option — a hard-coded ordered list would look identical
at rest — it's that something actually re-runs the probe and can tell you,
right now, which entry in the list is live.

## Why "swap the order, don't rewrite the caller" is the load-bearing design choice

The explicit framing given for how a broken backend gets replaced is: this is
a change to *list order* (or list membership), not a rewrite of the code that
calls into the destination. That constraint is what makes the fallback
pattern durable rather than a growing pile of special cases: the calling
code's contract is "give me a working way to reach destination X," and the
routing list is free to change its answer to that question over time without
the caller needing to change at all.

The corollary, stated in the source material for one specific case (a
platform-wide crackdown that broke a batch of single-platform tools at once,
independent of any single vendor's specific outage): the same reordering
mechanism is the fix whether the disruption caused one destination to lose
one backend or several destinations to lose their shared backend
simultaneously. The routing pattern does not need a special case for "many
things broke on the same day" — it is the same list-reordering operation
repeated, once per affected destination.

## A gap this pattern does not close, stated plainly

Ordered fallback only helps when a fallback candidate exists. For a
destination whose only viable path requires a signed-in session and offers
no automatable substitute (the sharpest example here is a discussion-forum
platform whose anonymous access has been closed off entirely), reordering a
list of one does nothing — the actual constraint is not "which tool," it's
"is a login unavoidable," and no amount of backend rotation removes that
requirement. The correct response to that case is not to add a fake
zero-config entry to make the table look more complete; it's to record
"no zero-config path" as the honest answer and route the person setting
things up toward the manual credential step instead.
