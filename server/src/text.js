import { HttpError } from './errors.js';

export function emptyDoc() {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

const BLOCKS = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'taskList',
  'taskItem',
  'blockquote',
  'codeBlock',
  'horizontalRule',
]);

function isSafeHref(href) {
  if (typeof href !== 'string' || href.length > 2000) return false;
  if (href.startsWith('#') || href.startsWith('/') || href.startsWith('mailto:')) return true;
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isSafeImage(src) {
  if (typeof src !== 'string' || src.length > 1_800_000) return false;
  if (/^data:image\/(png|jpeg|jpg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(src)) return true;
  return isSafeHref(src);
}

function walk(node, depth) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    throw new HttpError(400, 'Note content is not a valid document.');
  }
  if (depth > 40) throw new HttpError(400, 'Note content is nested too deeply.');
  if (typeof node.type !== 'string' || node.type.length > 40) {
    throw new HttpError(400, 'Note content is not a valid document.');
  }
  if (node.type === 'image' && !isSafeImage(node.attrs?.src)) {
    throw new HttpError(400, 'An image in this note uses an unsupported source.');
  }
  if (node.type === 'text') {
    if (typeof node.text !== 'string') throw new HttpError(400, 'Note content is not a valid document.');
    if (Array.isArray(node.marks)) {
      for (const mark of node.marks) {
        if (!mark || typeof mark !== 'object' || typeof mark.type !== 'string') {
          throw new HttpError(400, 'Note content is not a valid document.');
        }
        if (mark.type === 'link' && !isSafeHref(mark.attrs?.href || '')) {
          throw new HttpError(400, 'A link in this note is not allowed.');
        }
      }
    }
  }
  if (node.content !== undefined) {
    if (!Array.isArray(node.content)) throw new HttpError(400, 'Note content is not a valid document.');
    if (node.content.length > 5000) throw new HttpError(400, 'This note has too many blocks.');
    for (const child of node.content) walk(child, depth + 1);
  }
  if (!BLOCKS.has(node.type) && node.type !== 'doc' && node.type !== 'text' && node.type !== 'image' && node.type !== 'hardBreak') {
    throw new HttpError(400, 'Note content includes an unsupported block.');
  }
}

export function validateDoc(doc) {
  if (!doc || typeof doc !== 'object' || doc.type !== 'doc' || !Array.isArray(doc.content)) {
    throw new HttpError(400, 'Note content must be a document.');
  }
  const raw = JSON.stringify(doc);
  if (raw.length > 1_500_000) throw new HttpError(400, 'This note is too large to save.');
  walk(doc, 0);
  return doc;
}

export function docToText(doc) {
  const parts = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'text' && node.text) parts.push(node.text);
    if (node.type === 'hardBreak') parts.push('\n');
    if (Array.isArray(node.content)) {
      for (const child of node.content) visit(child);
    }
    if (BLOCKS.has(node.type) && node.type !== 'listItem' && node.type !== 'taskItem') parts.push('\n');
  };
  visit(doc);
  return parts.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function wordCount(text) {
  const words = String(text || '').trim().match(/\S+/g);
  return words ? words.length : 0;
}

export function excerpt(text, length = 180) {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  if (flat.length <= length) return flat;
  return `${flat.slice(0, length - 1).trimEnd()}…`;
}
