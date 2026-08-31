"""HTTP + WebSocket server for the dashboard, the JSON API, the push
receiver, and public status pages. Stdlib only (http.server, socketserver).

Route map is documented at the bottom of OUTPUT/README.md.
"""
import json
import mimetypes
import os
import re
import secrets
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from . import auth, notify, totp, ws

STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")


class Hub:
    """Registry of live WebSocket connections, used to push heartbeats to
    every connected dashboard the moment they happen (README motivation:
    "Try to use WebSocket with SPA instead of a REST API")."""

    def __init__(self):
        self._sockets = set()
        self._lock = threading.Lock()

    def add(self, sock):
        with self._lock:
            self._sockets.add(sock)

    def remove(self, sock):
        with self._lock:
            self._sockets.discard(sock)

    def broadcast(self, message: dict):
        data = json.dumps(message)
        dead = []
        with self._lock:
            targets = list(self._sockets)
        for sock in targets:
            try:
                ws.send_text(sock, data)
            except OSError:
                dead.append(sock)
        if dead:
            with self._lock:
                for s in dead:
                    self._sockets.discard(s)


def make_handler(db, sessions: auth.SessionStore, hub: Hub, notifier: notify.NotificationManager,
                  scheduler_ref: dict):
    class Handler(BaseHTTPRequestHandler):
        server_version = "UptimeKumaLite/1.0"

        def log_message(self, fmt, *args):
            pass  # keep stdout quiet; still could hook a real logger here

        # ---------- helpers ----------
        def _send_json(self, obj, status=200):
            body = json.dumps(obj).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _send_bytes(self, body: bytes, content_type: str, status=200):
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _read_json_body(self):
            length = int(self.headers.get("Content-Length", 0) or 0)
            if not length:
                return {}
            raw = self.rfile.read(length)
            try:
                return json.loads(raw.decode("utf-8"))
            except ValueError:
                return {}

        def _current_user(self):
            hdr = self.headers.get("Authorization", "")
            if not hdr.startswith("Bearer "):
                return None
            return sessions.username_for(hdr[len("Bearer "):])

        def _require_auth(self):
            user = self._current_user()
            if not user:
                self._send_json({"error": "unauthorized"}, 401)
                return None
            return user

        def _monitor_public(self, m):
            latest = db.latest_heartbeat(m["id"])
            uptime_24h = db.uptime_ratio(m["id"], 24 * 3600)
            m = dict(m)
            m.pop("push_token", None) if not self._current_user() else None
            m["latest"] = latest
            m["uptime_24h"] = uptime_24h
            return m

        # ---------- routing ----------
        def do_GET(self):
            parsed = urllib.parse.urlparse(self.path)
            path = parsed.path

            if path == "/ws" and self.headers.get("Upgrade", "").lower() == "websocket":
                return self._handle_ws_upgrade()

            if path == "/" or path == "/index.html":
                return self._serve_static("index.html")

            if path.startswith("/static/"):
                return self._serve_static(path[len("/static/"):])

            m = re.match(r"^/status/([A-Za-z0-9_-]+)$", path)
            if m:
                return self._serve_static("index.html")  # SPA renders the status route client-side

            if path == "/api/setup-required":
                return self._send_json({"required": not db.any_user_exists()})

            if path == "/api/monitors":
                monitors = [self._monitor_public(m) for m in db.list_monitors()]
                return self._send_json({"monitors": monitors})

            m = re.match(r"^/api/monitors/([A-Za-z0-9_-]+)/heartbeats$", path)
            if m:
                qs = urllib.parse.parse_qs(parsed.query)
                limit = int(qs.get("limit", ["100"])[0])
                return self._send_json({"heartbeats": db.heartbeats(m.group(1), limit)})

            m = re.match(r"^/api/monitors/([A-Za-z0-9_-]+)/cert$", path)
            if m:
                hb = db.latest_heartbeat(m.group(1))
                cert = json.loads(hb["cert_json"]) if hb and hb.get("cert_json") else None
                return self._send_json({"cert": cert})

            m = re.match(r"^/api/status-page/([A-Za-z0-9_-]+)$", path)
            if m:
                host = (self.headers.get("Host") or "").split(":")[0]
                page = db.get_status_page_by_domain(host) or db.get_status_page(m.group(1))
                if not page:
                    return self._send_json({"error": "not found"}, 404)
                monitors = [self._monitor_public(db.get_monitor(mid))
                            for mid in page["monitor_ids"] if db.get_monitor(mid)]
                return self._send_json({"title": page["title"], "monitors": monitors})

            if path == "/api/2fa/setup":
                user = self._require_auth()
                if not user:
                    return
                secret = totp.generate_secret()
                db.set_totp(user, secret, enabled=False)
                return self._send_json({
                    "secret": secret,
                    "provisioning_uri": totp.provisioning_uri(secret, user),
                })

            return self._send_json({"error": "not found"}, 404)

        def do_POST(self):
            parsed = urllib.parse.urlparse(self.path)
            path = parsed.path
            body = self._read_json_body()

            if path == "/api/setup":
                if db.any_user_exists():
                    return self._send_json({"error": "already set up"}, 400)
                username = (body.get("username") or "").strip()
                password = body.get("password") or ""
                if not username or len(password) < 8:
                    return self._send_json(
                        {"error": "username required, password must be >= 8 chars"}, 400)
                pw_hash, salt = auth.hash_password(password)
                db.create_user(username, pw_hash, salt)
                token = sessions.create(username)
                return self._send_json({"token": token})

            if path == "/api/login":
                username = body.get("username") or ""
                password = body.get("password") or ""
                user = db.get_user(username)
                if not user or not auth.verify_password(password, user["pw_hash"], user["pw_salt"]):
                    return self._send_json({"error": "invalid credentials"}, 401)
                if user["totp_enabled"]:
                    code = body.get("totp_code") or ""
                    if not totp.verify(user["totp_secret"], code):
                        return self._send_json({"error": "invalid or missing 2FA code"}, 401)
                token = sessions.create(username)
                return self._send_json({"token": token})

            if path == "/api/logout":
                hdr = self.headers.get("Authorization", "")
                if hdr.startswith("Bearer "):
                    sessions.revoke(hdr[len("Bearer "):])
                return self._send_json({"ok": True})

            if path == "/api/2fa/enable":
                user = self._require_auth()
                if not user:
                    return
                row = db.get_user(user)
                code = body.get("code") or ""
                if not row["totp_secret"] or not totp.verify(row["totp_secret"], code):
                    return self._send_json({"error": "invalid code"}, 400)
                db.set_totp(user, row["totp_secret"], enabled=True)
                return self._send_json({"ok": True})

            if path == "/api/2fa/disable":
                user = self._require_auth()
                if not user:
                    return
                db.set_totp(user, None, enabled=False)
                return self._send_json({"ok": True})

            if path == "/api/monitors":
                user = self._require_auth()
                if not user:
                    return
                mid = body.get("id") or secrets.token_hex(8)
                monitor = {
                    "id": mid,
                    "name": body.get("name") or mid,
                    "type": body.get("type") or "http",
                    "target": body.get("target") or "",
                    "interval_sec": int(body.get("interval_sec") or 20),
                    "keyword": body.get("keyword"),
                    "json_path": body.get("json_path"),
                    "expected_status": int(body.get("expected_status") or 200),
                    "push_token": body.get("push_token") or (
                        secrets.token_hex(16) if body.get("type") == "push" else None),
                    "proxy": body.get("proxy"),
                    "active": bool(body.get("active", True)),
                }
                db.upsert_monitor(monitor)
                scheduler = scheduler_ref.get("scheduler")
                if scheduler and monitor["active"]:
                    scheduler.start_monitor(mid)
                return self._send_json({"monitor": db.get_monitor(mid)})

            m = re.match(r"^/api/monitors/([A-Za-z0-9_-]+)/delete$", path)
            if m:
                user = self._require_auth()
                if not user:
                    return
                db.delete_monitor(m.group(1))
                return self._send_json({"ok": True})

            if path == "/api/status-pages":
                user = self._require_auth()
                if not user:
                    return
                db.upsert_status_page(
                    body.get("slug"), body.get("title") or body.get("slug"),
                    body.get("monitor_ids") or [], body.get("domain") or None,
                )
                return self._send_json({"ok": True})

            m = re.match(r"^/push/([A-Za-z0-9]+)$", path)
            if m:
                return self._handle_push(m.group(1), urllib.parse.parse_qs(parsed.query), body)

            return self._send_json({"error": "not found"}, 404)

        def do_DELETE(self):
            self.do_POST()  # DELETE bodies are unreliable across clients; POST /delete is canonical

        # ---------- push receiver ----------
        def _handle_push(self, token, qs, body):
            """README: "Push" monitor type -- an external cron/heartbeat
            script calls this URL; the monitor is up as long as pushes
            keep arriving within 2x its interval (enforced in the
            scheduler, which is what actually flips it down on silence)."""
            monitor = db.get_monitor_by_push_token(token)
            if not monitor:
                return self._send_json({"error": "unknown push token"}, 404)
            status = (qs.get("status", [None])[0] or body.get("status") or "up").lower()
            msg = qs.get("msg", [None])[0] or body.get("msg") or ""
            ping = qs.get("ping", [None])[0] or body.get("ping")
            db.add_heartbeat(monitor["id"], status == "up", float(ping) if ping else None, msg)
            hub.broadcast({"type": "heartbeat", "monitor_id": monitor["id"]})
            return self._send_json({"ok": True})

        # ---------- static files ----------
        def _serve_static(self, rel_path):
            rel_path = rel_path.lstrip("/")
            full = os.path.normpath(os.path.join(STATIC_DIR, rel_path))
            if not full.startswith(STATIC_DIR):
                return self._send_json({"error": "forbidden"}, 403)
            if not os.path.isfile(full):
                return self._send_json({"error": "not found"}, 404)
            ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
            with open(full, "rb") as f:
                self._send_bytes(f.read(), ctype)

        # ---------- websocket ----------
        def _handle_ws_upgrade(self):
            key = self.headers.get("Sec-WebSocket-Key")
            if not key:
                return self._send_json({"error": "bad request"}, 400)
            resp = ws.build_handshake_response(key)
            self.connection.sendall(resp)
            sock = self.connection
            hub.add(sock)
            self.close_connection = True  # stop BaseHTTPRequestHandler's normal keep-alive bookkeeping
            try:
                # Send an initial snapshot so a freshly connected dashboard
                # doesn't have to wait for the next heartbeat tick.
                monitors = [self._monitor_public(m) for m in db.list_monitors()]
                ws.send_text(sock, json.dumps({"type": "snapshot", "monitors": monitors}))
                while True:
                    opcode, payload = ws.read_frame(sock)
                    if opcode is None or opcode == 0x8:
                        break
            except (ConnectionError, OSError):
                pass
            finally:
                hub.remove(sock)
                try:
                    ws.send_close(sock)
                except OSError:
                    pass

    return Handler


def build_server(host, port, db, sessions, hub, notifier, scheduler_ref):
    handler = make_handler(db, sessions, hub, notifier, scheduler_ref)
    httpd = ThreadingHTTPServer((host, port), handler)
    return httpd
