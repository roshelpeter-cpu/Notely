import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '../api/client'
import { useToast } from '../context/ToastContext'
import { useUi } from '../context/UiContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { downloadText } from '../lib/download'

export function TransferPanel() {
  const { workspaceId } = useWorkspace()
  const { notify } = useToast()
  const ui = useUi()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')

  async function exportJson() {
    const data = await api.exportJson(workspaceId)
    downloadText(`notely-backup-${workspaceId}.json`, JSON.stringify(data, null, 2), 'application/json')
    notify('Backup downloaded.', 'success')
  }

  async function exportMarkdown() {
    const data = await api.exportMarkdown(workspaceId)
    const bundle = data.files.map((file) => `<!-- ${file.filename} -->\n${file.content}`).join('\n\n---\n\n')
    downloadText(`notely-notes-${workspaceId}.md`, bundle, 'text/markdown')
    notify('Markdown bundle downloaded.', 'success')
  }

  async function importMarkdown(files: FileList | null) {
    if (!files?.length) return
    const parsed = await Promise.all([...files].map(async (file) => ({ filename: file.name, content: await file.text() })))
    const result = await api.importMarkdown({ workspaceId, files: parsed })
    await queryClient.invalidateQueries()
    const duplicates = result.duplicateTitles.length ? ` Titles already in the library were kept and imported as new notes: ${result.duplicateTitles.join(', ')}.` : ''
    setMessage(`Imported ${result.created} new notes.${duplicates}`)
    notify('Markdown imported as new notes.', 'success')
  }

  async function importJson(file: File | null, confirm = false) {
    if (!file) return
    const payload = JSON.parse(await file.text()) as unknown
    try {
      const result = await api.importJson({ workspaceId, payload, mode: confirm ? 'replace' : 'add', confirm })
      await queryClient.invalidateQueries()
      setMessage(`Imported ${result.notes} notes in ${result.mode} mode.`)
      notify('Backup imported.', 'success')
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CONFIRM_REQUIRED') {
        const yes = await ui.confirm({
          title: 'Replace this workspace?',
          message: error.message,
          confirmLabel: 'Replace workspace',
          danger: true,
        })
        if (yes) await importJson(file, true)
        return
      }
      setMessage(error instanceof Error ? error.message : 'Import failed.')
    }
  }

  return (
    <div className="panel">
      <div className="section-head"><h2>Backup and export</h2></div>
      <p className="muted">Markdown and JSON imports add new records. Replacing a workspace asks for confirmation and never happens silently.</p>
      <div className="quick">
        <button className="btn btn-soft" type="button" onClick={() => void exportJson()}>Download JSON backup</button>
        <button className="btn btn-soft" type="button" onClick={() => void exportMarkdown()}>Download Markdown</button>
        <label className="btn btn-ghost">Import Markdown<input hidden type="file" accept=".md,text/markdown" multiple onChange={(event) => void importMarkdown(event.target.files)} /></label>
        <label className="btn btn-ghost">Import JSON<input hidden type="file" accept="application/json,.json" onChange={(event) => void importJson(event.target.files?.[0] || null)} /></label>
      </div>
      {message && <p>{message}</p>}
    </div>
  )
}
