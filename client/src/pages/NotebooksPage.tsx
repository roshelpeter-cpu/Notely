import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Notebook } from '../api/types'
import { NotebookDialog } from '../components/shell'
import { NotebookCover } from '../components/world'
import { useToast } from '../context/ToastContext'
import { useUi } from '../context/UiContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { TAG_COLORS, toneClass } from '../lib/options'

export default function NotebooksPage() {
  const { workspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const ui = useUi()
  const [params, setParams] = useSearchParams()
  const notebooks = useQuery({ queryKey: ['notebooks', workspaceId], queryFn: () => api.notebooks(workspaceId) })
  const folders = useQuery({ queryKey: ['folders', workspaceId], queryFn: () => api.folders(workspaceId) })
  const tags = useQuery({ queryKey: ['tags', workspaceId], queryFn: () => api.tags(workspaceId) })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Notebook | null>(null)
  const [folderName, setFolderName] = useState('')
  const [tagName, setTagName] = useState('')

  useEffect(() => {
    if (params.get('new') === '1') setOpen(true)
  }, [params])

  function closeDialog() {
    setOpen(false)
    setEditing(null)
    if (params.get('new')) {
      params.delete('new')
      setParams(params, { replace: true })
    }
  }

  const grouped = new Map<string, Notebook[]>()
  for (const notebook of notebooks.data || []) {
    const key = notebook.folderName || 'Loose volumes'
    grouped.set(key, [...(grouped.get(key) || []), notebook])
  }

  return (
    <div className="page">
      <div className="section-head">
        <div>
          <p className="eyebrow">Collections</p>
          <h1>Notebooks</h1>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>New notebook</button>
      </div>
      <div className="grid-2">
        <div>
          {[...grouped.entries()].map(([folder, books]) => (
            <section key={folder} className="panel">
              <h2>{folder}</h2>
              <div className="book-grid">
                {books.map((notebook) => (
                  <article key={notebook.id} className="book">
                    <div className={`book-cover ${toneClass(notebook.color)}`}><NotebookCover cover={notebook.cover} /></div>
                    <strong>{notebook.name}</strong>
                    <p className="muted">{notebook.description || 'A quiet volume.'}</p>
                    <small>{notebook.noteCount} notes</small>
                    <div className="quick">
                      <button className="btn btn-small btn-ghost" type="button" onClick={() => setEditing(notebook)}>Edit</button>
                      <button className="btn btn-small btn-ghost" type="button" onClick={async () => {
                        if (!(await ui.confirm({ title: 'Release this notebook?', message: 'Notes stay in the library without a cover.', confirmLabel: 'Delete notebook', danger: true }))) return
                        await api.deleteNotebook(notebook.id)
                        await queryClient.invalidateQueries({ queryKey: ['notebooks'] })
                        notify('Notebook removed. Its notes remain.', 'success')
                      }}>Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
          {notebooks.data?.length === 0 && <div className="empty card"><h2>No volumes yet</h2><p>Bind a notebook and give it a cover.</p></div>}
        </div>
        <aside className="stack">
          <section className="panel">
            <h2>Folders</h2>
            <ul className="activity-list">
              {(folders.data || []).map((folder) => (
                <li key={folder.id}>
                  <span>{folder.name}</span>
                  <button className="btn btn-small btn-ghost" type="button" onClick={async () => {
                    const name = window.prompt('Folder name', folder.name)
                    if (!name?.trim()) return
                    await api.updateFolder(folder.id, { name: name.trim() })
                    await queryClient.invalidateQueries({ queryKey: ['folders'] })
                  }}>Rename</button>
                  <button className="btn btn-small btn-ghost" type="button" onClick={async () => {
                    await api.deleteFolder(folder.id)
                    await queryClient.invalidateQueries({ queryKey: ['folders'] })
                    await queryClient.invalidateQueries({ queryKey: ['notebooks'] })
                  }}>Remove</button>
                </li>
              ))}
            </ul>
            <form className="link-pop" onSubmit={async (event) => {
              event.preventDefault()
              if (!folderName.trim()) return
              await api.createFolder({ workspaceId, name: folderName.trim() })
              setFolderName('')
              await queryClient.invalidateQueries({ queryKey: ['folders'] })
            }}>
              <input aria-label="New folder" placeholder="New folder" value={folderName} onChange={(event) => setFolderName(event.target.value)} />
              <button className="btn btn-small" type="submit">Add</button>
            </form>
          </section>
          <section className="panel">
            <h2>Tags</h2>
            <div className="tags">
              {(tags.data || []).map((tag) => (
                <span key={tag.id} className={`tag ${toneClass(tag.color)}`}>
                  {tag.name}
                  <button type="button" className="btn btn-small btn-ghost" aria-label={`Rename ${tag.name}`} onClick={async () => {
                    const name = window.prompt('Tag name', tag.name)
                    if (!name?.trim()) return
                    await api.updateTag(tag.id, { name: name.trim() })
                    await queryClient.invalidateQueries({ queryKey: ['tags'] })
                  }}>Rename</button>
                  <button type="button" className="btn btn-small btn-ghost" aria-label={`Delete ${tag.name}`} onClick={async () => {
                    if (!(await ui.confirm({ title: 'Remove this tag?', message: `“${tag.name}” will leave every note.`, confirmLabel: 'Delete tag', danger: true }))) return
                    await api.deleteTag(tag.id)
                    await queryClient.invalidateQueries({ queryKey: ['tags'] })
                  }}>Remove</button>
                </span>
              ))}
            </div>
            <form className="link-pop" onSubmit={async (event) => {
              event.preventDefault()
              if (!tagName.trim()) return
              await api.createTag({ workspaceId, name: tagName.trim(), color: TAG_COLORS[(tags.data?.length || 0) % TAG_COLORS.length] })
              setTagName('')
              await queryClient.invalidateQueries({ queryKey: ['tags'] })
            }}>
              <input aria-label="New tag" placeholder="New tag" value={tagName} onChange={(event) => setTagName(event.target.value)} />
              <button className="btn btn-small" type="submit">Add</button>
            </form>
          </section>
        </aside>
      </div>
      {(open || editing) && (
        <NotebookDialog
          initial={editing ? { id: editing.id, name: editing.name, description: editing.description, color: editing.color, cover: editing.cover, folderId: editing.folderId } : undefined}
          onClose={closeDialog}
          onSaved={() => { closeDialog(); notify('Notebook saved.', 'success') }}
        />
      )}
    </div>
  )
}
