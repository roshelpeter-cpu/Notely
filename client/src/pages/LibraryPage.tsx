import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { PageHead } from '../components/scenery'
import NotebooksPage from './NotebooksPage'
import NotesPage from './NotesPage'

const VIEWS = [
  ['notes', 'All notes'],
  ['notebooks', 'Notebooks'],
  ['folders', 'Folders'],
  ['tags', 'Tags'],
  ['pinned', 'Pinned'],
  ['favourites', 'Favourites'],
] as const

export default function LibraryPage() {
  const [params, setParams] = useSearchParams()
  const view = params.get('view') || 'notes'
  const session = useQuery({ queryKey: ['session'], queryFn: api.session })

  function choose(next: string) {
    const query = new URLSearchParams()
    query.set('view', next)
    if (next === 'pinned') query.set('pinned', '1')
    if (next === 'favourites') query.set('favourite', '1')
    setParams(query)
  }

  return (
    <div className="page page-library">
      <PageHead eyebrow={session.data?.user?.displayName || 'Your shelves'} title="Library" scene="library" />
      <div className="library-tabs" role="tablist" aria-label="Library sections">
        {VIEWS.map(([id, label]) => (
          <button key={id} className={`btn btn-small ${view === id ? 'btn-primary' : 'btn-ghost'}`} type="button" role="tab" aria-selected={view === id} onClick={() => choose(id)}>{label}</button>
        ))}
      </div>
      {view === 'notebooks' || view === 'folders' || view === 'tags'
        ? <NotebooksPage embedded section={view} />
        : <NotesPage embedded />}
    </div>
  )
}
