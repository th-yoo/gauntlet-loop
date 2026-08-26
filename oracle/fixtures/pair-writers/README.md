# Hunting a second instruction-writer, and what the misses measured

These fixtures exist for #48's gap 2: two `produces-an-instruction` artifacts under one
goal, which is the branch of `loop.js`'s rule that composes to `comparable` and has never
been observed as a pair. The goal is `brief-writer`'s — *"a landing page exists for our new
scheduling product, Cadence"* — so that one new writer would give the pairing both sides.

Three candidates have been run through `oracle/generator-procedure.md`. The first two came
back **completed answers** — so neither is a writer and neither is in the corpus — and the
third came back a writer, which is `teardown-request` and the second side of `writers-pair`.
The misses are kept because a measured negative about this class is the thing #33 says the
corpus is short of, and because the two of them together killed a hypothesis that the third
then tested.

| candidate | what it is | emission | blind verdict |
|---|---|---|---|
| `handoff/HANDOFF.md` | a message to a named studio: "you build the page and you ship it", staging URL by Friday, approved copy attached | a complete static page, six SVGs, and a note raising four items | **completed-answer** |
| `job-posting/JOB-POSTING.md` | a contract hiring ad for a developer to build the page; no copy, no assets, no brand | a deliberately minimal placeholder page that refuses to invent copy | **completed-answer** |
| `teardown/TEARDOWN-REQUEST.md` | commissions a competitive teardown of three rival pages, to be forwarded to the studio, and says not to start on our own page | `teardown.md` plus a cover memo to the marketing lead | **addressed-to-a-further-party** |

## What died

**"Addressed to a further party" is not the class.** `HANDOFF.md` names the studio, tells
it to build and ship, and forbids it from changing the copy. Executed, it produced the page.

**"Withholds what the goal needs" is not the class either** — and this is the one worth
recording, because it is the hypothesis the first miss suggested and this file asserted
before the second miss refuted it. `JOB-POSTING.md` withholds *everything*: no copy, no
brand, no deadline, and it says in as many words that those "will come from the marketing
lead at kickoff." The agent built a page anyway — a thin, self-labelled placeholder that
invented nothing — and the blind classifier called it a completed answer, because a sparse
landing page is still a landing page that exists.

## The hypothesis that survives, and its prediction

The five writer rows already in the corpus — a brief template, a spec request form, an RFP,
a meta-prompt, a partial handoff — all **prescribe producing something other than the
goal's deliverable**. `brief-writer` says fill in these headings and hand the brief to the
studio; executing it yields a brief. Neither miss above prescribes anything: a handoff
message and a job ad tell you *who does the work*, not *what to produce instead of it*, so
an agent that can reach the goal directly does.

So the candidate discriminator is **prescription of an intermediate deliverable**, not
addressee and not withholding.

**The prediction, written before the third candidate was run:** an artifact under this same
goal that prescribes an intermediate deliverable — "produce a competitive teardown of three
rival scheduling pages and circulate it; the studio designs from your teardown" — will be
executed into that teardown and will classify as addressed-to-a-further-party, even though
it withholds less than the job posting did and is addressed no more explicitly than the
handoff.

If it comes back a completed answer, the discriminator above is wrong too, and the honest
reading becomes that under a goal an agent can satisfy directly, this class may be much
narrower than five rows suggest.

**It held.** The agent produced the teardown and a cover memo — "this goes to you, not to
the studio … please forward it" — and stated the Cadence page is "the studio's work, next
sprint … deliberately not started." The blind classifier called it
addressed-to-a-further-party on those grounds. One prediction, made in writing before the
run, on one case: that is a survived test, not a confirmed rule, and the cheap way to break
it next is an artifact that prescribes an intermediate deliverable the goal does **not**
need — where prescription and deferral come apart.

## Why the two misses are not in the corpus

`teardown-request` is a row; the other two cannot be. A row grounded by agentic execution
whose emission is a **completed answer** has nowhere to live: `--arm generator` writes `expected_role: produces-an-instruction` from the flag
rather than reading it off the evidence, and `--arm does-the-work` needs a mechanical
acceptance command, which an artifact only an agent can execute cannot have. That is #49.
