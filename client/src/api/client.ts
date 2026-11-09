import type {
  SessionUser,
  Activity,
  BackupFile,
  CalendarData,
  Folder,
  GraphData,
  Note,
  NoteLink,
  NoteVersion,
  Notebook,
  Preferences,
  Profile,
  SearchResults,
  Stats,
  Suggestions,
  Tag,
  Task,
  Workspace,
} from './types'

export class ApiError extends Error {
  status: number
  code?: string
  current?: Note

  constructor(status: number, message: string, extra?: { code?: string; current?: Note }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = extra?.code
    this.current = extra?.current
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
  headers.set('x-notely-request', '1')
  let response: Response
  try {
    response = await fetch(path, { ...options, headers, credentials: 'include' })
  } catch {
    throw new ApiError(0, 'The woodland path is offline. Your draft is still on this device.')
  }
  const text = await response.text()
  let payload: { data?: T; error?: { message?: string; code?: string; current?: Note } } = {}
  if (text) {
    try {
      payload = JSON.parse(text) as typeof payload
    } catch {
      throw new ApiError(response.status, 'The server sent an unexpected response.')
    }
  }
  if (!response.ok) {
    throw new ApiError(response.status, payload.error?.message || 'Something went wrong.', payload.error)
  }
  return payload.data as T
}

function query(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const api = {
  session: () => request<{ user: SessionUser | null }>('/api/auth/session'),
  register: (body: { displayName: string; email: string; password: string; confirmPassword: string }) =>
    request<{ user: SessionUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string; remember?: boolean }) =>
    request<{ user: SessionUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  forgotPassword: (email: string) =>
    request<{ message: string; devResetPath?: string }>('/api/auth/forgot', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (body: { token: string; password: string; confirmPassword: string }) =>
    request<{ message: string }>('/api/auth/reset', { method: 'POST', body: JSON.stringify(body) }),
  changePassword: (body: { currentPassword: string; password: string; confirmPassword: string }) =>
    request<{ message: string }>('/api/auth/password', { method: 'POST', body: JSON.stringify(body) }),
  deleteAccount: (body: { password: string; confirm: string }) =>
    request<{ deleted: boolean }>('/api/auth/account', { method: 'DELETE', body: JSON.stringify(body) }),
  profile: () => request<Profile>('/api/profile'),
  updateProfile: (body: Partial<Pick<Profile, 'displayName' | 'tagline' | 'avatar'>>) =>
    request<Profile>('/api/profile', { method: 'PATCH', body: JSON.stringify(body) }),
  workspaces: () => request<Workspace[]>('/api/workspaces'),
  createWorkspace: (body: { name: string; description?: string }) =>
    request<Workspace>('/api/workspaces', { method: 'POST', body: JSON.stringify(body) }),
  updateWorkspace: (id: number, body: { name?: string; description?: string; isDefault?: boolean }) =>
    request<Workspace>(`/api/workspaces/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteWorkspace: (id: number) => request<{ id: number }>(`/api/workspaces/${id}`, { method: 'DELETE' }),
  folders: (workspaceId: number) => request<Folder[]>(`/api/folders${query({ workspaceId })}`),
  createFolder: (body: { workspaceId: number; name: string; parentId?: number | null }) =>
    request<Folder>('/api/folders', { method: 'POST', body: JSON.stringify(body) }),
  updateFolder: (id: number, body: { name?: string; parentId?: number | null }) =>
    request<Folder>(`/api/folders/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteFolder: (id: number) => request<{ id: number }>(`/api/folders/${id}`, { method: 'DELETE' }),
  notebooks: (workspaceId: number) => request<Notebook[]>(`/api/notebooks${query({ workspaceId })}`),
  notebook: (id: number) => request<Notebook>(`/api/notebooks/${id}`),
  createNotebook: (body: Partial<Notebook> & { name: string; workspaceId: number }) =>
    request<Notebook>('/api/notebooks', { method: 'POST', body: JSON.stringify(body) }),
  updateNotebook: (id: number, body: Partial<Notebook>) =>
    request<Notebook>(`/api/notebooks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteNotebook: (id: number) => request<{ id: number }>(`/api/notebooks/${id}`, { method: 'DELETE' }),
  tags: (workspaceId: number) => request<Tag[]>(`/api/tags${query({ workspaceId })}`),
  createTag: (body: { workspaceId: number; name: string; color?: string }) =>
    request<Tag>('/api/tags', { method: 'POST', body: JSON.stringify(body) }),
  updateTag: (id: number, body: { name?: string; color?: string }) =>
    request<Tag>(`/api/tags/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteTag: (id: number) => request<{ id: number }>(`/api/tags/${id}`, { method: 'DELETE' }),
  notes: (params: Record<string, string | number | boolean | null | undefined>) =>
    request<Note[]>(`/api/notes${query(params)}`),
  note: (id: number) => request<Note>(`/api/notes/${id}`),
  createNote: (body: Record<string, unknown>) => request<Note>('/api/notes', { method: 'POST', body: JSON.stringify(body) }),
  updateNote: (id: number, body: Record<string, unknown>) =>
    request<Note>(`/api/notes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  trashNote: (id: number) => request<{ id: number }>(`/api/notes/${id}`, { method: 'DELETE' }),
  restoreNote: (id: number) => request<Note>(`/api/notes/${id}/restore`, { method: 'POST' }),
  destroyNote: (id: number) => request<{ id: number }>(`/api/notes/${id}/permanent`, { method: 'DELETE' }),
  duplicateNote: (id: number) => request<Note>(`/api/notes/${id}/duplicate`, { method: 'POST' }),
  archiveNote: (id: number) => request<Note>(`/api/notes/${id}/archive`, { method: 'POST' }),
  unarchiveNote: (id: number) => request<Note>(`/api/notes/${id}/unarchive`, { method: 'POST' }),
  versions: (id: number) => request<NoteVersion[]>(`/api/notes/${id}/versions`),
  version: (id: number, versionId: number) => request<NoteVersion>(`/api/notes/${id}/versions/${versionId}`),
  restoreVersion: (id: number, versionId: number) =>
    request<Note>(`/api/notes/${id}/versions/${versionId}/restore`, { method: 'POST' }),
  links: (id: number) => request<{ outgoing: NoteLink[]; incoming: NoteLink[] }>(`/api/notes/${id}/links`),
  addLink: (id: number, targetId: number) =>
    request<{ outgoing: NoteLink[]; incoming: NoteLink[] }>(`/api/notes/${id}/links`, {
      method: 'POST',
      body: JSON.stringify({ targetId }),
    }),
  removeLink: (id: number, targetId: number) =>
    request<{ outgoing: NoteLink[]; incoming: NoteLink[] }>(`/api/notes/${id}/links/${targetId}`, { method: 'DELETE' }),
  tasks: (params: Record<string, string | number | boolean | null | undefined>) =>
    request<Task[]>(`/api/tasks${query(params)}`),
  createTask: (body: Record<string, unknown>) => request<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(body) }),
  updateTask: (id: number, body: Record<string, unknown>) =>
    request<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  trashTask: (id: number) => request<{ id: number }>(`/api/tasks/${id}`, { method: 'DELETE' }),
  restoreTask: (id: number) => request<Task>(`/api/tasks/${id}/restore`, { method: 'POST' }),
  destroyTask: (id: number) => request<{ id: number }>(`/api/tasks/${id}/permanent`, { method: 'DELETE' }),
  daily: (body: { workspaceId?: number; date: string }) =>
    request<Note>('/api/daily-notes', { method: 'POST', body: JSON.stringify(body) }),
  calendar: (workspaceId: number, from: string, to: string) =>
    request<CalendarData>(`/api/calendar${query({ workspaceId, from, to })}`),
  graph: (workspaceId: number) => request<GraphData>(`/api/graph${query({ workspaceId })}`),
  stats: (workspaceId: number) => request<Stats>(`/api/stats${query({ workspaceId })}`),
  search: (workspaceId: number, q: string) => request<SearchResults>(`/api/search${query({ workspaceId, q })}`),
  suggestions: (workspaceId: number, noteId?: number) =>
    request<Suggestions>(`/api/suggestions${query({ workspaceId, noteId })}`),
  activity: (workspaceId: number) => request<Activity[]>(`/api/activity${query({ workspaceId, limit: 20 })}`),
  preferences: (context?: { signal?: AbortSignal }) =>
    request<Preferences>('/api/preferences', { signal: context?.signal }),
  updatePreferences: (body: Partial<Preferences>) =>
    request<Preferences>('/api/preferences', { method: 'PATCH', body: JSON.stringify(body) }),
  exportJson: (workspaceId: number) => request<BackupFile>(`/api/export/json${query({ workspaceId })}`),
  exportMarkdown: (workspaceId: number) =>
    request<{ files: { filename: string; content: string }[] }>(`/api/export/markdown${query({ workspaceId })}`),
  noteMarkdown: (id: number) => request<{ filename: string; content: string; title: string }>(`/api/notes/${id}/markdown`),
  importJson: (body: { workspaceId?: number; payload: unknown; mode?: 'add' | 'replace'; confirm?: boolean }) =>
    request<{ notes: number; notebooks: number; tasks: number; dailySkipped: number; mode: string }>('/api/import/json', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  importMarkdown: (body: { workspaceId?: number; notebookId?: number | null; files: { filename: string; content: string }[] }) =>
    request<{ created: number; notes: { id: number; title: string }[]; duplicateTitles: string[] }>('/api/import/markdown', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}
