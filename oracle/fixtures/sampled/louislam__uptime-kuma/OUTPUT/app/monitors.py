"""Check implementations and the background scheduler.

README feature line implemented here:
"Monitoring uptime for HTTP(s) / TCP / HTTP(s) Keyword / HTTP(s) Json Query /
Ping / DNS Record / Push" and "Certificate info" and "Proxy support" and
"20-second intervals" (used as the default interval).

Not implemented in this lite build (documented in OUTPUT/README.md rather
than silently claimed): Websocket monitor type, Steam Game Server monitor,
Docker container monitor. Those need a game-query protocol / Docker socket
client this fixture has no spec for beyond a feature-list bullet.
"""
import json as _json
import socket
import ssl
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone


class CheckResult:
    __slots__ = ("up", "ping_ms", "msg", "cert_info")

    def __init__(self, up, ping_ms=None, msg="", cert_info=None):
        self.up = up
        self.ping_ms = ping_ms
        self.msg = msg
        self.cert_info = cert_info


def _get_cert_info(host: str, port: int, timeout: float):
    ctx = ssl.create_default_context()
    with socket.create_connection((host, port), timeout=timeout) as sock:
        with ctx.wrap_socket(sock, server_hostname=host) as tls:
            cert = tls.getpeercert()
    not_after = cert.get("notAfter")
    not_before = cert.get("notBefore")
    days_left = None
    if not_after:
        try:
            expiry = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
            days_left = (expiry - datetime.now(timezone.utc)).days
        except ValueError:
            pass
    issuer = dict(x[0] for x in cert.get("issuer", []))
    return {
        "issuer": issuer.get("organizationName") or issuer.get("commonName"),
        "valid_from": not_before,
        "valid_to": not_after,
        "days_left": days_left,
    }


def _resolve_json_path(data, path: str):
    """Very small dot/bracket path resolver, e.g. "a.b[0].c"."""
    cur = data
    token = ""
    tokens = []
    i = 0
    while i < len(path):
        c = path[i]
        if c == ".":
            if token:
                tokens.append(token)
                token = ""
        elif c == "[":
            if token:
                tokens.append(token)
                token = ""
            j = path.index("]", i)
            tokens.append(int(path[i + 1:j]))
            i = j
        else:
            token += c
        i += 1
    if token:
        tokens.append(token)
    for t in tokens:
        cur = cur[t]
    return cur


def check_http(target, expected_status=200, keyword=None, json_path=None,
                proxy=None, timeout=10):
    start = time.monotonic()
    try:
        handlers = []
        if proxy:
            handlers.append(urllib.request.ProxyHandler({"http": proxy, "https": proxy}))
        opener = urllib.request.build_opener(*handlers) if handlers else urllib.request.urlopen
        req = urllib.request.Request(target, headers={"User-Agent": "uptime-kuma-lite/1.0"})
        if handlers:
            with opener.open(req, timeout=timeout) as resp:
                status = resp.status
                body = resp.read(1_000_000)
        else:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                status = resp.status
                body = resp.read(1_000_000)
        ping_ms = (time.monotonic() - start) * 1000

        cert_info = None
        if target.lower().startswith("https://"):
            host = target.split("//", 1)[1].split("/", 1)[0].split(":")[0]
            try:
                cert_info = _get_cert_info(host, 443, timeout)
            except Exception:
                cert_info = None

        if status != expected_status:
            return CheckResult(False, ping_ms, f"Unexpected status {status}", cert_info)

        if keyword is not None:
            if keyword not in body.decode("utf-8", "replace"):
                return CheckResult(False, ping_ms, f"Keyword '{keyword}' not found", cert_info)

        if json_path is not None:
            try:
                data = _json.loads(body.decode("utf-8", "replace"))
                _resolve_json_path(data, json_path)
            except Exception as e:
                return CheckResult(False, ping_ms, f"JSON query failed: {e}", cert_info)

        return CheckResult(True, ping_ms, f"OK ({status})", cert_info)
    except urllib.error.HTTPError as e:
        ping_ms = (time.monotonic() - start) * 1000
        if e.code == expected_status:
            return CheckResult(True, ping_ms, f"OK ({e.code})")
        return CheckResult(False, ping_ms, f"HTTP error {e.code}")
    except Exception as e:
        ping_ms = (time.monotonic() - start) * 1000
        return CheckResult(False, ping_ms, str(e))


def check_tcp(target, timeout=10):
    """target format: "host:port". Also used as the approximation for
    "Ping" checks, since ICMP echo needs a raw socket / root privileges
    that a self-hosted app run as a normal user does not reliably have."""
    start = time.monotonic()
    try:
        host, port = target.rsplit(":", 1)
        with socket.create_connection((host, int(port)), timeout=timeout):
            pass
        ping_ms = (time.monotonic() - start) * 1000
        return CheckResult(True, ping_ms, "Connected")
    except Exception as e:
        ping_ms = (time.monotonic() - start) * 1000
        return CheckResult(False, ping_ms, str(e))


def check_dns(target, timeout=10):
    """target is a hostname; resolves A/AAAA records."""
    start = time.monotonic()
    try:
        results = socket.getaddrinfo(target, None)
        ping_ms = (time.monotonic() - start) * 1000
        addrs = sorted({r[4][0] for r in results})
        return CheckResult(True, ping_ms, "Resolved: " + ", ".join(addrs))
    except Exception as e:
        ping_ms = (time.monotonic() - start) * 1000
        return CheckResult(False, ping_ms, str(e))


def run_check(monitor: dict, timeout=10) -> CheckResult:
    mtype = monitor["type"]
    target = monitor.get("target") or ""
    if mtype in ("http", "https", "keyword", "json-query"):
        return check_http(
            target,
            expected_status=monitor.get("expected_status") or 200,
            keyword=monitor.get("keyword") if mtype == "keyword" else None,
            json_path=monitor.get("json_path") if mtype == "json-query" else None,
            proxy=monitor.get("proxy"),
            timeout=timeout,
        )
    if mtype in ("tcp", "ping"):
        return check_tcp(target, timeout=timeout)
    if mtype == "dns":
        return check_dns(target, timeout=timeout)
    if mtype == "push":
        # Liveness is decided by whether a push arrived recently; the
        # scheduler checks staleness for this type instead of calling out.
        return CheckResult(True, None, "Waiting for push")
    return CheckResult(False, None, f"Unknown monitor type: {mtype}")


class Scheduler:
    """One thread per active monitor, each sleeping its own interval.
    Broadcasts every heartbeat to `on_heartbeat` (used to push over
    WebSocket, matching the source project's "Try to use WebSocket with
    SPA instead of a REST API" motivation)."""

    def __init__(self, db, on_heartbeat=None, timeout=10):
        self.db = db
        self.on_heartbeat = on_heartbeat
        self.timeout = timeout
        self._threads = {}
        self._stop = threading.Event()

    def start_all(self):
        for m in self.db.list_monitors():
            if m["active"]:
                self.start_monitor(m["id"])

    def start_monitor(self, monitor_id):
        if monitor_id in self._threads:
            return
        t = threading.Thread(target=self._loop, args=(monitor_id,), daemon=True)
        self._threads[monitor_id] = t
        t.start()

    def stop(self):
        self._stop.set()

    def _loop(self, monitor_id):
        while not self._stop.is_set():
            monitor = self.db.get_monitor(monitor_id)
            if not monitor or not monitor["active"]:
                return
            if monitor["type"] == "push":
                # Push monitors are marked down if no push arrived within
                # 2x their expected interval; no outbound check to run.
                last = self.db.latest_heartbeat(monitor_id)
                stale = last is None or (time.time() - last["ts"]) > 2 * monitor["interval_sec"]
                if stale:
                    self.db.add_heartbeat(monitor_id, False, None, "No push received")
                    if self.on_heartbeat:
                        self.on_heartbeat(monitor_id)
            else:
                result = run_check(monitor, timeout=self.timeout)
                self.db.add_heartbeat(
                    monitor_id, result.up, result.ping_ms, result.msg, result.cert_info
                )
                if self.on_heartbeat:
                    self.on_heartbeat(monitor_id)
            self._stop.wait(monitor["interval_sec"])
