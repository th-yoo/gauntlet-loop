"""SQLite storage layer. Stdlib only (sqlite3).

Keeps monitor definitions, heartbeats (for uptime % and the ping chart),
users (for login + 2FA), and status pages (README: "Multiple status pages",
"Map status pages to specific domains").
"""
import json
import sqlite3
import threading
import time


class Database:
    def __init__(self, path: str):
        self.path = path
        self._local = threading.local()
        self._init_schema()

    def _conn(self) -> sqlite3.Connection:
        conn = getattr(self._local, "conn", None)
        if conn is None:
            conn = sqlite3.connect(self.path, check_same_thread=False)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL")
            self._local.conn = conn
        return conn

    def _init_schema(self):
        conn = self._conn()
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS monitors (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                target TEXT,
                interval_sec INTEGER NOT NULL DEFAULT 20,
                keyword TEXT,
                json_path TEXT,
                expected_status INTEGER DEFAULT 200,
                push_token TEXT,
                proxy TEXT,
                active INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS heartbeats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                monitor_id TEXT NOT NULL,
                ts REAL NOT NULL,
                up INTEGER NOT NULL,
                ping_ms REAL,
                msg TEXT,
                cert_json TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_heartbeats_monitor_ts
                ON heartbeats(monitor_id, ts);

            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                pw_hash TEXT NOT NULL,
                pw_salt TEXT NOT NULL,
                totp_secret TEXT,
                totp_enabled INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS status_pages (
                slug TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                monitor_ids_json TEXT NOT NULL,
                domain TEXT
            );
            """
        )
        conn.commit()

    # ---- monitors ----
    def upsert_monitor(self, m: dict):
        conn = self._conn()
        conn.execute(
            """
            INSERT INTO monitors (id, name, type, target, interval_sec, keyword,
                                   json_path, expected_status, push_token, proxy, active)
            VALUES (:id, :name, :type, :target, :interval_sec, :keyword,
                    :json_path, :expected_status, :push_token, :proxy, :active)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name, type=excluded.type, target=excluded.target,
                interval_sec=excluded.interval_sec, keyword=excluded.keyword,
                json_path=excluded.json_path, expected_status=excluded.expected_status,
                push_token=excluded.push_token, proxy=excluded.proxy, active=excluded.active
            """,
            {
                "id": m["id"], "name": m["name"], "type": m["type"],
                "target": m.get("target"), "interval_sec": m.get("interval_sec", 20),
                "keyword": m.get("keyword"), "json_path": m.get("json_path"),
                "expected_status": m.get("expected_status", 200),
                "push_token": m.get("push_token"), "proxy": m.get("proxy"),
                "active": 1 if m.get("active", True) else 0,
            },
        )
        conn.commit()

    def list_monitors(self):
        conn = self._conn()
        return [dict(r) for r in conn.execute("SELECT * FROM monitors ORDER BY name")]

    def get_monitor(self, monitor_id: str):
        conn = self._conn()
        row = conn.execute("SELECT * FROM monitors WHERE id=?", (monitor_id,)).fetchone()
        return dict(row) if row else None

    def get_monitor_by_push_token(self, token: str):
        conn = self._conn()
        row = conn.execute("SELECT * FROM monitors WHERE push_token=?", (token,)).fetchone()
        return dict(row) if row else None

    def delete_monitor(self, monitor_id: str):
        conn = self._conn()
        conn.execute("DELETE FROM monitors WHERE id=?", (monitor_id,))
        conn.execute("DELETE FROM heartbeats WHERE monitor_id=?", (monitor_id,))
        conn.commit()

    # ---- heartbeats ----
    def add_heartbeat(self, monitor_id: str, up: bool, ping_ms, msg: str, cert_info=None, ts=None):
        conn = self._conn()
        conn.execute(
            "INSERT INTO heartbeats (monitor_id, ts, up, ping_ms, msg, cert_json) VALUES (?,?,?,?,?,?)",
            (monitor_id, ts if ts is not None else time.time(), 1 if up else 0, ping_ms, msg,
             json.dumps(cert_info) if cert_info else None),
        )
        conn.commit()

    def latest_heartbeat(self, monitor_id: str):
        conn = self._conn()
        row = conn.execute(
            "SELECT * FROM heartbeats WHERE monitor_id=? ORDER BY ts DESC LIMIT 1", (monitor_id,)
        ).fetchone()
        return dict(row) if row else None

    def heartbeats(self, monitor_id: str, limit: int = 100):
        conn = self._conn()
        rows = conn.execute(
            "SELECT * FROM heartbeats WHERE monitor_id=? ORDER BY ts DESC LIMIT ?",
            (monitor_id, limit),
        ).fetchall()
        return [dict(r) for r in reversed(rows)]

    def uptime_ratio(self, monitor_id: str, window_sec: float):
        conn = self._conn()
        since = time.time() - window_sec
        row = conn.execute(
            "SELECT COUNT(*) AS n, SUM(up) AS up_n FROM heartbeats WHERE monitor_id=? AND ts>=?",
            (monitor_id, since),
        ).fetchone()
        if not row or not row["n"]:
            return None
        return (row["up_n"] or 0) / row["n"]

    # ---- users ----
    def create_user(self, username, pw_hash, pw_salt, totp_secret=None, totp_enabled=False):
        conn = self._conn()
        conn.execute(
            "INSERT OR REPLACE INTO users (username, pw_hash, pw_salt, totp_secret, totp_enabled) "
            "VALUES (?,?,?,?,?)",
            (username, pw_hash, pw_salt, totp_secret, 1 if totp_enabled else 0),
        )
        conn.commit()

    def get_user(self, username):
        conn = self._conn()
        row = conn.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
        return dict(row) if row else None

    def any_user_exists(self):
        conn = self._conn()
        row = conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()
        return row["n"] > 0

    def set_totp(self, username, secret, enabled):
        conn = self._conn()
        conn.execute(
            "UPDATE users SET totp_secret=?, totp_enabled=? WHERE username=?",
            (secret, 1 if enabled else 0, username),
        )
        conn.commit()

    # ---- status pages ----
    def upsert_status_page(self, slug, title, monitor_ids, domain=None):
        conn = self._conn()
        conn.execute(
            "INSERT INTO status_pages (slug, title, monitor_ids_json, domain) VALUES (?,?,?,?) "
            "ON CONFLICT(slug) DO UPDATE SET title=excluded.title, "
            "monitor_ids_json=excluded.monitor_ids_json, domain=excluded.domain",
            (slug, title, json.dumps(monitor_ids), domain),
        )
        conn.commit()

    def get_status_page(self, slug):
        conn = self._conn()
        row = conn.execute("SELECT * FROM status_pages WHERE slug=?", (slug,)).fetchone()
        if not row:
            return None
        d = dict(row)
        d["monitor_ids"] = json.loads(d["monitor_ids_json"])
        return d

    def get_status_page_by_domain(self, domain):
        conn = self._conn()
        row = conn.execute("SELECT * FROM status_pages WHERE domain=?", (domain,)).fetchone()
        if not row:
            return None
        d = dict(row)
        d["monitor_ids"] = json.loads(d["monitor_ids_json"])
        return d

    def list_status_pages(self):
        conn = self._conn()
        out = []
        for row in conn.execute("SELECT * FROM status_pages"):
            d = dict(row)
            d["monitor_ids"] = json.loads(d["monitor_ids_json"])
            out.append(d)
        return out
