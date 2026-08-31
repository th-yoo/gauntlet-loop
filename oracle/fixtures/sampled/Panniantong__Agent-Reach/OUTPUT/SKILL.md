# Agent Reach — SKILL (offline transcription)

This file is a skill sheet an agent can read to know which upstream tool to call
for a given user request, without needing to fetch `docs/install.md` or run any
installer. It is transcribed only from the "装好就能用" (works out of the box)
and "支持的平台" sections of the source README — nothing here was invented and
nothing here was fetched from the network.

Agent Reach itself is described as a **capability layer**: it selects, installs,
and health-checks upstream tools, and routes between a primary and fallback
backend per platform. It does not wrap the reads itself — the agent calls the
upstream tool directly. See `channels.json` in this directory for the full
primary▸fallback backend table per platform.

## Zero-configuration requests (works immediately)

| User says | Agent runs |
|---|---|
| "帮我看看这个链接" | `curl https://r.jina.ai/URL` |
| "这个 GitHub 仓库是做什么的" | `gh repo view owner/repo` |
| "这个 YouTube 视频讲了什么" | `yt-dlp` (extract subtitles) |
| "B站搜一下 AI 教程" | `bili search` (no login needed) |
| "全网搜一下 LLM 框架对比" | Exa semantic search (via mcporter, MCP, no key) |
| "订阅这个 RSS" | `feedparser` |
| V2EX 热门帖子 / 节点帖子 / 帖子详情+回复 / 用户信息 | no configuration needed |

## Requests that need the user to configure a platform first

If the user's request needs one of these, tell them: **"帮我配 XXX"** unlocks it —
do not attempt it silently, because each of these needs a login/cookie step only
the user can perform.

| Platform | What configuring unlocks | How it gets configured |
|---|---|---|
| Twitter/X | search, timeline, long-form reads (reading a single tweet works with zero config) | user says "帮我配 Twitter"; Cookie must come from the user's own Cookie-Editor export |
| 小红书 (XiaoHongShu) | search, reading, comments | OpenCLI reuses the user's own existing Chrome session only; Agent Reach does not perform XHS login and does not read XHS browser cookies itself |
| Reddit | search, reading posts/comments | no zero-config path exists (anonymous API is blocked); desktop OpenCLI with browser login, or rdt-cli + cookie |
| Facebook | search, home, feed, group list | desktop OpenCLI reusing Chrome login |
| Instagram | user search, profile, recent posts, Explore | desktop OpenCLI reusing Chrome login |
| LinkedIn | profile detail, company pages, job search (public pages already readable via Jina Reader) | user says "帮我配 LinkedIn" |
| B站字幕 | subtitles (search + video detail already work with zero config via bili-cli) | user says "帮我配 B站" |
| 雪球 | stock quotes, stock search, hot posts, hot stock ranking | user says "帮我配雪球" |
| 小宇宙播客 | podcast audio-to-text (Whisper transcription, free key) | user says "帮我配小宇宙播客" |

## Important caveats to relay, not to route around

- Twitter Cookie, once saved, is only used by `agent-reach doctor` to check that
  configuration is complete. Running the upstream `twitter` command directly
  still requires `TWITTER_AUTH_TOKEN` and `TWITTER_CT0` to be set explicitly in
  the current process environment.
- `agent-reach configure xhs-cookies` does not inject a cookie into OpenCLI or
  Chrome. If there is no existing Chrome session, the user must fall back to a
  manual Cookie-Editor export and configure `xiaohongshu-mcp` or the legacy
  tool instead.
- Cookies/tokens are stored only locally (`~/.agent-reach/config.yaml`, file
  mode 600) and are never uploaded.
- Any platform reached via cookie/login (Twitter, XiaoHongShu, Reddit,
  Facebook, Instagram) carries a ban risk from automated access; the source
  README recommends a dedicated secondary account, not the user's main one.
