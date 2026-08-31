"""Minimal RFC 6238 TOTP (Time-based One-Time Password) implementation.

Standard-library only (hmac, hashlib, struct, base64, time, os) so that
2FA support does not require installing any third-party package, in
keeping with "Uptime Kuma is an easy-to-use self-hosted monitoring tool"
having built-in 2FA (README: "2FA support").
"""
import base64
import hashlib
import hmac
import os
import struct
import time

_B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"


def generate_secret(length: int = 20) -> str:
    """Generate a random base32-encoded shared secret (default 160 bits)."""
    raw = os.urandom(length)
    return base64.b32encode(raw).decode("ascii").rstrip("=")


def _hotp(secret_b32: str, counter: int, digits: int = 6) -> str:
    # Pad base32 secret to a multiple of 8 chars before decoding.
    padded = secret_b32 + "=" * ((8 - len(secret_b32) % 8) % 8)
    key = base64.b32decode(padded.upper())
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    truncated = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(truncated % (10 ** digits)).zfill(digits)


def totp_now(secret_b32: str, step: int = 30, digits: int = 6, at: float = None) -> str:
    counter = int((at if at is not None else time.time()) // step)
    return _hotp(secret_b32, counter, digits)


def verify(secret_b32: str, code: str, step: int = 30, digits: int = 6, window: int = 1) -> bool:
    """Verify a submitted code, allowing +/- `window` steps of clock drift."""
    if not code or not code.isdigit():
        return False
    now = time.time()
    for delta in range(-window, window + 1):
        candidate = totp_now(secret_b32, step, digits, at=now + delta * step)
        if hmac.compare_digest(candidate, code):
            return True
    return False


def provisioning_uri(secret_b32: str, account: str, issuer: str = "Uptime-Kuma-Lite") -> str:
    """otpauth:// URI suitable for rendering as a QR code by the client."""
    return (
        f"otpauth://totp/{issuer}:{account}?secret={secret_b32}"
        f"&issuer={issuer}&algorithm=SHA1&digits=6&period=30"
    )
