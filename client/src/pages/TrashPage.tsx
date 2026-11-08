import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useToast } from '../context/ToastContext'
import { useUi } from '../context/UiContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { formatWhen } from '../lib/dates'

export default function TrashPage() {
  const { workspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const ui = useUi()
  const notes = useQuery({ queryKey: ['notes', workspaceId, 'trash'], queryFn: () => api.notes({ workspaceId, trashed: true, archived: 'all' }) })
  const tasks = useQuery({ queryKey: ['tasks', workspaceId, 'trash'], queryFn: () => api.tasks({ workspaceId, trashed: true }) })

  return (
    <div className="page">
      <div className="section-head">
        <div>
          <p className="eyebrow">Clearing</p>
          <h1>Trash</h1>
        </div>
      </div>
      <section className="panel">
        <h2>Notes</h2>
        {(notes.data || []).map((note) => (
          <div className="spread" key={note.id}>
            <div>
              <strong>{note.title}</strong>
              <p className="muted">{note.deletedAt ? formatWhen(note.deletedAt) : ''}</p>
            </div>
            <div className="quick">
              <button className="btn btn-small" type="button" onClick={async () => { await api.restoreNote(note.id); await queryClient.invalidateQueries({ queryKey: ['notes'] }); notify('Note restored.', 'success') }}>Restore</button>
              <button className="btn btn-small btn-danger" type="button" onClick={async () => {
                if (!(await ui.confirm({ title: 'Delete permanently?', message: `“${note.title}” and its versions cannot be recovered.`, confirmLabel: 'Delete forever', danger: true }))) return
                await api.destroyNote(note.id)
                await queryClient.invalidateQueries({ queryKey: ['notes'] })
              }}>Delete</button>
            </div>
          </div>
        ))}
        {notes.data?.length === 0 && <p className="muted">No notes in the clearing.</p>}
      </section>
      <section className="panel">
        <h2>Tasks</h2>
        {(tasks.data || []).map((task) => (
          <div className="spread" key={task.id}>
            <strong>{task.title}</strong>
            <div className="quick">
              <button className="btn btn-small" type="button" onClick={async () => { await api.restoreTask(task.id); await queryClient.invalidateQueries({ queryKey: ['tasks'] }); notify('Task restored.', 'success') }}>Restore</button>
              <button className="btn btn-small btn-danger" type="button" onClick={async () => {
                if (!(await ui.confirm({ title: 'Delete permanently?', message: `“${task.title}” cannot be recovered.`, confirmLabel: 'Delete forever', danger: true }))) return
                await api.destroyTask(task.id)
                await queryClient.invalidateQueries({ queryKey: ['tasks'] })
              }}>Delete</button>
            </div>
          </div>
        ))}
        {tasks.data?.length === 0 && <p className="muted">No tasks in the clearing.</p>}
      </section>
    </div>
  )
}
