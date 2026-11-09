import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dbFile = path.join(os.tmpdir(), `notely-test-${process.pid}.db`);
process.env.NOTELY_DB = dbFile;
process.env.NOTELY_AUTO_SEED = '0';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

const { createApp } = await import('../src/app.js');
const { closeDb, getDb } = await import('../src/db.js');
const { calculateStreak } = await import('../src/util.js');

const app = createApp();
const server = app.listen(0);
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

let cookie = '';

async function api(pathname, options = {}) {
  const headers = { 'content-type': 'application/json', 'x-notely-request': '1' };
  const jar = options.cookie === undefined ? cookie : options.cookie;
  if (jar) headers.cookie = jar;
  const response = await fetch(base + pathname, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const json = await response.json();
  let next = jar || '';
  for (const line of response.headers.getSetCookie?.() || []) {
    const pair = line.split(';')[0];
    if (pair.startsWith('notely_session=')) next = pair.includes('notely_session=;') || /Max-Age=0/i.test(line) ? '' : pair;
  }
  if (options.cookie === undefined) cookie = next;
  return { status: response.status, json, cookie: next };
}

test.before(async () => {
  const registered = await api('/api/auth/register', {
    method: 'POST',
    body: {
      displayName: 'Keeper',
      email: 'keeper@example.com',
      password: 'forest-path-19',
      confirmPassword: 'forest-path-19',
    },
  });
  assert.equal(registered.status, 201);
  assert.equal(registered.json.data.user.email, 'keeper@example.com');
});

function doc(text) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
  };
}

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  closeDb();
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(dbFile + suffix, { force: true });
});

test('health and foundation workspace are available', async () => {
  const health = await api('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.json.data.ok, true);
  const workspaces = await api('/api/workspaces');
  assert.equal(workspaces.status, 200);
  assert.ok(workspaces.json.data.some((workspace) => workspace.name === 'Personal'));
  const missing = await api('/api/not-a-path');
  assert.equal(missing.status, 404);
});

test('rejects invalid notes and unknown records', async () => {
  const invalid = await api('/api/notes', { method: 'POST', body: { title: 'x'.repeat(240) } });
  assert.equal(invalid.status, 400);
  const missing = await api('/api/notes/99999');
  assert.equal(missing.status, 404);
  const badTask = await api('/api/tasks', { method: 'POST', body: { title: 'Broken', status: 'later' } });
  assert.equal(badTask.status, 400);
});

test('creates, reads, updates, searches, and deletes notes', async () => {
  const notebook = await api('/api/notebooks', {
    method: 'POST',
    body: { name: 'River notebook', color: 'sky', cover: 'river', description: 'Water notes' },
  });
  assert.equal(notebook.status, 201);
  const tag = await api('/api/tags', { method: 'POST', body: { name: 'Bridges', color: 'bark' } });
  assert.equal(tag.status, 201);

  const created = await api('/api/notes', {
    method: 'POST',
    body: {
      title: "'; DROP TABLE notes; --",
      contentJson: doc('The willow path meets a bright river.'),
      notebookId: notebook.json.data.id,
      tagIds: [tag.json.data.id],
      color: 'sage',
    },
  });
  assert.equal(created.status, 201);
  const id = created.json.data.id;
  assert.equal(created.json.data.title, "'; DROP TABLE notes; --");
  assert.equal(created.json.data.tags[0].name, 'Bridges');

  const fetched = await api(`/api/notes/${id}`);
  assert.equal(fetched.status, 200);
  assert.match(fetched.json.data.contentText, /bright river/);

  const byTitle = await api('/api/notes?q=willow');
  assert.ok(byTitle.json.data.some((note) => note.id === id));
  const byContent = await api('/api/notes?q=bright%20river');
  assert.ok(byContent.json.data.some((note) => note.id === id));
  const byTag = await api(`/api/notes?tagId=${tag.json.data.id}`);
  assert.ok(byTag.json.data.some((note) => note.id === id));

  const updated = await api(`/api/notes/${id}`, {
    method: 'PATCH',
    body: { isPinned: true, isFavourite: true, baseUpdatedAt: fetched.json.data.updatedAt },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.json.data.isPinned, true);

  const removed = await api(`/api/notes/${id}`, { method: 'DELETE' });
  assert.equal(removed.status, 200);
  const library = await api('/api/notes');
  assert.equal(library.json.data.some((note) => note.id === id), false);
  const trash = await api('/api/notes?trashed=true');
  assert.equal(trash.json.data.some((note) => note.id === id), true);
  const restored = await api(`/api/notes/${id}/restore`, { method: 'POST' });
  assert.equal(restored.status, 200);
  await api(`/api/notes/${id}`, { method: 'DELETE' });
  const gone = await api(`/api/notes/${id}/permanent`, { method: 'DELETE' });
  assert.equal(gone.status, 200);
  assert.equal((await api(`/api/notes/${id}`)).status, 404);
  assert.equal((await api('/api/notes?q=willow')).json.data.some((note) => note.id === id), false);
});

test('keeps one daily note per date and links notes', async () => {
  const first = await api('/api/daily-notes', { method: 'POST', body: { date: '2026-11-06' } });
  const second = await api('/api/daily-notes', { method: 'POST', body: { date: '2026-11-06' } });
  assert.equal(first.status, 200);
  assert.equal(second.json.data.id, first.json.data.id);
  assert.equal(second.json.data.isDaily, true);

  const other = await api('/api/notes', {
    method: 'POST',
    body: { title: 'Backlink target', contentJson: doc('A connected idea about bridges and rivers.') },
  });
  const linked = await api(`/api/notes/${first.json.data.id}/links`, {
    method: 'POST',
    body: { targetId: other.json.data.id },
  });
  assert.equal(linked.status, 201);
  assert.equal(linked.json.data.outgoing[0].id, other.json.data.id);
  const back = await api(`/api/notes/${other.json.data.id}/links`);
  assert.equal(back.json.data.incoming[0].id, first.json.data.id);
  const graph = await api('/api/graph');
  const linkedEdge = graph.json.data.edges.find((edge) => edge.source === first.json.data.id && edge.target === other.json.data.id);
  assert.ok(linkedEdge);
  assert.equal(linkedEdge.kind, 'link');
  const duplicate = await api(`/api/notes/${first.json.data.id}/links`, {
    method: 'POST',
    body: { targetId: other.json.data.id },
  });
  assert.equal(duplicate.status, 409);
});

test('stores a restorable version only after a meaningful change', async () => {
  const created = await api('/api/notes', {
    method: 'POST',
    body: { title: 'Versioned essay', contentJson: doc('A short beginning.') },
  });
  const id = created.json.data.id;
  const tiny = await api(`/api/notes/${id}`, {
    method: 'PATCH',
    body: { contentJson: doc('A short beginning!'), baseUpdatedAt: created.json.data.updatedAt },
  });
  assert.equal(tiny.status, 200);
  const afterTiny = await api(`/api/notes/${id}/versions`);
  assert.equal(afterTiny.json.data.length, 1);

  const longer = `${'The river kept the morning light for a long time. '.repeat(4)}Then the mist lifted.`;
  const edited = await api(`/api/notes/${id}`, {
    method: 'PATCH',
    body: { contentJson: doc(longer), baseUpdatedAt: tiny.json.data.updatedAt },
  });
  assert.equal(edited.status, 200);
  const middle = `${longer} A second meaningful passage was added so the earlier copy can be recovered.`;
  const second = await api(`/api/notes/${id}`, {
    method: 'PATCH',
    body: { contentJson: doc(middle), baseUpdatedAt: edited.json.data.updatedAt },
  });
  assert.equal(second.status, 200);
  const versions = await api(`/api/notes/${id}/versions`);
  assert.ok(versions.json.data.length >= 2);

  const original = versions.json.data.at(-1);
  const restored = await api(`/api/notes/${id}/versions/${original.id}/restore`, { method: 'POST' });
  assert.equal(restored.status, 200);
  assert.match(restored.json.data.contentText, /short beginning/);

  const conflict = await api(`/api/notes/${id}`, {
    method: 'PATCH',
    body: { title: 'Stale title', baseUpdatedAt: created.json.data.updatedAt },
  });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.json.error.code, 'CONFLICT');
});

test('manages notebooks, tags, archive, and tasks', async () => {
  const notebook = await api('/api/notebooks', {
    method: 'POST',
    body: { name: 'Moss studies', color: 'moss', cover: 'fern' },
  });
  const renamed = await api(`/api/notebooks/${notebook.json.data.id}`, {
    method: 'PATCH',
    body: { name: 'Moss studies revised' },
  });
  assert.equal(renamed.json.data.name, 'Moss studies revised');

  const note = await api('/api/notes', {
    method: 'POST',
    body: { title: 'Archive me', contentJson: doc('Put this on the high shelf.'), notebookId: notebook.json.data.id },
  });
  const archived = await api(`/api/notes/${note.json.data.id}/archive`, { method: 'POST' });
  assert.equal(archived.json.data.isArchived, true);
  assert.equal((await api('/api/notes')).json.data.some((item) => item.id === note.json.data.id), false);
  const archive = await api('/api/notes?archived=true');
  assert.ok(archive.json.data.some((item) => item.id === note.json.data.id));

  await api(`/api/notebooks/${notebook.json.data.id}`, { method: 'DELETE' });
  const detached = await api(`/api/notes/${note.json.data.id}`);
  assert.equal(detached.json.data.notebookId, null);

  const task = await api('/api/tasks', {
    method: 'POST',
    body: {
      title: 'Mend the bridge rail',
      description: 'Take a measurement before cutting.',
      priority: 'high',
      status: 'pending',
      dueDate: '2026-11-06',
      noteId: note.json.data.id,
    },
  });
  assert.equal(task.status, 201);
  const done = await api(`/api/tasks/${task.json.data.id}`, { method: 'PATCH', body: { status: 'completed' } });
  assert.equal(done.json.data.status, 'completed');
  assert.ok(done.json.data.completedAt);
  const reopened = await api(`/api/tasks/${task.json.data.id}`, { method: 'PATCH', body: { status: 'in_progress' } });
  assert.equal(reopened.json.data.completedAt, null);
  const due = await api('/api/tasks?dueOn=2026-11-06');
  assert.ok(due.json.data.some((item) => item.id === task.json.data.id));

  const calendar = await api('/api/calendar?from=2026-11-01&to=2026-11-30');
  assert.equal(calendar.status, 200);
  assert.ok(calendar.json.data.tasks.some((item) => item.id === task.json.data.id));
  assert.ok(calendar.json.data.notes.some((item) => item.isDaily));
});

test('search, suggestions, statistics, and preferences use stored data', async () => {
  const found = await api('/api/search?q=bridge');
  assert.equal(found.status, 200);
  assert.ok(found.json.data.notes.length + found.json.data.tasks.length > 0);

  const note = await api('/api/notes', {
    method: 'POST',
    body: {
      title: 'Duplicate lantern',
      contentJson: doc('A lantern sketch beside the cedar bench and another lantern sketch.'),
    },
  });
  await api('/api/notes', { method: 'POST', body: { title: 'Duplicate lantern', contentJson: doc('The second lantern sketch.') } });
  const suggestions = await api(`/api/suggestions?noteId=${note.json.data.id}`);
  assert.match(suggestions.json.data.method, /keyword/i);
  assert.ok(suggestions.json.data.duplicateTitles.some((group) => group.title === 'duplicate lantern'));
  assert.ok(suggestions.json.data.unassigned.length >= 1);

  const stats = await api('/api/stats');
  assert.ok(stats.json.data.totals.notes >= 1);
  assert.equal(typeof stats.json.data.streak.current, 'number');
  assert.ok(Array.isArray(stats.json.data.notesByWeek));

  const preferences = await api('/api/preferences', {
    method: 'PATCH',
    body: { theme: 'night', accent: 'gold', dashboard: { map: false } },
  });
  assert.equal(preferences.json.data.theme, 'night');
  assert.equal(preferences.json.data.accent, 'gold');
  assert.equal(preferences.json.data.dashboard.map, false);
  assert.equal(preferences.json.data.dashboard.focus, true);
});

test('imports markdown beside existing notes and guards backup replacement', async () => {
  const before = await api('/api/notes?archived=all');
  const imported = await api('/api/import/markdown', {
    method: 'POST',
    body: {
      files: [{ filename: 'bridge-notes.md', content: '# Bridge notes\n\nThe rail needs a new peg.\n\n- Measure\n- Cut' }],
    },
  });
  assert.equal(imported.status, 201);
  const after = await api('/api/notes?archived=all');
  assert.equal(after.json.data.length, before.json.data.length + 1);
  assert.ok(after.json.data.some((note) => note.title === 'Bridge notes'));

  const backup = await api('/api/export/json');
  assert.equal(backup.json.data.format, 'notely-backup');
  const blocked = await api('/api/import/json', { method: 'POST', body: { payload: backup.json.data, mode: 'replace' } });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.json.error.code, 'CONFIRM_REQUIRED');
  const added = await api('/api/import/json', { method: 'POST', body: { payload: backup.json.data, mode: 'add' } });
  assert.equal(added.status, 200);
  assert.ok(added.json.data.notes > 0);
  const markdown = await api(`/api/notes/${imported.json.data.notes[0].id}/markdown`);
  assert.match(markdown.json.data.content, /# Bridge notes/);
});

test('data remains after the database connection is reopened', async () => {
  const created = await api('/api/notes', {
    method: 'POST',
    body: { title: 'Persist me', contentJson: doc('This sentence should survive a restart.') },
  });
  closeDb();
  const again = await api(`/api/notes/${created.json.data.id}`);
  assert.equal(again.status, 200);
  assert.match(again.json.data.contentText, /survive a restart/);
});

test('keeps accounts separate and resets a password once', async () => {
  const locked = await api('/api/notes', { cookie: '' });
  assert.equal(locked.status, 401);

  const mine = await api('/api/notes', { method: 'POST', body: { title: 'Private path', contentJson: doc('Only the keeper.') } });
  const other = await api('/api/auth/register', {
    method: 'POST',
    cookie: '',
    body: {
      displayName: 'Visitor',
      email: 'visitor@example.com',
      password: 'lantern-walk-22',
      confirmPassword: 'lantern-walk-22',
    },
  });
  assert.equal(other.status, 201);
  const denied = await api(`/api/notes/${mine.json.data.id}`, { cookie: other.cookie });
  assert.equal(denied.status, 404);
  const duplicate = await api('/api/auth/register', {
    method: 'POST',
    cookie: '',
    body: {
      displayName: 'Keeper',
      email: 'keeper@example.com',
      password: 'forest-path-19',
      confirmPassword: 'forest-path-19',
    },
  });
  assert.equal(duplicate.status, 409);

  const forgot = await api('/api/auth/forgot', { method: 'POST', cookie: '', body: { email: 'visitor@example.com' } });
  assert.equal(forgot.status, 200);
  assert.ok(forgot.json.data.devResetPath);
  const token = new URL(forgot.json.data.devResetPath, 'http://localhost').searchParams.get('token');
  const reset = await api('/api/auth/reset', {
    method: 'POST',
    cookie: '',
    body: { token, password: 'new-lantern-22', confirmPassword: 'new-lantern-22' },
  });
  assert.equal(reset.status, 200);
  const again = await api('/api/auth/reset', {
    method: 'POST',
    cookie: '',
    body: { token, password: 'new-lantern-22', confirmPassword: 'new-lantern-22' },
  });
  assert.equal(again.status, 400);
  const signedIn = await api('/api/auth/login', {
    method: 'POST',
    cookie: '',
    body: { email: 'visitor@example.com', password: 'new-lantern-22' },
  });
  assert.equal(signedIn.status, 200);
});

test('streak math walks consecutive local days', () => {
  assert.deepEqual(calculateStreak(['2026-11-04', '2026-11-05', '2026-11-06'], '2026-11-06'), {
    current: 3,
    longest: 3,
    activeDays: 3,
  });
  assert.equal(calculateStreak(['2026-11-04', '2026-11-06'], '2026-11-06').current, 1);
});

test('seed script plants fictional sample data without touching this test database', async () => {
  const file = path.join(os.tmpdir(), `notely-seed-${process.pid}.db`);
  const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const result = spawnSync(process.execPath, ['src/seed.js'], {
    cwd: serverRoot,
    env: { ...process.env, NOTELY_DB: file, NOTELY_AUTO_SEED: '0' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(file);
  const notes = db.prepare('SELECT COUNT(*) AS count FROM notes').get().count;
  const profile = db.prepare('SELECT display_name FROM profile WHERE id = 1').get();
  db.close();
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(file + suffix, { force: true });
  assert.ok(notes >= 12);
  assert.equal(profile.display_name, 'Roshel');
  const untouched = getDb().prepare("SELECT COUNT(*) AS count FROM notes WHERE title = 'Willow path, early light'").get().count;
  assert.equal(untouched, 0);
});
