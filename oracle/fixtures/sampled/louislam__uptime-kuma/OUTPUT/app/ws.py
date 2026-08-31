"""A bare-bones RFC 6455 WebSocket server, stdlib only (hashlib, base64,
struct, socket). README motivation: "Try to use WebSocket with SPA instead
of a REST API" -- the dashboard here gets live heartbeats pushed to it over
a raw WebSocket instead of polling a REST endpoint.

This intentionally implements only what a JSON-text-frame, server-push
use case needs: the opening handshake, sending unmasked text frames
(RFC 6455 6.1, server-to-client frames MUST NOT be masked), and reading
masked client frames (for the client's initial subscribe message and for
close/ping control frames). It is not a general-purpose WebSocket library.
"""
import base64
import hashlib
import socket
import struct

_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


def accept_key(client_key: str) -> str:
    sha1 = hashlib.sha1((client_key + _GUID).encode("ascii")).digest()
    return base64.b64encode(sha1).decode("ascii")


def build_handshake_response(client_key: str) -> bytes:
    accept = accept_key(client_key)
    return (
        "HTTP/1.1 101 Switching Protocols\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Accept: {accept}\r\n\r\n"
    ).encode("ascii")


def send_text(sock: socket.socket, text: str):
    payload = text.encode("utf-8")
    header = bytearray()
    header.append(0x81)  # FIN + text opcode
    length = len(payload)
    if length <= 125:
        header.append(length)
    elif length <= 0xFFFF:
        header.append(126)
        header += struct.pack(">H", length)
    else:
        header.append(127)
        header += struct.pack(">Q", length)
    sock.sendall(bytes(header) + payload)


def send_close(sock: socket.socket, code: int = 1000):
    payload = struct.pack(">H", code)
    header = bytes([0x88, len(payload)])
    try:
        sock.sendall(header + payload)
    except OSError:
        pass


def _recv_exact(sock: socket.socket, n: int) -> bytes:
    buf = b""
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            raise ConnectionError("socket closed")
        buf += chunk
    return buf


def read_frame(sock: socket.socket):
    """Read one client frame. Returns (opcode, payload) or (None, None) on
    clean close. Only supports single-frame (FIN=1) messages, which is all
    this dashboard's client ever sends (small JSON subscribe/ping messages)."""
    header = _recv_exact(sock, 2)
    b0, b1 = header[0], header[1]
    opcode = b0 & 0x0F
    masked = bool(b1 & 0x80)
    length = b1 & 0x7F
    if length == 126:
        length = struct.unpack(">H", _recv_exact(sock, 2))[0]
    elif length == 127:
        length = struct.unpack(">Q", _recv_exact(sock, 8))[0]
    mask_key = _recv_exact(sock, 4) if masked else None
    payload = _recv_exact(sock, length) if length else b""
    if masked:
        payload = bytes(b ^ mask_key[i % 4] for i, b in enumerate(payload))
    if opcode == 0x8:  # close
        return 0x8, payload
    return opcode, payload
