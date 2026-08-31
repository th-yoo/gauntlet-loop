# Power tools and standalone binaries

Beyond the specialist skills, the setup ships a second layer: slash commands
for safety/config, and standalone CLIs for workflows that don't belong inside
a Claude Code session.

## Power-tool slash commands

| Skill | What it does |
|---|---|
| `/codex` | Second Opinion — independent review from OpenAI's Codex CLI. Three modes: pass/fail review, adversarial challenge, open consultation. Cross-model analysis once both `/review` and `/codex` have run on the same branch. |
| `/careful` | Warns before destructive commands (`rm -rf`, `DROP TABLE`, force-push). Say "be careful" to activate. Any MEDIUM warning can be overridden; root/home recursive deletes and default-branch force-pushes are hard-denied. |
| `/freeze` | Restricts file edits to one directory while debugging. |
| `/guard` | `/careful` + `/freeze` together, for prod work. |
| `/unfreeze` | Removes the `/freeze` boundary. |
| `/open-gstack-browser` | Launches an AI-controlled Chromium with sidebar, anti-bot stealth, and auto model routing (Sonnet for actions, Opus for analysis). |
| `/setup-deploy` | One-time setup for `/land-and-deploy`: detects platform, production URL, deploy commands. |
| `/setup-gbrain` | Zero-to-running persistent knowledge base in under five minutes, four install paths (Supabase existing URL, Supabase auto-provision, local PGLite, remote MCP). |
| `/sync-gbrain` | Re-indexes the current repo into the knowledge base and refreshes the search-guidance block in `CLAUDE.md`; removes that guidance automatically if the capability check fails. |
| `/gstack-upgrade` | Detects global vs. vendored install and upgrades both, showing what changed. |

## Investigation / debugging note

`/investigate` auto-freezes edits to the module under investigation, and
enforces an "Iron Law": no fixes without investigation, stopping after three
failed fix attempts to force a rethink rather than a fourth guess.

## Standalone binaries (run outside a session)

| Command | What it does |
|---|---|
| `gstack-model-benchmark` | Runs the same prompt through Claude, GPT (via Codex CLI), and Gemini; compares latency, tokens, cost, and optionally an LLM-judge quality score. `--dry-run` validates flags/auth without spending API calls. |
| `gstack-taste-update` | Writes `/design-shotgun` approvals/rejections into a persistent per-project taste profile (decays 5%/week) that biases future variant generation. |
| `gstack-egress` | Auditor for every off-machine send: a hash-chained, tamper-evident receipt ledger. `list`, `grants`, and `verify` (exits 3 on tamper — truncating/deleting the ledger itself is explicitly out of scope, since it's a forensic log, not tamper-proof storage). |
| `gstack-context-bill` | Offline, read-only token bill-of-materials for an installed skills tree: always-on frontmatter cost vs. per-invocation cost. `--diff`, `--budget`, and an opt-in `--exact` mode that sends file text off-machine (receipted first, degrades to the offline estimate if the receipt can't be written). |
| `gstack-code-intelligence` | One interface over GBrain / Sourcebot / Graphify code-intelligence providers; falls back to grep if nothing is selected. Non-local providers require recorded per-repo consent and respect the per-repo trust tier before writing or even searching. |
| `gstack-verify-gate` | Opt-in Stop hook that blocks a turn from ending until a declared verify command passes; yields with a loud still-RED warning after three blocked re-entries instead of looping forever. Requires an explicit one-time trust grant per repo. |
| `gstack-wtree` | Content hash of what's actually on disk (untracked source counts, gitignored scratch doesn't) — identical across commits, rebases, amends, and squashes, so it can bind a review to content rather than a commit SHA. |
| `gstack-evidence` | Wraps a test command, records what ran against which working-tree fingerprint, and grades stored evidence FRESH/STALE/MISSING so `/ship` and `/land-and-deploy` can cite it instead of re-running suites. |
| `gstack-issue-guard` | Wraps fetched GitHub issue/PR text in a labeled trust envelope so agents treat it as data, not instructions — labels injection-shaped lines even through evasion tricks, and defuses forged envelope banners. |

## Default-on hook

`./setup` registers one Stop hook, `gstack-timeline-stop`, which closes
dangling session-timeline entries if a session is interrupted. It is
fail-open (2s internal budget, always exits 0, can never block a session),
skippable with `./setup --no-team`, and removable with
`gstack-settings-hook remove-source --source gstack-timeline-stop`.
