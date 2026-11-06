import { getDb, tx } from '../db.js';
import { HttpError } from '../errors.js';
import { insertedId } from '../db.js';
import {
  PRIORITIES,
  TASK_STATUSES,
  asBool,
  choice,
  cleanMultiline,
  cleanText,
  idList,
  likeTerm,
  localDate,
  nowIso,
  optionalFlag,
  parseId,
  parseLimit,
  assertDate,
} from '../util.js';
import { assertNote, assertTags, logActivity, resolveWorkspaceId } from './shared.js';

function mapTask(row, tags = []) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    noteId: row.note_id,
    noteTitle: row.note_title ?? null,
    title: row.title,
    description: row.description || '',
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdOn: row.created_on,
    completedAt: row.completed_at,
    completedOn: row.completed_on,
    deletedAt: row.deleted_at,
  };
}

function tagsFor(ids) {
  const map = new Map();
  if (!ids.length) return map;
  const rows = getDb()
    .prepare(
      `SELECT tt.task_id, t.id, t.workspace_id, t.name, t.color
       FROM task_tags tt JOIN tags t ON t.id = tt.tag_id
       WHERE tt.task_id IN (${ids.map(() => '?').join(',')})
       ORDER BY t.name COLLATE NOCASE`,
    )
    .all(...ids);
  for (const row of rows) {
    const list = map.get(row.task_id) || [];
    list.push({ id: row.id, workspaceId: row.workspace_id, name: row.name, color: row.color });
    map.set(row.task_id, list);
  }
  return map;
}

function hydrate(rows) {
  const tags = tagsFor(rows.map((row) => row.id));
  return rows.map((row) => mapTask(row, tags.get(row.id) || []));
}

function taskRow(id) {
  return getDb()
    .prepare(
      `SELECT t.*, n.title AS note_title
       FROM tasks t LEFT JOIN notes n ON n.id = t.note_id
       WHERE t.id = ?`,
    )
    .get(id);
}

function requireTask(id, { allowDeleted = false } = {}) {
  const row = taskRow(parseId(id, 'Task'));
  if (!row || (!allowDeleted && row.deleted_at)) throw new HttpError(404, 'Task not found.');
  return row;
}

export function getTask(id, { allowDeleted = true } = {}) {
  return hydrate([requireTask(id, { allowDeleted })])[0];
}

function replaceTaskTags(taskId, tagIds, workspaceId) {
  getDb().prepare('DELETE FROM task_tags WHERE task_id = ?').run(taskId);
  if (!tagIds?.length) return;
  assertTags(workspaceId, tagIds);
  const insert = getDb().prepare('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)');
  for (const tagId of tagIds) insert.run(taskId, tagId);
}

export function listTasks(query) {
  const workspaceId = resolveWorkspaceId(query.workspaceId);
  const where = ['t.workspace_id = ?'];
  const params = [workspaceId];
  const trashed = optionalFlag(query.trashed);
  where.push(trashed ? 't.deleted_at IS NOT NULL' : 't.deleted_at IS NULL');
  if (query.status) {
    where.push('t.status = ?');
    params.push(choice(query.status, TASK_STATUSES, 'Status'));
  }
  if (query.priority) {
    where.push('t.priority = ?');
    params.push(choice(query.priority, PRIORITIES, 'Priority'));
  }
  if (query.noteId) {
    where.push('t.note_id = ?');
    params.push(parseId(query.noteId, 'Note'));
  }
  if (query.tagId) {
    where.push('EXISTS (SELECT 1 FROM task_tags tt WHERE tt.task_id = t.id AND tt.tag_id = ?)');
    params.push(parseId(query.tagId, 'Tag'));
  }
  const today = localDate();
  if (query.due === 'today') {
    where.push('t.due_date = ?');
    params.push(today);
  } else if (query.due === 'overdue') {
    where.push("t.due_date < ? AND t.status != 'completed'");
    params.push(today);
  } else if (query.due === 'upcoming') {
    where.push("t.due_date > ? AND t.status != 'completed'");
    params.push(today);
  } else if (query.due === 'none') where.push('t.due_date IS NULL');
  else if (query.due) throw new HttpError(400, 'Due filter must be today, overdue, upcoming, or none.');
  if (query.dueOn) {
    where.push('t.due_date = ?');
    params.push(assertDate(query.dueOn, 'Due date'));
  }
  if (query.q && String(query.q).trim()) {
    where.push('(t.title LIKE ? COLLATE NOCASE OR t.description LIKE ? COLLATE NOCASE)');
    const term = likeTerm(query.q);
    params.push(term, term);
  }
  const sorts = {
    due: "t.due_date IS NULL, t.due_date ASC, CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END",
    priority: "CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, t.due_date IS NULL, t.due_date",
    title: 't.title COLLATE NOCASE',
    created: 't.created_at DESC',
  };
  if (query.sort && !sorts[query.sort]) throw new HttpError(400, 'Task sort must be due, priority, title, or created.');
  const sort = sorts[query.sort] || "CASE t.status WHEN 'completed' THEN 1 ELSE 0 END, " + sorts.due;
  const limit = parseLimit(query.limit);
  const rows = getDb()
    .prepare(
      `SELECT t.*, n.title AS note_title
       FROM tasks t LEFT JOIN notes n ON n.id = t.note_id
       WHERE ${where.join(' AND ')}
       ORDER BY ${sort}
       LIMIT ${limit}`,
    )
    .all(...params);
  return hydrate(rows);
}

export function createTask(input, stamp = null) {
  return tx(() => {
    const workspaceId = resolveWorkspaceId(input.workspaceId);
    const title = cleanText(input.title, { label: 'Task title', max: 160, required: true });
    const description = cleanMultiline(input.description, { label: 'Description', max: 4000 });
    const status = choice(input.status || 'pending', TASK_STATUSES, 'Status');
    const priority = choice(input.priority || 'medium', PRIORITIES, 'Priority');
    const dueDate = input.dueDate ? assertDate(input.dueDate, 'Due date') : null;
    const noteId = input.noteId ? assertNote(workspaceId, input.noteId) : null;
    const when = stamp?.at || nowIso();
    const day = stamp?.on || localDate(stamp?.at ? new Date(stamp.at) : new Date());
    const completed = status === 'completed';
    const result = getDb()
      .prepare(
        `INSERT INTO tasks (
          workspace_id, note_id, title, description, status, priority, due_date,
          created_at, updated_at, created_on, completed_at, completed_on
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        workspaceId,
        noteId,
        title,
        description,
        status,
        priority,
        dueDate,
        when,
        when,
        day,
        completed ? when : null,
        completed ? day : null,
      );
    const id = insertedId(result);
    replaceTaskTags(id, idList(input.tagIds) || [], workspaceId);
    logActivity(workspaceId, 'task.created', 'task', id, `Added the quest “${title}”.`, when);
    if (completed) logActivity(workspaceId, 'task.completed', 'task', id, `Completed “${title}”.`, when);
    return getTask(id);
  });
}

export function updateTask(id, input) {
  return tx(() => {
    const current = requireTask(id);
    const title = input.title !== undefined ? cleanText(input.title, { label: 'Task title', max: 160, required: true }) : current.title;
    const description = input.description !== undefined ? cleanMultiline(input.description, { label: 'Description', max: 4000 }) : current.description;
    const status = input.status !== undefined ? choice(input.status, TASK_STATUSES, 'Status') : current.status;
    const priority = input.priority !== undefined ? choice(input.priority, PRIORITIES, 'Priority') : current.priority;
    let dueDate = current.due_date;
    if (input.dueDate !== undefined) dueDate = input.dueDate === null || input.dueDate === '' ? null : assertDate(input.dueDate, 'Due date');
    let noteId = current.note_id;
    if (input.noteId !== undefined) noteId = input.noteId === null ? null : assertNote(current.workspace_id, input.noteId);
    const when = nowIso();
    let completedAt = current.completed_at;
    let completedOn = current.completed_on;
    if (status === 'completed' && current.status !== 'completed') {
      completedAt = when;
      completedOn = localDate();
    } else if (status !== 'completed') {
      completedAt = null;
      completedOn = null;
    }
    getDb()
      .prepare(
        `UPDATE tasks
         SET title = ?, description = ?, status = ?, priority = ?, due_date = ?, note_id = ?,
             updated_at = ?, completed_at = ?, completed_on = ?
         WHERE id = ?`,
      )
      .run(title, description, status, priority, dueDate, noteId, when, completedAt, completedOn, current.id);
    if (input.tagIds !== undefined) replaceTaskTags(current.id, idList(input.tagIds) || [], current.workspace_id);
    if (status === 'completed' && current.status !== 'completed') {
      logActivity(current.workspace_id, 'task.completed', 'task', current.id, `Completed “${title}”.`);
    } else if (current.status === 'completed' && status !== 'completed') {
      logActivity(current.workspace_id, 'task.reopened', 'task', current.id, `Reopened “${title}”.`);
    }
    return getTask(current.id);
  });
}

export function trashTask(id) {
  const task = requireTask(id);
  const deletedAt = nowIso();
  getDb().prepare('UPDATE tasks SET deleted_at = ? WHERE id = ?').run(deletedAt, task.id);
  logActivity(task.workspace_id, 'task.deleted', 'task', task.id, `Cleared “${task.title}” from the quest board.`);
  return { id: task.id, deletedAt };
}

export function restoreTask(id) {
  const task = requireTask(id, { allowDeleted: true });
  if (!task.deleted_at) throw new HttpError(400, 'That task is not in the trash.');
  getDb().prepare('UPDATE tasks SET deleted_at = NULL, updated_at = ? WHERE id = ?').run(nowIso(), task.id);
  return getTask(task.id);
}

export function destroyTask(id) {
  const task = requireTask(id, { allowDeleted: true });
  if (!task.deleted_at) throw new HttpError(400, 'Move a task to the trash before deleting it permanently.');
  getDb().prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
  return { id: task.id, deleted: true };
}

export { asBool };
