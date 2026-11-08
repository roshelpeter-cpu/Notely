import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useWorkspace } from '../context/WorkspaceContext'
import { addDays, formatLong, localDate, monthGrid, monthLabel, weekDays } from '../lib/dates'

type View = 'month' | 'week' | 'day'

export default function CalendarPage() {
  const { workspaceId, preferences } = useWorkspace()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const today = localDate()
  const [params] = useSearchParams()
  const requested = params.get('date')
  const start = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today
  const [anchor, setAnchor] = useState(start)
  const [view, setView] = useState<View>('month')
  const [selected, setSelected] = useState(start)
  const [year, month] = anchor.split('-').map(Number)

  function shift(direction: number) {
    if (view === 'month') {
      const next = new Date(year, month - 1 + direction, 1)
      const date = localDate(next)
      setAnchor(date)
      setSelected(date)
      return
    }
    const date = addDays(view === 'week' ? anchor : selected, direction * (view === 'week' ? 7 : 1))
    setAnchor(date)
    setSelected(date)
  }
  const range = useMemo(() => {
    if (view === 'day') return { from: selected, to: selected }
    if (view === 'week') {
      const days = weekDays(anchor)
      return { from: days[0], to: days[6] }
    }
    const cells = monthGrid(year, month - 1)
    return { from: cells[0].date, to: cells[41].date }
  }, [anchor, month, selected, view, year])
  const calendar = useQuery({
    queryKey: ['calendar', workspaceId, range.from, range.to],
    queryFn: () => api.calendar(workspaceId, range.from, range.to),
  })

  const notesOn = (date: string) => (calendar.data?.notes || []).filter((note) => (note.dailyDate || note.createdOn) === date)
  const tasksOn = (date: string) => (calendar.data?.tasks || []).filter((task) => task.dueDate === date)

  async function daily(date: string) {
    const note = await api.daily({ workspaceId, date })
    await queryClient.invalidateQueries({ queryKey: ['calendar'] })
    navigate(`/app/notes/${note.id}`)
  }

  async function task(date: string) {
    const created = await api.createTask({
      workspaceId,
      title: 'New task',
      dueDate: date,
      status: 'pending',
      priority: 'medium',
    })
    await queryClient.invalidateQueries({ queryKey: ['tasks'] })
    await queryClient.invalidateQueries({ queryKey: ['calendar'] })
    navigate(`/app/tasks?edit=${created.id}`)
  }

  const days = view === 'week' ? weekDays(anchor) : view === 'day' ? [selected] : []
  const cells = monthGrid(year, month - 1)

  return (
    <div className="page">
      <div className="section-head">
        <div>
          <p className="eyebrow">Almanac</p>
          <h1>{view === 'month' ? monthLabel(year, month - 1) : formatLong(view === 'day' ? selected : anchor)}</h1>
        </div>
        <div className="quick">
          <button className="btn btn-small btn-ghost" type="button" onClick={() => shift(-1)}>Previous</button>
          <button className="btn btn-small btn-ghost" type="button" onClick={() => { setAnchor(today); setSelected(today) }}>Today</button>
          <button className="btn btn-small btn-ghost" type="button" onClick={() => shift(1)}>Next</button>
          {(['month', 'week', 'day'] as View[]).map((item) => (
            <button key={item} className={`btn btn-small ${view === item ? 'btn-primary' : 'btn-ghost'}`} type="button" onClick={() => setView(item)}>{item}</button>
          ))}
        </div>
      </div>
      <div className="cal-layout">
        <section className="panel">
          {view === 'month' && (
            <div className="cal-grid">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => <strong key={label}>{label}</strong>)}
              {cells.map((cell) => (
                <button
                  key={cell.date}
                  type="button"
                  className={`cal-cell ${cell.inMonth ? '' : 'is-out'} ${cell.date === today ? 'is-today' : ''} ${cell.date === selected ? 'is-selected' : ''}`}
                  onClick={() => setSelected(cell.date)}
                >
                  <span>{Number(cell.date.slice(8))}</span>
                  <ul>
                    {notesOn(cell.date).slice(0, 2).map((note) => <li key={note.id}>{note.isDaily ? 'Daily' : note.title}</li>)}
                    {tasksOn(cell.date).slice(0, 2).map((task) => <li key={task.id}>{task.title}</li>)}
                  </ul>
                </button>
              ))}
            </div>
          )}
          {view !== 'month' && (
            <div className="stack">
              {days.map((date) => (
                <article key={date} className={`card ${date === today ? 'is-today' : ''}`}>
                  <h2>{formatLong(date)}</h2>
                  {notesOn(date).map((note) => <p key={note.id}><Link to={`/app/notes/${note.id}`}>{note.title}</Link></p>)}
                  {tasksOn(date).map((task) => <p key={task.id}>{task.title} · {task.status}</p>)}
                  {notesOn(date).length + tasksOn(date).length === 0 && <p className="muted">A quiet day.</p>}
                </article>
              ))}
            </div>
          )}
        </section>
        <aside className="panel">
          <h2>{formatLong(selected)}</h2>
          <div className="quick">
            <button className="btn btn-small btn-primary" type="button" onClick={() => void daily(selected)}>Daily note</button>
            <button className="btn btn-small btn-soft" type="button" onClick={async () => {
              const note = await api.createNote({ workspaceId, title: `Note for ${selected}`, notebookId: preferences?.defaultNotebookId || null })
              navigate(`/app/notes/${note.id}`)
            }}>New note</button>
            <button className="btn btn-small btn-soft" type="button" onClick={() => void task(selected)}>New task</button>
          </div>
          <h3>Notes</h3>
          <ul>{notesOn(selected).map((note) => <li key={note.id}><Link to={`/app/notes/${note.id}`}>{note.title}</Link></li>)}</ul>
          <h3>Tasks</h3>
          <ul>{tasksOn(selected).map((task) => <li key={task.id}>{task.title}</li>)}</ul>
          {notesOn(selected).length + tasksOn(selected).length === 0 && <p className="muted">Nothing is marked on this date.</p>}
        </aside>
      </div>
    </div>
  )
}
