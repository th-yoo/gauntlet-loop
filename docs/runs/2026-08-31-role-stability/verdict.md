# Verdict — the disputed labels are mostly nobody's to award, and the probe is wrong twice

Trials: 10 artifacts x 3 executions (the grounding execution plus two fresh ones under the
identical prompt), each new emission read by one fresh blind classifier over a path-neutral
copy. Ledger: `trials.jsonl`; emissions and classifications committed beside it.

## The grid (grounding / exec2 / exec3; A = addressed-to-a-further-party, C = completed-answer)

| artifact | set | labels | verdict |
| --- | --- | --- | --- |
| Panniantong/Agent-Reach | disputed | A A A | STABLE — the arm's label is an artifact property; the probe is wrong here |
| karpathy/autoresearch | disputed | A A A | STABLE — same |
| neovim/neovim | disputed | A C C | FLIP — executor-contingent |
| home-assistant/core | disputed | A C C | FLIP |
| garrytan/gstack | disputed | A A C | FLIP |
| github/gitignore | disputed | C A A | FLIP |
| louislam/uptime-kuma | control | C A C | FLIP — on a control |
| ggml-org/llama.cpp | control | C C C | stable |
| thedotmack/claude-mem | control | C C C | stable |
| Anduin2017/HowToCook | control | C C C | stable |

## Against the pre-stated predictions

Neither clean branch held; the design's mixed-outcome clause is the one that fired.

- Flips concentrate in the disputed set (4/6 vs 1/4), as P-contingent predicted — but two
  disputed artifacts are STABLE, so the probe's misses on agent-reach and autoresearch are
  real misses of a stable fact, and P-probe-wrong holds for exactly those two.
- One CONTROL flipped (uptime-kuma: the grounding executor built the whole tool, exec2
  wrote an install packet, exec3 built the whole tool again), so the contingency is not a
  property of the disputed set — it is a property of the ARM on README-shaped artifacts,
  and the disputed set is simply where it was dense enough to see.

## What follows, and what was done

1. **Five rows lose their standing as ground truth**: neovim, home-assistant, gstack,
   gitignore, uptime-kuma. Their agentic label is one draw from a process the artifact
   does not determine. They are re-recorded with `--disputed` — the corpus's existing
   status for a contested label — with notes citing this run, and a disputed row is
   excluded from every rate the report computes. This resolves nothing by preference:
   both original classifications stay pinned; the dispute is between EXECUTIONS, not
   between readers.
2. **The instruction-arm headline dissolves honestly.** 5/5 missed, CI [57%, 100%] was a
   statement over rows of which three could not carry a label. What survives: the probe
   is wrong on both stable instruction-writers the frame has produced (2/2), which is
   below the report's floor of five — so the sampled instruction-arm rate returns to
   CANNOT BE POSED, now for the right reason.
3. **The does-the-work arm cleans to 0 misses over stable rows** — gitignore's "miss"
   was the arm's coin, not the probe's error.

## What this cannot establish

Which label is TRUE for the stable artifacts — stability is an instrument agreeing with
itself. The two stable disagreements (agent-reach, autoresearch: three executions all
addressed onward, the probe stably reading does-the-work) are now the sharpest specimens
this corpus holds, and judging between instrument and arm there needs an anchor neither
uses. Also not established: WHY executions bifurcate — the emissions suggest a
build-the-thing vs document-the-thing fork in the executor, but nothing here measures
what tips it.

## Reader-noise bound

New emissions got ONE blind reader each (the two-reader protocol measured 38/38 agreement
earlier today, so reader noise is bounded but not zero). A flip produced by reader noise
rather than execution difference would need the reader to misread a whole emission class;
the flipped cases pair emissions of visibly different kinds (a 14-file working tool vs an
install packet; a template collection vs a contributor scaffold), which reader noise does
not produce.
