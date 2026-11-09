import { createHash, randomBytes } from 'node:crypto';
import { getDb, tx } from '../db.js';
import { HttpError } from '../errors.js';
import { cleanText, nowIso } from '../util.js';
import { authStore } from './context.js';
import { hashPassword, passwordError, verifyPassword } from './passwords.js';

const SESSION_COOKIE = 'notely_session';
const DAY = 60 * 60 * 12;
const MONTH = 60 * 60 * 24 * 30;
const attempts = new Map();

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function emailOf(value) {
  const email = cleanText(value, { label: 'Email', max: 120, required: true }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.');
  return email;
}

export function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    tagline: row.tagline,
    avatar: row.avatar || null,
    createdAt: row.created_at,
  };
}

function userById(id) {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function readCookie(req, name = SESSION_COOKIE) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

export function sessionCookie(token, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie() {
  return sessionCookie('', 0);
}

export function userFromRequest(req) {
  const token = readCookie(req);
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(tokenHash(token), nowIso());
  return row ? publicUser(row) : null;
}

function issueSession(userId, remember) {
  const token = randomBytes(32).toString('base64url');
  const maxAge = remember ? MONTH : DAY;
  const expires = new Date(Date.now() + maxAge * 1000).toISOString();
  getDb()
    .prepare('INSERT INTO sessions (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(userId, tokenHash(token), expires, nowIso());
  return { token, maxAge };
}

function claimLibrary(userId) {
  const db = getDb();
  const unowned = db.prepare('SELECT id FROM workspaces WHERE user_id IS NULL').all();
  const onlyUser = db.prepare('SELECT COUNT(*) AS count FROM users').get().count === 1;
  if (unowned.length && onlyUser) {
    db.prepare('UPDATE workspaces SET user_id = ? WHERE user_id IS NULL').run(userId);
    const prefs = db.prepare('SELECT key, value FROM preferences').all();
    const insert = db.prepare(
      'INSERT INTO user_preferences (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value',
    );
    for (const pref of prefs) insert.run(userId, pref.key, pref.value);
    return;
  }
  const now = nowIso();
  db.prepare(
    'INSERT INTO workspaces (name, description, is_default, user_id, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?)',
  ).run('Personal', 'Your woodland workspace', userId, now, now);
}

export function registerAccount(input) {
  const displayName = cleanText(input.displayName, { label: 'Full name', max: 80, required: true });
  const email = emailOf(input.email);
  const problem = passwordError(input.password);
  if (problem) throw new HttpError(400, problem);
  if (input.password !== input.confirmPassword) throw new HttpError(400, 'The passwords do not match.');
  const now = nowIso();
  const userId = tx(() => {
    const existing = getDb().prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) throw new HttpError(409, 'An account with that email already exists.');
    const result = getDb()
      .prepare(
        'INSERT INTO users (email, password_hash, display_name, tagline, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(email, hashPassword(input.password), displayName, 'A space for your thoughts', now, now);
    const id = Number(result.lastInsertRowid);
    claimLibrary(id);
    return id;
  });
  const session = issueSession(userId, true);
  return { user: publicUser(userById(userId)), ...session };
}

function limitKey(req, email) {
  return `${req.ip || 'local'}:${email}`;
}

function assertAttempts(req, email) {
  const key = limitKey(req, email);
  const row = attempts.get(key);
  if (row && row.reset > Date.now() && row.count >= 8) {
    throw new HttpError(429, 'Too many attempts. Wait a little, then try again.');
  }
}

function recordFailure(req, email) {
  const key = limitKey(req, email);
  const row = attempts.get(key);
  if (!row || row.reset < Date.now()) attempts.set(key, { count: 1, reset: Date.now() + 15 * 60 * 1000 });
  else row.count += 1;
}

export function loginAccount(req, input) {
  const email = emailOf(input.email || '');
  assertAttempts(req, email);
  const password = typeof input.password === 'string' ? input.password : '';
  const row = getDb().prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row || !verifyPassword(password, row.password_hash)) {
    recordFailure(req, email);
    throw new HttpError(401, 'Email or password is not right.');
  }
  attempts.delete(limitKey(req, email));
  const session = issueSession(row.id, input.remember === true);
  return { user: publicUser(row), ...session };
}

export function logoutAccount(req) {
  const token = readCookie(req);
  if (token) getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
}

export function requestReset(input) {
  const email = emailOf(input.email || '');
  const row = getDb().prepare('SELECT id FROM users WHERE email = ?').get(email);
  const message = 'If an account uses that email, a reset link is ready.';
  if (!row) return { message };
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  getDb()
    .prepare('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
    .run(row.id, tokenHash(token), expires);
  const dev = process.env.NODE_ENV !== 'production' && process.env.NOTELY_DEV_RESET !== '0';
  return dev ? { message, devResetPath: `/reset?token=${token}` } : { message };
}

export function resetPassword(input) {
  const token = cleanText(input.token, { label: 'Reset token', max: 200, required: true });
  const problem = passwordError(input.password);
  if (problem) throw new HttpError(400, problem);
  if (input.password !== input.confirmPassword) throw new HttpError(400, 'The passwords do not match.');
  const row = getDb()
    .prepare('SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?')
    .get(tokenHash(token), nowIso());
  if (!row) throw new HttpError(400, 'That reset link is no longer valid.');
  tx(() => {
    getDb().prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hashPassword(input.password), nowIso(), row.user_id);
    getDb().prepare('UPDATE password_resets SET used_at = ? WHERE id = ?').run(nowIso(), row.id);
    getDb().prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
  });
  return { message: 'Password updated. Sign in with the new one.' };
}

export function changePassword(input) {
  const user = authStore.getStore();
  if (!user) throw new HttpError(401, 'Sign in to continue.');
  const row = userById(user.id);
  if (!verifyPassword(input.currentPassword || '', row.password_hash)) {
    throw new HttpError(401, 'The current password is not right.');
  }
  const problem = passwordError(input.password);
  if (problem) throw new HttpError(400, problem);
  if (input.password !== input.confirmPassword) throw new HttpError(400, 'The passwords do not match.');
  getDb().prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hashPassword(input.password), nowIso(), user.id);
  return { message: 'Password updated.' };
}

export function deleteAccount(input, req) {
  const user = authStore.getStore();
  if (!user) throw new HttpError(401, 'Sign in to continue.');
  const row = userById(user.id);
  if (!verifyPassword(input.password || '', row.password_hash)) throw new HttpError(401, 'The password is not right.');
  if (input.confirm !== 'delete') throw new HttpError(400, 'Type delete to confirm.');
  tx(() => {
    getDb().prepare('DELETE FROM workspaces WHERE user_id = ?').run(user.id);
    getDb().prepare('DELETE FROM users WHERE id = ?').run(user.id);
  });
  logoutAccount(req);
  return { deleted: true };
}

export function updateAccount(input) {
  const user = authStore.getStore();
  if (!user) throw new HttpError(401, 'Sign in to continue.');
  const current = userById(user.id);
  const displayName = input.displayName !== undefined
    ? cleanText(input.displayName, { label: 'Full name', max: 80, required: true })
    : current.display_name;
  const tagline = input.tagline !== undefined ? cleanText(input.tagline, { label: 'Tagline', max: 140 }) : current.tagline;
  let avatar = current.avatar;
  if (input.avatar !== undefined) {
    if (input.avatar === null || input.avatar === '') avatar = null;
    else if (typeof input.avatar !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(input.avatar) || input.avatar.length > 180000) {
      throw new HttpError(400, 'Use a small PNG, JPEG, or WebP image.');
    } else avatar = input.avatar;
  }
  getDb()
    .prepare('UPDATE users SET display_name = ?, tagline = ?, avatar = ?, updated_at = ? WHERE id = ?')
    .run(displayName, tagline, avatar, nowIso(), user.id);
  const next = publicUser(userById(user.id));
  return next;
}
