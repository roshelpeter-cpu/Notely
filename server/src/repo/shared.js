import { currentUser } from '../auth/context.js';
import { getDb, insertedId } from '../db.js';
import { migrate } from '../db.js';
import { HttpError } from '../errors.js';
import { cleanText, localDate, nowIso, parseId } from '../util.js';

export function ensureFoundation() {
  migrate();
  const db = getDb();
  const now = nowIso();
  if (!db.prepare('SELECT id FROM profile WHERE id = 1').get()) {
    db.prepare('INSERT INTO profile (id, display_name, tagline, created_at) VALUES (1, ?, ?, ?)').run(
      'Friend',
      'A space for your thoughts',
      now,
    );
  }
  if (!db.prepare('SELECT id FROM workspaces LIMIT 1').get()) {
    db.prepare(
      'INSERT INTO workspaces (name, description, is_default, created_at, updated_at) VALUES (?, ?, 1, ?, ?)',
    ).run('Personal', 'Your woodland workspace', now, now);
  }
}

export function ownWorkspace(workspaceId) {
  const user = currentUser();
  const row = getDb().prepare('SELECT id FROM workspaces WHERE id = ? AND user_id = ?').get(workspaceId, user.id);
  if (!row) throw new HttpError(404, 'Workspace not found.');
  return workspaceId;
}

export function resolveWorkspaceId(value) {
  const user = currentUser();
  const db = getDb();
  if (value !== undefined && value !== null && value !== '') {
    return ownWorkspace(parseId(value, 'Workspace'));
  }
  const row =
    db.prepare('SELECT id FROM workspaces WHERE user_id = ? AND is_default = 1 ORDER BY id LIMIT 1').get(user.id) ||
    db.prepare('SELECT id FROM workspaces WHERE user_id = ? ORDER BY id LIMIT 1').get(user.id);
  if (!row) throw new HttpError(400, 'Create a workspace first.');
  return row.id;
}

export function assertNotebook(workspaceId, notebookId) {
  const id = parseId(notebookId, 'Notebook');
  const row = getDb().prepare('SELECT id FROM notebooks WHERE id = ? AND workspace_id = ?').get(id, workspaceId);
  if (!row) throw new HttpError(400, 'Notebook does not belong to this workspace.');
  return id;
}

export function assertFolder(workspaceId, folderId) {
  const id = parseId(folderId, 'Folder');
  const row = getDb().prepare('SELECT id FROM folders WHERE id = ? AND workspace_id = ?').get(id, workspaceId);
  if (!row) throw new HttpError(400, 'Folder does not belong to this workspace.');
  return id;
}

export function assertNote(workspaceId, noteId) {
  const id = parseId(noteId, 'Note');
  const row = getDb()
    .prepare('SELECT id FROM notes WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL')
    .get(id, workspaceId);
  if (!row) throw new HttpError(400, 'That note is not available in this workspace.');
  return id;
}

export function assertTags(workspaceId, tagIds) {
  if (!tagIds.length) return;
  const unique = [...new Set(tagIds)];
  const rows = getDb()
    .prepare(
      `SELECT id FROM tags WHERE workspace_id = ? AND id IN (${unique.map(() => '?').join(',')})`,
    )
    .all(workspaceId, ...unique);
  if (rows.length !== unique.length) throw new HttpError(400, 'A tag does not belong to this workspace.');
}

export function logActivity(workspaceId, type, entityType, entityId, summary, when = nowIso()) {
  getDb()
    .prepare(
      `INSERT INTO activity (workspace_id, type, entity_type, entity_id, summary, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(workspaceId, type, entityType, entityId, summary, when);
}

export function listActivity(workspaceValue, limit = 20) {
  const workspaceId = resolveWorkspaceId(workspaceValue);
  return getDb()
    .prepare(
      `SELECT id, workspace_id, type, entity_type, entity_id, summary, created_at
       FROM activity WHERE workspace_id = ? ORDER BY id DESC LIMIT ?`,
    )
    .all(workspaceId, limit)
    .map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      type: row.type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      summary: row.summary,
      createdAt: row.created_at,
    }));
}

export function workspaceById(id) {
  return getDb().prepare('SELECT * FROM workspaces WHERE id = ?').get(id);
}

export function touchWorkspace(id) {
  getDb().prepare('UPDATE workspaces SET updated_at = ? WHERE id = ?').run(nowIso(), id);
}

export function newRowId(result) {
  return insertedId(result);
}

export function today() {
  return localDate();
}
