import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Focus, Maximize2, Minimize2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useBlocker, useParams } from 'react-router-dom'
import { ApiError, api } from '../api/client'
import type { Note, NoteDoc } from '../api/types'
import { RichEditor } from '../components/Editor'
import { SceneArt } from '../components/scenery'
import { useToast } from '../context/ToastContext'
import { useUi } from '../context/UiContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { formatWhen } from '../lib/dates'
import { NOTE_COLORS, TAG_COLORS, toneClass } from '../lib/options'
import { downloadText } from '../lib/download'

export default function EditorPage() {
  const params = useParams()
  const noteId = Number(params.id)
  const queryClient = useQueryClient()
  const { workspaceId, preferences } = useWorkspace()
  const ui = useUi()
  const { notify } = useToast()
  const note = useQuery({ queryKey: ['note', noteId], queryFn: () => api.note(noteId), enabled: Number.isInteger(noteId) && noteId > 0 })
  const notebooks = useQuery({ queryKey: ['notebooks', workspaceId], queryFn: () => api.notebooks(workspaceId) })
  const tags = useQuery({ queryKey: ['tags', workspaceId], queryFn: () => api.tags(workspaceId) })
  const library = useQuery({ queryKey: ['notes', workspaceId, 'picker'], queryFn: () => api.notes({ workspaceId, limit: 100 }) })
  const links = useQuery({ queryKey: ['links', noteId], queryFn: () => api.links(noteId), enabled: note.isSuccess })
  const versions = useQuery({ queryKey: ['versions', noteId], queryFn: () => api.versions(noteId), enabled: note.isSuccess })
  const suggestions = useQuery({ queryKey: ['suggestions', workspaceId, noteId], queryFn: () => api.suggestions(workspaceId, noteId), enabled: note.isSuccess })
  const [title, setTitle] = useState('')
  const [doc, setDoc] = useState<NoteDoc | null>(null)
  const [status, setStatus] = useState('Saved')
  const [conflict, setConflict] = useState<Note | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState('loaded')
  const [preview, setPreview] = useState<string>('')
  const [linkTarget, setLinkTarget] = useState('')
  const titleRef = useRef('')
  const bodyRef = useRef<NoteDoc | null>(null)
  const textRef = useRef('')
  const baseRef = useRef('')
  const timer = useRef<number | null>(null)
  const loadedId = useRef<number | null>(null)
  const [seenId, setSeenId] = useState(noteId)
  const [dirty, setDirty] = useState(false)
  if (seenId !== noteId) {
    setSeenId(noteId)
    setDoc(null)
    setDraft(null)
    setConflict(null)
    loadedId.current = null
  }
  titleRef.current = title

  useEffect(() => {
    if (!note.data || note.data.id !== noteId || loadedId.current === noteId) return
    loadedId.current = noteId
    const next = note.data.contentJson || { type: 'doc', content: [{ type: 'paragraph' }] }
    setTitle(note.data.title)
    setDoc(next)
    bodyRef.current = next
    textRef.current = note.data.contentText || ''
    baseRef.current = note.data.updatedAt
    setDirty(false)
    const saved = localStorage.getItem(`notely-draft-${noteId}`)
    if (saved) {
      const parsed = JSON.parse(saved) as { savedAt?: string }
      if (parsed.savedAt && parsed.savedAt > note.data.updatedAt) setDraft(saved)
    }
  }, [note.data, noteId])

  async function save(force = false) {
    if (!bodyRef.current) return
    setStatus('Saving')
    try {
      const updated = await api.updateNote(noteId, {
        title: titleRef.current,
        contentJson: bodyRef.current,
        contentText: textRef.current,
        baseUpdatedAt: baseRef.current,
        force,
      })
      baseRef.current = updated.updatedAt
      setDirty(false)
      localStorage.removeItem(`notely-draft-${noteId}`)
      setStatus(`Saved ${formatWhen(updated.updatedAt)}`)
      setConflict(null)
      queryClient.setQueryData(['note', noteId], updated)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && error.current) {
        setConflict(error.current)
        setStatus('This note changed elsewhere')
        return
      }
      setStatus('Kept locally')
      notify(error instanceof Error ? error.message : 'Save failed', 'error')
    }
  }

  function schedule(nextDoc: NoteDoc, nextText: string) {
    bodyRef.current = nextDoc
    textRef.current = nextText
    setDirty(true)
    localStorage.setItem(`notely-draft-${noteId}`, JSON.stringify({
      title: titleRef.current,
      content: nextDoc,
      text: nextText,
      savedAt: new Date().toISOString(),
    }))
    if (preferences?.autosave === false) {
      setStatus('Unsaved')
      return
    }
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void save(), 800)
  }

  const blocker = useBlocker(dirty)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    void save().finally(() => blocker.proceed())
  }, [blocker, blocker.state])

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [dirty])

  async function applyTags(tagIds: number[]) {
    const updated = await api.updateNote(noteId, { tagIds })
    queryClient.setQueryData(['note', noteId], updated)
    await queryClient.invalidateQueries({ queryKey: ['tags'] })
  }

  if (note.isLoading || !doc) return <p className="page">Opening the cottage…</p>
  if (note.isError || !note.data) return <p className="page">That note is not on the shelf.</p>

  return (
    <div className={`page page-cottage editor-layout ${ui.focus ? 'is-focus' : ''}`}>
      <section className="editor-sheet card">
        <div className="editor-banner"><SceneArt scene="cottage" crop="top" /></div>
        <div className="spread">
          <Link to="/app/notes">Back to the library</Link>
          <div className="quick">
            <span className={status.startsWith('Saved') ? 'save-ok' : 'save-bad'}>{status}</span>
            <button className="btn btn-small btn-ghost" type="button" onClick={() => void save()}>Save</button>
            <button className="icon-btn" type="button" aria-label="Focus mode" onClick={() => ui.setFocus(!ui.focus)}>{ui.focus ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
          </div>
        </div>
        {draft && (
          <p className="panel">
            A newer draft is stored on this device.
            <button className="btn btn-small" type="button" onClick={() => {
              const parsed = JSON.parse(draft) as { title: string; content: NoteDoc; text: string }
              setTitle(parsed.title)
              bodyRef.current = parsed.content
              textRef.current = parsed.text
              setDoc(parsed.content)
              setRefreshKey(`draft-${Date.now()}`)
              setDraft(null)
            }}>Restore draft</button>
          </p>
        )}
        <input className="editor-title" aria-label="Note title" value={title} onChange={(event) => { setTitle(event.target.value); titleRef.current = event.target.value; schedule(bodyRef.current || doc, textRef.current) }} />
        <RichEditor noteId={noteId} content={doc} refreshKey={refreshKey} onChange={schedule} onSave={() => void save()} />
      </section>
      {!ui.focus && (
        <aside className="editor-rail">
          <section className="panel">
            <h2>Place</h2>
            <label className="field"><span>Notebook</span>
              <select value={note.data.notebookId || ''} onChange={(event) => void api.updateNote(noteId, { notebookId: event.target.value ? Number(event.target.value) : null }).then((updated) => queryClient.setQueryData(['note', noteId], updated))}>
                <option value="">No notebook</option>
                {(notebooks.data || []).map((notebook) => <option key={notebook.id} value={notebook.id}>{notebook.name}</option>)}
              </select>
            </label>
            <div className="swatches">
              {NOTE_COLORS.map((color) => (
                <button key={color} className={`swatch ${toneClass(color)}`} style={{ background: 'var(--tone)' }} aria-label={color} type="button" onClick={() => void api.updateNote(noteId, { color }).then((updated) => queryClient.setQueryData(['note', noteId], updated))} />
              ))}
            </div>
            <div className="tags">
              {note.data.tags.map((tag) => <button key={tag.id} className={`tag ${toneClass(tag.color)}`} type="button" onClick={() => void applyTags(note.data.tags.filter((item) => item.id !== tag.id).map((item) => item.id))}>{tag.name} ×</button>)}
            </div>
            <TagAdder existing={tags.data || []} onCreate={async (name) => { const tag = await api.createTag({ workspaceId, name, color: TAG_COLORS[note.data.tags.length % TAG_COLORS.length] }); await applyTags([...note.data.tags.map((item) => item.id), tag.id]) }} onPick={(id) => void applyTags([...new Set([...note.data.tags.map((item) => item.id), id])])} />
          </section>
          <section className="panel">
            <h2>Details</h2>
            <p>Updated {formatWhen(note.data.updatedAt)}</p>
            <p className="muted">Created {formatWhen(note.data.createdAt)} · {note.data.wordCount} words</p>
          </section>
          <section className="panel">
            <h2>Connections</h2>
            <ul>{(links.data?.outgoing || []).map((link) => <li key={link.id}><Link to={`/app/notes/${link.id}`}>{link.title}</Link></li>)}</ul>
            <p className="muted">Backlinks</p>
            <ul>{(links.data?.incoming || []).map((link) => <li key={link.id}><Link to={`/app/notes/${link.id}`}>{link.title}</Link></li>)}</ul>
            <label className="field"><span>Link a note</span>
              <select value={linkTarget} onChange={(event) => setLinkTarget(event.target.value)}>
                <option value="">Choose a note</option>
                {(library.data || []).filter((item) => item.id !== noteId).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
            <button className="btn btn-small btn-soft" type="button" disabled={!linkTarget} onClick={() => void api.addLink(noteId, Number(linkTarget)).then(() => { setLinkTarget(''); return queryClient.invalidateQueries({ queryKey: ['links', noteId] }) })}>Link</button>
          </section>
          <section className="panel">
            <h2>Earlier versions</h2>
            <ul className="activity-list">
              {(versions.data || []).map((version) => (
                <li key={version.id}>
                  <button type="button" className="btn btn-ghost btn-small" onClick={() => void api.version(noteId, version.id).then((full) => setPreview(full.contentText || full.excerpt))}>{formatWhen(version.createdAt)}</button>
                  <button type="button" className="btn btn-small" onClick={() => void api.restoreVersion(noteId, version.id).then((restored) => { setDoc(restored.contentJson || doc); bodyRef.current = restored.contentJson || doc; setTitle(restored.title); setRefreshKey(`restore-${version.id}`); baseRef.current = restored.updatedAt; queryClient.setQueryData(['note', noteId], restored); notify('Earlier version restored.', 'success') })}>Restore</button>
                </li>
              ))}
            </ul>
            {preview && <p>{preview}</p>}
          </section>
          <section className="panel">
            <h2>Suggestions</h2>
            <p className="muted">{suggestions.data?.method}</p>
            <ul>{(suggestions.data?.related || []).map((item) => <li key={item.id}><Link to={`/app/notes/${item.id}`}>{item.title}</Link> <small>{item.reason}</small></li>)}</ul>
            {(suggestions.data?.tagSuggestions || []).map((tag) => (
              <button key={tag.id} className="btn btn-small btn-ghost" type="button" onClick={() => void applyTags([...note.data.tags.map((item) => item.id), tag.id])}>Add {tag.name}</button>
            ))}
          </section>
          <button className="btn btn-ghost" type="button" onClick={() => void api.noteMarkdown(noteId).then((file) => downloadText(file.filename, file.content, 'text/markdown'))}><Focus size={14} /> Export Markdown</button>
        </aside>
      )}
      {conflict && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true">
            <h2>Two copies of this note</h2>
            <p>The saved copy changed after you started writing. You can keep your writing or return to the saved copy.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" type="button" onClick={() => { if (!conflict.contentJson) return; setDoc(conflict.contentJson); bodyRef.current = conflict.contentJson; setTitle(conflict.title); textRef.current = conflict.contentText || ''; baseRef.current = conflict.updatedAt; setRefreshKey(`server-${conflict.updatedAt}`); setConflict(null); setDirty(false) }}>Use saved copy</button>
              <button className="btn btn-primary" type="button" onClick={() => void save(true)}>Keep mine</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TagAdder({ existing, onCreate, onPick }: { existing: { id: number; name: string }[]; onCreate: (name: string) => Promise<void>; onPick: (id: number) => void }) {
  const [name, setName] = useState('')
  return (
    <form className="link-pop" onSubmit={(event) => { event.preventDefault(); const match = existing.find((tag) => tag.name.toLowerCase() === name.trim().toLowerCase()); if (match) onPick(match.id); else if (name.trim()) void onCreate(name.trim()); setName('') }}>
      <input aria-label="Add a tag" placeholder="Add a tag" value={name} onChange={(event) => setName(event.target.value)} list="tag-names" />
      <datalist id="tag-names">{existing.map((tag) => <option key={tag.id} value={tag.name} />)}</datalist>
      <button className="btn btn-small" type="submit">Add</button>
    </form>
  )
}
