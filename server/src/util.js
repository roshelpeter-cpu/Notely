import { HttpError } from './errors.js';

export const NOTE_COLORS = ['parchment', 'sage', 'moss', 'gold', 'sky', 'rose', 'dusk', 'slate'];
export const NOTEBOOK_COLORS = ['sage', 'moss', 'forest', 'gold', 'bark', 'rose', 'sky', 'dusk'];
export const TAG_COLORS = ['moss', 'gold', 'rose', 'sky', 'dusk', 'bark', 'forest', 'berry'];
export const COVERS = ['floral', 'moon', 'cottage', 'river', 'fern', 'lantern', 'mushroom', 'stars'];
export const TASK_STATUSES = ['pending', 'in_progress', 'completed'];
export const PRIORITIES = ['low', 'medium', 'high'];

export function nowIso() {
  return new Date().toISOString();
}

export function localDate(date = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${z(date.getMonth() + 1)}-${z(date.getDate())}`;
}

export function addDays(dateStr, amount) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);
  return localDate(date);
}

export function assertDate(value, label = 'Date') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `${label} must use the YYYY-MM-DD format.`);
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new HttpError(400, `${label} is not a real calendar date.`);
  }
  return value;
}

export function parseId(value, label = 'Id') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, `${label} must be a positive whole number.`);
  }
  return id;
}

export function optionalId(value, label) {
  if (value === undefined) return undefined;
  if (value === null || value === '' || value === 'none') return null;
  return parseId(value, label);
}

export function parseLimit(value, fallback = 200) {
  if (value === undefined || value === null || value === '') return fallback;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new HttpError(400, 'Limit must be a whole number from 1 to 500.');
  }
  return limit;
}

export function asBool(value, label = 'Value') {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  throw new HttpError(400, `${label} must be true or false.`);
}

export function optionalFlag(value) {
  if (value === undefined || value === null || value === '') return undefined;
  return asBool(value, 'Filter');
}

export function choice(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new HttpError(400, `${label} must be one of: ${allowed.join(', ')}.`);
  }
  return value;
}

export function cleanText(value, { label, max, fallback = '', required = false }) {
  if (value === undefined || value === null) {
    if (required) throw new HttpError(400, `${label} is required.`);
    return fallback;
  }
  if (typeof value !== 'string') throw new HttpError(400, `${label} must be text.`);
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text && required) throw new HttpError(400, `${label} is required.`);
  if (text.length > max) throw new HttpError(400, `${label} must be ${max} characters or fewer.`);
  return text;
}

export function cleanTitle(value, { fallback = 'Untitled note', max = 200, required = false } = {}) {
  return cleanText(value, { label: 'Title', max, fallback, required }) || fallback;
}

export function cleanMultiline(value, { label, max }) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new HttpError(400, `${label} must be text.`);
  const text = value.replace(/\r\n/g, '\n').trim();
  if (text.length > max) throw new HttpError(400, `${label} must be ${max} characters or fewer.`);
  return text;
}

export function idList(value, label = 'Tags') {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new HttpError(400, `${label} must be a list of ids.`);
  if (value.length > 24) throw new HttpError(400, `${label} accepts at most 24 items.`);
  return [...new Set(value.map((item) => parseId(item, label)))];
}

export function likeTerm(value) {
  return `%${String(value).trim().replace(/[\\%_]/g, '')}%`;
}

export function toFtsQuery(raw) {
  const tokens = String(raw)
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9']/g, ''))
    .filter((token) => token.length > 1);
  if (!tokens.length) return null;
  return tokens.map((token) => `"${token}"*`).join(' AND ');
}

export function slugify(value) {
  const slug = String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return slug || 'note';
}

export function dailyTitle(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const formatted = new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `Daily Note · ${formatted}`;
}

export function calculateStreak(dates, today = localDate()) {
  const unique = [...new Set(dates)].filter(Boolean).sort();
  const present = new Set(unique);
  let longest = 0;
  let run = 0;
  let previous = null;
  for (const date of unique) {
    run = previous && addDays(previous, 1) === date ? run + 1 : 1;
    previous = date;
    if (run > longest) longest = run;
  }

  let cursor = present.has(today) ? today : addDays(today, -1);
  let current = 0;
  if (present.has(cursor)) {
    while (present.has(cursor)) {
      current += 1;
      cursor = addDays(cursor, -1);
    }
  }
  return { current, longest, activeDays: unique.length };
}
