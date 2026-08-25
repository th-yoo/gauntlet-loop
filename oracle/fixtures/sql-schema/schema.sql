-- Schema for the subscriber list.
CREATE TABLE IF NOT EXISTS subscribers (
  id       INTEGER PRIMARY KEY,
  email    TEXT NOT NULL UNIQUE,
  joined   TEXT NOT NULL DEFAULT (date('now'))
);

CREATE INDEX IF NOT EXISTS subscribers_email ON subscribers(email);
