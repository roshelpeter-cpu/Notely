import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BookMarked, CalendarDays, Feather, ListChecks, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { NoteCard } from '../components/NoteCard'
import { NotebookCover, WoodlandScene } from '../components/world'
import { useToast } from '../context/ToastContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { formatLong, localDate, monthGrid, monthLabel } from '../lib/dates'
import { greetingFor, welcomeLine } from '../lib/greeting'
import { toneClass } from '../lib/options'

export default function HomePage() {
  const { workspaceId, profile, preferences } = useWorkspace()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const today = localDate()
  const sections = preferences?.dashboard
  const notes = useQuery({ queryKey: ['notes', workspaceId, 'recent'], queryFn: () => api.notes({ workspaceId, limit: 6, sort: 'updated' }) })
  const notebooks = useQuery({ queryKey: ['notebooks', workspaceId], queryFn: () => api.notebooks(workspaceId) })
  const tasks = useQuery({ queryKey: ['tasks', workspaceId, today], queryFn: () => api.tasks({ workspaceId, dueOn: today }) })
  const stats = useQuery({ queryKey: ['stats', workspaceId], queryFn: () => api.stats(workspaceId) })
  const activity = useQuery({ queryKey: ['activity', workspaceId], queryFn: () => api.activity(workspaceId) })
  const graph = useQuery({ queryKey: ['graph', workspaceId], queryFn: () => api.graph(workspaceId) })
  const now = new Date()
  const cells = monthGrid(now.getFullYear(), now.getMonth())

  async function create(kind: 'note' | 'notebook' | 'task' | 'daily') {
    if (kind === 'note') {
      const note = await api.createNote({ workspaceId, title: 'Untitled note', notebookId: preferences?.defaultNotebookId || null })
      navigate(`/app/notes/${note.id}`)
    } else if (kind === 'daily') {
      const note = await api.daily({ workspaceId, date: today })
      navigate(`/app/notes/${note.id}`)
    } else if (kind === 'notebook') navigate('/app/notebooks?new=1')
    else navigate('/app/tasks?new=1')
    await queryClient.invalidateQueries()
  }

  async function toggleTask(id: number, done: boolean) {
    await api.updateTask(id, { status: done ? 'pending' : 'completed' })
    await queryClient.invalidateQueries({ queryKey: ['tasks'] })
    notify(done ? 'Task returned to the board.' : 'Task completed.', 'success')
  }

  const show = (key: keyof NonNullable<typeof sections>) => sections?.[key] !== false

  return (
    <div className="page">
      <section className="hero card">
        <div>
          <p className="eyebrow">{formatLong(today)}</p>
          <h1>{greetingFor(now)}, {profile?.displayName || 'friend'}.</h1>
          <p>{welcomeLine(now)}</p>
        </div>
        <WoodlandScene />
      </section>
      <div className="quick">
        <button className="btn btn-primary" type="button" onClick={() => void create('note')}><Plus size={16} /> New note</button>
        <button className="btn btn-soft" type="button" onClick={() => void create('notebook')}><BookMarked size={16} /> New notebook</button>
        <button className="btn btn-soft" type="button" onClick={() => void create('task')}><ListChecks size={16} /> New task</button>
        <button className="btn btn-soft" type="button" onClick={() => void create('daily')}><Feather size={16} /> Daily note</button>
        <Link className="btn btn-ghost" to="/app/settings">Import</Link>
      </div>
      <section className="grid-4">
        <article className="card stat"><span>Notes</span><strong>{stats.data?.totals.notes ?? '—'}</strong></article>
        <article className="card stat"><span>Notebooks</span><strong>{stats.data?.totals.notebooks ?? '—'}</strong></article>
        <article className="card stat"><span>Open tasks</span><strong>{stats.data?.totals.openTasks ?? '—'}</strong></article>
        <article className="card stat"><span>Writing streak</span><strong>{stats.data?.streak.current ?? '—'}</strong><small className="muted">days with notes or completed tasks</small></article>
      </section>
      <div className="grid-2" style={{ marginTop: 16 }}>
        <div>
          {show('focus') && (
            <section className="panel">
              <div className="section-head"><h2>Today’s focus</h2><Link to="/app/tasks">Quest board</Link></div>
              {(tasks.data || []).length === 0 && <p className="muted">Nothing is due today. The path is clear.</p>}
              <ul className="activity-list">
                {(tasks.data || []).map((task) => (
                  <li key={task.id}>
                    <label className="checkline">
                      <input type="checkbox" checked={task.status === 'completed'} onChange={() => void toggleTask(task.id, task.status === 'completed')} />
                      <span>{task.title}</span>
                    </label>
                    {task.noteId && <Link to={`/app/notes/${task.noteId}`}>Open note</Link>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {show('recent') && (
            <section className="panel">
              <div className="section-head"><h2>Recent notes</h2><Link to="/app/notes">Library</Link></div>
              <div className="note-grid">
                {(notes.data || []).map((note) => <NoteCard key={note.id} note={note} />)}
              </div>
              {notes.data?.length === 0 && <p className="muted">Your first note is still unwritten.</p>}
            </section>
          )}
          {show('notebooks') && (
            <section className="panel">
              <div className="section-head"><h2>Notebooks</h2><Link to="/app/notebooks">All books</Link></div>
              <div className="book-grid">
                {(notebooks.data || []).slice(0, 4).map((notebook) => (
                  <Link className="book" key={notebook.id} to={`/app/notes?notebook=${notebook.id}`}>
                    <div className={`book-cover ${toneClass(notebook.color)}`}><NotebookCover cover={notebook.cover} /></div>
                    <strong>{notebook.name}</strong>
                    <small className="muted">{notebook.noteCount} notes</small>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
        <div>
          {show('calendar') && (
            <section className="panel">
              <div className="section-head"><h2>{monthLabel(now.getFullYear(), now.getMonth())}</h2><Link to="/app/calendar"><CalendarDays size={16} /></Link></div>
              <div className="cal-grid">
                {cells.filter((cell) => cell.inMonth).slice(0, 14).map((cell) => (
                  <Link key={cell.date} className={`cal-cell ${cell.date === today ? 'is-today' : ''}`} to={`/app/calendar?date=${cell.date}`}>{cell.date.slice(-2)}</Link>
                ))}
              </div>
            </section>
          )}
          {show('map') && (
            <section className="panel">
              <div className="section-head"><h2>Knowledge map</h2><Link to="/app/map">Open map</Link></div>
              <ul className="activity-list">
                {(graph.data?.edges || []).slice(0, 4).map((edge) => {
                  const source = graph.data?.nodes.find((node) => node.id === edge.source)
                  const target = graph.data?.nodes.find((node) => node.id === edge.target)
                  return <li key={`${edge.source}-${edge.target}`}><span>{source?.title} → {target?.title}</span></li>
                })}
              </ul>
              {graph.data?.edges.length === 0 && <p className="muted">Link two notes and a path will appear here.</p>}
            </section>
          )}
          {show('activity') && (
            <section className="panel">
              <h2>Recent activity</h2>
              <ul className="activity-list">
                {(activity.data || []).slice(0, 6).map((item) => <li key={item.id}><span>{item.summary}</span></li>)}
              </ul>
            </section>
          )}
          {show('writing') && (
            <section className="panel">
              <h2>Writing</h2>
              <p><strong>{stats.data?.totals.words ?? 0}</strong> words kept in this workspace.</p>
              <p className="muted">{stats.data?.streak.activeDays ?? 0} active days · longest streak {stats.data?.streak.longest ?? 0}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
