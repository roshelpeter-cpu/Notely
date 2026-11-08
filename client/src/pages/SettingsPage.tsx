import { useQueryClient } from '@tanstack/react-query'
import { PageHead } from '../components/scenery'
import { TransferPanel } from '../components/Transfer'
import { useTheme } from '../context/ThemeContext'
import { useToast } from '../context/ToastContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { SHORTCUTS } from '../lib/shortcuts'
import { api } from '../api/client'
import type { Preferences } from '../api/types'
import { useQuery } from '@tanstack/react-query'

export default function SettingsPage() {
  const theme = useTheme()
  const { preferences, profile, workspaceId, workspaces } = useWorkspace()
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const notebooks = useQuery({ queryKey: ['notebooks', workspaceId], queryFn: () => api.notebooks(workspaceId) })

  async function save(body: Partial<Preferences>, message = 'Settings saved.') {
    const next = await api.updatePreferences(body)
    queryClient.setQueryData(['preferences'], next)
    notify(message, 'success')
  }

  if (!preferences || !profile) return <p className="page">Opening the workshop…</p>

  return (
    <div className="page page-workshop">
      <PageHead eyebrow="Workshop" title="Settings" scene="cottage" crop="top" />
      <section className="panel">
        <h2>Appearance</h2>
        <div className="grid-3">
          <label className="field"><span>Theme</span>
            <select value={theme.setting} onChange={(event) => {
              const value = event.target.value as Preferences['theme']
              theme.setSetting(value)
              void save({ theme: value })
            }}>
              <option value="day">Day</option>
              <option value="night">Night</option>
              <option value="system">System</option>
            </select>
          </label>
          <label className="field"><span>Accent</span>
            <select value={preferences.accent} onChange={(event) => {
              const accent = event.target.value as Preferences['accent']
              theme.setAccent(accent)
              void save({ accent })
            }}>
              <option value="forest">Forest</option>
              <option value="gold">Gold</option>
              <option value="berry">Berry</option>
              <option value="river">River</option>
            </select>
          </label>
          <label className="field"><span>Motion</span>
            <select value={preferences.motion} onChange={(event) => {
              const motion = event.target.value as Preferences['motion']
              theme.setMotion(motion)
              void save({ motion })
            }}>
              <option value="full">Gentle motion</option>
              <option value="reduce">Reduced motion</option>
            </select>
          </label>
        </div>
      </section>
      <section className="panel">
        <h2>Editor</h2>
        <div className="grid-3">
          <label className="field"><span>Font</span>
            <select value={preferences.editorFont} onChange={(event) => void save({ editorFont: event.target.value as Preferences['editorFont'] })}>
              <option value="serif">Fraunces</option>
              <option value="literata">Source Serif</option>
              <option value="sans">Source Sans</option>
              <option value="mono">Mono</option>
            </select>
          </label>
          <label className="field"><span>Size</span>
            <select value={preferences.editorSize} onChange={(event) => void save({ editorSize: event.target.value as Preferences['editorSize'] })}>
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
          </label>
          <label className="checkline"><input type="checkbox" checked={preferences.autosave} onChange={(event) => void save({ autosave: event.target.checked })} /> Autosave</label>
        </div>
      </section>
      <section className="panel">
        <h2>Organisation</h2>
        <div className="grid-3">
          <label className="field"><span>Default notebook</span>
            <select value={preferences.defaultNotebookId || ''} onChange={(event) => void save({ defaultNotebookId: event.target.value ? Number(event.target.value) : null })}>
              <option value="">None</option>
              {(notebooks.data || []).map((notebook) => <option key={notebook.id} value={notebook.id}>{notebook.name}</option>)}
            </select>
          </label>
          <label className="field"><span>Note view</span>
            <select value={preferences.noteView} onChange={(event) => void save({ noteView: event.target.value as Preferences['noteView'] })}>
              <option value="card">Cards</option>
              <option value="list">List</option>
            </select>
          </label>
          <label className="field"><span>Default sort</span>
            <select value={preferences.noteSort} onChange={(event) => void save({ noteSort: event.target.value as Preferences['noteSort'] })}>
              <option value="updated">Updated</option>
              <option value="created">Created</option>
              <option value="title">Title</option>
              <option value="words">Words</option>
            </select>
          </label>
        </div>
        <h3>Home sections</h3>
        <div className="quick">
          {(Object.keys(preferences.dashboard) as (keyof Preferences['dashboard'])[]).map((key) => (
            <label key={key} className="checkline">
              <input type="checkbox" checked={preferences.dashboard[key]} onChange={(event) => void save({ dashboard: { ...preferences.dashboard, [key]: event.target.checked } })} />
              {key}
            </label>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Profile and workspaces</h2>
        <form className="grid-2" onSubmit={async (event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          await api.updateProfile({ displayName: String(form.get('displayName') || ''), tagline: String(form.get('tagline') || '') })
          await queryClient.invalidateQueries({ queryKey: ['profile'] })
          notify('Profile saved.', 'success')
        }}>
          <label className="field"><span>Name</span><input name="displayName" defaultValue={profile.displayName} /></label>
          <label className="field"><span>Tagline</span><input name="tagline" defaultValue={profile.tagline} /></label>
          <button className="btn btn-soft" type="submit">Save profile</button>
        </form>
        <ul className="activity-list">
          {workspaces.map((workspace) => (
            <li key={workspace.id}>
              <span>{workspace.name}{workspace.isDefault ? ' · default' : ''}</span>
              {!workspace.isDefault && <button className="btn btn-small btn-ghost" type="button" onClick={async () => { await api.updateWorkspace(workspace.id, { isDefault: true }); await queryClient.invalidateQueries({ queryKey: ['workspaces'] }) }}>Make default</button>}
            </li>
          ))}
        </ul>
        <form className="link-pop" onSubmit={async (event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          const name = String(form.get('name') || '').trim()
          if (!name) return
          await api.createWorkspace({ name })
          event.currentTarget.reset()
          await queryClient.invalidateQueries({ queryKey: ['workspaces'] })
        }}>
          <input name="name" aria-label="New workspace" placeholder="New workspace" />
          <button className="btn btn-small" type="submit">Add workspace</button>
        </form>
      </section>
      <section className="panel">
        <h2>Keyboard shortcuts</h2>
        <ul className="activity-list">
          {SHORTCUTS.map((item) => <li key={item.keys}><span>{item.label}</span><strong>{item.keys}</strong></li>)}
        </ul>
      </section>
      <TransferPanel />
    </div>
  )
}
