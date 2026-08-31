'use strict';

/**
 * Store: a tiny JSON-file-backed database.
 *
 * PulseWatch has no runtime dependencies, so instead of SQLite/Prisma it
 * keeps everything in memory and flushes to a single JSON document on
 * every mutation. That is enough for a self-hosted instance watching a
 * few dozen monitors; it is not meant to scale to a multi-tenant SaaS.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');
const MAX_HEARTBEATS_PER_MONITOR = 200;

function defaultDb() {
  return {
    users: [],
    monitors: [],
    heartbeats: {}, // monitorId -> array of { time, status, ms, msg, certDaysRemaining }
    notifications: [],
    statusPages: [],
    sessions: {}, // token -> { userId, expires }
    settings: {
      instanceName: 'PulseWatch',
      checkIntervalSeconds: 20,
      retries: 1
    }
  };
}

class Store {
  constructor(dbPath) {
    this.dbPath = dbPath || DB_PATH;
    this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.dbPath, 'utf8');
      this.db = JSON.parse(raw);
    } catch (err) {
      this.db = defaultDb();
      this._flush();
    }
  }

  _flush() {
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    const tmp = this.dbPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.db, null, 2));
    fs.renameSync(tmp, this.dbPath);
  }

  // ---- monitors ----

  listMonitors() {
    return this.db.monitors;
  }

  getMonitor(id) {
    return this.db.monitors.find((m) => m.id === id);
  }

  addMonitor(monitor) {
    const id = crypto.randomUUID();
    const record = Object.assign(
      {
        id,
        active: true,
        createdAt: new Date().toISOString(),
        retries: this.db.settings.retries,
        pushToken: monitor.type === 'push' ? crypto.randomBytes(16).toString('hex') : undefined
      },
      monitor,
      { id }
    );
    this.db.monitors.push(record);
    this.db.heartbeats[id] = [];
    this._flush();
    return record;
  }

  updateMonitor(id, patch) {
    const m = this.getMonitor(id);
    if (!m) return null;
    Object.assign(m, patch, { id });
    this._flush();
    return m;
  }

  removeMonitor(id) {
    this.db.monitors = this.db.monitors.filter((m) => m.id !== id);
    delete this.db.heartbeats[id];
    this._flush();
  }

  // ---- heartbeats ----

  pushHeartbeat(monitorId, beat) {
    if (!this.db.heartbeats[monitorId]) this.db.heartbeats[monitorId] = [];
    const arr = this.db.heartbeats[monitorId];
    arr.push(beat);
    if (arr.length > MAX_HEARTBEATS_PER_MONITOR) arr.shift();
    this._flush();
  }

  getHeartbeats(monitorId) {
    return this.db.heartbeats[monitorId] || [];
  }

  uptimePercent(monitorId, windowCount) {
    const beats = this.getHeartbeats(monitorId).slice(windowCount ? -windowCount : 0);
    if (beats.length === 0) return null;
    const up = beats.filter((b) => b.status === 'up').length;
    return (up / beats.length) * 100;
  }

  // ---- notifications ----

  listNotifications() {
    return this.db.notifications;
  }

  addNotification(n) {
    const record = Object.assign({ id: crypto.randomUUID() }, n);
    this.db.notifications.push(record);
    this._flush();
    return record;
  }

  removeNotification(id) {
    this.db.notifications = this.db.notifications.filter((n) => n.id !== id);
    this._flush();
  }

  // ---- status pages ----

  listStatusPages() {
    return this.db.statusPages;
  }

  getStatusPage(slug) {
    return this.db.statusPages.find((p) => p.slug === slug);
  }

  addStatusPage(page) {
    const record = Object.assign({ id: crypto.randomUUID() }, page);
    this.db.statusPages.push(record);
    this._flush();
    return record;
  }

  // ---- users / sessions ----

  listUsers() {
    return this.db.users;
  }

  getUserByName(username) {
    return this.db.users.find((u) => u.username === username);
  }

  addUser(user) {
    const record = Object.assign({ id: crypto.randomUUID() }, user);
    this.db.users.push(record);
    this._flush();
    return record;
  }

  createSession(userId, ttlMs) {
    const token = crypto.randomBytes(32).toString('hex');
    this.db.sessions[token] = { userId, expires: Date.now() + ttlMs };
    this._flush();
    return token;
  }

  getSession(token) {
    const s = this.db.sessions[token];
    if (!s) return null;
    if (s.expires < Date.now()) {
      delete this.db.sessions[token];
      this._flush();
      return null;
    }
    return s;
  }

  destroySession(token) {
    delete this.db.sessions[token];
    this._flush();
  }
}

module.exports = { Store, DB_PATH };
