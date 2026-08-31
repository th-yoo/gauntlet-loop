// Uptime Kuma Lite -- frontend. No build step, no framework: plain DOM +
// fetch + a raw WebSocket, which is what a "no npm install" stdlib-only
// backend can serve as static files without a bundler.

const state = {
  token: localStorage.getItem("ukl_token") || null,
  monitors: new Map(),
  charts: new Map(), // monitor_id -> array of {ts, ping_ms, up}
};

const app = document.getElementById("app");
const themeToggle = document.getElementById("theme-toggle");
const logoutBtn = document.getElementById("logout-btn");
const twofaBtn = document.getElementById("twofa-btn");
const overallDot = document.getElementById("overall-dot");

// ---------- theme ----------
function applyTheme() {
  const light = localStorage.getItem("ukl_theme") === "light";
  document.body.classList.toggle("light", light);
}
themeToggle.addEventListener("click", () => {
  const light = document.body.classList.toggle("light");
  localStorage.setItem("ukl_theme", light ? "light" : "dark");
});
applyTheme();

// ---------- fetch helpers ----------
async function api(path, opts = {}) {
  const headers = Object.assign({}, opts.headers || {});
  if (opts.body) headers["Content-Type"] = "application/json";
  if (state.token) headers["Authorization"] = "Bearer " + state.token;
  const res = await fetch(path, Object.assign({}, opts, { headers }));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
  return data;
}

function setToken(token) {
  state.token = token;
  if (token) localStorage.setItem("ukl_token", token);
  else localStorage.removeItem("ukl_token");
  logoutBtn.style.display = token ? "" : "none";
  twofaBtn.style.display = token ? "" : "none";
}
setToken(state.token);

logoutBtn.addEventListener("click", async () => {
  try { await api("/api/logout", { method: "POST" }); } catch (e) {}
  setToken(null);
  route();
});

// ---------- router ----------
window.addEventListener("hashchange", route);
function route() {
  const hash = location.hash || "";
  const statusMatch = hash.match(/^#\/status\/([A-Za-z0-9_-]+)$/);
  if (statusMatch) {
    renderStatusPage(statusMatch[1]);
    return;
  }
  boot();
}

async function boot() {
  let setupInfo;
  try {
    setupInfo = await api("/api/setup-required");
  } catch (e) {
    app.innerHTML = `<div class="panel"><p class="error">Cannot reach server: ${escapeHtml(e.message)}</p></div>`;
    return;
  }
  if (setupInfo.required) {
    renderSetup();
    return;
  }
  if (!state.token) {
    renderLogin();
    return;
  }
  renderDashboard();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ---------- setup / login ----------
function renderSetup() {
  app.innerHTML = `
    <div class="panel">
      <h2>Create the admin account</h2>
      <p class="hint">First run: no user exists yet.</p>
      <div class="form-row"><label>Username</label><input id="su-user" /></div>
      <div class="form-row"><label>Password (min 8 chars)</label><input id="su-pass" type="password" /></div>
      <div class="error" id="su-error"></div>
      <div class="actions"><button id="su-submit">Create account</button></div>
    </div>`;
  document.getElementById("su-submit").addEventListener("click", async () => {
    const username = document.getElementById("su-user").value.trim();
    const password = document.getElementById("su-pass").value;
    try {
      const data = await api("/api/setup", { method: "POST", body: JSON.stringify({ username, password }) });
      setToken(data.token);
      route();
    } catch (e) {
      document.getElementById("su-error").textContent = e.message;
    }
  });
}

function renderLogin() {
  app.innerHTML = `
    <div class="panel">
      <h2>Log in</h2>
      <div class="form-row"><label>Username</label><input id="li-user" /></div>
      <div class="form-row"><label>Password</label><input id="li-pass" type="password" /></div>
      <div class="form-row"><label>2FA code (if enabled)</label><input id="li-totp" placeholder="123456" /></div>
      <div class="error" id="li-error"></div>
      <div class="actions"><button id="li-submit">Log in</button></div>
      <p class="hint"><a href="#/status/public">View the public status page instead &rarr;</a></p>
    </div>`;
  document.getElementById("li-submit").addEventListener("click", async () => {
    const username = document.getElementById("li-user").value.trim();
    const password = document.getElementById("li-pass").value;
    const totp_code = document.getElementById("li-totp").value.trim();
    try {
      const data = await api("/api/login", { method: "POST", body: JSON.stringify({ username, password, totp_code }) });
      setToken(data.token);
      route();
    } catch (e) {
      document.getElementById("li-error").textContent = e.message;
    }
  });
}

// ---------- 2FA panel ----------
twofaBtn.addEventListener("click", async () => {
  try {
    const data = await api("/api/2fa/setup");
    app.innerHTML = `
      <div class="panel">
        <h2>Two-factor authentication</h2>
        <p class="hint">Add this secret to any TOTP app (Google Authenticator, Authy, ...):</p>
        <p><code>${escapeHtml(data.secret)}</code></p>
        <p class="hint">Or use this URI: <code>${escapeHtml(data.provisioning_uri)}</code></p>
        <div class="form-row"><label>Enter a code to enable</label><input id="tf-code" placeholder="123456" /></div>
        <div class="error" id="tf-error"></div>
        <div class="actions">
          <button id="tf-enable">Enable 2FA</button>
          <button class="secondary" id="tf-disable">Disable 2FA</button>
          <button class="secondary" id="tf-back">Back</button>
        </div>
      </div>`;
    document.getElementById("tf-back").addEventListener("click", renderDashboard);
    document.getElementById("tf-enable").addEventListener("click", async () => {
      try {
        await api("/api/2fa/enable", { method: "POST", body: JSON.stringify({ code: document.getElementById("tf-code").value.trim() }) });
        renderDashboard();
      } catch (e) {
        document.getElementById("tf-error").textContent = e.message;
      }
    });
    document.getElementById("tf-disable").addEventListener("click", async () => {
      await api("/api/2fa/disable", { method: "POST", body: "{}" });
      renderDashboard();
    });
  } catch (e) {
    alert(e.message);
  }
});

// ---------- dashboard ----------
let socket = null;

function connectSocket() {
  if (socket) { try { socket.close(); } catch (e) {} }
  const proto = location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${proto}://${location.host}/ws`);
  socket.addEventListener("message", (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }
    if (msg.type === "snapshot") {
      state.monitors.clear();
      for (const m of msg.monitors) state.monitors.set(m.id, m);
      renderMonitorGrid();
    } else if (msg.type === "heartbeat") {
      refreshOneMonitor(msg.monitor_id);
    }
  });
  socket.addEventListener("close", () => {
    setTimeout(() => { if (state.token || location.hash.startsWith("#/status/")) connectSocket(); }, 3000);
  });
}

async function refreshOneMonitor(id) {
  try {
    const data = await api("/api/monitors");
    for (const m of data.monitors) state.monitors.set(m.id, m);
    renderMonitorGrid();
    loadChart(id);
  } catch (e) { /* transient */ }
}

function renderDashboard() {
  app.innerHTML = `
    <div class="actions" style="margin-bottom:16px">
      <button id="add-monitor-btn">+ Add monitor</button>
      <a href="#/status/public" target="_blank"><button class="secondary" type="button">Open public status page</button></a>
    </div>
    <div id="monitor-grid" class="grid"></div>
    <div id="add-monitor-form" style="display:none"></div>
  `;
  document.getElementById("add-monitor-btn").addEventListener("click", toggleAddForm);
  connectSocket();
  api("/api/monitors").then((data) => {
    for (const m of data.monitors) state.monitors.set(m.id, m);
    renderMonitorGrid();
  }).catch(() => {});
}

function badgeFor(m) {
  if (!m.latest) return `<span class="badge pending">pending</span>`;
  return m.latest.up
    ? `<span class="badge up">up</span>`
    : `<span class="badge down">down</span>`;
}

function renderMonitorGrid() {
  const grid = document.getElementById("monitor-grid");
  if (!grid) return;
  const monitors = Array.from(state.monitors.values());
  const anyDown = monitors.some((m) => m.latest && !m.latest.up);
  overallDot.style.background = anyDown ? "var(--down)" : "var(--up)";
  overallDot.style.boxShadow = `0 0 8px ${anyDown ? "var(--down)" : "var(--up)"}`;

  grid.innerHTML = monitors.map((m) => `
    <div class="card" data-id="${m.id}">
      <div class="card-header">
        <span class="card-title">${escapeHtml(m.name)}</span>
        ${badgeFor(m)}
      </div>
      <div class="meta">${escapeHtml(m.type.toUpperCase())} &middot; ${escapeHtml(m.target || "(push)")}</div>
      <div class="meta">Interval: ${m.interval_sec}s &middot; Uptime (24h): ${
        m.uptime_24h == null ? "n/a" : (m.uptime_24h * 100).toFixed(2) + "%"
      }</div>
      <div class="meta">${m.latest ? escapeHtml(m.latest.msg || "") : ""}</div>
      <canvas class="chart" id="chart-${m.id}" width="600" height="60"></canvas>
      ${m.cert ? "" : ""}
      <div class="actions">
        <button class="secondary" data-action="delete" data-id="${m.id}">Delete</button>
        ${m.type === "http" && (m.target || "").startsWith("https://")
          ? `<button class="secondary" data-action="cert" data-id="${m.id}">Cert info</button>` : ""}
      </div>
    </div>
  `).join("") || `<p class="hint">No monitors yet. Add one to get started.</p>`;

  grid.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api(`/api/monitors/${btn.dataset.id}/delete`, { method: "POST" });
      state.monitors.delete(btn.dataset.id);
      renderMonitorGrid();
    });
  });
  grid.querySelectorAll('[data-action="cert"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const data = await api(`/api/monitors/${btn.dataset.id}/cert`);
      alert(data.cert ? JSON.stringify(data.cert, null, 2) : "No certificate info yet -- wait for the next check.");
    });
  });

  for (const m of monitors) loadChart(m.id);
}

async function loadChart(id) {
  const canvas = document.getElementById(`chart-${id}`);
  if (!canvas) return;
  let data;
  try {
    data = await api(`/api/monitors/${id}/heartbeats?limit=60`);
  } catch (e) { return; }
  drawChart(canvas, data.heartbeats || []);
}

function drawChart(canvas, heartbeats) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (!heartbeats.length) return;
  const pings = heartbeats.map((hb) => hb.ping_ms || 0);
  const max = Math.max(...pings, 1);
  const step = w / Math.max(heartbeats.length - 1, 1);
  ctx.beginPath();
  heartbeats.forEach((hb, i) => {
    const x = i * step;
    const y = h - (hb.ping_ms ? (hb.ping_ms / max) * (h - 8) : 0) - 4;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#5b8def";
  ctx.lineWidth = 2;
  ctx.stroke();
  // down markers
  heartbeats.forEach((hb, i) => {
    if (!hb.up) {
      const x = i * step;
      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(x - 1, 0, 2, h);
    }
  });
}

// ---------- add monitor form ----------
function toggleAddForm() {
  const el = document.getElementById("add-monitor-form");
  const showing = el.style.display !== "none";
  if (showing) { el.style.display = "none"; return; }
  el.style.display = "";
  el.innerHTML = `
    <div class="panel" style="margin-top:0">
      <h3>Add monitor</h3>
      <div class="form-row"><label>Name</label><input id="am-name" /></div>
      <div class="form-row"><label>Type</label>
        <select id="am-type">
          <option value="http">HTTP(s)</option>
          <option value="keyword">HTTP(s) Keyword</option>
          <option value="json-query">HTTP(s) JSON Query</option>
          <option value="tcp">TCP</option>
          <option value="ping">Ping (TCP-connect approximation)</option>
          <option value="dns">DNS Record</option>
          <option value="push">Push</option>
        </select>
      </div>
      <div class="form-row"><label>Target (URL / host:port / hostname, n/a for Push)</label><input id="am-target" /></div>
      <div class="form-row"><label>Keyword (Keyword type only)</label><input id="am-keyword" /></div>
      <div class="form-row"><label>JSON path, e.g. status.ok (JSON Query type only)</label><input id="am-json" /></div>
      <div class="form-row"><label>Interval (seconds)</label><input id="am-interval" value="20" /></div>
      <div class="error" id="am-error"></div>
      <div class="actions">
        <button id="am-submit">Save</button>
        <button class="secondary" id="am-cancel" type="button">Cancel</button>
      </div>
    </div>`;
  document.getElementById("am-cancel").addEventListener("click", toggleAddForm);
  document.getElementById("am-submit").addEventListener("click", async () => {
    try {
      await api("/api/monitors", {
        method: "POST",
        body: JSON.stringify({
          name: document.getElementById("am-name").value.trim(),
          type: document.getElementById("am-type").value,
          target: document.getElementById("am-target").value.trim(),
          keyword: document.getElementById("am-keyword").value.trim() || null,
          json_path: document.getElementById("am-json").value.trim() || null,
          interval_sec: parseInt(document.getElementById("am-interval").value, 10) || 20,
        }),
      });
      toggleAddForm();
      const data = await api("/api/monitors");
      for (const m of data.monitors) state.monitors.set(m.id, m);
      renderMonitorGrid();
    } catch (e) {
      document.getElementById("am-error").textContent = e.message;
    }
  });
}

// ---------- public status page ----------
async function renderStatusPage(slug) {
  app.innerHTML = `<p class="hint">Loading status page...</p>`;
  let data;
  try {
    data = await api(`/api/status-page/${slug}`);
  } catch (e) {
    app.innerHTML = `<div class="panel"><p class="error">${escapeHtml(e.message)}</p></div>`;
    return;
  }
  const anyDown = data.monitors.some((m) => m.latest && !m.latest.up);
  app.innerHTML = `
    <div class="status-page-header">
      <h1>${escapeHtml(data.title)}</h1>
      <p class="overall ${anyDown ? "down" : "up"}">${anyDown ? "Some systems are down" : "All systems operational"}</p>
    </div>
    <div class="grid">
      ${data.monitors.map((m) => `
        <div class="card">
          <div class="card-header">
            <span class="card-title">${escapeHtml(m.name)}</span>
            ${badgeFor(m)}
          </div>
          <div class="meta">Uptime (24h): ${m.uptime_24h == null ? "n/a" : (m.uptime_24h * 100).toFixed(2) + "%"}</div>
        </div>
      `).join("")}
    </div>`;
  connectSocket();
}

route();
