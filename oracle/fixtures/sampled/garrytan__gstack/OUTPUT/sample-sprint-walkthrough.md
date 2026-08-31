# Worked example: "add CSV export to the reports page"

A copy-pasteable template. Swap the feature and the answers, keep the stage
order.

**The ask, as it first arrives:** "Can we add a button to export the reports
page as CSV?"

## Think

`/office-hours` is run against that one sentence. Expected forcing questions:
who downloads this and what do they do with it next (rules out a plain
`window.location = /export.csv` if the real use case is "paste into a
recurring finance deck"), what's the current workaround (a screenshot? a
manual copy-paste into a spreadsheet — that tells you the real pain is
formatting, not the download itself), what happens with 50,000 rows (a
server-side stream vs. a client-side blob is a different build), and whether
"CSV" is a stand-in for "give me this data" — which might really mean an API
key, not a button.

Realistic outcome: the one-line ask turns into a design doc for "structured
data export with a CSV path now and room for a scheduled-export / API path
later," scoped down to just the CSV button for v1, with the future paths
noted so the architecture doesn't paint itself into a corner.

## Plan

`/plan-eng-review` against that doc produces: a streaming export endpoint
(not building the whole CSV in memory), a background job if row count is
above some threshold, the edge cases (empty report, report with in-progress
filters, concurrent export requests from the same user), and a test matrix
(empty state, 1 row, 10k rows, special characters that need CSV escaping,
two exports in flight at once).

`/plan-design-review` covers the button itself: where it sits relative to
the existing filter bar, what state it's in mid-export (disabled? spinner?
toast?), and what the user sees if the export fails.

## Build

Implementation follows the amended plan: the endpoint, the escaping logic,
the button and its three visual states, and the background-job path if the
threshold plan called for one.

## Review

`/review` catches, for example, that the CSV escaping doesn't handle a
value containing both a comma and a literal quote character, and that the
concurrent-export case silently double-charges a rate limit. It auto-fixes
the escaping; the rate-limit interaction gets flagged for a human call
because it touches billing logic.

## Test

`/qa` opens the staging reports page, clicks export with a report that has
zero rows, a normal report, and a report with a name containing a comma,
confirms the downloaded file opens cleanly in a spreadsheet app, and writes
a regression test pinning the comma-in-filename case so it can't regress
silently.

## Ship

`/ship` runs the full suite (now including the new regression test), audits
coverage on the new endpoint, pushes, and opens the PR — with the doc update
invoked automatically so the reports-page how-to guide picks up a line about
the new button instead of going stale. `/land-and-deploy` merges once
approved, watches CI and the deploy, and confirms the export endpoint
actually responds in production before calling it done.

## Reflect

At the next `/retro`, this sprint shows up as one more data point in the
test-health trend (did coverage on the reports module go up or down over the
month) and in the shipping-streak count — not analyzed on its own, but
folded into the pattern across sprints.
