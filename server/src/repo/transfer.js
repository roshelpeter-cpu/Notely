import { getDb, tx } from '../db.js';
import { HttpError } from '../errors.js';
import { docToMarkdown, parseMarkdownFile } from '../markdown.js';
import { docToText, validateDoc } from '../text.js';
import { cleanText, parseId, slugify } from '../util.js';
import { importNoteRecord, getNote } from './notes.js';
import { logActivity, resolveWorkspaceId } from './shared.js';
import { createTask } from './tasks.js';

function workspaceNotes(workspaceId) {
  return getDb()
    .prepare('SELECT id FROM notes WHERE workspace_id = ?')
    .all(workspaceId)
    .map((row) => row.id);
}

export function clearWorkspaceContent(workspaceId) {
  const ids = workspaceNotes(workspaceId);
  const remove = getDb().prepare('DELETE FROM notes_fts WHERE rowid = ?');
  for (const id of ids) remove.run(id);
  getDb().prepare('DELETE FROM tasks WHERE workspace_id = ?').run(workspaceId);
  getDb().prepare('DELETE FROM notes WHERE workspace_id = ?').run(workspaceId);
  getDb().prepare('DELETE FROM tags WHERE workspace_id = ?').run(workspaceId);
  getDb().prepare('DELETE FROM notebooks WHERE workspace_id = ?').run(workspaceId);
  getDb().prepare('DELETE FROM folders WHERE workspace_id = ?').run(workspaceId);
}

export function exportJson(workspaceValue) {
  const workspaceId = resolveWorkspaceId(workspaceValue);
  const workspace = getDb().prepare('SELECT name, description FROM workspaces WHERE id = ?').get(workspaceId);
  const folders = getDb().prepare('SELECT * FROM folders WHERE workspace_id = ? ORDER BY id').all(workspaceId);
  const notebooks = getDb().prepare('SELECT * FROM notebooks WHERE workspace_id = ? ORDER BY id').all(workspaceId);
  const tags = getDb().prepare('SELECT * FROM tags WHERE workspace_id = ? ORDER BY id').all(workspaceId);
  const notes = getDb()
    .prepare('SELECT * FROM notes WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY id')
    .all(workspaceId);
  const noteTags = notes.length
    ? getDb()
        .prepare(
          `SELECT note_id, tag_id FROM note_tags WHERE note_id IN (${notes.map(() => '?').join(',')})`,
        )
        .all(...notes.map((note) => note.id))
    : [];
  const tasks = getDb()
    .prepare('SELECT * FROM tasks WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY id')
    .all(workspaceId);
  const links = notes.length
    ? getDb()
        .prepare(
          `SELECT source_id, target_id FROM note_links
           WHERE source_id IN (${notes.map(() => '?').join(',')})`,
        )
        .all(...notes.map((note) => note.id))
    : [];
  const folderKey = new Map(folders.map((folder) => [folder.id, `folder-${folder.id}`]));
  const notebookKey = new Map(notebooks.map((notebook) => [notebook.id, `notebook-${notebook.id}`]));
  const tagKey = new Map(tags.map((tag) => [tag.id, `tag-${tag.id}`]));
  const noteKey = new Map(notes.map((note) => [note.id, `note-${note.id}`]));
  const tagsForNote = new Map();
  for (const row of noteTags) {
    const list = tagsForNote.get(row.note_id) || [];
    if (tagKey.has(row.tag_id)) list.push(tagKey.get(row.tag_id));
    tagsForNote.set(row.note_id, list);
  }
  return {
    format: 'notely-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    workspace: { name: workspace.name, description: workspace.description },
    folders: folders.map((folder) => ({
      key: folderKey.get(folder.id),
      name: folder.name,
      parentKey: folder.parent_id ? folderKey.get(folder.parent_id) || null : null,
    })),
    notebooks: notebooks.map((notebook) => ({
      key: notebookKey.get(notebook.id),
      name: notebook.name,
      description: notebook.description,
      color: notebook.color,
      cover: notebook.cover,
      folderKey: notebook.folder_id ? folderKey.get(notebook.folder_id) || null : null,
    })),
    tags: tags.map((tag) => ({ key: tagKey.get(tag.id), name: tag.name, color: tag.color })),
    notes: notes.map((note) => ({
      key: noteKey.get(note.id),
      title: note.title,
      contentJson: JSON.parse(note.content_json),
      notebookKey: note.notebook_id ? notebookKey.get(note.notebook_id) || null : null,
      tagKeys: tagsForNote.get(note.id) || [],
      color: note.color,
      isPinned: note.is_pinned === 1,
      isFavourite: note.is_favourite === 1,
      isArchived: note.is_archived === 1,
      isDaily: note.is_daily === 1,
      dailyDate: note.daily_date,
    })),
    tasks: tasks.map((task) => ({
      key: `task-${task.id}`,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.due_date,
      noteKey: task.note_id ? noteKey.get(task.note_id) || null : null,
    })),
    links: links
      .filter((link) => noteKey.has(link.source_id) && noteKey.has(link.target_id))
      .map((link) => ({ sourceKey: noteKey.get(link.source_id), targetKey: noteKey.get(link.target_id) })),
  };
}

export function importJson(input) {
  const payload = input.payload;
  if (!payload || payload.format !== 'notely-backup' || payload.version !== 1) {
    throw new HttpError(400, 'This file is not a Notely backup.');
  }
  if (!Array.isArray(payload.notes) || !Array.isArray(payload.notebooks) || !Array.isArray(payload.tags)) {
    throw new HttpError(400, 'The backup is missing notes, notebooks, or tags.');
  }
  if (payload.notes.length > 2000 || payload.notebooks.length > 500) {
    throw new HttpError(400, 'This backup is larger than Notely can import in one pass.');
  }
  const mode = input.mode || 'add';
  if (mode !== 'add' && mode !== 'replace') throw new HttpError(400, 'Import mode must be add or replace.');
  const workspaceId = resolveWorkspaceId(input.workspaceId);
  if (mode === 'replace' && input.confirm !== true) {
    const existing = getDb().prepare('SELECT COUNT(*) AS count FROM notes WHERE workspace_id = ? AND deleted_at IS NULL').get(workspaceId).count;
    throw new HttpError(409, 'Replacing this workspace removes its current notes, notebooks, and tasks. Confirm to continue.', {
      code: 'CONFIRM_REQUIRED',
      details: { existingNotes: existing },
    });
  }

  return tx(() => {
    if (mode === 'replace') clearWorkspaceContent(workspaceId);
    const folderIds = new Map();
    const pending = [...(payload.folders || [])];
    let guard = 0;
    while (pending.length && guard < pending.length + 5) {
      guard += 1;
      const folder = pending.shift();
      if (!folder?.key || typeof folder.name !== 'string') throw new HttpError(400, 'A folder in the backup is invalid.');
      if (folder.parentKey && !folderIds.has(folder.parentKey)) {
        pending.push(folder);
        continue;
      }
      const now = new Date().toISOString();
      const result = getDb()
        .prepare('INSERT INTO folders (workspace_id, parent_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(workspaceId, folder.parentKey ? folderIds.get(folder.parentKey) : null, cleanText(folder.name, { label: 'Folder name', max: 60, required: true }), now, now);
      folderIds.set(folder.key, Number(result.lastInsertRowid));
    }
    if (pending.length) throw new HttpError(400, 'The backup folders refer to a missing parent.');

    const notebookIds = new Map();
    for (const notebook of payload.notebooks) {
      if (!notebook?.key) throw new HttpError(400, 'A notebook in the backup is invalid.');
      const created = getDb()
        .prepare(
          `INSERT INTO notebooks (workspace_id, folder_id, name, description, color, cover, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          workspaceId,
          notebook.folderKey ? folderIds.get(notebook.folderKey) || null : null,
          cleanText(notebook.name, { label: 'Notebook name', max: 80, required: true }),
          typeof notebook.description === 'string' ? notebook.description.slice(0, 400) : '',
          typeof notebook.color === 'string' ? notebook.color : 'sage',
          typeof notebook.cover === 'string' ? notebook.cover : 'floral',
          new Date().toISOString(),
          new Date().toISOString(),
        );
      notebookIds.set(notebook.key, Number(created.lastInsertRowid));
    }

    const tagIds = new Map();
    for (const tag of payload.tags) {
      if (!tag?.key) throw new HttpError(400, 'A tag in the backup is invalid.');
      const name = cleanText(tag.name, { label: 'Tag name', max: 40, required: true });
      const existing = getDb()
        .prepare('SELECT id FROM tags WHERE workspace_id = ? AND name = ? COLLATE NOCASE')
        .get(workspaceId, name);
      if (existing && mode === 'add') {
        tagIds.set(tag.key, existing.id);
        continue;
      }
      const created = getDb()
        .prepare('INSERT INTO tags (workspace_id, name, color, created_at) VALUES (?, ?, ?, ?)')
        .run(workspaceId, name, typeof tag.color === 'string' ? tag.color : 'moss', new Date().toISOString());
      tagIds.set(tag.key, Number(created.lastInsertRowid));
    }

    const noteIds = new Map();
    let dailySkipped = 0;
    for (const note of payload.notes) {
      if (!note?.key) throw new HttpError(400, 'A note in the backup is invalid.');
      validateDoc(note.contentJson);
      const imported = importNoteRecord({
        workspaceId,
        title: note.title,
        contentJson: note.contentJson,
        notebookId: note.notebookKey ? notebookIds.get(note.notebookKey) || null : null,
        color: note.color || 'parchment',
        isPinned: Boolean(note.isPinned),
        isFavourite: Boolean(note.isFavourite),
        isDaily: Boolean(note.isDaily),
        dailyDate: note.dailyDate || null,
        tagIds: (note.tagKeys || []).map((key) => tagIds.get(key)).filter(Boolean),
      });
      if (note.isArchived) {
        getDb().prepare('UPDATE notes SET is_archived = 1 WHERE id = ?').run(imported.note.id);
      }
      if (imported.dailySkipped) dailySkipped += 1;
      noteIds.set(note.key, imported.note.id);
    }

    let tasks = 0;
    for (const task of payload.tasks || []) {
      createTask({
        workspaceId,
        title: task.title,
        description: task.description || '',
        status: task.status || 'pending',
        priority: task.priority || 'medium',
        dueDate: task.dueDate || null,
        noteId: task.noteKey ? noteIds.get(task.noteKey) || null : null,
      });
      tasks += 1;
    }
    let links = 0;
    const insertLink = getDb().prepare('INSERT OR IGNORE INTO note_links (source_id, target_id, created_at) VALUES (?, ?, ?)');
    for (const link of payload.links || []) {
      const source = noteIds.get(link.sourceKey);
      const target = noteIds.get(link.targetKey);
      if (!source || !target || source === target) continue;
      insertLink.run(source, target, new Date().toISOString());
      links += 1;
    }
    logActivity(
      workspaceId,
      'import.completed',
      'workspace',
      workspaceId,
      `Imported ${noteIds.size} notes without replacing existing work.`,
    );
    if (mode === 'replace') {
      getDb()
        .prepare('UPDATE activity SET summary = ? WHERE id = (SELECT MAX(id) FROM activity WHERE workspace_id = ?)')
        .run(`Replaced this workspace with ${noteIds.size} imported notes.`, workspaceId);
    }
    return { notes: noteIds.size, notebooks: notebookIds.size, tags: tagIds.size, tasks, links, dailySkipped, mode };
  });
}

export function importMarkdown(input) {
  const workspaceId = resolveWorkspaceId(input.workspaceId);
  if (!Array.isArray(input.files) || !input.files.length) throw new HttpError(400, 'Choose at least one Markdown file.');
  if (input.files.length > 50) throw new HttpError(400, 'Import up to 50 Markdown files at a time.');
  const notebookId = input.notebookId ? parseId(input.notebookId, 'Notebook') : null;
  const created = [];
  const titles = [];
  for (const file of input.files) {
    if (!file || typeof file.content !== 'string') throw new HttpError(400, 'A Markdown file was empty or unreadable.');
    if (file.content.length > 500_000) throw new HttpError(400, 'A Markdown file is too large.');
    const parsed = parseMarkdownFile(file.filename, file.content);
    const note = importNoteRecord({
      workspaceId,
      notebookId,
      title: parsed.title,
      contentJson: parsed.contentJson,
      contentText: docToText(parsed.contentJson),
    });
    created.push({ id: note.note.id, title: note.note.title });
    titles.push(note.note.title);
  }
  const existing = getDb()
    .prepare(
      `SELECT title FROM notes WHERE workspace_id = ? AND deleted_at IS NULL AND id NOT IN (${created.map(() => '?').join(',')})`,
    )
    .all(workspaceId, ...created.map((note) => note.id));
  const existingTitles = new Set(existing.map((note) => note.title.trim().toLowerCase()));
  logActivity(workspaceId, 'import.completed', 'workspace', workspaceId, `Imported ${created.length} Markdown notes as new notes.`);
  return {
    created: created.length,
    notes: created,
    duplicateTitles: titles.filter((title) => existingTitles.has(title.trim().toLowerCase())),
  };
}

export function exportMarkdown(workspaceValue) {
  const workspaceId = resolveWorkspaceId(workspaceValue);
  const notes = getDb()
    .prepare('SELECT id FROM notes WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY title COLLATE NOCASE')
    .all(workspaceId);
  return {
    files: notes.map((row) => {
      const note = getNote(row.id);
      return {
        filename: `${slugify(note.title)}-${note.id}.md`,
        content: `# ${note.title}\n\n${docToMarkdown(note.contentJson)}`,
      };
    }),
  };
}

export function noteMarkdown(id) {
  const note = getNote(id);
  return { filename: `${slugify(note.title)}-${note.id}.md`, content: `# ${note.title}\n\n${docToMarkdown(note.contentJson)}`, title: note.title };
}
