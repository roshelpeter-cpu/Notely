import { getDb } from '../db.js';
import { HttpError } from '../errors.js';
import { tx } from '../db.js';
import {
  COVERS,
  NOTEBOOK_COLORS,
  TAG_COLORS,
  asBool,
  choice,
  cleanMultiline,
  cleanText,
  nowIso,
  parseId,
} from '../util.js';
import { updateAccount } from '../auth/accounts.js';
import { currentUser } from '../auth/context.js';
import { assertFolder, logActivity, newRowId, ownWorkspace, resolveWorkspaceId, touchWorkspace, workspaceById } from './shared.js';

function mapWorkspace(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isDefault: row.is_default === 1,
    noteCount: row.note_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listWorkspaces() {
  return getDb()
    .prepare(
      `SELECT w.*,
        (SELECT COUNT(*) FROM notes n WHERE n.workspace_id = w.id AND n.deleted_at IS NULL AND n.is_archived = 0) AS note_count
       FROM workspaces w
       WHERE w.user_id = ?
       ORDER BY w.is_default DESC, w.name COLLATE NOCASE`,
    )
    .all(currentUser().id)
    .map(mapWorkspace);
}

export function createWorkspace(input) {
  const name = cleanText(input.name, { label: 'Workspace name', max: 60, required: true });
  const description = cleanText(input.description, { label: 'Description', max: 240 });
  const now = nowIso();
  const makeDefault = input.isDefault ? 1 : 0;
  const user = currentUser();
  const id = tx(() => {
    if (makeDefault) getDb().prepare('UPDATE workspaces SET is_default = 0 WHERE user_id = ?').run(user.id);
    const hasAny = getDb().prepare('SELECT id FROM workspaces WHERE user_id = ? LIMIT 1').get(user.id);
    const result = getDb()
      .prepare(
        'INSERT INTO workspaces (name, description, is_default, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(name, description, makeDefault || !hasAny ? 1 : 0, user.id, now, now);
    return newRowId(result);
  });
  return listWorkspaces().find((workspace) => workspace.id === id);
}

export function updateWorkspace(id, input) {
  const workspaceId = ownWorkspace(parseId(id, 'Workspace'));
  const current = workspaceById(workspaceId);
  if (!current) throw new HttpError(404, 'Workspace not found.');
  const name = input.name !== undefined ? cleanText(input.name, { label: 'Workspace name', max: 60, required: true }) : current.name;
  const description = input.description !== undefined ? cleanText(input.description, { label: 'Description', max: 240 }) : current.description;
  const makeDefault = input.isDefault === undefined ? false : asBool(input.isDefault, 'Default');
  tx(() => {
    if (makeDefault) getDb().prepare('UPDATE workspaces SET is_default = 0 WHERE user_id = ?').run(current.user_id);
    getDb()
      .prepare('UPDATE workspaces SET name = ?, description = ?, is_default = ?, updated_at = ? WHERE id = ?')
      .run(name, description, makeDefault ? 1 : current.is_default, nowIso(), workspaceId);
  });
  return listWorkspaces().find((workspace) => workspace.id === workspaceId);
}

export function deleteWorkspace(id) {
  const workspaceId = ownWorkspace(parseId(id, 'Workspace'));
  const current = workspaceById(workspaceId);
  if (!current) throw new HttpError(404, 'Workspace not found.');
  return tx(() => {
    const count = getDb().prepare('SELECT COUNT(*) AS count FROM workspaces WHERE user_id = ?').get(current.user_id).count;
    if (count <= 1) throw new HttpError(400, 'Keep at least one workspace.');
    const noteIds = getDb().prepare('SELECT id FROM notes WHERE workspace_id = ?').all(workspaceId);
    const remove = getDb().prepare('DELETE FROM notes_fts WHERE rowid = ?');
    for (const note of noteIds) remove.run(note.id);
    getDb().prepare('DELETE FROM workspaces WHERE id = ?').run(workspaceId);
    if (current.is_default === 1) {
      getDb().prepare('UPDATE workspaces SET is_default = 1 WHERE id = (SELECT id FROM workspaces WHERE user_id = ? ORDER BY id LIMIT 1)').run(current.user_id);
    }
    return { id: workspaceId, deleted: true };
  });
}

function mapFolder(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    parentId: row.parent_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listFolders(workspaceValue) {
  const workspaceId = resolveWorkspaceId(workspaceValue);
  return getDb()
    .prepare('SELECT * FROM folders WHERE workspace_id = ? ORDER BY name COLLATE NOCASE')
    .all(workspaceId)
    .map(mapFolder);
}

function wouldCycle(folderId, parentId) {
  let current = parentId;
  const seen = new Set();
  while (current) {
    if (current === folderId || seen.has(current)) return true;
    seen.add(current);
    const row = getDb().prepare('SELECT parent_id FROM folders WHERE id = ?').get(current);
    current = row?.parent_id ?? null;
  }
  return false;
}

export function createFolder(input) {
  const workspaceId = resolveWorkspaceId(input.workspaceId);
  const name = cleanText(input.name, { label: 'Folder name', max: 60, required: true });
  const parentId = input.parentId ? assertFolder(workspaceId, input.parentId) : null;
  const now = nowIso();
  const result = getDb()
    .prepare('INSERT INTO folders (workspace_id, parent_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(workspaceId, parentId, name, now, now);
  return mapFolder(getDb().prepare('SELECT * FROM folders WHERE id = ?').get(newRowId(result)));
}

export function updateFolder(id, input) {
  const folderId = parseId(id, 'Folder');
  const current = getDb().prepare('SELECT * FROM folders WHERE id = ?').get(folderId);
  if (!current) throw new HttpError(404, 'Folder not found.');
  ownWorkspace(current.workspace_id);
  const name = input.name !== undefined ? cleanText(input.name, { label: 'Folder name', max: 60, required: true }) : current.name;
  let parentId = current.parent_id;
  if (input.parentId !== undefined) {
    parentId = input.parentId === null ? null : assertFolder(current.workspace_id, input.parentId);
    if (parentId && wouldCycle(folderId, parentId)) throw new HttpError(400, 'A folder cannot contain itself.');
  }
  getDb().prepare('UPDATE folders SET name = ?, parent_id = ?, updated_at = ? WHERE id = ?').run(name, parentId, nowIso(), folderId);
  return mapFolder(getDb().prepare('SELECT * FROM folders WHERE id = ?').get(folderId));
}

export function deleteFolder(id) {
  const folderId = parseId(id, 'Folder');
  const current = getDb().prepare('SELECT * FROM folders WHERE id = ?').get(folderId);
  if (!current) throw new HttpError(404, 'Folder not found.');
  ownWorkspace(current.workspace_id);
  getDb().prepare('DELETE FROM folders WHERE id = ?').run(folderId);
  return { id: folderId, deleted: true };
}

function mapNotebook(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    folderId: row.folder_id,
    folderName: row.folder_name ?? null,
    name: row.name,
    description: row.description,
    color: row.color,
    cover: row.cover,
    noteCount: row.note_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function notebookQuery() {
  return `SELECT nb.*, f.name AS folder_name,
            (SELECT COUNT(*) FROM notes n WHERE n.notebook_id = nb.id AND n.deleted_at IS NULL AND n.is_archived = 0) AS note_count
          FROM notebooks nb
          LEFT JOIN folders f ON f.id = nb.folder_id`;
}

export function listNotebooks(workspaceValue) {
  const workspaceId = resolveWorkspaceId(workspaceValue);
  return getDb()
    .prepare(`${notebookQuery()} WHERE nb.workspace_id = ? ORDER BY nb.name COLLATE NOCASE`)
    .all(workspaceId)
    .map(mapNotebook);
}

export function getNotebook(id) {
  const notebookId = parseId(id, 'Notebook');
  const row = getDb().prepare(`${notebookQuery()} WHERE nb.id = ?`).get(notebookId);
  if (!row) throw new HttpError(404, 'Notebook not found.');
  ownWorkspace(row.workspace_id);
  return mapNotebook(row);
}

export function createNotebook(input) {
  const workspaceId = resolveWorkspaceId(input.workspaceId);
  const name = cleanText(input.name, { label: 'Notebook name', max: 80, required: true });
  const description = cleanMultiline(input.description, { label: 'Description', max: 400 });
  const color = choice(input.color || 'sage', NOTEBOOK_COLORS, 'Notebook colour');
  const cover = choice(input.cover || 'floral', COVERS, 'Cover');
  const folderId = input.folderId ? assertFolder(workspaceId, input.folderId) : null;
  const now = nowIso();
  const result = getDb()
    .prepare(
      `INSERT INTO notebooks (workspace_id, folder_id, name, description, color, cover, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(workspaceId, folderId, name, description, color, cover, now, now);
  const notebook = getNotebook(newRowId(result));
  logActivity(workspaceId, 'notebook.created', 'notebook', notebook.id, `Bound a new notebook, “${notebook.name}”.`);
  touchWorkspace(workspaceId);
  return notebook;
}

export function updateNotebook(id, input) {
  const current = getNotebook(id);
  const name = input.name !== undefined ? cleanText(input.name, { label: 'Notebook name', max: 80, required: true }) : current.name;
  const description = input.description !== undefined ? cleanMultiline(input.description, { label: 'Description', max: 400 }) : current.description;
  const color = input.color !== undefined ? choice(input.color, NOTEBOOK_COLORS, 'Notebook colour') : current.color;
  const cover = input.cover !== undefined ? choice(input.cover, COVERS, 'Cover') : current.cover;
  let folderId = current.folderId;
  if (input.folderId !== undefined) folderId = input.folderId === null ? null : assertFolder(current.workspaceId, input.folderId);
  getDb()
    .prepare('UPDATE notebooks SET name = ?, description = ?, color = ?, cover = ?, folder_id = ?, updated_at = ? WHERE id = ?')
    .run(name, description, color, cover, folderId, nowIso(), current.id);
  return getNotebook(current.id);
}

export function deleteNotebook(id) {
  const notebook = getNotebook(id);
  getDb().prepare('DELETE FROM notebooks WHERE id = ?').run(notebook.id);
  logActivity(notebook.workspaceId, 'notebook.deleted', 'notebook', null, `Set “${notebook.name}” aside. Its notes stayed in the library.`);
  return { id: notebook.id, deleted: true };
}

function mapTag(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    color: row.color,
    noteCount: row.note_count ?? 0,
    createdAt: row.created_at,
  };
}

export function listTags(workspaceValue) {
  const workspaceId = resolveWorkspaceId(workspaceValue);
  return getDb()
    .prepare(
      `SELECT t.*,
        (SELECT COUNT(*) FROM note_tags nt JOIN notes n ON n.id = nt.note_id AND n.deleted_at IS NULL WHERE nt.tag_id = t.id) AS note_count
       FROM tags t WHERE t.workspace_id = ? ORDER BY t.name COLLATE NOCASE`,
    )
    .all(workspaceId)
    .map(mapTag);
}

function tagClash(workspaceId, name, ignoreId = null) {
  const row = getDb()
    .prepare('SELECT id FROM tags WHERE workspace_id = ? AND name = ? COLLATE NOCASE AND id != ?')
    .get(workspaceId, name, ignoreId || 0);
  if (row) throw new HttpError(409, 'A tag with that name already exists.');
}

export function createTag(input) {
  const workspaceId = resolveWorkspaceId(input.workspaceId);
  const name = cleanText(input.name, { label: 'Tag name', max: 40, required: true });
  const color = choice(input.color || 'moss', TAG_COLORS, 'Tag colour');
  tagClash(workspaceId, name);
  const result = getDb()
    .prepare('INSERT INTO tags (workspace_id, name, color, created_at) VALUES (?, ?, ?, ?)')
    .run(workspaceId, name, color, nowIso());
  return listTags(workspaceId).find((tag) => tag.id === newRowId(result));
}

export function updateTag(id, input) {
  const tagId = parseId(id, 'Tag');
  const current = getDb().prepare('SELECT * FROM tags WHERE id = ?').get(tagId);
  if (!current) throw new HttpError(404, 'Tag not found.');
  ownWorkspace(current.workspace_id);
  const name = input.name !== undefined ? cleanText(input.name, { label: 'Tag name', max: 40, required: true }) : current.name;
  const color = input.color !== undefined ? choice(input.color, TAG_COLORS, 'Tag colour') : current.color;
  tagClash(current.workspace_id, name, tagId);
  getDb().prepare('UPDATE tags SET name = ?, color = ? WHERE id = ?').run(name, color, tagId);
  return listTags(current.workspace_id).find((tag) => tag.id === tagId);
}

export function deleteTag(id) {
  const tagId = parseId(id, 'Tag');
  const current = getDb().prepare('SELECT * FROM tags WHERE id = ?').get(tagId);
  if (!current) throw new HttpError(404, 'Tag not found.');
  ownWorkspace(current.workspace_id);
  getDb().prepare('DELETE FROM tags WHERE id = ?').run(tagId);
  return { id: tagId, deleted: true };
}

const DEFAULT_PREFERENCES = {
  theme: 'system',
  accent: 'forest',
  motion: 'full',
  editorFont: 'serif',
  editorSize: 'md',
  autosave: true,
  defaultNotebookId: null,
  noteView: 'card',
  noteSort: 'updated',
  dashboard: {
    focus: true,
    recent: true,
    notebooks: true,
    calendar: true,
    map: true,
    activity: true,
    writing: true,
  },
};

export function getPreferences() {
  const user = currentUser();
  const stored = {};
  for (const row of getDb().prepare('SELECT key, value FROM user_preferences WHERE user_id = ?').all(user.id)) {
    try {
      stored[row.key] = JSON.parse(row.value);
    } catch {
      /* Ignore a damaged preference and fall back to the default. */
    }
  }
  return {
    ...DEFAULT_PREFERENCES,
    ...stored,
    dashboard: { ...DEFAULT_PREFERENCES.dashboard, ...(stored.dashboard || {}) },
  };
}

export function updatePreferences(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new HttpError(400, 'Preferences must be an object.');
  }
  const allowed = Object.keys(DEFAULT_PREFERENCES);
  const keys = Object.keys(patch);
  if (keys.some((key) => !allowed.includes(key))) {
    throw new HttpError(400, 'One of those preferences is not recognised.');
  }
  const current = getPreferences();
  const next = { ...current, dashboard: { ...current.dashboard } };
  if (patch.theme !== undefined) next.theme = choice(patch.theme, ['day', 'night', 'system'], 'Theme');
  if (patch.accent !== undefined) next.accent = choice(patch.accent, ['forest', 'gold', 'berry', 'river'], 'Accent');
  if (patch.motion !== undefined) next.motion = choice(patch.motion, ['full', 'reduce'], 'Motion');
  if (patch.editorFont !== undefined) next.editorFont = choice(patch.editorFont, ['sans', 'serif', 'literata', 'mono'], 'Editor font');
  if (patch.editorSize !== undefined) next.editorSize = choice(patch.editorSize, ['sm', 'md', 'lg'], 'Editor size');
  if (patch.autosave !== undefined) next.autosave = asBool(patch.autosave, 'Autosave');
  if (patch.noteView !== undefined) next.noteView = choice(patch.noteView, ['card', 'list'], 'Note view');
  if (patch.noteSort !== undefined) next.noteSort = choice(patch.noteSort, ['updated', 'created', 'title', 'words'], 'Note sort');
  if (patch.defaultNotebookId !== undefined) {
    next.defaultNotebookId = patch.defaultNotebookId === null ? null : parseId(patch.defaultNotebookId, 'Notebook');
    if (next.defaultNotebookId) {
      const notebook = getDb()
        .prepare(
          `SELECT n.id FROM notebooks n
           JOIN workspaces w ON w.id = n.workspace_id
           WHERE n.id = ? AND w.user_id = ?`,
        )
        .get(next.defaultNotebookId, currentUser().id);
      if (!notebook) throw new HttpError(400, 'The default notebook does not exist.');
    }
  }
  if (patch.dashboard !== undefined) {
    if (!patch.dashboard || typeof patch.dashboard !== 'object' || Array.isArray(patch.dashboard)) {
      throw new HttpError(400, 'Dashboard preferences are invalid.');
    }
    for (const key of Object.keys(patch.dashboard)) {
      if (!(key in DEFAULT_PREFERENCES.dashboard)) throw new HttpError(400, 'Dashboard preferences are invalid.');
      next.dashboard[key] = asBool(patch.dashboard[key], 'Dashboard section');
    }
  }
  const user = currentUser();
  const upsert = getDb().prepare(
    'INSERT INTO user_preferences (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value',
  );
  for (const key of keys) upsert.run(user.id, key, JSON.stringify(next[key]));
  return getPreferences();
}

export function getProfile() {
  const user = currentUser();
  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  if (!row) throw new HttpError(404, 'Profile not found.');
  return {
    id: row.id,
    displayName: row.display_name,
    tagline: row.tagline,
    email: row.email,
    avatar: row.avatar || null,
    createdAt: row.created_at,
  };
}

export function updateProfile(input) {
  const next = updateAccount(input);
  getDb().prepare('UPDATE profile SET display_name = ?, tagline = ? WHERE id = 1').run(next.displayName, next.tagline);
  return getProfile();
}
