import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { NoteCard } from '../components/NoteCard'
import { useToast } from '../context/ToastContext'
import { useWorkspace } from '../context/WorkspaceContext'

export default function ArchivePage() {
  const { workspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const notes = useQuery({ queryKey: ['notes', workspaceId, 'archive'], queryFn: () => api.notes({ workspaceId, archived: true }) })

  return (
    <div className="page">
      <div className="section-head">
        <div>
          <p className="eyebrow">Memories room</p>
          <h1>Archive</h1>
        </div>
      </div>
      {notes.isLoading && <p>Opening the old room…</p>}
      {notes.isError && <p className="save-bad">The archive could not be opened.</p>}
      <div className="note-grid">
        {(notes.data || []).map((note) => (
          <div key={note.id}>
            <NoteCard note={note} />
            <button className="btn btn-small" type="button" onClick={async () => {
              await api.unarchiveNote(note.id)
              await queryClient.invalidateQueries({ queryKey: ['notes'] })
              notify('Returned to the library.', 'success')
            }}>Restore</button>
          </div>
        ))}
      </div>
      {notes.data?.length === 0 && <div className="empty card"><h2>The memories room is empty</h2><p>Archived notes wait here until you bring them back.</p></div>}
    </div>
  )
}
