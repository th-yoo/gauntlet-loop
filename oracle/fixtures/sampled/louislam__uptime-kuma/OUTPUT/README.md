# Uptime Kuma Lite

A from-scratch, Python-standard-library-only implementation of "a fancy
self-hosted monitoring tool," built against the **feature list and install
instructions in the sampled `louislam/uptime-kuma` README** (the artifact at
`../README.md`). This is not a port of, and shares no code with, the actual
Uptime Kuma project -- the README is the only spec that was available.

## Why stdlib-only

The task rules for producing this artifact forbid running package managers
or installers. The source README's own "Non-Docker" install path
(`npm run setup`, PM2) needs npm and, implicitly, network access to a
registry. To be runnable as delivered, this rebuild avoids that dependency
entirely: everything here is `python3` standard library
(`http.server`, `sqlite3`, `ssl`, `hashlib`, `hmac`, `socket`, `smtplib`).

## Running it

```bash
python3 server.py
```

Then open `http://localhost:3001` -- deliberately the same port and the
same "now running on all network interfaces" framing the source README
uses for its own Docker/PM2 instructions. First run prompts you to create
an admin account (no seeded credentials are shipped). No outbound network
call happens on startup; the only sockets opened are the listening
dashboard socket and whatever checks the configured monitors ask for
(`monitors.json` ships with everything pointed at `127.0.0.1`, so a fresh
checkout monitors only itself).

## Feature list -> what's implemented

| README bullet | Status | Where |
|---|---|---|
| Monitoring uptime for HTTP(s) | Implemented | `app/monitors.py: check_http` |
| ... / TCP | Implemented | `app/monitors.py: check_tcp` |
| ... / HTTP(s) Keyword | Implemented | `check_http(keyword=...)` |
| ... / HTTP(s) Json Query | Implemented | `check_http(json_path=...)`, dot/bracket path resolver |
| ... / Ping | Approximated | TCP-connect timing, not ICMP (ICMP needs a raw socket / root; documented, not silently faked) |
| ... / DNS Record | Implemented | `check_dns` (A/AAAA via `getaddrinfo`) |
| ... / Push | Implemented | `POST /push/<token>`, staleness enforced by the scheduler |
| ... / Websocket monitor type | **Not implemented** | no protocol spec beyond the bullet itself |
| ... / Steam Game Server | **Not implemented** | needs the A2S query protocol, out of scope for a feature-list bullet |
| ... / Docker Containers | **Not implemented** | needs a Docker socket client |
| Fancy, Reactive, Fast UI/UX | Implemented | `static/*`, WebSocket push (see below), dark/light toggle |
| Notifications via Telegram/Discord/Gotify/Slack/Pushover/Email/90+ | Partially implemented | generic `WebhookNotifier` (covers the HTTP-webhook-based services), `EmailNotifier` (SMTP), `LogNotifier`; a pluggable `Notifier` interface for the rest |
| 20-second intervals | Implemented | default `interval_sec` in `monitors.json` / the add-monitor form |
| Multi Languages | **Not implemented** | out of scope; UI is English-only |
| Multiple status pages | Implemented | `status_pages` table, `/api/status-page/<slug>`, `#/status/<slug>` |
| Map status pages to specific domains | Implemented | `Database.get_status_page_by_domain`, matched against the request's `Host` header |
| Ping chart | Implemented | canvas chart in `static/app.js`, fed by `/api/monitors/<id>/heartbeats` |
| Certificate info | Implemented | `app/monitors.py: _get_cert_info`, surfaced via `/api/monitors/<id>/cert` |
| Proxy support | Implemented | per-monitor `proxy` field, used for HTTP(s) checks only |
| 2FA support | Implemented | `app/totp.py`, a from-scratch RFC 6238 TOTP (no external otplib) |
| "Try to use WebSocket with SPA instead of a REST API" (Motivation) | Implemented | `app/ws.py` is a minimal hand-rolled RFC 6455 server; the dashboard subscribes over `/ws` and gets heartbeats pushed, falling back to the REST endpoints (`/api/monitors`, `/api/monitors/<id>/heartbeats`) for anything not push-driven (initial monitor list load, chart history, status pages) |

## Route map

- `GET /`, `GET /static/*` -- the SPA and its assets
- `GET /ws` -- WebSocket upgrade; sends a `snapshot` message on connect, then a `heartbeat` message per check
- `GET /api/setup-required` -- whether first-run admin creation is needed
- `POST /api/setup` -- create the (single) admin account
- `POST /api/login`, `POST /api/logout`
- `GET /api/2fa/setup`, `POST /api/2fa/enable`, `POST /api/2fa/disable`
- `GET /api/monitors`, `POST /api/monitors` (create/update), `POST /api/monitors/<id>/delete`
- `GET /api/monitors/<id>/heartbeats?limit=N`
- `GET /api/monitors/<id>/cert`
- `POST /push/<token>?status=up|down&msg=...&ping=...` -- push heartbeat receiver
- `GET /api/status-page/<slug>`, `POST /api/status-pages` (create/update); a request whose `Host` header matches a page's configured domain is served that page even under a different slug in the URL

## Known limitations (stated here, not hidden)

- Single-process, single-admin-account: there's no multi-user/role model
  the source README doesn't describe one either.
- Sessions are in-memory bearer tokens; they don't survive a restart.
- "Ping" is TCP-connect latency, not an ICMP echo -- called out above and in
  the code, not presented as the real thing.
- No i18n: the README lists multi-language support as a feature; this build
  does not attempt it.
- The three monitor types requiring an external protocol/service client
  (Websocket target, Steam Game Server, Docker) are left unimplemented
  rather than stubbed to silently report "up".
