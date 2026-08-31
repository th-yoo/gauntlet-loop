'use strict';

/* Public status page: unauthenticated, polls every 30s. It infers its
 * slug either from a domain mapping resolved server-side (in which case
 * the API call below with the literal string "auto" is redirected to the
 * right page by the server) or from /status/<slug> in the URL. */

function slugFromPath() {
  const parts = location.pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('status');
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : 'auto';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function load() {
  const slug = slugFromPath();
  const res = await fetch(`/api/status/${encodeURIComponent(slug)}`);
  if (!res.ok) {
    document.getElementById('page-title').textContent = 'Status page not found';
    return;
  }
  const data = await res.json();
  document.title = data.title;
  document.getElementById('page-title').textContent = data.title;
  document.getElementById('page-description').textContent = data.description;

  const banner = document.getElementById('overall');
  banner.className = 'overall-banner ' + data.overall;
  banner.textContent =
    data.overall === 'all-systems-go'
      ? 'All systems operational'
      : data.overall === 'partial-outage'
      ? 'Some systems are experiencing issues'
      : 'Status unknown';

  const list = document.getElementById('status-monitor-list');
  list.innerHTML = '';
  for (const m of data.monitors) {
    const row = document.createElement('div');
    row.className = 'monitor';
    const dot = document.createElement('div');
    dot.className = 'status-dot ' + m.status;
    const info = document.createElement('div');
    info.innerHTML = `<div class="name">${escapeHtml(m.name)}</div>`;
    const badge = document.createElement('div');
    badge.className = 'uptime-badge';
    badge.textContent = m.uptime24h != null ? m.uptime24h.toFixed(1) + '%' : '--';
    row.appendChild(dot);
    row.appendChild(info);
    row.appendChild(document.createElement('div'));
    row.appendChild(badge);
    list.appendChild(row);
  }
}

load();
setInterval(load, 30000);
