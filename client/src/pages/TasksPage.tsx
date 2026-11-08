import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Task } from '../api/types'
import { PageHead } from '../components/scenery'
import { TaskDialog } from '../components/shell'
import { useToast } from '../context/ToastContext'
import { useUi } from '../context/UiContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { formatMedium } from '../lib/dates'

const COLUMNS = [
  { status: 'pending', title: 'Pending' },
  { status: 'in_progress', title: 'In progress' },
  { status: 'completed', title: 'Completed' },
] as const

export default function TasksPage() {
  const { workspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const ui = useUi()
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [priority, setPriority] = useState('')
  const [due, setDue] = useState('')
  const [sort, setSort] = useState('due')
  const tasks = useQuery({
    queryKey: ['tasks', workspaceId, priority, due, sort],
    queryFn: () => api.tasks({ workspaceId, priority: priority || undefined, due: due || undefined, sort }),
  })

  const openedEdit = useRef(false)

  useEffect(() => {
    if (params.get('new') === '1') setOpen(true)
    const editId = Number(params.get('edit'))
    if (!editId || openedEdit.current || !tasks.data) return
    const match = tasks.data.find((task) => task.id === editId)
    if (!match) return
    openedEdit.current = true
    setEditing(match)
  }, [params, tasks.data])

  function close() {
    setOpen(false)
    setEditing(null)
    if (params.get('new') || params.get('edit')) {
      params.delete('new')
      params.delete('edit')
      setParams(params, { replace: true })
    }
  }

  async function move(id: number, status: Task['status']) {
    await api.updateTask(id, { status })
    await queryClient.invalidateQueries({ queryKey: ['tasks'] })
  }

  return (
    <div className="page page-quest">
      <PageHead eyebrow="Quest board" title="Tasks" scene="village" crop="bottom" actions={<button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>New task</button>} />
      <div className="filters">
        <select aria-label="Priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select aria-label="Due" value={due} onChange={(event) => setDue(event.target.value)}>
          <option value="">Any date</option>
          <option value="today">Due today</option>
          <option value="overdue">Overdue</option>
          <option value="upcoming">Upcoming</option>
          <option value="none">No date</option>
        </select>
        <select aria-label="Sort" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="due">Due date</option>
          <option value="priority">Priority</option>
          <option value="title">Title</option>
          <option value="created">Created</option>
        </select>
      </div>
      {tasks.isLoading && <p>Laying out the board…</p>}
      {tasks.isError && <p className="save-bad">The quest board could not be opened.</p>}
      <div className="quest-board">
        {COLUMNS.map((column) => (
          <section
            key={column.status}
            className="panel quest"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const id = Number(event.dataTransfer.getData('text/plain'))
              if (id) void move(id, column.status)
            }}
          >
            <h2>{column.title}</h2>
            {(tasks.data || []).filter((task) => task.status === column.status).map((task) => (
              <article
                key={task.id}
                className={`card task-card priority-${task.priority}`}
                draggable
                onDragStart={(event) => event.dataTransfer.setData('text/plain', String(task.id))}
              >
                <strong>{task.title}</strong>
                {task.description && <p className="muted">{task.description}</p>}
                <div className="note-meta">
                  <span className="chip">{task.priority}</span>
                  {task.dueDate && <span className="chip">{formatMedium(task.dueDate)}</span>}
                  {task.tags.map((tag) => <span key={tag.id} className="tag">{tag.name}</span>)}
                </div>
                {task.noteId && <Link to={`/app/notes/${task.noteId}`}>{task.noteTitle || 'Linked note'}</Link>}
                <div className="quick">
                  <button className="btn btn-small btn-ghost" type="button" onClick={() => setEditing(task)}>Edit</button>
                  <button className="btn btn-small btn-ghost" type="button" onClick={async () => {
                    if (!(await ui.confirm({ title: 'Clear this task?', message: 'It can be restored from the trash.', confirmLabel: 'Move to trash', danger: true }))) return
                    await api.trashTask(task.id)
                    await queryClient.invalidateQueries({ queryKey: ['tasks'] })
                    notify('Task moved to the clearing.', 'success')
                  }}>Trash</button>
                </div>
              </article>
            ))}
            {(tasks.data || []).filter((task) => task.status === column.status).length === 0 && <p className="muted">Nothing here.</p>}
          </section>
        ))}
      </div>
      {(open || editing) && (
        <TaskDialog
          initial={editing ? { id: editing.id, title: editing.title, description: editing.description, status: editing.status, priority: editing.priority, dueDate: editing.dueDate, noteId: editing.noteId } : undefined}
          onClose={close}
          onSaved={() => { close(); notify('Task saved.', 'success') }}
        />
      )}
    </div>
  )
}
