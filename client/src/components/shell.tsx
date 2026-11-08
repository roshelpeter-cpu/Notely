import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  Bell,
  BookMarked,
  CalendarDays,
  ChartColumn,
  ChevronLeft,
  Home,
  Library,
  ListChecks,
  Menu,
  Moon,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Sun,
  Trash2,
  Waypoints,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useTheme } from '../context/ThemeContext'
import { useToast } from '../context/ToastContext'
import { useUi } from '../context/UiContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { formatWhen } from '../lib/dates'
import { COVERS, NOTEBOOK_COLORS, toneClass } from '../lib/options'
import { SHORTCUTS } from '../lib/shortcuts'
import { NotebookCover, QuillMark, SidebarVine } from './world'

const NAV = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/notes', label: 'Notes', icon: Library, end: false },
  { to: '/app/notebooks', label: 'Notebooks', icon: BookMarked, end: false },
  { to: '/app/tasks', label: 'Tasks', icon: ListChecks, end: false },
  { to: '/app/calendar', label: 'Calendar', icon: CalendarDays, end: false },
  { to: '/app/map', label: 'Knowledge Map', icon: Waypoints, end: false },
  { to: '/app/insights', label: 'Insights', icon: ChartColumn, end: false },
  { to: '/app/archive', label: 'Archive', icon: Archive, end: false },
  { to: '/app/trash', label: 'Trash', icon: Trash2, end: false },
]

export function AppShell() {
  const ui = useUi()
  const theme = useTheme()
  const { notify } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { workspaceId, workspaces, profile, preferences, setWorkspaceId } = useWorkspace()
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [bell, setBell] = useState(false)
  const [notebookOpen, setNotebookOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const search = useQuery({
    queryKey: ['search', workspaceId, query],
    queryFn: () => api.search(workspaceId, query),
    enabled: query.trim().length > 1,
  })
  const activity = useQuery({ queryKey: ['activity', workspaceId], queryFn: () => api.activity(workspaceId) })
  const seen = Number(localStorage.getItem('notely-seen') || 0)
  const unread = (activity.data || []).filter((item) => item.id > seen).length

  function persistTheme(next: 'day' | 'night') {
    theme.setSetting(next)
    void api.updatePreferences({ theme: next }).then((prefs) => queryClient.setQueryData(['preferences'], prefs))
  }

  async function createNote() {
    const note = await api.createNote({
      workspaceId,
      title: 'Untitled note',
      notebookId: preferences?.defaultNotebookId || null,
    })
    await queryClient.invalidateQueries({ queryKey: ['notes'] })
    navigate(`/app/notes/${note.id}`)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.ctrlKey || event.metaKey
      if (!meta) return
      const key = event.key.toLowerCase()
      if (key === 'k') {
        event.preventDefault()
        ui.setPalette(true)
      } else if (key === 'n' && !event.shiftKey) {
        event.preventDefault()
        void createNote()
      } else if (key === 'n' && event.shiftKey) {
        event.preventDefault()
        setNotebookOpen(true)
      } else if (key === 't' && event.shiftKey) {
        event.preventDefault()
        setTaskOpen(true)
      } else if (key === '\\') {
        event.preventDefault()
        ui.setCollapsed(!ui.collapsed)
      } else if (key === 'f' && event.shiftKey) {
        event.preventDefault()
        ui.setFocus(!ui.focus)
      } else if (key === 'l' && event.shiftKey) {
        event.preventDefault()
        persistTheme(theme.theme === 'day' ? 'night' : 'day')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const actions = useMemo(
    () => [
      { label: 'Create a note', run: () => void createNote() },
      { label: 'Create a notebook', run: () => setNotebookOpen(true) },
      { label: 'Create a task', run: () => setTaskOpen(true) },
      { label: 'Open home', run: () => navigate('/app') },
      { label: 'Open calendar', run: () => navigate('/app/calendar') },
      { label: 'Open knowledge map', run: () => navigate('/app/map') },
      { label: 'Open settings', run: () => navigate('/app/settings') },
      { label: 'Enter focus mode', run: () => ui.setFocus(true) },
      {
        label: theme.theme === 'day' ? 'Switch to night' : 'Switch to day',
        run: () => persistTheme(theme.theme === 'day' ? 'night' : 'day'),
      },
    ],
    [navigate, theme, ui],
  )

  return (
    <div className={`shell ${ui.collapsed ? 'is-collapsed' : ''} ${ui.focus ? 'is-focus' : ''}`}>
      <a className="skip" href="#content">Skip to content</a>
      {ui.drawer && <div className="drawer-backdrop" onClick={() => ui.setDrawer(false)} />}
      <aside className={`sidebar ${ui.drawer ? 'is-open' : ''}`}>
        <SidebarVine />
        <NavLink to="/app" className="brand" onClick={() => ui.setDrawer(false)}>
          <QuillMark />
          <div>
            <strong>Notely</strong>
            <span>A space for your thoughts</span>
          </div>
        </NavLink>
        <label className="field">
          <span className="sr-only">Workspace</span>
          <select
            className="workspace-switch"
            aria-label="Workspace"
            value={workspaceId}
            onChange={(event) => setWorkspaceId(Number(event.target.value))}
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </label>
        <nav className="nav-list" aria-label="Primary">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}
              onClick={() => ui.setDrawer(false)}
            >
              <item.icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="sidebar-cat" aria-hidden="true">
            <img className="art-day" src="/art/cat-day.jpg" alt="" />
            <img className="art-night" src="/art/cat-night.jpg" alt="" />
          </div>
          <div className="side-tools">
            <button className="icon-btn" type="button" aria-label={theme.theme === 'day' ? 'Switch to night' : 'Switch to day'} onClick={() => persistTheme(theme.theme === 'day' ? 'night' : 'day')}>
              {theme.theme === 'day' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <NavLink className="icon-btn" to="/app/settings" aria-label="Settings">
              <Settings size={16} />
            </NavLink>
          </div>
          <div className="profile-chip">
            <div className="avatar" aria-hidden="true">{(profile?.displayName || 'N').slice(0, 1)}</div>
            <div>
              <strong>{profile?.displayName}</strong>
              <small>{profile?.tagline}</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" type="button" aria-label="Open navigation" onClick={() => ui.setDrawer(true)}>
            <Menu size={18} />
          </button>
          <button className="icon-btn hide-sm" type="button" aria-label="Collapse sidebar" onClick={() => ui.setCollapsed(!ui.collapsed)}>
            <PanelLeft size={18} />
          </button>
          <form className="search" role="search" onSubmit={(event) => { event.preventDefault(); navigate(`/app/notes?q=${encodeURIComponent(query)}`); setSearchOpen(false) }}>
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="Search notes, notebooks, tags, and tasks"
              placeholder="Search the library"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setSearchOpen(true) }}
              onFocus={() => setSearchOpen(true)}
            />
            {searchOpen && query.trim().length > 1 && (
              <div className="search-pop">
                <ResultGroup title="Notes" items={search.data?.notes.map((note) => ({ to: `/app/notes/${note.id}`, label: note.title, detail: note.excerpt }))} />
                <ResultGroup title="Notebooks" items={search.data?.notebooks.map((notebook) => ({ to: `/app/notes?notebook=${notebook.id}`, label: notebook.name, detail: notebook.description }))} />
                <ResultGroup title="Tags" items={search.data?.tags.map((tag) => ({ to: `/app/notes?tag=${tag.id}`, label: tag.name }))} />
                <ResultGroup title="Tasks" items={search.data?.tasks.map((task) => ({ to: '/app/tasks', label: task.title, detail: task.status }))} />
                {search.isFetching && <p className="muted">Searching the shelves…</p>}
                {search.isSuccess && !search.data?.notes.length && !search.data?.notebooks.length && !search.data?.tags.length && !search.data?.tasks.length && <p className="muted">Nothing matches yet.</p>}
              </div>
            )}
          </form>
          <div className="top-actions">
            <button className="btn btn-primary btn-small" type="button" onClick={() => void createNote()}>
              <Plus size={16} /> New note
            </button>
            <button className="icon-btn" type="button" aria-label="Notifications" onClick={() => { setBell((value) => !value); localStorage.setItem('notely-seen', String(activity.data?.[0]?.id || seen)) }}>
              <Bell size={16} />
              {unread > 0 && <span className="sr-only">{unread} new</span>}
            </button>
          </div>
          {bell && (
            <div className="search-pop" style={{ right: 16, left: 'auto', width: 320, top: 64 }}>
              <strong>Recent activity</strong>
              <ul className="activity-list">
                {(activity.data || []).slice(0, 8).map((item) => (
                  <li key={item.id}><span>{item.summary}</span><small>{formatWhen(item.createdAt)}</small></li>
                ))}
              </ul>
            </div>
          )}
        </header>
        <main id="content" className="content">
          <Outlet />
        </main>
        <nav className="mobile-nav" aria-label="Mobile">
          <NavLink to="/app" end><Home size={18} />Home</NavLink>
          <NavLink to="/app/notes"><Library size={18} />Notes</NavLink>
          <NavLink to="/app/tasks"><ListChecks size={18} />Tasks</NavLink>
          <NavLink to="/app/calendar"><CalendarDays size={18} />Days</NavLink>
          <button type="button" onClick={() => ui.setDrawer(true)}><Menu size={18} />More</button>
        </nav>
      </div>
      {ui.palette && (
        <div className="modal-backdrop" onMouseDown={() => ui.setPalette(false)}>
          <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(event) => event.stopPropagation()}>
            <input autoFocus placeholder="Type a command or search" value={query} onChange={(event) => setQuery(event.target.value)} />
            <div className="palette-list">
              {actions.filter((action) => action.label.toLowerCase().includes(query.toLowerCase())).map((action) => (
                <button key={action.label} type="button" onClick={() => { action.run(); ui.setPalette(false) }}>{action.label}</button>
              ))}
              {(search.data?.notes || []).map((note) => (
                <button key={note.id} type="button" onClick={() => { navigate(`/app/notes/${note.id}`); ui.setPalette(false) }}>Open “{note.title}”</button>
              ))}
            </div>
            <p className="muted">{SHORTCUTS.map((item) => item.keys).slice(0, 4).join(' · ')}</p>
          </div>
        </div>
      )}
      {notebookOpen && <NotebookDialog onClose={() => setNotebookOpen(false)} onSaved={() => { setNotebookOpen(false); notify('Notebook bound.', 'success') }} />}
      {taskOpen && <TaskDialog onClose={() => setTaskOpen(false)} onSaved={() => { setTaskOpen(false); notify('Task added.', 'success') }} />}
    </div>
  )
}

function ResultGroup({ title, items }: { title: string; items?: { to: string; label: string; detail?: string }[] }) {
  if (!items?.length) return null
  return (
    <div>
      <p className="eyebrow">{title}</p>
      {items.slice(0, 5).map((item) => (
        <NavLink key={item.to + item.label} to={item.to}>
          <strong>{item.label}</strong>
          {item.detail && <small className="muted"> {item.detail}</small>}
        </NavLink>
      ))}
    </div>
  )
}

export function NotebookDialog({ onClose, onSaved, initial }: { onClose: () => void; onSaved: () => void; initial?: { id: number; name: string; description: string; color: string; cover: string; folderId: number | null } }) {
  const { workspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const folders = useQuery({ queryKey: ['folders', workspaceId], queryFn: () => api.folders(workspaceId) })
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [color, setColor] = useState(initial?.color || 'sage')
  const [cover, setCover] = useState(initial?.cover || 'floral')
  const [folderId, setFolderId] = useState<number | ''>(initial?.folderId || '')
  const [error, setError] = useState('')

  async function save() {
    try {
      const body = { workspaceId, name, description, color, cover, folderId: folderId || null }
      if (initial) await api.updateNotebook(initial.id, body)
      else await api.createNotebook(body)
      await queryClient.invalidateQueries({ queryKey: ['notebooks'] })
      onSaved()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the notebook.')
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="notebook-title" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="notebook-title">{initial ? 'Rename notebook' : 'New notebook'}</h2>
        <label className="field"><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="field"><span>Description</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <label className="field"><span>Folder</span>
          <select value={folderId} onChange={(event) => setFolderId(event.target.value ? Number(event.target.value) : '')}>
            <option value="">No folder</option>
            {(folders.data || []).map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
          </select>
        </label>
        <p>Colour</p>
        <div className="swatches">
          {NOTEBOOK_COLORS.map((item) => <button key={item} type="button" className={`swatch ${toneClass(item)}`} style={{ background: 'var(--tone)' }} aria-label={item} onClick={() => setColor(item)} />)}
        </div>
        <p>Cover</p>
        <div className="book-grid">
          {COVERS.map((item) => (
            <button key={item} className="book" type="button" onClick={() => setCover(item)}>
              <div className={`book-cover ${toneClass(color)}`}><NotebookCover cover={item} /></div>
              <strong>{item}</strong>
            </button>
          ))}
        </div>
        {error && <p className="save-bad">{error}</p>}
        <div className="modal-actions">
          <button className="btn btn-ghost" type="button" onClick={onClose}><ChevronLeft size={16} /> Close</button>
          <button className="btn btn-primary" type="button" onClick={() => void save()}>Save notebook</button>
        </div>
      </div>
    </div>
  )
}

export function TaskDialog({ onClose, onSaved, initial }: { onClose: () => void; onSaved: () => void; initial?: { id: number; title: string; description: string; status: string; priority: string; dueDate: string | null; noteId: number | null } }) {
  const { workspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const notes = useQuery({ queryKey: ['notes', workspaceId, 'picker'], queryFn: () => api.notes({ workspaceId, limit: 100 }) })
  const [title, setTitle] = useState(initial?.title || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [status, setStatus] = useState(initial?.status || 'pending')
  const [priority, setPriority] = useState(initial?.priority || 'medium')
  const [dueDate, setDueDate] = useState(initial?.dueDate || '')
  const [noteId, setNoteId] = useState<number | ''>(initial?.noteId || '')
  const [error, setError] = useState('')

  async function save() {
    try {
      const body = { workspaceId, title, description, status, priority, dueDate: dueDate || null, noteId: noteId || null }
      if (initial) await api.updateTask(initial.id, body)
      else await api.createTask(body)
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
      onSaved()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the task.')
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="task-title" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="task-title">{initial ? 'Edit task' : 'New task'}</h2>
        <label className="field"><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="field"><span>Description</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <div className="grid-3">
          <label className="field"><span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label className="field"><span>Priority</span>
            <select value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="field"><span>Due</span><input type="date" value={dueDate || ''} onChange={(event) => setDueDate(event.target.value)} /></label>
        </div>
        <label className="field"><span>Linked note</span>
          <select value={noteId} onChange={(event) => setNoteId(event.target.value ? Number(event.target.value) : '')}>
            <option value="">None</option>
            {(notes.data || []).map((note) => <option key={note.id} value={note.id}>{note.title}</option>)}
          </select>
        </label>
        {error && <p className="save-bad">{error}</p>}
        <div className="modal-actions">
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" type="button" onClick={() => void save()}>Save task</button>
        </div>
      </div>
    </div>
  )
}
