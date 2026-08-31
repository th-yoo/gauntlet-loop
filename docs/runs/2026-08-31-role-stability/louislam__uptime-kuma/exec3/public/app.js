'use strict';

/* PulseWatch dashboard: no build step, no framework -- fetch() for the
 * REST calls and an EventSource for the live "reactive" heartbeat feed. */

const state = { monitors: [], heartbeatHistory: {} };

async function api(path, opts) {
  const res = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts));
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed: ${res.status}`);
  return body;
}

function $(id) { return document.getElementById(id); }

function showApp(show) {
  $('login-screen').classList.toggle('hidden', show);
  $('app').classList.toggle('hidden', !show);
}

async function boot() {
  try {
    const me = await api('/api/me');
    if (me.authenticated) {
      $('whoami').textContent = me.username;
      showApp(true);
      await loadMonitors();
      subscribeLive();
      renderTwoFactorStatus(me.twoFactorEnabled);
    } else {
      showApp(false);
      $('login-form').dataset.needsSetup = me.needsSetup ? '1' : '';
    }
  } catch (e) {
    showApp(false);
  }
}

$('login-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const username = $('login-username').value.trim();
  const password = $('login-password').value;
  const totp = $('login-totp').value.trim();
  $('login-error').textContent = '';
  try {
    if ($('login-form').dataset.needsSetup === '1') {
      await api('/api/setup', { method: 'POST', body: JSON.stringify({ username, password }) });
    }
    await api('/api/login', { method: 'POST', body: JSON.stringify({ username, password, totp }) });
    location.reload();
  } catch (e) {
    $('login-error').textContent = e.message;
  }
});

$('logout-btn').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  location.reload();
});

async function loadMonitors() {
  state.monitors = await api('/api/monitors');
  for (const m of state.monitors) {
    state.heartbeatHistory[m.id] = await api(`/api/monitors/${m.id}/heartbeats`);
  }
  renderMonitors();
  renderSummary();
}

function renderSummary() {
  const total = state.monitors.length;
  const up = state.monitors.filter((m) => m.lastHeartbeat && m.lastHeartbeat.status === 'up').length;
  const down = state.monitors.filter((m) => m.lastHeartbeat && m.lastHeartbeat.status === 'down').length;
  const uptimes = state.monitors.map((m) => m.uptime24h).filter((v) => v != null);
  const avgUptime = uptimes.length ? (uptimes.reduce((a, b) => a + b, 0) / uptimes.length).toFixed(1) + '%' : '-';
  $('stat-up').textContent = up;
  $('stat-down').textContent = down;
  $('stat-total').textContent = total;
  $('stat-uptime').textContent = avgUptime;
}

function drawSparkline(canvas, beats) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const values = beats.map((b) => (b.status === 'up' ? (b.ms || 1) : 0));
  if (values.length < 2) return;
  const max = Math.max(...values, 1);
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - (v / max) * h;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#7c5cff';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function renderMonitors() {
  const list = $('monitor-list');
  list.innerHTML = '';
  for (const m of state.monitors) {
    const row = document.createElement('div');
    row.className = 'monitor';
    row.dataset.id = m.id;

    const dot = document.createElement('div');
    dot.className = 'status-dot ' + (m.lastHeartbeat ? m.lastHeartbeat.status : 'pending');

    const info = document.createElement('div');
    info.innerHTML = `<div class="name">${escapeHtml(m.name)} <span style="color:var(--muted); font-weight:400; font-size:0.75rem;">(${m.type})</span></div>
      <div class="msg">${escapeHtml((m.lastHeartbeat && m.lastHeartbeat.msg) || 'Waiting for first check')}${m.lastHeartbeat && m.lastHeartbeat.certDaysRemaining != null ? ` -- cert expires in ${m.lastHeartbeat.certDaysRemaining}d` : ''}${m.type === 'push' ? ` -- push URL token: ${m.pushToken}` : ''}</div>`;

    const canvas = document.createElement('canvas');
    canvas.className = 'sparkline';
    canvas.width = 160;
    canvas.height = 32;

    const badge = document.createElement('div');
    badge.className = 'uptime-badge';
    badge.textContent = m.uptime24h != null ? m.uptime24h.toFixed(1) + '%' : '--';

    row.appendChild(dot);
    row.appendChild(info);
    row.appendChild(canvas);
    row.appendChild(badge);
    list.appendChild(row);

    drawSparkline(canvas, state.heartbeatHistory[m.id] || []);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function subscribeLive() {
  const source = new EventSource('/events');
  source.addEventListener('heartbeat', (ev) => {
    const data = JSON.parse(ev.data);
    const monitor = state.monitors.find((m) => m.id === data.monitorId);
    if (!monitor) return;
    monitor.lastHeartbeat = data.heartbeat;
    const history = state.heartbeatHistory[data.monitorId] || (state.heartbeatHistory[data.monitorId] = []);
    history.push(data.heartbeat);
    if (history.length > 200) history.shift();
    renderMonitors();
    renderSummary();
  });
}

$('add-monitor-btn').addEventListener('click', async () => {
  const name = $('new-name').value.trim();
  const type = $('new-type').value;
  const target = $('new-target').value.trim();
  if (!name || !target) return;

  let payload = { name, type };
  if (type === 'http' || type === 'http-keyword' || type === 'json-query') {
    payload.url = target;
  } else if (type === 'tcp') {
    const [host, port] = target.split(':');
    payload.host = host;
    payload.port = Number(port);
  } else if (type === 'ping' || type === 'dns') {
    payload.host = target;
  } else {
    payload.host = target;
  }

  await api('/api/monitors', { method: 'POST', body: JSON.stringify(payload) });
  $('new-name').value = '';
  $('new-target').value = '';
  await loadMonitors();
});

function renderTwoFactorStatus(enabled) {
  $('twofa-status').textContent = enabled ? 'Two-factor authentication is enabled.' : 'Two-factor authentication is not enabled.';
  $('twofa-start-btn').classList.toggle('hidden', enabled);
}

$('twofa-start-btn').addEventListener('click', async () => {
  const { secret } = await api('/api/2fa/setup', { method: 'POST' });
  $('twofa-secret').textContent = secret;
  $('twofa-setup').classList.remove('hidden');
});

$('twofa-confirm-btn').addEventListener('click', async () => {
  try {
    await api('/api/2fa/confirm', { method: 'POST', body: JSON.stringify({ totp: $('twofa-code').value.trim() }) });
    $('twofa-setup').classList.add('hidden');
    renderTwoFactorStatus(true);
  } catch (e) {
    alert(e.message);
  }
});

boot();
