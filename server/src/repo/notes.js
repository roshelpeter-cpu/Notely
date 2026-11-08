import { getDb, insertedId, tx } from '../db.js';
import { HttpError, isUniqueError } from '../errors.js';
import { docToText, emptyDoc, excerpt, validateDoc, wordCount } from '../text.js';
import {
  NOTE_COLORS,
  asBool,
  choice,
  cleanTitle,
  dailyTitle,
  idList,
  localDate,
  nowIso,
  optionalFlag,
  parseId,
  parseLimit,
  toFtsQuery,
} from '../util.js';
import { assertFolder, assertNotebook, assertTags, logActivity, resolveWorkspaceId } from './shared.js';

const NOTE_FROM = `
  FROM notes n
  LEFT JOIN notebooks nb ON nb.id = n.notebook_id
`;

function mapNote(row, tags = [], full = false) {
  const note = {
    id: row.id,
    workspaceId: row.workspace_id,
    notebookId: row.notebook_id,
    notebookName: row.notebook_name ?? null,
    notebookColor: row.notebook_color ?? null,
    notebookCover: row.notebook_cover ?? null,
    folderId: row.folder_id,
    title: row.title,
    excerpt: excerpt(row.content_text),
    color: row.color,
    isPinned: row.is_pinned === 1,
    isFavourite: row.is_favourite === 1,
    isArchived: row.is_archived === 1,
    isDaily: row.is_daily === 1,
    dailyDate: row.daily_date,
    wordCount: row.word_count,
    charCount: (row.content_text || '').length,
    tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdOn: row.created_on,
    updatedOn: row.updated_on,
    deletedAt: row.deleted_at,
  };
  if (full) {
    note.contentJson = JSON.parse(row.content_json);
    note.contentText = row.content_text || '';
  }
  return note;
}

function tagsFor(ids) {
  const map = new Map();
  if (!ids.length) return map;
  const rows = getDb()
    .prepare(
      `SELECT nt.note_id, t.id, t.workspace_id, t.name, t.color
       FROM note_tags nt
       JOIN tags t ON t.id = nt.tag_id
       WHERE nt.note_id IN (${ids.map(() => '?').join(',')})
       ORDER BY t.name COLLATE NOCASE`,
    )
    .all(...ids);
  for (const row of rows) {
    const tag = { id: row.id, workspaceId: row.workspace_id, name: row.name, color: row.color };
    const list = map.get(row.note_id) || [];
    list.push(tag);
    map.set(row.note_id, list);
  }
  return map;
}

function hydrate(rows, full = false) {
  const tags = tagsFor(rows.map((row) => row.id));
  return rows.map((row) => mapNote(row, tags.get(row.id) || [], full));
}

export function getNoteRow(id) {
  return getDb()
    .prepare(
      `SELECT n.*, nb.name AS notebook_name, nb.color AS notebook_color, nb.cover AS notebook_cover
       ${NOTE_FROM}
       WHERE n.id = ?`,
    )
    .get(id);
}

function requireNote(id, { allowDeleted = false } = {}) {
  const row = getNoteRow(id);
  if (!row || (!allowDeleted && row.deleted_at)) throw new HttpError(404, 'Note not found.');
  return row;
}

export function getNote(id, { full = true, allowDeleted = true } = {}) {
  const row = requireNote(parseId(id, 'Note'), { allowDeleted });
  return hydrate([row], full)[0];
}

function syncFts(id, title, contentText) {
  const db = getDb();
  db.prepare('DELETE FROM notes_fts WHERE rowid = ?').run(id);
  db.prepare('INSERT INTO notes_fts(rowid, title, content_text) VALUES (?, ?, ?)').run(id, title, contentText);
}

function removeFts(id) {
  getDb().prepare('DELETE FROM notes_fts WHERE rowid = ?').run(id);
}

function addVersion(noteId, title, contentJson, contentText, words, when = nowIso()) {
  getDb()
    .prepare(
      `INSERT INTO note_versions (note_id, title, content_json, content_text, word_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(noteId, title, JSON.stringify(contentJson), contentText, words, when);
}

function latestVersion(noteId) {
  return getDb()
    .prepare('SELECT title, content_text, created_at FROM note_versions WHERE note_id = ? ORDER BY id DESC LIMIT 1')
    .get(noteId);
}

function meaningfulChange(current, next, lastVersionAt) {
  if (current.title === next.title && current.content_text === next.contentText) return false;
  const delta = Math.abs((next.contentText || '').length - (current.content_text || '').length);
  const age = lastVersionAt ? Date.now() - new Date(lastVersionAt).getTime() : Number.POSITIVE_INFINITY;
  if (delta >= 60) return true;
  if (current.title !== next.title && age > 60_000) return true;
  if (age > 10 * 60 * 1000 && (delta >= 15 || current.title !== next.title)) return true;
  return false;
}

function replaceNoteTags(noteId, tagIds, workspaceId) {
  const db = getDb();
  db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(noteId);
  if (!tagIds?.length) return;
  assertTags(workspaceId, tagIds);
  const insert = db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)');
  for (const tagId of tagIds) insert.run(noteId, tagId);
}

function contentFrom(input) {
  if (input.contentJson !== undefined) {
    const contentJson = validateDoc(input.contentJson);
    const contentText = input.contentText !== undefined ? String(input.contentText) : docToText(contentJson);
    if (contentText.length > 500_000) throw new HttpError(400, 'Note text is too long.');
    return { contentJson, contentText };
  }
  const contentJson = emptyDoc();
  const contentText = input.contentText !== undefined ? String(input.contentText) : '';
  if (contentText.length > 500_000) throw new HttpError(400, 'Note text is too long.');
  if (contentText) contentJson.content = [{ type: 'paragraph', content: [{ type: 'text', text: contentText }] }];
  return { contentJson, contentText };
}

function insertNote(input, stamp = null) {
  const workspaceId = input.workspaceId;
  const when = stamp?.at || nowIso();
  const day = stamp?.on || localDate(stamp?.at ? new Date(stamp.at) : new Date());
  const title = cleanTitle(input.title);
  const { contentJson, contentText } = contentFrom(input);
  const notebookId = input.notebookId ? assertNotebook(workspaceId, input.notebookId) : null;
  const folderId = input.folderId ? assertFolder(workspaceId, input.folderId) : null;
  const color = choice(input.color || 'parchment', NOTE_COLORS, 'Note colour');
  const words = wordCount(contentText);
  const result = getDb()
    .prepare(
      `INSERT INTO notes (
        workspace_id, notebook_id, folder_id, title, content_json, content_text, color,
        is_pinned, is_favourite, is_archived, is_daily, daily_date, word_count,
        created_at, updated_at, created_on, updated_on
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      workspaceId,
      notebookId,
      folderId,
      title,
      JSON.stringify(contentJson),
      contentText,
      color,
      input.isPinned ? 1 : 0,
      input.isFavourite ? 1 : 0,
      0,
      input.isDaily ? 1 : 0,
      input.isDaily ? input.dailyDate : null,
      words,
      when,
      when,
      day,
      day,
    );
  const id = insertedId(result);
  replaceNoteTags(id, input.tagIds || [], workspaceId);
  syncFts(id, title, contentText);
  addVersion(id, title, contentJson, contentText, words, when);
  return id;
}

export function createNote(input, stamp = null) {
  return tx(() => {
    const workspaceId = resolveWorkspaceId(input.workspaceId);
    const id = insertNote({ ...input, workspaceId, isDaily: false }, stamp);
    const note = getNote(id);
    logActivity(workspaceId, 'note.created', 'note', id, `Opened “${note.title}”.`, stamp?.at);
    return note;
  });
}

export function importNoteRecord(input) {
  return tx(() => {
    const workspaceId = resolveWorkspaceId(input.workspaceId);
    let isDaily = Boolean(input.isDaily && input.dailyDate);
    if (isDaily) {
      const existing = getDb()
        .prepare(
          `SELECT id FROM notes
           WHERE workspace_id = ? AND daily_date = ? AND is_daily = 1 AND deleted_at IS NULL`,
        )
        .get(workspaceId, input.dailyDate);
      if (existing) isDaily = false;
    }
    const write = (daily) =>
      insertNote({
        ...input,
        workspaceId,
        isDaily: daily,
        dailyDate: input.dailyDate,
      });
    try {
      const id = write(isDaily);
      return { note: getNote(id), dailySkipped: Boolean(input.isDaily && !isDaily) };
    } catch (error) {
      if (!(isDaily && isUniqueError(error))) throw error;
      const id = write(false);
      return { note: getNote(id), dailySkipped: true };
    }
  });
}

export function openDailyNote(input) {
  return tx(() => {
    const workspaceId = resolveWorkspaceId(input.workspaceId);
    const date = input.date;
    const existing = getDb()
      .prepare(
        `SELECT id FROM notes
         WHERE workspace_id = ? AND daily_date = ? AND is_daily = 1 AND deleted_at IS NULL`,
      )
      .get(workspaceId, date);
    if (existing) return getNote(existing.id);

    const contentJson = input.contentJson || {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: "Today's thoughts" }] },
        { type: 'paragraph' },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Daily goals' }] },
        {
          type: 'taskList',
          content: [
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] },
          ],
        },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Tasks' }] },
        { type: 'paragraph' },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Reflection' }] },
        { type: 'paragraph' },
      ],
    };
    try {
      const id = insertNote({
        workspaceId,
        title: input.title || dailyTitle(date),
        contentJson,
        notebookId: input.notebookId,
        color: input.color || 'parchment',
        isDaily: true,
        dailyDate: date,
        tagIds: input.tagIds || [],
      });
      logActivity(workspaceId, 'note.created', 'note', id, `Opened ${dailyTitle(date)}.`);
      return getNote(id);
    } catch (error) {
      if (!isUniqueError(error)) throw error;
      const raced = getDb()
        .prepare(
          `SELECT id FROM notes
           WHERE workspace_id = ? AND daily_date = ? AND is_daily = 1 AND deleted_at IS NULL`,
        )
        .get(workspaceId, date);
      if (!raced) throw error;
      return getNote(raced.id);
    }
  });
}

export function listNotes(query) {
  const workspaceId = resolveWorkspaceId(query.workspaceId);
  const where = ['n.workspace_id = ?'];
  const params = [workspaceId];
  const trashed = optionalFlag(query.trashed);
  where.push(trashed ? 'n.deleted_at IS NOT NULL' : 'n.deleted_at IS NULL');

  if (!trashed) {
    if (query.archived === 'all') {
      /* Library search can see the stacks and the archive together. */
    } else if (optionalFlag(query.archived)) where.push('n.is_archived = 1');
    else where.push('n.is_archived = 0');
  }
  if (optionalFlag(query.pinned)) where.push('n.is_pinned = 1');
  if (optionalFlag(query.favourite)) where.push('n.is_favourite = 1');
  if (optionalFlag(query.daily)) where.push('n.is_daily = 1');
  if (query.color) {
    where.push('n.color = ?');
    params.push(choice(query.color, NOTE_COLORS, 'Note colour'));
  }
  if (query.notebookId === 'none') where.push('n.notebook_id IS NULL');
  else if (query.notebookId) {
    where.push('n.notebook_id = ?');
    params.push(parseId(query.notebookId, 'Notebook'));
  }
  if (query.folderId) {
    where.push('n.folder_id = ?');
    params.push(parseId(query.folderId, 'Folder'));
  }
  if (query.tagId) {
    where.push('EXISTS (SELECT 1 FROM note_tags nt WHERE nt.note_id = n.id AND nt.tag_id = ?)');
    params.push(parseId(query.tagId, 'Tag'));
  }
  if (query.from) {
    where.push('n.updated_on >= ?');
    params.push(query.from);
  }
  if (query.to) {
    where.push('n.updated_on <= ?');
    params.push(query.to);
  }

  const sorts = {
    updated: 'n.updated_at',
    created: 'n.created_at',
    title: 'n.title COLLATE NOCASE',
    words: 'n.word_count',
  };
  if (query.sort && !sorts[query.sort]) throw new HttpError(400, 'Sort must be updated, created, title, or words.');
  const sort = sorts[query.sort] || sorts.updated;
  const direction = query.order === 'asc' ? 'ASC' : query.order === 'desc' || !query.order ? 'DESC' : null;
  if (!direction) throw new HttpError(400, 'Order must be asc or desc.');
  const limit = parseLimit(query.limit);

  const select = `SELECT n.*, nb.name AS notebook_name, nb.color AS notebook_color, nb.cover AS notebook_cover`;
  const runLike = () => {
    const likeParams = [...params];
    const likeWhere = [...where];
    if (query.q && String(query.q).trim()) {
      const term = `%${String(query.q).trim().replace(/[\\%_]/g, '')}%`;
      likeWhere.push('(n.title LIKE ? COLLATE NOCASE OR n.content_text LIKE ? COLLATE NOCASE)');
      likeParams.push(term, term);
    }
    return getDb()
      .prepare(
        `${select} ${NOTE_FROM}
         WHERE ${likeWhere.join(' AND ')}
         ORDER BY ${sort} ${direction}
         LIMIT ${limit}`,
      )
      .all(...likeParams);
  };

  if (query.q && String(query.q).trim()) {
    const match = toFtsQuery(query.q);
    if (!match) return [];
    try {
      const rows = getDb()
        .prepare(
          `${select}
           FROM notes_fts
           JOIN notes n ON n.id = notes_fts.rowid
           LEFT JOIN notebooks nb ON nb.id = n.notebook_id
           WHERE notes_fts MATCH ? AND ${where.join(' AND ')}
           ORDER BY ${sort} ${direction}
           LIMIT ${limit}`,
        )
        .all(match, ...params);
      return hydrate(rows);
    } catch {
      return hydrate(runLike());
    }
  }
  return hydrate(runLike());
}

export function updateNote(id, input) {
  return tx(() => {
    const current = requireNote(parseId(id, 'Note'));
    if (input.baseUpdatedAt && !input.force && input.baseUpdatedAt !== current.updated_at) {
      throw new HttpError(409, 'This note was updated somewhere else. Reload it, or keep your copy.', {
        code: 'CONFLICT',
        current: getNote(current.id),
      });
    }

    const next = {
      title: input.title !== undefined ? cleanTitle(input.title) : current.title,
      contentJson: JSON.parse(current.content_json),
      contentText: current.content_text,
      notebookId: current.notebook_id,
      folderId: current.folder_id,
      color: current.color,
      isPinned: current.is_pinned === 1,
      isFavourite: current.is_favourite === 1,
      isArchived: current.is_archived === 1,
    };
    if (input.contentJson !== undefined || input.contentText !== undefined) {
      const content = contentFrom(input.contentJson !== undefined ? input : { contentText: input.contentText, contentJson: next.contentJson });
      if (input.contentJson !== undefined) {
        next.contentJson = content.contentJson;
        next.contentText = input.contentText !== undefined ? content.contentText : docToText(content.contentJson);
      } else {
        next.contentText = content.contentText;
      }
    }
    if (input.notebookId !== undefined) {
      next.notebookId = input.notebookId === null ? null : assertNotebook(current.workspace_id, input.notebookId);
    }
    if (input.folderId !== undefined) {
      next.folderId = input.folderId === null ? null : assertFolder(current.workspace_id, input.folderId);
    }
    if (input.color !== undefined) next.color = choice(input.color, NOTE_COLORS, 'Note colour');
    if (input.isPinned !== undefined) next.isPinned = asBool(input.isPinned, 'Pinned');
    if (input.isFavourite !== undefined) next.isFavourite = asBool(input.isFavourite, 'Favourite');
    if (input.isArchived !== undefined) next.isArchived = asBool(input.isArchived, 'Archived');

    const contentChanged = next.title !== current.title || next.contentText !== current.content_text;
    const structureChanged =
      next.notebookId !== current.notebook_id ||
      next.folderId !== current.folder_id ||
      next.color !== current.color ||
      input.tagIds !== undefined;
    const flagsChanged =
      next.isPinned !== (current.is_pinned === 1) ||
      next.isFavourite !== (current.is_favourite === 1) ||
      next.isArchived !== (current.is_archived === 1);
    if (!contentChanged && !structureChanged && !flagsChanged && input.contentJson === undefined) return getNote(current.id);

    let updatedAt = current.updated_at;
    let updatedOn = current.updated_on;
    if (contentChanged || structureChanged || input.contentJson !== undefined) {
      const last = latestVersion(current.id);
      if (meaningfulChange(current, next, last?.created_at)) {
        if (!last || last.content_text !== current.content_text || last.title !== current.title) {
          addVersion(current.id, current.title, JSON.parse(current.content_json), current.content_text, current.word_count);
        }
      }
      updatedAt = nowIso();
      updatedOn = localDate();
    }

    getDb()
      .prepare(
        `UPDATE notes
         SET title = ?, content_json = ?, content_text = ?, notebook_id = ?, folder_id = ?, color = ?,
             is_pinned = ?, is_favourite = ?, is_archived = ?, word_count = ?, updated_at = ?, updated_on = ?
         WHERE id = ?`,
      )
      .run(
        next.title,
        JSON.stringify(next.contentJson),
        next.contentText,
        next.notebookId,
        next.folderId,
        next.color,
        next.isPinned ? 1 : 0,
        next.isFavourite ? 1 : 0,
        next.isArchived ? 1 : 0,
        wordCount(next.contentText),
        updatedAt,
        updatedOn,
        current.id,
      );
    if (input.tagIds !== undefined) replaceNoteTags(current.id, idList(input.tagIds) || [], current.workspace_id);
    if (contentChanged) syncFts(current.id, next.title, next.contentText);
    if (input.isArchived === true) logActivity(current.workspace_id, 'note.archived', 'note', current.id, `Archived “${next.title}”.`);
    if (input.isArchived === false && current.is_archived === 1) {
      logActivity(current.workspace_id, 'note.restored', 'note', current.id, `Returned “${next.title}” from the archive.`);
    }
    return getNote(current.id);
  });
}

export function trashNote(id) {
  return tx(() => {
    const note = requireNote(parseId(id, 'Note'));
    const deletedAt = nowIso();
    getDb().prepare('UPDATE notes SET deleted_at = ?, is_daily = 0, daily_date = NULL WHERE id = ?').run(deletedAt, note.id);
    logActivity(note.workspace_id, 'note.deleted', 'note', note.id, `Moved “${note.title}” to the clearing.`);
    return { id: note.id, deletedAt };
  });
}

export function restoreNote(id) {
  return tx(() => {
    const note = requireNote(parseId(id, 'Note'), { allowDeleted: true });
    if (!note.deleted_at) throw new HttpError(400, 'That note is not in the trash.');
    getDb().prepare('UPDATE notes SET deleted_at = NULL, updated_at = ?, updated_on = ? WHERE id = ?').run(nowIso(), localDate(), note.id);
    logActivity(note.workspace_id, 'note.restored', 'note', note.id, `Brought “${note.title}” back from the clearing.`);
    return getNote(note.id);
  });
}

export function destroyNote(id) {
  return tx(() => {
    const note = requireNote(parseId(id, 'Note'), { allowDeleted: true });
    if (!note.deleted_at) throw new HttpError(400, 'Move a note to the trash before deleting it permanently.');
    removeFts(note.id);
    getDb().prepare('DELETE FROM notes WHERE id = ?').run(note.id);
    logActivity(note.workspace_id, 'note.destroyed', 'note', null, `Cleared “${note.title}” for good.`);
    return { id: note.id, deleted: true };
  });
}

export function duplicateNote(id) {
  return tx(() => {
    const note = getNote(parseId(id, 'Note'), { allowDeleted: false });
    const copyId = insertNote({
      workspaceId: note.workspaceId,
      title: cleanTitle(`${note.title} copy`.slice(0, 200)),
      contentJson: note.contentJson,
      notebookId: note.notebookId,
      folderId: note.folderId,
      color: note.color,
      tagIds: note.tags.map((tag) => tag.id),
    });
    logActivity(note.workspaceId, 'note.created', 'note', copyId, `Copied “${note.title}”.`);
    return getNote(copyId);
  });
}

export function listVersions(noteId) {
  const note = requireNote(parseId(noteId, 'Note'), { allowDeleted: true });
  return getDb()
    .prepare(
      `SELECT id, note_id, title, content_text, word_count, created_at
       FROM note_versions WHERE note_id = ? ORDER BY id DESC`,
    )
    .all(note.id)
    .map((row) => ({
      id: row.id,
      noteId: row.note_id,
      title: row.title,
      excerpt: excerpt(row.content_text),
      wordCount: row.word_count,
      createdAt: row.created_at,
    }));
}

export function getVersion(noteId, versionId) {
  requireNote(parseId(noteId, 'Note'), { allowDeleted: true });
  const row = getDb()
    .prepare('SELECT * FROM note_versions WHERE id = ? AND note_id = ?')
    .get(parseId(versionId, 'Version'), parseId(noteId, 'Note'));
  if (!row) throw new HttpError(404, 'Version not found.');
  return {
    id: row.id,
    noteId: row.note_id,
    title: row.title,
    contentJson: JSON.parse(row.content_json),
    contentText: row.content_text,
    excerpt: excerpt(row.content_text),
    wordCount: row.word_count,
    createdAt: row.created_at,
  };
}

export function restoreVersion(noteId, versionId) {
  return tx(() => {
    const current = requireNote(parseId(noteId, 'Note'));
    const version = getVersion(current.id, versionId);
    const last = latestVersion(current.id);
    if (!last || last.content_text !== current.content_text || last.title !== current.title) {
      addVersion(current.id, current.title, JSON.parse(current.content_json), current.content_text, current.word_count);
    }
    const when = nowIso();
    getDb()
      .prepare(
        `UPDATE notes
         SET title = ?, content_json = ?, content_text = ?, word_count = ?, updated_at = ?, updated_on = ?
         WHERE id = ?`,
      )
      .run(version.title, JSON.stringify(version.contentJson), version.contentText, version.wordCount, when, localDate(), current.id);
    syncFts(current.id, version.title, version.contentText);
    logActivity(current.workspace_id, 'note.restored', 'note', current.id, `Restored an earlier copy of “${version.title}”.`);
    return getNote(current.id);
  });
}

function linkedNote(row) {
  return {
    id: row.id,
    title: row.title,
    excerpt: excerpt(row.content_text),
    color: row.color,
    notebookName: row.notebook_name ?? null,
    updatedAt: row.updated_at,
  };
}

export function listLinks(noteId) {
  const note = requireNote(parseId(noteId, 'Note'), { allowDeleted: true });
  const db = getDb();
  const outgoing = db
    .prepare(
      `SELECT n.id, n.title, n.content_text, n.color, n.updated_at, nb.name AS notebook_name
       FROM note_links l
       JOIN notes n ON n.id = l.target_id
       LEFT JOIN notebooks nb ON nb.id = n.notebook_id
       WHERE l.source_id = ? AND n.deleted_at IS NULL
       ORDER BY n.title COLLATE NOCASE`,
    )
    .all(note.id)
    .map(linkedNote);
  const incoming = db
    .prepare(
      `SELECT n.id, n.title, n.content_text, n.color, n.updated_at, nb.name AS notebook_name
       FROM note_links l
       JOIN notes n ON n.id = l.source_id
       LEFT JOIN notebooks nb ON nb.id = n.notebook_id
       WHERE l.target_id = ? AND n.deleted_at IS NULL
       ORDER BY n.title COLLATE NOCASE`,
    )
    .all(note.id)
    .map(linkedNote);
  return { outgoing, incoming };
}

export function addLink(noteId, targetId) {
  return tx(() => {
    const source = requireNote(parseId(noteId, 'Note'));
    const target = requireNote(parseId(targetId, 'Note'));
    if (source.id === target.id) throw new HttpError(400, 'A note cannot link to itself.');
    if (source.workspace_id !== target.workspace_id) {
      throw new HttpError(400, 'Linked notes need to live in the same workspace.');
    }
    try {
      getDb()
        .prepare('INSERT INTO note_links (source_id, target_id, created_at) VALUES (?, ?, ?)')
        .run(source.id, target.id, nowIso());
    } catch (error) {
      if (isUniqueError(error)) throw new HttpError(409, 'Those notes are already linked.');
      throw error;
    }
    return listLinks(source.id);
  });
}

export function removeLink(noteId, targetId) {
  const source = requireNote(parseId(noteId, 'Note'), { allowDeleted: true });
  const result = getDb()
    .prepare('DELETE FROM note_links WHERE source_id = ? AND target_id = ?')
    .run(source.id, parseId(targetId, 'Note'));
  if (!result.changes) throw new HttpError(404, 'That link was not found.');
  return listLinks(source.id);
}

export function graphFor(workspaceId) {
  const id = resolveWorkspaceId(workspaceId);
  const nodes = getDb()
    .prepare(
      `SELECT n.id, n.title, n.color, n.notebook_id, nb.name AS notebook_name,
              (SELECT COUNT(*) FROM note_links l WHERE l.source_id = n.id OR l.target_id = n.id) AS link_count
       FROM notes n
       LEFT JOIN notebooks nb ON nb.id = n.notebook_id
       WHERE n.workspace_id = ? AND n.deleted_at IS NULL AND n.is_archived = 0
       ORDER BY n.title COLLATE NOCASE`,
    )
    .all(id)
    .map((row) => ({
      id: row.id,
      title: row.title,
      color: row.color,
      notebookId: row.notebook_id,
      notebookName: row.notebook_name ?? null,
      linkCount: row.link_count,
    }));
  const linkEdges = getDb()
    .prepare(
      `SELECT l.source_id AS source, l.target_id AS target
       FROM note_links l
       JOIN notes a ON a.id = l.source_id
       JOIN notes b ON b.id = l.target_id
       WHERE a.workspace_id = ? AND a.deleted_at IS NULL AND a.is_archived = 0
         AND b.workspace_id = ? AND b.deleted_at IS NULL AND b.is_archived = 0`,
    )
    .all(id, id)
    .map((edge) => ({ source: edge.source, target: edge.target, kind: 'link' }));
  const seen = new Set(linkEdges.map((edge) => pairKey(edge.source, edge.target)));
  const notebookEdges = [];
  const byNotebook = new Map();
  for (const node of nodes) {
    if (!node.notebookId) continue;
    const list = byNotebook.get(node.notebookId) || [];
    list.push(node.id);
    byNotebook.set(node.notebookId, list);
  }
  for (const ids of byNotebook.values()) {
    if (ids.length < 2) continue;
    const hub = ids[0];
    for (const other of ids.slice(1)) {
      const key = pairKey(hub, other);
      if (seen.has(key)) continue;
      seen.add(key);
      notebookEdges.push({ source: hub, target: other, kind: 'notebook' });
    }
  }
  const tagRows = getDb()
    .prepare(
      `SELECT nt.note_id, nt.tag_id
       FROM note_tags nt
       JOIN notes n ON n.id = nt.note_id
       WHERE n.workspace_id = ? AND n.deleted_at IS NULL AND n.is_archived = 0`,
    )
    .all(id);
  const byTag = new Map();
  for (const row of tagRows) {
    const list = byTag.get(row.tag_id) || [];
    list.push(row.note_id);
    byTag.set(row.tag_id, list);
  }
  const tagEdges = [];
  for (const ids of byTag.values()) {
    if (ids.length < 2 || ids.length > 8) continue;
    const hub = ids[0];
    for (const other of ids.slice(1)) {
      if (tagEdges.length >= 30) break;
      const key = pairKey(hub, other);
      if (seen.has(key)) continue;
      seen.add(key);
      tagEdges.push({ source: hub, target: other, kind: 'tag' });
    }
  }
  return { nodes, edges: [...linkEdges, ...notebookEdges, ...tagEdges] };
}

function pairKey(left, right) {
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

export function calendarItems(query) {
  const workspaceId = resolveWorkspaceId(query.workspaceId);
  const from = query.from;
  const to = query.to;
  const notes = getDb()
    .prepare(
      `SELECT n.id, n.title, n.color, n.is_daily, n.daily_date, n.created_on, nb.name AS notebook_name
       FROM notes n
       LEFT JOIN notebooks nb ON nb.id = n.notebook_id
       WHERE n.workspace_id = ? AND n.deleted_at IS NULL AND n.is_archived = 0
         AND (
           (n.daily_date IS NOT NULL AND n.daily_date >= ? AND n.daily_date <= ?)
           OR (n.created_on >= ? AND n.created_on <= ?)
         )
       ORDER BY n.title COLLATE NOCASE`,
    )
    .all(workspaceId, from, to, from, to)
    .map((row) => ({
      id: row.id,
      title: row.title,
      color: row.color,
      isDaily: row.is_daily === 1,
      dailyDate: row.daily_date,
      createdOn: row.created_on,
      notebookName: row.notebook_name ?? null,
    }));
  const tasks = getDb()
    .prepare(
      `SELECT id, title, status, priority, due_date, note_id
       FROM tasks
       WHERE workspace_id = ? AND deleted_at IS NULL AND due_date >= ? AND due_date <= ?
       ORDER BY due_date, title COLLATE NOCASE`,
    )
    .all(workspaceId, from, to)
    .map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      priority: row.priority,
      dueDate: row.due_date,
      noteId: row.note_id,
    }));
  return { notes, tasks };
}
