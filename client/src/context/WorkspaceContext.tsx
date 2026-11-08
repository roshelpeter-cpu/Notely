import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import type { Preferences, Profile, Workspace } from '../api/types'
interface WorkspaceValue {
  workspaceId: number
  workspace?: Workspace
  workspaces: Workspace[]
  profile?: Profile
  preferences?: Preferences
  setWorkspaceId: (id: number) => void
  refresh: () => void
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const profile = useQuery({ queryKey: ['profile'], queryFn: api.profile })
  const workspaces = useQuery({ queryKey: ['workspaces'], queryFn: api.workspaces })
  const preferences = useQuery({ queryKey: ['preferences'], queryFn: api.preferences })
  const [workspaceId, setWorkspaceIdState] = useState<number | null>(null)

  useEffect(() => {
    if (!workspaces.data?.length) return
    const stored = Number(localStorage.getItem('notely-workspace'))
    const match = workspaces.data.find((workspace) => workspace.id === stored)
    const fallback = workspaces.data.find((workspace) => workspace.isDefault) || workspaces.data[0]
    setWorkspaceIdState((current) => current || match?.id || fallback.id)
  }, [workspaces.data])

  useEffect(() => {
    const prefs = preferences.data
    if (!prefs) return
    document.documentElement.dataset.editorFont = prefs.editorFont
    document.documentElement.dataset.editorSize = prefs.editorSize
  }, [preferences.data])

  const setWorkspaceId = (id: number) => {
    setWorkspaceIdState(id)
    localStorage.setItem('notely-workspace', String(id))
  }

  const value = useMemo<WorkspaceValue | null>(() => {
    if (!workspaceId) return null
    return {
      workspaceId,
      workspace: workspaces.data?.find((workspace) => workspace.id === workspaceId),
      workspaces: workspaces.data || [],
      profile: profile.data,
      preferences: preferences.data,
      setWorkspaceId,
      refresh: () => {
        void queryClient.invalidateQueries()
      },
    }
  }, [workspaceId, workspaces.data, profile.data, preferences.data, queryClient])

  if (profile.isError || workspaces.isError) {
    return (
      <div className="boot-error">
        <h1>The path into Notely is closed.</h1>
        <p>The local API did not answer. Start the server, then try again.</p>
        <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    )
  }

  if (!value) {
    return (
      <div className="boot">
        <div className="boot-mark" aria-hidden="true" />
        <p>Entering the woodland…</p>
      </div>
    )
  }

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('Workspace is unavailable.')
  return value
}
