#!/usr/bin/env python3
"""Create the subscriber list database. Usage: init_db.py <path to .db>"""
import sqlite3, sys

path = sys.argv[1] if len(sys.argv) > 1 else "subscribers.db"
db = sqlite3.connect(path)
db.executescript(
    """
    CREATE TABLE IF NOT EXISTS subscribers (
      id     INTEGER PRIMARY KEY,
      email  TEXT NOT NULL UNIQUE,
      joined TEXT NOT NULL DEFAULT (date('now'))
    );
    CREATE INDEX IF NOT EXISTS subscribers_email ON subscribers(email);
    """
)
db.commit()
db.close()
print("subscribers table ready in", path)
