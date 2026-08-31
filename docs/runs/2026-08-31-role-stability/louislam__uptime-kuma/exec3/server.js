'use strict';

/**
 * PulseWatch server: a fancy, reactive, self-hosted monitoring tool.
 *
 * Zero runtime dependencies -- everything below is Node.js core:
 * http, fs, path, url, crypto. Static assets, a JSON REST API, a
 * Server-Sent-Events stream for live updates, and a background
 * scheduler that checks every active monitor on a fixed interval
 * all live in this one process, matching the "self-hosted, single
 * binary-ish" spirit of the tool this was built after.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const { Store } = require('./lib/store');
const { runCheck } = require('./lib/monitors');
const { dispatch } = require('./lib/notify');
const { buildStatusPageData, resolveSlugForHost } = require('./lib/statuspages');
const auth = require('./lib/auth');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const SESSION_COOKIE = 'pulsewatch_session';

const store = new Store();

// ---- SSE subscriber registry ----
const sseClients = new Set();
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    res.write(payload);
  }
}

// ---- scheduler ----
let lastTransition = {}; // monitorId -> last status, to detect up/down transitions

async function tickMonitor(monitor) {
  if (!monitor.active) return;
  let heartbeat;
  try {
    heartbeat = await runCheck(monitor, store);
  } catch (err) {
    heartbeat = { status: 'down', ms: null, msg: `Checker crashed: ${err.message}`, time: new Date().toISOString() };
  }
  store.pushHeartbeat(monitor.id, heartbeat);
  broadcast('heartbeat', { monitorId: monitor.id, heartbeat });

  const prev = lastTransition[monitor.id];
  lastTransition[monitor.id] = heartbeat.status;
  const isTransition = prev && prev !== heartbeat.status && heartbeat.status !== 'pending';
  if (isTransition) {
    const channels = store.listNotifications().filter((n) => (monitor.notificationIds || []).includes(n.id));
    for (const channel of channels) {
      dispatch(channel, monitor, heartbeat).catch((err) => {
        // Notification failures must never crash the scheduler; they are
        // reported to the console since that is always available on a
        // self-hosted box even when every other channel is broken.
        console.error(`[notify:${channel.type}] failed for monitor "${monitor.name}": ${err.message}`);
      });
    }
  }
}

function scheduleLoop() {
  const intervalMs = (store.db.settings.checkIntervalSeconds || 20) * 1000;
  setInterval(() => {
    for (const monitor of store.listMonitors()) {
      if (monitor.type === 'push') continue; // push monitors are passive; still checked for staleness below
      tickMonitor(monitor);
    }
    // Push monitors: re-evaluate staleness every tick without contacting anything.
    for (const monitor of store.listMonitors().filter((m) => m.type === 'push')) {
      tickMonitor(monitor);
    }
  }, intervalMs);
}

// ---- request helpers ----

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return out;
}

function currentUser(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const session = store.getSession(token);
  if (!session) return null;
  return store.listUsers().find((u) => u.id === session.userId) || null;
}

function requireAuth(req, res) {
  const user = currentUser(req);
  if (!user) {
    sendJson(res, 401, { error: 'Authentication required' });
    return null;
  }
  return user;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8'
};

function serveStatic(req, res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ---- route table ----

async function handleApi(req, res, parsed) {
  const segments = parsed.pathname.split('/').filter(Boolean); // ['api', ...]

  // Public, unauthenticated endpoints first.
  if (segments[1] === 'push' && segments[2] && req.method === 'GET') {
    const monitor = store.listMonitors().find((m) => m.pushToken === segments[2]);
    if (!monitor) return sendJson(res, 404, { error: 'Unknown push token' });
    const query = parsed.query || {};
    const beat = {
      status: query.status === 'down' ? 'down' : 'up',
      ms: query.ping ? Number(query.ping) : null,
      msg: query.msg || 'Received push',
      time: new Date().toISOString()
    };
    store.pushHeartbeat(monitor.id, beat);
    broadcast('heartbeat', { monitorId: monitor.id, heartbeat: beat });
    return sendJson(res, 200, { ok: true });
  }

  if (segments[1] === 'status' && segments[2] && req.method === 'GET') {
    const page = store.getStatusPage(segments[2]);
    if (!page) return sendJson(res, 404, { error: 'Status page not found' });
    return sendJson(res, 200, buildStatusPageData(page, store));
  }

  if (segments[1] === 'setup' && req.method === 'POST') {
    if (store.listUsers().length > 0) return sendJson(res, 409, { error: 'Already set up' });
    const body = await readBody(req);
    if (!body.username || !body.password) return sendJson(res, 400, { error: 'username and password required' });
    const user = store.addUser({ username: body.username, passwordHash: auth.hashPassword(body.password), totpSecret: null });
    return sendJson(res, 201, { id: user.id, username: user.username });
  }

  if (segments[1] === 'login' && req.method === 'POST') {
    const body = await readBody(req);
    const user = store.getUserByName(body.username || '');
    if (!user || !auth.verifyPassword(body.password || '', user.passwordHash)) {
      return sendJson(res, 401, { error: 'Invalid credentials' });
    }
    if (user.totpSecret) {
      if (!body.totp || !auth.verifyTotp(user.totpSecret, body.totp)) {
        return sendJson(res, 401, { error: 'Invalid or missing 2FA code' });
      }
    }
    const token = store.createSession(user.id, SESSION_TTL_MS);
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`);
    return sendJson(res, 200, { ok: true, twoFactorEnabled: !!user.totpSecret });
  }

  if (segments[1] === 'logout' && req.method === 'POST') {
    const cookies = parseCookies(req);
    if (cookies[SESSION_COOKIE]) store.destroySession(cookies[SESSION_COOKIE]);
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0`);
    return sendJson(res, 200, { ok: true });
  }

  if (segments[1] === 'me' && req.method === 'GET') {
    const user = currentUser(req);
    return sendJson(res, 200, {
      authenticated: !!user,
      needsSetup: store.listUsers().length === 0,
      username: user ? user.username : null,
      twoFactorEnabled: user ? !!user.totpSecret : false
    });
  }

  // Everything past this point requires a session.
  const user = requireAuth(req, res);
  if (!user) return;

  if (segments[1] === '2fa' && segments[2] === 'setup' && req.method === 'POST') {
    const secret = auth.generateTotpSecret();
    user.totpSecret = secret; // staged; not persisted until /2fa/confirm succeeds
    return sendJson(res, 200, { secret, uri: auth.totpUri(secret, user.username, 'PulseWatch') });
  }

  if (segments[1] === '2fa' && segments[2] === 'confirm' && req.method === 'POST') {
    const body = await readBody(req);
    if (!user.totpSecret || !auth.verifyTotp(user.totpSecret, body.totp || '')) {
      return sendJson(res, 400, { error: 'Code did not match' });
    }
    store._flush();
    return sendJson(res, 200, { ok: true });
  }

  if (segments[1] === 'monitors' && !segments[2] && req.method === 'GET') {
    const monitors = store.listMonitors().map((m) => {
      const beats = store.getHeartbeats(m.id);
      const last = beats[beats.length - 1];
      return Object.assign({}, m, {
        lastHeartbeat: last || null,
        uptime24h: store.uptimePercent(m.id)
      });
    });
    return sendJson(res, 200, monitors);
  }

  if (segments[1] === 'monitors' && !segments[2] && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.name || !body.type) return sendJson(res, 400, { error: 'name and type required' });
    const monitor = store.addMonitor(body);
    return sendJson(res, 201, monitor);
  }

  if (segments[1] === 'monitors' && segments[2] && !segments[3] && req.method === 'PUT') {
    const body = await readBody(req);
    const updated = store.updateMonitor(segments[2], body);
    if (!updated) return sendJson(res, 404, { error: 'Monitor not found' });
    return sendJson(res, 200, updated);
  }

  if (segments[1] === 'monitors' && segments[2] && !segments[3] && req.method === 'DELETE') {
    store.removeMonitor(segments[2]);
    return sendJson(res, 200, { ok: true });
  }

  if (segments[1] === 'monitors' && segments[2] && segments[3] === 'heartbeats' && req.method === 'GET') {
    return sendJson(res, 200, store.getHeartbeats(segments[2]));
  }

  if (segments[1] === 'monitors' && segments[2] && segments[3] === 'check-now' && req.method === 'POST') {
    const monitor = store.getMonitor(segments[2]);
    if (!monitor) return sendJson(res, 404, { error: 'Monitor not found' });
    await tickMonitor(monitor);
    return sendJson(res, 200, { ok: true });
  }

  if (segments[1] === 'notifications' && !segments[2] && req.method === 'GET') {
    return sendJson(res, 200, store.listNotifications());
  }

  if (segments[1] === 'notifications' && !segments[2] && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.type) return sendJson(res, 400, { error: 'type required' });
    return sendJson(res, 201, store.addNotification(body));
  }

  if (segments[1] === 'notifications' && segments[2] && req.method === 'DELETE') {
    store.removeNotification(segments[2]);
    return sendJson(res, 200, { ok: true });
  }

  if (segments[1] === 'status-pages' && !segments[2] && req.method === 'GET') {
    return sendJson(res, 200, store.listStatusPages());
  }

  if (segments[1] === 'status-pages' && !segments[2] && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.slug || !body.title) return sendJson(res, 400, { error: 'slug and title required' });
    return sendJson(res, 201, store.addStatusPage(body));
  }

  return sendJson(res, 404, { error: 'Unknown API route' });
}

function handleSse(req, res) {
  if (!currentUser(req)) {
    sendJson(res, 401, { error: 'Authentication required' });
    return;
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.write(': connected\n\n');
  sseClients.add(res);
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);

  if (parsed.pathname === '/events') return handleSse(req, res);

  if (parsed.pathname.startsWith('/api/')) {
    try {
      await handleApi(req, res, parsed);
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // A hostname mapped to a status page (custom-domain status pages).
  const mappedSlug = resolveSlugForHost(store, req.headers.host);
  if (mappedSlug && parsed.pathname === '/') {
    return serveStatic(req, res, path.join(PUBLIC_DIR, 'status.html'));
  }

  if (parsed.pathname.startsWith('/status/')) {
    return serveStatic(req, res, path.join(PUBLIC_DIR, 'status.html'));
  }

  let relPath = parsed.pathname === '/' ? '/index.html' : parsed.pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, relPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendJson(res, 400, { error: 'Bad path' });
  }
  serveStatic(req, res, filePath);
});

scheduleLoop();

server.listen(PORT, HOST, () => {
  console.log(`PulseWatch listening on http://${HOST}:${PORT}`);
  console.log(`Checking monitors every ${store.db.settings.checkIntervalSeconds}s.`);
});

module.exports = server;
