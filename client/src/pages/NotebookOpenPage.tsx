import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { NoteCard } from '../components/NoteCard'
import { NotebookDialog } from '../components/shell'
import { NotebookCover } from '../components/world'
import { useToast } from '../context/ToastContext'
import { useUi } from '../context/UiContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { toneClass } from '../lib/options'

export default function NotebookOpenPage() {
  const params = useParams()
  const notebookId = Number(params.id)
  const navigate = useNavigate()
  const { workspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const ui = useUi()
  const [editing, setEditing] = useState(false)
  const notebook = useQuery({
    queryKey: ['notebook', notebookId],
    queryFn: () => api.notebook(notebookId),
    enabled: notebookId > 0,
  })
  const notes = useQuery({
    queryKey: ['notes', workspaceId, 'book', notebookId],
    queryFn: () => api.notes({ workspaceId, notebookId }),
    enabled: notebookId > 0,
  })

  if (notebook.isLoading) return <p className="page">Opening the book…</p>
  if (!notebook.data) return <p className="page">That notebook is not on this shelf.</p>
  const book = notebook.data

  return (
    <div className="page page-books">
      <div className="book-open">
        <div className="book-stage" aria-hidden="true">
          <div className={`book-cover book-cover-open ${toneClass(book.color)}`}><NotebookCover cover={book.cover} /></div>
        </div>
        <div>
          <p className="eyebrow"><Link to="/app/library?view=notebooks">Library</Link></p>
          <h1>{book.name}</h1>
          <p>{book.description || 'A quiet volume.'}</p>
          <p className="muted">{book.noteCount} notes</p>
          <div className="quick">
            <button className="btn btn-primary" type="button" onClick={async () => {
              const note = await api.createNote({ workspaceId, notebookId: book.id, title: 'Untitled note' })
              navigate(`/app/notes/${note.id}`)
            }}>New note</button>
            <button className="btn btn-ghost" type="button" onClick={() => setEditing(true)}>Edit</button>
            <button className="btn btn-ghost" type="button" onClick={async () => {
            if (!(await ui.confirm({ title: 'Release this notebook?', message: 'Notes stay in the library without a cover.', confirmLabel: 'Delete notebook', danger: true }))) return
            await api.deleteNotebook(book.id)
            await queryClient.invalidateQueries({ queryKey: ['notebooks'] })
            notify('Notebook removed. Its notes remain.', 'success')
            navigate('/app/library?view=notebooks')
          }}>Delete</button>
          </div>
        </div>
      </div>
      <div className="note-grid">
        {(notes.data || []).map((note) => <NoteCard key={note.id} note={note} />)}
      </div>
      {notes.data && notes.data.length === 0 && <p className="muted">This book is waiting for its first page.</p>}
      {editing && (
        <NotebookDialog
          initial={{ id: book.id, name: book.name, description: book.description, color: book.color, cover: book.cover, folderId: book.folderId }}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); void queryClient.invalidateQueries({ queryKey: ['notebook', notebookId] }); notify('Notebook saved.', 'success') }}
        />
      )}
    </div>
  )
}
