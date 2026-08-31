# Installation Guide

Three ways to get this running, in order of least to most manual effort.
Pick one; you don't need all three.

> **Warning:** whichever method you choose, do not point the data
> directory at an NFS-backed volume — network file systems of that kind
> are explicitly not supported. Use a local directory or a local Docker
> volume instead.

## Option 1: Docker Compose (recommended for most people)

1. Create a folder for the deployment and move into it.
2. Fetch the project's `compose.yaml` (a working starting point is
   provided alongside this guide as `compose.yaml`).
3. Bring the stack up in the background:

   ```bash
   docker compose up -d
   ```

Once it's up, the dashboard is reachable on port 3001 on every network
interface of the host (for example `http://localhost:3001` or
`http://<host-ip>:3001`).

## Option 2: Plain Docker, one command

If you don't want a compose file at all:

```bash
docker run -d --restart=always -p 3001:3001 -v uptime-kuma:/app/data --name uptime-kuma louislam/uptime-kuma:2
```

This exposes the dashboard on all network interfaces the same way as
the compose option. If you'd rather it only be reachable from the host
itself, bind the published port to loopback instead:

```bash
docker run ... -p 127.0.0.1:3001:3001 ...
```

(fill in the rest of the flags from the full command above).

## Option 3: Run it directly, without Docker

Only supported on a limited set of platforms — check before you commit
to this route.

**Supported:**
- Major Linux distributions (Debian, Ubuntu, Fedora, ArchLinux, and
  similar)
- Windows 10 (x64), Windows Server 2012 R2 (x64) or newer

**Not supported:**
- FreeBSD / OpenBSD / NetBSD
- Restrictive sandboxed hosting platforms (the kind that don't give you
  a normal persistent process, e.g. Replit- or Heroku-style hosting)

**You'll also need, before you start:**
- Node.js, version 20.4 or newer
- Git
- pm2, if you want the server to keep running in the background instead
  of dying when your terminal session ends (recommended)

**Steps:**

```bash
git clone <the project's repository URL>
cd <the cloned directory>
npm run setup

# Try it out directly, in the foreground:
node server/server.js

# Recommended instead: run it under pm2 in the background.
# Install pm2 first if you don't already have it:
npm install pm2 -g && pm2 install pm2-logrotate

# Then start the server under pm2:
pm2 start server/server.js --name uptime-kuma
```

As with the Docker options, the dashboard ends up on port 3001, on all
network interfaces of the host.

Handy pm2 commands once it's running this way:

```bash
# Watch live console output
pm2 monit

# Make it survive a reboot
pm2 startup && pm2 save
```

## If you need more than this

For anything beyond the basics above — routing it behind a reverse
proxy, or other advanced configuration — consult the project's own
"How to Install" wiki page rather than improvising, since those details
are maintained separately from the base installation steps.

## Keeping it up to date

Update procedures are also maintained on a separate wiki page rather
than here; follow that page's "How to Update" instructions when a new
version comes out, rather than guessing at an upgrade path.
