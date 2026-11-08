import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

interface Toast {
  id: number
  tone: 'info' | 'success' | 'error'
  message: string
}

interface ToastValue {
  notify: (message: string, tone?: Toast['tone']) => void
}

const ToastContext = createContext<ToastValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const notify = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, tone, message }])
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3600)
  }, [])
  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((toast) => (
          <div className={`toast tone-${toast.tone}`} key={toast.id} role="status">
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('Notifications are unavailable.')
  return value
}
