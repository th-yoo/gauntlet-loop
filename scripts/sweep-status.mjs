// Report the coverage sweep's last verdict at session start — #46's option 5.
//
//   node scripts/sweep-status.mjs        (run by the SessionStart hook in .claude/settings.json)
//
// WHY THIS EXISTS. `scripts/coverage-sweep.mjs` produces findings and nothing
// reads them. #46's menu offers a badge, a summary, an auto-filed issue, or a
// recorded decision to do nothing. This is a fifth option, and it is chosen on a
// measurement rather than a preference: of the three findings that have ever
// reached a person in this repository, all three arrived inside a working
// session — a log opened by hand, a question asked mid-session, an agent
// noticing while arguing something else. Zero arrived via a run page. So the
// reader goes where the attention measurably is.
//
// WHY A HOOK AND NOT AN AGENT. An agent has to be spawned by someone, which is
// the remembered trigger this repository's whole #42 -> #46 chain is about. A
// hook fires without being remembered.
//
// WHAT IT CAN AND CANNOT SEE. Only one part of a sweep result survives outside
// the run page: the run's conclusion, one bit, queryable with `gh run list`. The
// rendered job summary is not fetchable — no REST endpoint returns it, the
// check-run output comes back empty, and the run page is a JavaScript shell
// (#46 S15). So this transports one bit and says so. In particular:
//
//   - it cannot tell NOT CAUGHT (code unprotected) from COULD NOT RUN (a needle
//     went stale), which need opposite repairs and share exit 1 (#46 S8);
//   - it cannot see a finding riding inside a GREEN run, which is the instance
//     #46 was filed on (run 32900618692, success, two defects in its log);
//   - it says nothing at all when it cannot reach the API, and must say THAT
//     rather than fall back to silence — silence reads as clean.
//
// Those three limits are printed on the branch they apply to, every time, not in
// a footnote that only appears when nothing is being claimed.

import { spawnSync } from 'node:child_process'

// The only all-clear this program can emit. It is a single token so a test can
// require its ABSENCE on every branch that has not earned it.
export const CLEAR_TOKEN = 'SWEEP OK'
export const RESIDUAL_MARK = 'residual:'

const WORKFLOW = 'coverage.yml'
const ASK_TIMEOUT_MS = 8000

const short = sha => (typeof sha === 'string' ? sha.slice(0, 7) : '?')

// ---------------------------------------------------------------------------
// ASKING. Every failure mode collapses to one status — `unavailable` — carrying
// the reason, because the distinction that matters to a reader is not why the
// question failed but that it was not answered.
// ---------------------------------------------------------------------------
export function ask({ timeoutMs = ASK_TIMEOUT_MS } = {}) {
  const r = spawnSync('gh', [
    'run', 'list',
    '--workflow', WORKFLOW,
    '--limit', '1',
    '--json', 'databaseId,conclusion,status,headSha,createdAt,event',
  ], { encoding: 'utf8', timeout: timeoutMs })

  if (r.error) return { status: 'unavailable', reason: r.error.code === 'ENOENT' ? 'gh is not on PATH' : String(r.error.message) }
  if (r.signal) return { status: 'unavailable', reason: `gh did not answer within ${Math.round(timeoutMs / 1000)}s` }
  if (r.status !== 0) return { status: 'unavailable', reason: (String(r.stderr).trim().split('\n')[0] || `gh exited ${r.status}`) }

  let runs
  try { runs = JSON.parse(r.stdout) } catch { return { status: 'unavailable', reason: 'gh returned something that is not JSON' } }
  if (!Array.isArray(runs)) return { status: 'unavailable', reason: 'gh returned JSON that is not a list of runs' }
  if (!runs.length) return { status: 'none' }

  const run = runs[0]
  const common = { run: String(run.databaseId), sha: run.headSha, when: run.createdAt, conclusion: run.conclusion || run.status }

  if (run.status !== 'completed') return { ...common, status: 'no-verdict' }
  if (run.conclusion === 'success') return { ...common, status: 'success' }
  if (run.conclusion === 'cancelled' || run.conclusion === 'skipped') return { ...common, status: 'no-verdict' }
  return { ...common, status: 'failure' }
}

export function head() {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 5000 })
  return r.status === 0 ? String(r.stdout).trim() : null
}

// ---------------------------------------------------------------------------
// RENDERING. Pure, so every branch can be driven from a test rather than from
// whatever GitHub happens to be returning today.
// ---------------------------------------------------------------------------
export function render(state, headSha) {
  const L = []
  const say = (...lines) => L.push(...lines)
  const stale = state.sha && headSha && state.sha !== headSha

  switch (state.status) {
    case 'unavailable':
      say(`coverage sweep: COULD NOT ASK — ${state.reason}.`,
          `  ${RESIDUAL_MARK} this says nothing about coverage, only that the question went unanswered. Ask by hand with \`gh run list --workflow ${WORKFLOW}\`.`)
      break

    case 'none':
      say(`coverage sweep: no run of ${WORKFLOW} exists yet.`,
          `  ${RESIDUAL_MARK} nothing has been swept, so nothing here says the tree is covered.`)
      break

    case 'no-verdict':
      say(`coverage sweep: NO VERDICT — the last run (${state.run}, ${short(state.sha)}) ended ${state.conclusion}.`,
          `  ${RESIDUAL_MARK} a run that did not finish is unswept, not clean. Re-run it with \`gh workflow run ${WORKFLOW}\`.`)
      break

    case 'failure':
      say(`coverage sweep: RED — run ${state.run} on ${short(state.sha)} concluded ${state.conclusion}.`,
          `  open it: \`gh run view ${state.run} --log\``,
          `  ${RESIDUAL_MARK} this is one bit. It cannot tell NOT CAUGHT (a property nothing tests) from COULD NOT RUN (a needle went stale after a rename) — opposite repairs, same exit code — and the summary naming the property is not fetchable from here.`)
      break

    case 'success':
      if (stale) {
        say(`coverage sweep: last run ${state.run} passed, but against ${short(state.sha)} — this tree is at ${short(headSha)}, which has no sweep verdict of its own.`,
            `  ${RESIDUAL_MARK} a pass on another commit is not a pass on this one, and a green sweep can carry a finding in its log that its exit code never shows.`)
      } else {
        say(`coverage sweep: ${CLEAR_TOKEN} — run ${state.run} passed on this commit (${short(state.sha)}).`,
            `  ${RESIDUAL_MARK} green is not silence. The run this reader exists for concluded success while carrying two defects in its log, and only the exit code reaches here.`)
      }
      break

    default:
      say(`coverage sweep: COULD NOT ASK — unrecognised state ${JSON.stringify(state.status)}.`,
          `  ${RESIDUAL_MARK} this says nothing about coverage.`)
  }
  return L.join('\n')
}

// ---------------------------------------------------------------------------
// The hook contract: one JSON object, so the line reaches the operator
// (systemMessage) and the session (additionalContext) rather than only one of
// them. Always exit 0 — a reader that can fail a session start is a reader that
// gets removed.
// ---------------------------------------------------------------------------
const INVOKED = process.argv[1] && process.argv[1].endsWith('sweep-status.mjs')
if (INVOKED) {
  const text = render(ask(), head())
  process.stdout.write(JSON.stringify({
    systemMessage: text,
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text },
  }))
  process.exit(0)
}
