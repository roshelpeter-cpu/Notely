import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
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
}

const UiContext = createContext<UiValue | null>(null)

export function UiProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(localStorage.getItem('notely-sidebar') === 'collapsed')
  const [drawer, setDrawer] = useState(false)
  const [palette, setPalette] = useState(false)
  const [focus, setFocus] = useState(false)
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (value: boolean) => void }) | null>(null)

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value)
    localStorage.setItem('notely-sidebar', value ? 'collapsed' : 'open')
  }, [])

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => setPending({ ...options, resolve }))
  }, [])

  const close = (value: boolean) => {
    pending?.resolve(value)
    setPending(null)
  }

  const value = useMemo<UiValue>(
    () => ({ collapsed, setCollapsed, drawer, setDrawer, palette, setPalette, focus, setFocus, confirm }),
    [collapsed, setCollapsed, drawer, palette, focus, confirm],
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
    </UiContext.Provider>
  )
}

export function useUi() {
  const value = useContext(UiContext)
  if (!value) throw new Error('The workspace shell is unavailable.')
  return value
}
