"""Password hashing + session tokens. Stdlib only (hashlib, hmac, secrets)."""
import hashlib
import secrets
import time

_ITERATIONS = 200_000
_SESSION_TTL = 60 * 60 * 12  # 12 hours


def hash_password(password: str, salt: str = None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), _ITERATIONS)
    return digest.hex(), salt


def verify_password(password: str, pw_hash: str, salt: str) -> bool:
    digest, _ = hash_password(password, salt)
    return secrets.compare_digest(digest, pw_hash)


class SessionStore:
    """In-memory bearer-token sessions. Simple, and fine for a single
    self-hosted process the way Uptime Kuma itself is a single process."""

    def __init__(self):
        self._sessions = {}

    def create(self, username: str) -> str:
        token = secrets.token_urlsafe(32)
        self._sessions[token] = (username, time.time() + _SESSION_TTL)
        return token

    def username_for(self, token: str):
        entry = self._sessions.get(token)
        if not entry:
            return None
        username, expiry = entry
        if time.time() > expiry:
            del self._sessions[token]
            return None
        return username

    def revoke(self, token: str):
        self._sessions.pop(token, None)
