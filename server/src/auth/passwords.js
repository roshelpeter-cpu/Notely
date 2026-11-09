import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY = 32;

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex');
  return `scrypt$16384$8$1$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, hash] = parts;
  let actual;
  try {
    actual = scryptSync(password, salt, KEY, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
  } catch {
    return false;
  }
  const expected = Buffer.from(hash, 'hex');
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(actual, expected);
}

export function passwordError(password) {
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
    return 'Use a password of 10 to 128 characters.';
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Use at least one letter and one number.';
  }
  return '';
}
