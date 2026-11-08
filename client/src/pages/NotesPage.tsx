import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { NoteCard } from '../components/NoteCard'
import { useToast } from '../context/ToastContext'
import { useUi } from '../context/UiContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { NOTE_COLORS } from '../lib/options'

export default function NotesPage() {
  const { workspaceId, preferences } = useWorkspace()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const ui = useUi()
  const [view, setView] = useState(preferences?.noteView || 'card')
  const filters = useMemo(() => ({
    workspaceId,
    q: params.get('q') || undefined,
    notebookId: params.get('notebook') || undefined,
    tagId: params.get('tag') || undefined,
    color: params.get('color') || undefined,
    pinned: params.get('pinned') || undefined,
    favourite: params.get('favourite') || undefined,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
    sort: params.get('sort') || preferences?.noteSort || 'updated',
    order: params.get('order') || 'desc',
  }), [params, preferences?.noteSort, workspaceId])
  const notes = useQuery({ queryKey: ['notes', workspaceId, filters], queryFn: () => api.notes(filters) })
  const notebooks = useQuery({ queryKey: ['notebooks', workspaceId], queryFn: () => api.notebooks(workspaceId) })
  const tags = useQuery({ queryKey: ['tags', workspaceId], queryFn: () => api.tags(workspaceId) })

  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }

  async function patch(id: number, body: Record<string, unknown>, message: string) {
    await api.updateNote(id, body)
    await queryClient.invalidateQueries({ queryKey: ['notes'] })
    notify(message, 'success')
  }

  const pinned = (notes.data || []).filter((note) => note.isPinned)
  const rest = (notes.data || []).filter((note) => !note.isPinned)

  function actions(note: (typeof rest)[number]) {
    return (
      <div className="quick">
        <button className="btn btn-small btn-ghost" type="button" onClick={() => void patch(note.id, { isArchived: true }, 'Moved to the archive.')}>Archive</button>
        <button className="btn btn-small btn-ghost" type="button" onClick={async () => { const copy = await api.duplicateNote(note.id); notify(`Copied as “${copy.title}”.`, 'success'); await queryClient.invalidateQueries({ queryKey: ['notes'] }) }}>Duplicate</button>
        <button className="btn btn-small btn-ghost" type="button" onClick={async () => { if (await ui.confirm({ title: 'Move to trash?', message: `“${note.title}” can be restored from the clearing.`, confirmLabel: 'Move to trash', danger: true })) { await api.trashNote(note.id); await queryClient.invalidateQueries({ queryKey: ['notes'] }); notify('Moved to the clearing.', 'success') } }}>Trash</button>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="section-head">
        <div>
          <p className="eyebrow">Library</p>
          <h1>Notes</h1>
        </div>
        <button className="btn btn-primary" type="button" onClick={async () => {
          const note = await api.createNote({ workspaceId, title: 'Untitled note', notebookId: preferences?.defaultNotebookId || null })
          navigate(`/app/notes/${note.id}`)
        }}>New note</button>
      </div>
      <div className="filters">
        <input aria-label="Search notes" placeholder="Title or sentence" defaultValue={params.get('q') || ''} onChange={(event) => update('q', event.target.value)} />
        <select aria-label="Notebook" value={params.get('notebook') || ''} onChange={(event) => update('notebook', event.target.value)}>
          <option value="">All notebooks</option>
          <option value="none">Without a notebook</option>
          {(notebooks.data || []).map((notebook) => <option key={notebook.id} value={notebook.id}>{notebook.name}</option>)}
        </select>
        <select aria-label="Tag" value={params.get('tag') || ''} onChange={(event) => update('tag', event.target.value)}>
          <option value="">All tags</option>
          {(tags.data || []).map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
        </select>
        <select aria-label="Colour" value={params.get('color') || ''} onChange={(event) => update('color', event.target.value)}>
          <option value="">All colours</option>
          {NOTE_COLORS.map((color) => <option key={color} value={color}>{color}</option>)}
        </select>
        <select aria-label="Sort" value={String(filters.sort)} onChange={(event) => update('sort', event.target.value)}>
          <option value="updated">Recently updated</option>
          <option value="created">Recently created</option>
          <option value="title">Title</option>
          <option value="words">Word count</option>
        </select>
        <button className={`btn btn-small ${params.get('pinned') ? 'btn-primary' : 'btn-ghost'}`} type="button" onClick={() => update('pinned', params.get('pinned') ? '' : 'true')}>Pinned</button>
        <button className={`btn btn-small ${params.get('favourite') ? 'btn-primary' : 'btn-ghost'}`} type="button" onClick={() => update('favourite', params.get('favourite') ? '' : 'true')}>Favourites</button>
        <input aria-label="From date" type="date" value={params.get('from') || ''} onChange={(event) => update('from', event.target.value)} />
        <input aria-label="To date" type="date" value={params.get('to') || ''} onChange={(event) => update('to', event.target.value)} />
        <button className="btn btn-small btn-ghost" type="button" onClick={() => setView(view === 'card' ? 'list' : 'card')}>{view === 'card' ? 'List' : 'Cards'}</button>
      </div>
      {notes.isLoading && <p>Turning the pages…</p>}
      {notes.isError && <p className="save-bad">The library could not be opened.</p>}
      {pinned.length > 0 && <h2>Pinned</h2>}
      <div className={view === 'card' ? 'note-grid' : 'note-list'}>
        {pinned.map((note) => (
          <div key={note.id}>
            <NoteCard note={note} view={view} onPin={() => void patch(note.id, { isPinned: !note.isPinned }, 'Pin updated.')} onFavourite={() => void patch(note.id, { isFavourite: !note.isFavourite }, 'Favourite updated.')} />
            {actions(note)}
          </div>
        ))}
      </div>
      <div className={view === 'card' ? 'note-grid' : 'note-list'} style={{ marginTop: 14 }}>
        {rest.map((note) => (
          <div key={note.id}>
            <NoteCard note={note} view={view} onPin={() => void patch(note.id, { isPinned: !note.isPinned }, 'Pin updated.')} onFavourite={() => void patch(note.id, { isFavourite: !note.isFavourite }, 'Favourite updated.')} />
            {actions(note)}
          </div>
        ))}
      </div>
      {notes.data?.length === 0 && <div className="empty card"><h2>The shelves are quiet</h2><p>Create a note and it will be kept here.</p></div>}
    </div>
  )
}
