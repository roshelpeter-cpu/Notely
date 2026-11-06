import { getDb } from '../db.js';
import { parseId } from '../util.js';
import { getNoteRow } from './notes.js';
import { resolveWorkspaceId } from './shared.js';
import { HttpError } from '../errors.js';

const STOP = new Set(
  `the a an and or of to in for on with at from by this that it is are was were be as your you we our not into about over after before than then so if but just have has had will would can could should their there here they them also more when what which while where some such today note notes daily goals reflection thoughts tasks very really quite into onto from with`.split(
    ' ',
  ),
);

function keywords(text, limit = 20) {
  const counts = new Map();
  for (const word of String(text || '').toLowerCase().match(/[a-z][a-z0-9']{3,}/g) || []) {
    if (STOP.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

function jaccard(left, right) {
  const a = new Set(left);
  const b = new Set(right);
  if (!a.size || !b.size) return { score: 0, shared: [] };
  const shared = [...a].filter((word) => b.has(word));
  return { score: shared.length / (a.size + b.size - shared.length), shared };
}

function loadCorpus(workspaceId) {
  const notes = getDb()
    .prepare(
      `SELECT n.id, n.title, n.content_text, n.notebook_id, n.is_daily
       FROM notes n
       WHERE n.workspace_id = ? AND n.deleted_at IS NULL AND n.is_archived = 0`,
    )
    .all(workspaceId);
  const tagRows = getDb()
    .prepare(
      `SELECT nt.note_id, t.id, t.name, t.color
       FROM note_tags nt JOIN tags t ON t.id = nt.tag_id
       WHERE t.workspace_id = ?`,
    )
    .all(workspaceId);
  const tags = getDb().prepare('SELECT id, name, color FROM tags WHERE workspace_id = ?').all(workspaceId);
  const tagsByNote = new Map();
  for (const row of tagRows) {
    const list = tagsByNote.get(row.note_id) || [];
    list.push({ id: row.id, name: row.name, color: row.color });
    tagsByNote.set(row.note_id, list);
  }
  return notes.map((note) => ({
    ...note,
    keys: keywords(`${note.title} ${note.content_text}`),
    tags: tagsByNote.get(note.id) || [],
    allTags: tags,
  }));
}

export function suggestionsFor(query) {
  const workspaceId = resolveWorkspaceId(query.workspaceId);
  const corpus = loadCorpus(workspaceId);
  const allTags = getDb().prepare('SELECT id, name, color FROM tags WHERE workspace_id = ? ORDER BY name').all(workspaceId);
  let focus = null;
  if (query.noteId) {
    const noteId = parseId(query.noteId, 'Note');
    focus = corpus.find((note) => note.id === noteId);
    if (!focus) {
      const row = getNoteRow(noteId);
      if (!row || row.workspace_id !== workspaceId) throw new HttpError(404, 'Note not found.');
      focus = { ...row, keys: keywords(`${row.title} ${row.content_text}`), tags: [], id: row.id, title: row.title };
    }
  }

  const related = [];
  const tagSuggestions = [];
  if (focus) {
    for (const other of corpus) {
      if (other.id === focus.id) continue;
      const { score, shared } = jaccard(focus.keys, other.keys);
      if (shared.length < 2 || score < 0.18) continue;
      related.push({
        id: other.id,
        title: other.title,
        score: Number(score.toFixed(2)),
        reason: `Shares keywords: ${shared.slice(0, 4).join(', ')}.`,
      });
    }
    related.sort((a, b) => b.score - a.score);
    const applied = new Set((focus.tags || []).map((tag) => tag.id));
    for (const tag of allTags) {
      if (applied.has(tag.id)) continue;
      const needle = tag.name.toLowerCase();
      if (focus.keys.includes(needle) || focus.keys.some((word) => needle.includes(word) && word.length > 4)) {
        tagSuggestions.push({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          reason: `The word “${tag.name}” appears in this note. This is keyword matching, not an external model.`,
        });
      }
    }
  }

  const groups = new Map();
  for (const note of corpus) {
    const key = note.title.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!key || key === 'untitled note') continue;
    const list = groups.get(key) || [];
    list.push({ id: note.id, title: note.title });
    groups.set(key, list);
  }

  return {
    method: 'Local keyword matching. Notely does not call an AI model for these suggestions.',
    related: related.slice(0, 5),
    tagSuggestions: tagSuggestions.slice(0, 5),
    unassigned: corpus
      .filter((note) => !note.notebook_id && !note.is_daily)
      .slice(0, 8)
      .map((note) => ({ id: note.id, title: note.title, reason: 'This note is not in a notebook yet.' })),
    untagged: corpus
      .filter((note) => note.tags && note.tags.length === 0)
      .slice(0, 8)
      .map((note) => ({ id: note.id, title: note.title, reason: 'This note has no tags.' })),
    duplicateTitles: [...groups.entries()]
      .filter(([, notes]) => notes.length > 1)
      .slice(0, 8)
      .map(([title, notes]) => ({
        title,
        notes,
        reason: 'These notes use the same title.',
      })),
  };
}
