import {
  changePassword,
  clearSessionCookie,
  deleteAccount,
  loginAccount,
  logoutAccount,
  registerAccount,
  requestReset,
  resetPassword,
  sessionCookie,
} from './auth/accounts.js';
import { authStore } from './auth/context.js';
import { HttpError, asyncHandler } from './errors.js';
import { assertDate, parseId } from './util.js';
import { calendarItems } from './repo/notes.js';
import {
  addLink,
  createNote,
  destroyNote,
  duplicateNote,
  getNote,
  getVersion,
  graphFor,
  listLinks,
  listNotes,
  listVersions,
  openDailyNote,
  removeLink,
  restoreNote,
  restoreVersion,
  trashNote,
  updateNote,
} from './repo/notes.js';
import {
  createFolder,
  createNotebook,
  createTag,
  createWorkspace,
  deleteFolder,
  deleteNotebook,
  deleteTag,
  deleteWorkspace,
  getNotebook,
  getPreferences,
  getProfile,
  listFolders,
  listNotebooks,
  listTags,
  listWorkspaces,
  updateFolder,
  updateNotebook,
  updatePreferences,
  updateProfile,
  updateTag,
  updateWorkspace,
} from './repo/organise.js';
import { createTask, destroyTask, getTask, listTasks, restoreTask, trashTask, updateTask } from './repo/tasks.js';
import { calendarQuery, globalSearch, statsFor } from './repo/insights.js';
import { suggestionsFor } from './repo/suggestions.js';
import { exportJson, exportMarkdown, importJson, importMarkdown, noteMarkdown } from './repo/transfer.js';
import { listActivity } from './repo/shared.js';

function send(res, data, status = 200) {
  res.status(status).json({ data });
}

function bodyOf(req) {
  if (req.body === undefined || req.body === null) return {};
  if (typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw new HttpError(400, 'Request body must be a JSON object.');
  }
  return req.body;
}

export function registerRoutes(app) {
  const route = (method, path, handler) => app[method](path, asyncHandler(handler));

  route('get', '/api/health', (_req, res) => {
    send(res, { ok: true, service: 'notely' });
  });

  route('get', '/api/auth/session', (_req, res) => send(res, { user: authStore.getStore() || null }));
  route('post', '/api/auth/register', (req, res) => {
    const result = registerAccount(bodyOf(req));
    res.setHeader('Set-Cookie', sessionCookie(result.token, result.maxAge));
    send(res, { user: result.user }, 201);
  });
  route('post', '/api/auth/login', (req, res) => {
    const result = loginAccount(req, bodyOf(req));
    res.setHeader('Set-Cookie', sessionCookie(result.token, result.maxAge));
    send(res, { user: result.user });
  });
  route('post', '/api/auth/logout', (req, res) => {
    logoutAccount(req);
    res.setHeader('Set-Cookie', clearSessionCookie());
    send(res, { ok: true });
  });
  route('post', '/api/auth/forgot', (req, res) => send(res, requestReset(bodyOf(req))));
  route('post', '/api/auth/reset', (req, res) => send(res, resetPassword(bodyOf(req))));
  route('post', '/api/auth/password', (req, res) => send(res, changePassword(bodyOf(req))));
  route('delete', '/api/auth/account', (req, res) => {
    const result = deleteAccount(bodyOf(req), req);
    res.setHeader('Set-Cookie', clearSessionCookie());
    send(res, result);
  });

  route('get', '/api/profile', (_req, res) => send(res, getProfile()));
  route('patch', '/api/profile', (req, res) => send(res, updateProfile(bodyOf(req))));

  route('get', '/api/workspaces', (_req, res) => send(res, listWorkspaces()));
  route('post', '/api/workspaces', (req, res) => send(res, createWorkspace(bodyOf(req)), 201));
  route('patch', '/api/workspaces/:id', (req, res) => send(res, updateWorkspace(req.params.id, bodyOf(req))));
  route('delete', '/api/workspaces/:id', (req, res) => send(res, deleteWorkspace(req.params.id)));

  route('get', '/api/folders', (req, res) => send(res, listFolders(req.query.workspaceId)));
  route('post', '/api/folders', (req, res) => send(res, createFolder(bodyOf(req)), 201));
  route('patch', '/api/folders/:id', (req, res) => send(res, updateFolder(req.params.id, bodyOf(req))));
  route('delete', '/api/folders/:id', (req, res) => send(res, deleteFolder(req.params.id)));

  route('get', '/api/notebooks', (req, res) => send(res, listNotebooks(req.query.workspaceId)));
  route('post', '/api/notebooks', (req, res) => send(res, createNotebook(bodyOf(req)), 201));
  route('get', '/api/notebooks/:id', (req, res) => send(res, getNotebook(req.params.id)));
  route('patch', '/api/notebooks/:id', (req, res) => send(res, updateNotebook(req.params.id, bodyOf(req))));
  route('delete', '/api/notebooks/:id', (req, res) => send(res, deleteNotebook(req.params.id)));

  route('get', '/api/tags', (req, res) => send(res, listTags(req.query.workspaceId)));
  route('post', '/api/tags', (req, res) => send(res, createTag(bodyOf(req)), 201));
  route('patch', '/api/tags/:id', (req, res) => send(res, updateTag(req.params.id, bodyOf(req))));
  route('delete', '/api/tags/:id', (req, res) => send(res, deleteTag(req.params.id)));

  route('get', '/api/notes', (req, res) => send(res, listNotes(req.query)));
  route('post', '/api/notes', (req, res) => send(res, createNote(bodyOf(req)), 201));
  route('get', '/api/notes/:id/markdown', (req, res) => send(res, noteMarkdown(req.params.id)));
  route('get', '/api/notes/:id/versions', (req, res) => send(res, listVersions(req.params.id)));
  route('get', '/api/notes/:id/versions/:versionId', (req, res) => send(res, getVersion(req.params.id, req.params.versionId)));
  route('post', '/api/notes/:id/versions/:versionId/restore', (req, res) => send(res, restoreVersion(req.params.id, req.params.versionId)));
  route('get', '/api/notes/:id/links', (req, res) => send(res, listLinks(req.params.id)));
  route('post', '/api/notes/:id/links', (req, res) => {
    const targetId = bodyOf(req).targetId;
    if (!targetId) throw new HttpError(400, 'Choose a note to link.');
    send(res, addLink(req.params.id, targetId), 201);
  });
  route('delete', '/api/notes/:id/links/:targetId', (req, res) => send(res, removeLink(req.params.id, req.params.targetId)));
  route('post', '/api/notes/:id/duplicate', (req, res) => send(res, duplicateNote(req.params.id), 201));
  route('post', '/api/notes/:id/archive', (req, res) => send(res, updateNote(req.params.id, { isArchived: true })));
  route('post', '/api/notes/:id/unarchive', (req, res) => send(res, updateNote(req.params.id, { isArchived: false })));
  route('post', '/api/notes/:id/restore', (req, res) => send(res, restoreNote(req.params.id)));
  route('delete', '/api/notes/:id/permanent', (req, res) => send(res, destroyNote(req.params.id)));
  route('get', '/api/notes/:id', (req, res) => send(res, getNote(req.params.id)));
  route('patch', '/api/notes/:id', (req, res) => send(res, updateNote(req.params.id, bodyOf(req))));
  route('delete', '/api/notes/:id', (req, res) => send(res, trashNote(req.params.id)));

  route('get', '/api/tasks', (req, res) => send(res, listTasks(req.query)));
  route('post', '/api/tasks', (req, res) => send(res, createTask(bodyOf(req)), 201));
  route('get', '/api/tasks/:id', (req, res) => send(res, getTask(req.params.id)));
  route('patch', '/api/tasks/:id', (req, res) => send(res, updateTask(req.params.id, bodyOf(req))));
  route('post', '/api/tasks/:id/restore', (req, res) => send(res, restoreTask(req.params.id)));
  route('delete', '/api/tasks/:id/permanent', (req, res) => send(res, destroyTask(req.params.id)));
  route('delete', '/api/tasks/:id', (req, res) => send(res, trashTask(req.params.id)));

  route('post', '/api/daily-notes', (req, res) => {
    const body = bodyOf(req);
    if (!body.date) throw new HttpError(400, 'A daily note needs a date.');
    send(res, openDailyNote({ ...body, date: assertDate(body.date, 'Date') }));
  });

  route('get', '/api/calendar', (req, res) => send(res, calendarItems(calendarQuery(req.query))));
  route('get', '/api/graph', (req, res) => send(res, graphFor(req.query.workspaceId)));
  route('get', '/api/stats', (req, res) => send(res, statsFor(req.query.workspaceId)));
  route('get', '/api/search', (req, res) => send(res, globalSearch(req.query)));
  route('get', '/api/suggestions', (req, res) => send(res, suggestionsFor(req.query)));
  route('get', '/api/activity', (req, res) => send(res, listActivity(req.query.workspaceId, req.query.limit ? parseId(req.query.limit, 'Limit') : 20)));

  route('get', '/api/preferences', (_req, res) => send(res, getPreferences()));
  route('patch', '/api/preferences', (req, res) => send(res, updatePreferences(bodyOf(req))));

  route('get', '/api/export/json', (req, res) => send(res, exportJson(req.query.workspaceId)));
  route('get', '/api/export/markdown', (req, res) => send(res, exportMarkdown(req.query.workspaceId)));
  route('post', '/api/import/json', (req, res) => send(res, importJson(bodyOf(req))));
  route('post', '/api/import/markdown', (req, res) => send(res, importMarkdown(bodyOf(req)), 201));
}
