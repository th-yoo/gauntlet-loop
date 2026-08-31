'use strict';

/**
 * Auth: password hashing and TOTP-based two-factor authentication,
 * built only on Node's `crypto` module (RFC 6238 / RFC 4226).
 */

const crypto = require('crypto');

const SCRYPT_KEYLEN = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ---- TOTP (2FA) ----

function generateTotpSecret() {
  // 20 random bytes, base32-encoded, per RFC 4226 recommendation.
  return base32Encode(crypto.randomBytes(20));
}

function base32Encode(buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of str.toUpperCase().replace(/=+$/, '')) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function totpAt(secretBase32, timeStepSeconds, digits, unixSeconds) {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(unixSeconds / timeStepSeconds);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const code = (binCode % 10 ** digits).toString().padStart(digits, '0');
  return code;
}

/**
 * Verify a 6-digit TOTP code, allowing +/- one 30-second step of clock
 * drift (a common tolerance in authenticator-app based 2FA flows).
 */
function verifyTotp(secretBase32, code, opts) {
  const digits = (opts && opts.digits) || 6;
  const step = (opts && opts.step) || 30;
  const now = Math.floor(Date.now() / 1000);
  for (const drift of [0, -1, 1]) {
    if (totpAt(secretBase32, step, digits, now + drift * step) === String(code).trim()) {
      return true;
    }
  }
  return false;
}

function totpUri(secretBase32, label, issuer) {
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer: issuer || 'PulseWatch',
    algorithm: 'SHA1',
    digits: '6',
    period: '30'
  });
  return `otpauth://totp/${encodeURIComponent(issuer || 'PulseWatch')}:${encodeURIComponent(
    label
  )}?${params.toString()}`;
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateTotpSecret,
  verifyTotp,
  totpUri
};
