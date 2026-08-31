#!/usr/bin/env python3
"""Uptime Kuma Lite -- entry point.

Standard-library only, so running it needs no `npm run setup`, no `pip
install`, no Docker pull -- just:

    python3 server.py

then open http://localhost:3001 (matches the README: "Uptime Kuma is now
running on all network interfaces (e.g. http://localhost:3001 ...)").

This process does not reach out to the network on its own; it only opens a
listening socket for the dashboard, plus whatever outbound checks the
monitors you configure ask it to make (which is the whole point of a
monitoring tool). With the bundled default config (monitors.json) every
check target is 127.0.0.1, so a fresh checkout monitors only itself.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import auth, db as db_mod, httpserver, monitors, notify

DEFAULT_PORT = 3001
DATA_DIR_DEFAULT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")


def load_default_monitors(db: db_mod.Database, config_path: str):
    if db.list_monitors():
        return
    if not os.path.isfile(config_path):
        return
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
    for m in config.get("monitors", []):
        db.upsert_monitor(m)
    for p in config.get("status_pages", []):
        db.upsert_status_page(p["slug"], p.get("title", p["slug"]),
                               p.get("monitor_ids", []), p.get("domain"))


def main():
    parser = argparse.ArgumentParser(description="Uptime Kuma Lite")
    parser.add_argument("--host", default="0.0.0.0",
                         help="bind address (README: runs on all network interfaces by default)")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--data-dir", default=DATA_DIR_DEFAULT)
    parser.add_argument("--config", default=os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "monitors.json"))
    parser.add_argument("--check-timeout", type=float, default=10.0)
    args = parser.parse_args()

    os.makedirs(args.data_dir, exist_ok=True)
    db_path = os.path.join(args.data_dir, "uptime-kuma-lite.sqlite3")
    db = db_mod.Database(db_path)

    load_default_monitors(db, args.config)

    notifier = notify.NotificationManager()
    notifier.add(notify.LogNotifier(os.path.join(args.data_dir, "notifications.log")))

    sessions = auth.SessionStore()
    hub = httpserver.Hub()
    scheduler_ref = {}

    def on_heartbeat(monitor_id):
        m = db.get_monitor(monitor_id)
        hb = db.latest_heartbeat(monitor_id)
        hub.broadcast({"type": "heartbeat", "monitor_id": monitor_id, "heartbeat": hb})
        if hb and not hb["up"]:
            notifier.notify_all(f"{m['name']} is DOWN", hb.get("msg") or "")

    scheduler = monitors.Scheduler(db, on_heartbeat=on_heartbeat, timeout=args.check_timeout)
    scheduler_ref["scheduler"] = scheduler
    scheduler.start_all()

    httpd = httpserver.build_server(args.host, args.port, db, sessions, hub, notifier, scheduler_ref)
    print(f"Uptime Kuma Lite is now running on all network interfaces "
          f"(e.g. http://localhost:{args.port} or http://your-ip:{args.port}).")
    if not db.any_user_exists():
        print("No admin account yet -- open the dashboard to create one (first-run setup).")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        scheduler.stop()
        httpd.shutdown()


if __name__ == "__main__":
    main()
