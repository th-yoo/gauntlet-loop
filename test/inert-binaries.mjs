// BINARIES KNOWN TO BE INERT, in one place because two checks now ask the same
// question and one of them was asking a different one.
//
// Issue #55 inverted containment's rule: the question is no longer "is this
// binary on the model list" but "is this binary known to be inert". A name
// nobody has vouched for is a candidate spawner and has to carry the guard. The
// list still has to be maintained — but adding a model runner is now the case
// that FAILS CLOSED, and forgetting to update a list is what the old rule
// punished with silence.
//
// Issue #61 is why it moved here. `test/ci-workflow.test.mjs` discovers which
// scripts are model-spawners so it can assert the CI workflow never invokes one
// on a runner, and it was doing that with a private regex that knew one name,
// under a comment claiming parity with containment. Measured: a spawner whose
// binary is `codex` left its count unchanged, and one whose binary is
// `nimbusrun` — a name on NO list — did too, while containment caught both.
//
// AND THE OTHER ROUTE WAS RULED OUT BY MEASUREMENT, not preference. Using the
// shared name list from scripts/model-shaped.mjs cannot catch `nimbusrun`:
// namesAModel returns false for it, and it MUST, because that name is in
// test/model-names.mjs's negative arm, which issue #57 asserts must never match.
// Widening the list to cover it would destroy the crossing that proves the list
// discriminates at all.
//
// WHAT INERT MEANS HERE: it reads no prompt and starts no agent, so it cannot
// re-enter this repository. `sh` is on the list and is the residual — a shell
// carries whatever command it is handed, and `sh -c "<runner> -p ..."` is
// invisible to a scan that reads the binary. That hole is not new and is not
// closed here; the namesAModel refusals in oracle-add, constructed-verify and
// oracle-report are what stand in front of the acceptance-command case.
export const INERT = new Set(['git', 'gh', 'grep', 'ls', 'sh', 'bash', 'node', 'npm', 'cat', 'sed', 'awk', 'find', 'which', 'env', 'true', 'echo', 'printf', 'tar', 'xargs', 'cp', 'mkdir', 'rm', 'test', 'diff', 'sort', 'head', 'tail', 'wc'])

// A binary is judged by its last path segment, so /usr/local/bin/node is node.
export const isInert = bin => INERT.has(String(bin).trim().split(/[\s/]+/).pop())
