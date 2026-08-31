---
name: interview-me
description: One-question-at-a-time interview that extracts what the user actually wants instead of what they think they should want, until roughly 95% confidence. Use when the ask is underspecified, or the user invokes "interview me" or "grill me."
---

## Overview

Most underspecified requests are not solved by asking one big clarifying
question up front — the user doesn't know what they don't know until a
concrete follow-up surfaces it. This skill runs a short, sequential interview
instead of a single clarifying-questions dump, because a list of five
questions gets answered shallowly while five sequential questions each get a
real answer.

## When to Use

- The request states a goal but not the constraints, audience, or shape of
  the solution.
- The user explicitly says "interview me" or "grill me."
- A spec or plan is about to be written and the last confirmed fact was more
  than a couple of exchanges ago.

## Process

1. **State the confidence target up front.** Tell the user this will be a
   short back-and-forth aimed at roughly 95% confidence in the requirements,
   not a single form to fill out.
2. **Ask exactly one question per turn.** Pick the question whose answer
   would most change the resulting spec or plan — not the next item on a
   checklist. Wait for the answer before asking the next one.
3. **Reflect the answer back in one line** before the next question, so
   drift is caught immediately rather than compounding across five answers.
4. **Track confidence explicitly.** After each answer, note (to yourself,
   not necessarily aloud) what's still unknown and how much it would change
   the outcome. Stop asking once further questions would only refine detail,
   not change direction.
5. **Summarize before handing off.** Close with a short restatement of what
   was learned, phrased as the input to the next skill (usually
   `spec-driven-development` or `idea-refine`), and get an explicit
   "yes, that's right" before moving on.

## Rationalizations

| Excuse | Rebuttal |
|---|---|
| "I'll ask all the questions at once to save turns." | A batch of questions gets answered shallowly; the user answers what's easy and skips what's hard, which is exactly the part worth asking. |
| "I already have a good guess, I'll just confirm it." | A leading confirmation question anchors the user on the guess instead of surfacing what they'd have said unprompted. |
| "This is taking too many turns." | A wrong assumption caught now costs one turn; caught after a spec is written it costs the spec. |

## Red Flags

- More than one question is asked in a single turn.
- The interview ends without a restated summary the user confirmed.
- Questions are being asked in checklist order rather than in order of how
  much each answer would change the outcome.

## Verification

- A one-paragraph summary of the confirmed requirements exists, and the user
  explicitly agreed to it in the transcript.
- Each open question that materially affects scope was asked and answered
  before the interview was declared closed.
