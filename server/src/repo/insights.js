import { getDb } from '../db.js';
import { HttpError } from '../errors.js';
import { addDays, assertDate, calculateStreak, cleanText, likeTerm, localDate, parseLimit } from '../util.js';
import { listNotes } from './notes.js';
import { resolveWorkspaceId } from './shared.js';
import { listTasks } from './tasks.js';

function fillDays(rows, days, field = 'count') {
  const map = new Map(rows.map((row) => [row.date, row]));
  const filled = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = addDays(localDate(), -offset);
    const row = map.get(date);
    filled.push({ date, count: row?.count || 0, words: field === 'words' ? row?.words || 0 : row?.words || 0 });
  }
  return filled;
}

function bucketWeeks(days) {
  const weeks = [];
  for (let index = 0; index < days.length; index += 7) {
    const slice = days.slice(index, index + 7);
    weeks.push({
      weekStart: slice[0].date,
      count: slice.reduce((sum, day) => sum + day.count, 0),
      words: slice.reduce((sum, day) => sum + (day.words || 0), 0),
    });
  }
  return weeks;
}

export function statsFor(workspaceValue) {
  const workspaceId = resolveWorkspaceId(workspaceValue);
  const db = getDb();
  const totals = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM notes WHERE workspace_id = ? AND deleted_at IS NULL AND is_archived = 0) AS notes,
        (SELECT COUNT(*) FROM notes WHERE workspace_id = ? AND deleted_at IS NULL AND is_archived = 1) AS archived,
        (SELECT COUNT(*) FROM notebooks WHERE workspace_id = ?) AS notebooks,
        (SELECT COUNT(*) FROM tasks WHERE workspace_id = ? AND deleted_at IS NULL AND status != 'completed') AS open_tasks,
        (SELECT COUNT(*) FROM tasks WHERE workspace_id = ? AND deleted_at IS NULL AND status = 'completed') AS completed_tasks,
        (SELECT COALESCE(SUM(word_count), 0) FROM notes WHERE workspace_id = ? AND deleted_at IS NULL) AS words`,
    )
    .get(workspaceId, workspaceId, workspaceId, workspaceId, workspaceId, workspaceId);

  const start = addDays(localDate(), -83);
  const created = db
    .prepare(
      `SELECT created_on AS date, COUNT(*) AS count, COALESCE(SUM(word_count), 0) AS words
       FROM notes
       WHERE workspace_id = ? AND deleted_at IS NULL AND created_on >= ?
       GROUP BY created_on`,
    )
    .all(workspaceId, start);
  const completed = db
    .prepare(
      `SELECT completed_on AS date, COUNT(*) AS count
       FROM tasks
       WHERE workspace_id = ? AND deleted_at IS NULL AND completed_on IS NOT NULL AND completed_on >= ?
       GROUP BY completed_on`,
    )
    .all(workspaceId, start);
  const activityDates = db
    .prepare(
      `SELECT created_on AS date FROM notes WHERE workspace_id = ? AND deleted_at IS NULL
       UNION
       SELECT updated_on AS date FROM notes WHERE workspace_id = ? AND deleted_at IS NULL
       UNION
       SELECT completed_on AS date FROM tasks WHERE workspace_id = ? AND deleted_at IS NULL AND completed_on IS NOT NULL`,
    )
    .all(workspaceId, workspaceId, workspaceId)
    .map((row) => row.date);
  const noteDays = fillDays(created, 84);
  const taskDays = fillDays(completed, 84);
  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weekdays = weekdayNames.map((day) => ({ day, count: 0 }));
  for (const row of db.prepare('SELECT updated_on AS date FROM notes WHERE workspace_id = ? AND deleted_at IS NULL').all(workspaceId)) {
    const [year, month, day] = row.date.split('-').map(Number);
    weekdays[new Date(year, month - 1, day).getDay()].count += 1;
  }
  return {
    totals: {
      notes: totals.notes,
      archived: totals.archived,
      notebooks: totals.notebooks,
      openTasks: totals.open_tasks,
      completedTasks: totals.completed_tasks,
      words: totals.words,
    },
    streak: calculateStreak(activityDates),
    notesByWeek: bucketWeeks(noteDays),
    tasksByWeek: bucketWeeks(taskDays),
    recentDays: noteDays.slice(-14),
    weekdays,
    topTags: db
      .prepare(
        `SELECT t.name, t.color, COUNT(n.id) AS count
         FROM tags t
         LEFT JOIN note_tags nt ON nt.tag_id = t.id
         LEFT JOIN notes n ON n.id = nt.note_id AND n.deleted_at IS NULL
         WHERE t.workspace_id = ?
         GROUP BY t.id
         ORDER BY count DESC, t.name COLLATE NOCASE
         LIMIT 8`,
      )
      .all(workspaceId),
    notebooks: db
      .prepare(
        `SELECT nb.name, nb.color, nb.cover, COUNT(n.id) AS count
         FROM notebooks nb
         LEFT JOIN notes n ON n.notebook_id = nb.id AND n.deleted_at IS NULL AND n.is_archived = 0
         WHERE nb.workspace_id = ?
         GROUP BY nb.id
         ORDER BY count DESC, nb.name COLLATE NOCASE`,
      )
      .all(workspaceId),
  };
}

export function globalSearch(query) {
  const workspaceId = resolveWorkspaceId(query.workspaceId);
  const q = cleanText(query.q, { label: 'Search', max: 200 });
  if (!q || q.length < 2) return { notes: [], notebooks: [], tags: [], tasks: [] };
  const term = likeTerm(q);
  const limit = Math.min(parseLimit(query.limit, 8), 20);
  return {
    notes: listNotes({ workspaceId, q, archived: 'all', limit }),
    notebooks: getDb()
      .prepare(
        `SELECT id, name, description, color, cover FROM notebooks
         WHERE workspace_id = ? AND (name LIKE ? COLLATE NOCASE OR description LIKE ? COLLATE NOCASE)
         ORDER BY name COLLATE NOCASE LIMIT ?`,
      )
      .all(workspaceId, term, term, limit)
      .map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        color: row.color,
        cover: row.cover,
      })),
    tags: getDb()
      .prepare(
        `SELECT id, name, color FROM tags
         WHERE workspace_id = ? AND name LIKE ? COLLATE NOCASE
         ORDER BY name COLLATE NOCASE LIMIT ?`,
      )
      .all(workspaceId, term, limit),
    tasks: listTasks({ workspaceId, q, limit }),
  };
}

export function calendarQuery(query) {
  if (!query.from || !query.to) throw new HttpError(400, 'Calendar requests need a from and to date.');
  assertDate(query.from, 'From date');
  assertDate(query.to, 'To date');
  if (query.from > query.to) throw new HttpError(400, 'The calendar range is backwards.');
  return query;
}
