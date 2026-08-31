# PulseWatch

PulseWatch is a fancy, self-hosted monitoring tool. Point it at your sites,
servers, and background jobs; it checks them on a schedule, shows a live
reactive dashboard, and can page you the moment something goes down.

It ships as a single Node.js process with **zero runtime dependencies** --
no database server, no build step, nothing to `npm install` beyond Node
itself. Everything from HTTP checks to two-factor login to email alerts is
built on Node's standard library.

## Features

- Monitor HTTP(s), HTTP(s) with a required/forbidden keyword, HTTP(s) with a
  JSON-path assertion, raw TCP ports, ICMP ping, DNS records, and passive
  "push" heartbeats from your own scripts or cron jobs.
- A dark, reactive dashboard that updates live over Server-Sent Events --
  no page refresh needed to see a monitor flip from up to down.
- Notifications to Discord, Slack, Telegram, Gotify, Pushover, a generic
  JSON webhook, or plain SMTP email, fired on every up/down transition.
- Public status pages, addressable by slug or by mapping a domain straight
  to one, so you can share uptime without sharing the admin dashboard.
- A rolling ping-time sparkline and uptime percentage per monitor.
- TLS certificate expiry tracking for any HTTPS monitor -- no separate
  certificate checker needed.
- Username/password login with optional TOTP-based two-factor
  authentication (works with any standard authenticator app).
- A default 20-second check interval, configurable per instance.

Two monitor types are recognised in the schema (Steam Game Server and
Docker Container) but have no built-in client yet in this build; adding
one is a matter of writing a checker function next to the others in
`lib/monitors.js` and does not touch the scheduler, the API, or the UI.

## How to run it

### Docker Compose

```bash
docker compose up -d
```

This builds the image from the included `Dockerfile` and starts the
service on port 3001, persisting its data directory in a named volume.

### Docker, one-off

```bash
docker build -t pulsewatch .
docker run -d --restart=always -p 3001:3001 -v pulsewatch-data:/app/data --name pulsewatch pulsewatch
```

### Without Docker

Requirements: Node.js 18 or newer. That's it -- there is nothing to
install with a package manager.

```bash
node server.js
```

The dashboard is then reachable at `http://localhost:3001` (or
`http://your-host-ip:3001` from another machine on the network). The
first visit walks you through creating the admin account; there is no
default password to change later.

To keep it running in the background, use whatever process supervisor
you already have (systemd, pm2, a container restart policy) to run
`node server.js` and restart it if it exits.

## Configuring monitors

Monitors are created from the dashboard's "Add a monitor" panel, or via
the REST API once you're logged in:

```bash
curl -X POST http://localhost:3001/api/monitors \
  -H 'Content-Type: application/json' \
  --cookie "pulsewatch_session=<your session cookie>" \
  -d '{"name": "Homepage", "type": "http", "url": "https://example.com"}'
```

See `data/config.example.json` for one example of every monitor type's
expected fields.

## Notifications

Add a channel via `POST /api/notifications`, then attach its id to a
monitor's `notificationIds` array so it fires on that monitor's
transitions. Supported channel types and their required fields are
listed in `docs/NOTIFICATIONS.md`.

## Public status pages

`POST /api/status-pages` with a `slug`, a `title`, and a list of
`monitorIds` to expose. The page is then served at `/status/<slug>`, and
JSON at `/api/status/<slug>` for anyone who wants to build their own
front end against it. Optionally add a `domains` array to a status page
to have that hostname's root path serve the page directly.

## Two-factor authentication

From the dashboard, click "Enable 2FA," scan the shown secret into any
TOTP authenticator app, and confirm one generated code. From that point
on, logging in requires the current 6-digit code in addition to the
password.

## Project layout

```
server.js          HTTP server, routing, scheduler, SSE broadcast
lib/store.js        JSON-file-backed data store
lib/auth.js          password hashing + TOTP two-factor auth
lib/monitors.js      one checker function per monitor type
lib/notify.js        notification channel dispatch
lib/statuspages.js   public status page rendering data
public/              dashboard and status page front end (no framework)
data/                the JSON database lives here at runtime
```

## Design notes and honest limitations

- The data store is a single JSON file rewritten on every change. That
  is intentionally simple and fine for a personal or small-team
  instance; it is not built to hold years of dense heartbeat history
  or many concurrent writers. Heartbeat history is capped at 200 points
  per monitor for exactly that reason.
- Live updates use Server-Sent Events rather than a bidirectional
  WebSocket protocol -- it is a one-way "push new data to the open tab"
  channel, implemented with nothing beyond a kept-open HTTP response,
  which is sufficient for a status dashboard that never needs to send
  anything back over the same connection.
- The email notifier is a minimal hand-rolled SMTP client (EHLO,
  optional STARTTLS, AUTH LOGIN, DATA). It is enough to deliver a plain
  text alert through a typical relay; it is not a general-purpose mail
  library and does not support every authentication mechanism a mail
  provider might require.
- Steam Game Server and Docker Container monitors are stubbed to return
  a clear "not implemented" heartbeat instead of silently reporting
  "down" or crashing the scheduler.
