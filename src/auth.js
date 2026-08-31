import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;

export function passwordDigest(password, salt = randomBytes(16).toString('hex')) {
  const normalized = String(password || '');
  if (!normalized) return { password_hash:null, password_salt:null };
  if (normalized.length > 256) throw new Error('Hasło może mieć maksymalnie 256 znaków.');
  const hash = scryptSync(normalized, salt, KEY_LENGTH, { N:16384, r:8, p:1, maxmem:64 * 1024 * 1024 });
  return { password_hash:hash.toString('hex'), password_salt:salt };
}

export function passwordMatches(password, salt, expectedHex) {
  if (!expectedHex || !salt) return String(password || '') === '';
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = scryptSync(String(password || ''), salt, expected.length, { N:16384, r:8, p:1, maxmem:64 * 1024 * 1024 });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function newSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function tokenDigest(token) {
  return createHash('sha256').update(String(token || '')).digest('hex');
}
