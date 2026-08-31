'use strict';

/**
 * Monitor checkers: one function per monitor type, all built on Node's
 * core `http`, `https`, `net`, `tls`, `dns` and `child_process` modules.
 *
 * Supported today: http, http-keyword, json-query, tcp, ping, dns, push.
 * Steam Game Server and Docker Container checks are recognised but return
 * a "not implemented" heartbeat rather than crashing the scheduler --
 * both require a protocol (A2S) or a socket (dockerd) this build does not
 * ship a client for. That limitation is reported in the heartbeat message,
 * not hidden.
 */

const http = require('http');
const https = require('https');
const net = require('net');
const dns = require('dns');
const { spawn } = require('child_process');

const DEFAULT_TIMEOUT_MS = 10000;

function now() {
  return new Date().toISOString();
}

function up(ms, msg, extra) {
  return Object.assign({ status: 'up', ms, msg: msg || 'OK', time: now() }, extra || {});
}

function down(ms, msg) {
  return { status: 'down', ms: ms || null, msg: msg || 'Down', time: now() };
}

function pending(msg) {
  return { status: 'pending', ms: null, msg, time: now() };
}

function checkHttp(monitor) {
  return new Promise((resolve) => {
    let url;
    try {
      url = new URL(monitor.url);
    } catch (e) {
      resolve(down(null, `Invalid URL: ${monitor.url}`));
      return;
    }
    const lib = url.protocol === 'https:' ? https : http;
    const started = Date.now();
    const req = lib.request(
      url,
      {
        method: monitor.method || 'GET',
        timeout: monitor.timeoutMs || DEFAULT_TIMEOUT_MS,
        headers: monitor.headers || {}
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => {
          if (monitor.type === 'http-keyword' || monitor.type === 'json-query') chunks.push(c);
        });
        res.on('end', () => {
          const ms = Date.now() - started;
          const body = Buffer.concat(chunks).toString('utf8');
          const acceptedRange = monitor.acceptedStatusRange || [200, 299];
          const statusOk = res.statusCode >= acceptedRange[0] && res.statusCode <= acceptedRange[1];

          let certExtra = {};
          if (url.protocol === 'https:' && typeof res.socket.getPeerCertificate === 'function') {
            const cert = res.socket.getPeerCertificate();
            if (cert && cert.valid_to) {
              const validTo = new Date(cert.valid_to);
              const daysRemaining = Math.round((validTo.getTime() - Date.now()) / 86400000);
              certExtra = { certValidTo: cert.valid_to, certDaysRemaining: daysRemaining };
            }
          }

          if (!statusOk) {
            resolve(down(ms, `HTTP ${res.statusCode}`));
            return;
          }

          if (monitor.type === 'http-keyword') {
            const found = body.includes(monitor.keyword || '');
            const invert = !!monitor.keywordInverted;
            const passed = invert ? !found : found;
            if (!passed) {
              resolve(down(ms, `Keyword "${monitor.keyword}" ${invert ? 'unexpectedly found' : 'not found'}`));
              return;
            }
          }

          if (monitor.type === 'json-query') {
            try {
              const data = JSON.parse(body);
              const actual = jsonPath(data, monitor.jsonPath);
              const expected = monitor.expectedValue;
              if (String(actual) !== String(expected)) {
                resolve(down(ms, `JSON path "${monitor.jsonPath}" = ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`));
                return;
              }
            } catch (e) {
              resolve(down(ms, `Response is not valid JSON: ${e.message}`));
              return;
            }
          }

          resolve(up(ms, `HTTP ${res.statusCode}`, certExtra));
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (err) => resolve(down(Date.now() - started, err.message)));
    req.end();
  });
}

function jsonPath(obj, path) {
  if (!path) return obj;
  return path
    .split('.')
    .filter(Boolean)
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function checkTcp(monitor) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = net.createConnection({ host: monitor.host, port: monitor.port });
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(down(Date.now() - started, 'Connection timed out'));
    }, monitor.timeoutMs || DEFAULT_TIMEOUT_MS);

    socket.on('connect', () => {
      clearTimeout(timeout);
      const ms = Date.now() - started;
      socket.end();
      resolve(up(ms, `TCP connect OK on port ${monitor.port}`));
    });
    socket.on('error', (err) => {
      clearTimeout(timeout);
      resolve(down(Date.now() - started, err.message));
    });
  });
}

function checkPing(monitor) {
  return new Promise((resolve) => {
    const started = Date.now();
    // -c 1 (Linux/macOS) sends a single echo request; Windows uses -n.
    const isWin = process.platform === 'win32';
    const args = isWin ? ['-n', '1', monitor.host] : ['-c', '1', monitor.host];
    let child;
    try {
      child = spawn('ping', args);
    } catch (err) {
      resolve(down(null, `Unable to spawn ping: ${err.message}`));
      return;
    }
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.on('error', (err) => resolve(down(null, `ping failed: ${err.message}`)));
    child.on('close', (code) => {
      const ms = Date.now() - started;
      if (code === 0) {
        const match = out.match(/time[=<]([\d.]+)/i);
        const rtt = match ? parseFloat(match[1]) : ms;
        resolve(up(rtt, 'Host is reachable'));
      } else {
        resolve(down(ms, 'Host is unreachable'));
      }
    });
  });
}

function checkDns(monitor) {
  return new Promise((resolve) => {
    const started = Date.now();
    const type = (monitor.recordType || 'A').toUpperCase();
    dns.resolve(monitor.host, type, (err, records) => {
      const ms = Date.now() - started;
      if (err) {
        resolve(down(ms, err.message));
        return;
      }
      if (monitor.expectedValue) {
        const flat = records.map((r) => (typeof r === 'string' ? r : JSON.stringify(r)));
        if (!flat.some((r) => r.includes(monitor.expectedValue))) {
          resolve(down(ms, `Expected value "${monitor.expectedValue}" not present in ${type} records`));
          return;
        }
      }
      resolve(up(ms, `Resolved ${records.length} ${type} record(s)`));
    });
  });
}

function checkPush(monitor, store) {
  // Push monitors are considered "up" as long as an external caller has
  // hit /api/push/:token within the configured heartbeat interval; the
  // scheduler only checks the elapsed time, it never contacts anything.
  const beats = store.getHeartbeats(monitor.id);
  const last = beats[beats.length - 1];
  const graceMs = (monitor.intervalSeconds || 20) * 1000 * 2;
  if (!last) return Promise.resolve(pending('Waiting for first push'));
  const age = Date.now() - new Date(last.time).getTime();
  if (age > graceMs) return Promise.resolve(down(null, `No push received in ${Math.round(age / 1000)}s`));
  return Promise.resolve(up(last.ms, 'Received recent push', last));
}

function checkUnsupported(monitor) {
  return Promise.resolve(
    pending(`Monitor type "${monitor.type}" is recognised but has no built-in client in this build`)
  );
}

async function runCheck(monitor, store) {
  switch (monitor.type) {
    case 'http':
    case 'http-keyword':
    case 'json-query':
      return checkHttp(monitor);
    case 'tcp':
      return checkTcp(monitor);
    case 'ping':
      return checkPing(monitor);
    case 'dns':
      return checkDns(monitor);
    case 'push':
      return checkPush(monitor, store);
    case 'steam':
    case 'docker':
      return checkUnsupported(monitor);
    default:
      return down(null, `Unknown monitor type "${monitor.type}"`);
  }
}

module.exports = { runCheck };
