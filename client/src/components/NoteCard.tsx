import { Pin, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Note } from '../api/types'
import { formatMedium } from '../lib/dates'
import { COVER_ART, NOTE_THUMBS } from '../lib/art'
import { toneClass } from '../lib/options'

export function NoteCard({ note, view = 'card', onPin, onFavourite }: { note: Note; view?: 'card' | 'list'; onPin?: () => void; onFavourite?: () => void }) {
  const thumb = (note.notebookCover && COVER_ART[note.notebookCover]) || NOTE_THUMBS[note.id % NOTE_THUMBS.length]
  return (
    <article className={`note-card card ${toneClass(note.color)}`}>
      {view === 'card' && (
        <Link className="note-thumb" to={`/app/notes/${note.id}`} tabIndex={-1} aria-hidden="true">
          <img src={thumb} alt="" />
        </Link>
      )}
      <div className="spread">
        <Link to={`/app/notes/${note.id}`}><h3>{note.title}</h3></Link>
        <span>
          {onPin && <button className="icon-btn" type="button" aria-label={note.isPinned ? 'Unpin note' : 'Pin note'} aria-pressed={note.isPinned} onClick={onPin}><Pin size={14} /></button>}
          {onFavourite && <button className="icon-btn" type="button" aria-label={note.isFavourite ? 'Remove favourite' : 'Favourite note'} aria-pressed={note.isFavourite} onClick={onFavourite}><Star size={14} /></button>}
        </span>
      </div>
      {view === 'card' && <p>{note.excerpt || 'A blank page.'}</p>}
      <div className="note-meta">
        {note.notebookName && <span className="chip">{note.notebookName}</span>}
        {note.tags.map((tag) => <span className={`tag ${toneClass(tag.color)}`} key={tag.id}>{tag.name}</span>)}
        {note.isPinned && <span className="chip">Pinned</span>}
        {note.isFavourite && <span className="chip">Favourite</span>}
        <small className="muted">{note.wordCount} words · {formatMedium(note.updatedAt)}</small>
      </div>
    </article>
  )
}
