import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

interface PromptOptions {
  title: string
  label: string
  initial?: string
  confirmLabel?: string
}

interface UiValue {
  collapsed: boolean
  setCollapsed: (value: boolean) => void
  drawer: boolean
  setDrawer: (value: boolean) => void
  palette: boolean
  setPalette: (value: boolean) => void
  focus: boolean
  setFocus: (value: boolean) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
  ask: (options: PromptOptions) => Promise<string | null>
}

const UiContext = createContext<UiValue | null>(null)

export function UiProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(localStorage.getItem('notely-sidebar') === 'collapsed')
  const [drawer, setDrawer] = useState(false)
  const [palette, setPalette] = useState(false)
  const [focus, setFocus] = useState(false)
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (value: boolean) => void }) | null>(null)
  const [prompting, setPrompting] = useState<(PromptOptions & { resolve: (value: string | null) => void }) | null>(null)
  const [draft, setDraft] = useState('')
  const [promptError, setPromptError] = useState('')

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value)
    localStorage.setItem('notely-sidebar', value ? 'collapsed' : 'open')
  }, [])

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => setPending({ ...options, resolve }))
  }, [])

  const ask = useCallback((options: PromptOptions) => {
    setDraft(options.initial || '')
    setPromptError('')
    return new Promise<string | null>((resolve) => setPrompting({ ...options, resolve }))
  }, [])

  const close = (value: boolean) => {
    pending?.resolve(value)
    setPending(null)
  }

  const closePrompt = (value: string | null) => {
    prompting?.resolve(value)
    setPrompting(null)
    setPromptError('')
  }

  useEffect(() => {
    if (!pending && !prompting) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (prompting) closePrompt(null)
        else close(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const value = useMemo<UiValue>(
    () => ({ collapsed, setCollapsed, drawer, setDrawer, palette, setPalette, focus, setFocus, confirm, ask }),
    [collapsed, setCollapsed, drawer, palette, focus, confirm, ask],
  )

  return (
    <UiContext.Provider value={value}>
      {children}
      {pending && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => close(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="confirm-title">{pending.title}</h2>
            <p>{pending.message}</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" type="button" onClick={() => close(false)}>
                Cancel
              </button>
              <button className={`btn ${pending.danger ? 'btn-danger' : 'btn-primary'}`} type="button" onClick={() => close(true)}>
                {pending.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
      {prompting && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => closePrompt(null)}>
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="prompt-title"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault()
              const name = draft.trim()
              if (!name) {
                setPromptError('A name is required.')
                return
              }
              closePrompt(name)
            }}
          >
            <h2 id="prompt-title">{prompting.title}</h2>
            <label className="field">
              <span>{prompting.label}</span>
              <input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} />
            </label>
            {promptError && <p className="save-bad">{promptError}</p>}
            <div className="modal-actions">
              <button className="btn btn-ghost" type="button" onClick={() => closePrompt(null)}>Cancel</button>
              <button className="btn btn-primary" type="submit">{prompting.confirmLabel || 'Save'}</button>
            </div>
          </form>
        </div>
      )}
    </UiContext.Provider>
  )
}

export function useUi() {
  const value = useContext(UiContext)
  if (!value) throw new Error('The workspace shell is unavailable.')
  return value
}
