import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom'
import { api } from './api/client'
import { AppShell } from './components/shell'
import { Splash } from './components/Splash'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { UiProvider } from './context/UiContext'
import { WorkspaceProvider } from './context/WorkspaceContext'
import AccountPage from './pages/AccountPage'
import ArchivePage from './pages/ArchivePage'
import { ForgotPage, LoginPage, ResetPage, SignupPage } from './pages/AuthPages'
import CalendarPage from './pages/CalendarPage'
import EditorPage from './pages/EditorPage'
import HomePage from './pages/HomePage'
import InsightsPage from './pages/InsightsPage'
import LibraryPage from './pages/LibraryPage'
import MapPage from './pages/MapPage'
import NotebookOpenPage from './pages/NotebookOpenPage'
import SettingsPage from './pages/SettingsPage'
import TasksPage from './pages/TasksPage'
import TrashPage from './pages/TrashPage'
import WelcomePage from './pages/WelcomePage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: 1 } },
})

function RootLayout() {
  const session = useQuery({ queryKey: ['session'], queryFn: api.session, retry: false })
  const [splash, setSplash] = useState(() => sessionStorage.getItem('notely-splash') !== 'seen')

  return (
    <>
      {splash && (
        <Splash
          ready={session.isFetched}
          onDone={() => {
            sessionStorage.setItem('notely-splash', 'seen')
            setSplash(false)
          }}
        />
      )}
      <Outlet />
    </>
  )
}

function RequireAuth() {
  const session = useQuery({ queryKey: ['session'], queryFn: api.session, retry: false })
  if (session.isLoading) return <div className="boot"><p>Entering the woodland…</p></div>
  if (!session.data?.user) return <Navigate to="/login" replace />
  return (
    <WorkspaceProvider>
      <AppShell />
    </WorkspaceProvider>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <WelcomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'signup', element: <SignupPage /> },
      { path: 'forgot', element: <ForgotPage /> },
      { path: 'reset', element: <ResetPage /> },
      {
        path: 'app',
        element: <RequireAuth />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'library', element: <LibraryPage /> },
          { path: 'library/notebooks/:id', element: <NotebookOpenPage /> },
          { path: 'notes', element: <Navigate to="/app/library?view=notes" replace /> },
          { path: 'notes/:id', element: <EditorPage /> },
          { path: 'notebooks', element: <Navigate to="/app/library?view=notebooks" replace /> },
          { path: 'tasks', element: <TasksPage /> },
          { path: 'calendar', element: <CalendarPage /> },
          { path: 'map', element: <MapPage /> },
          { path: 'insights', element: <InsightsPage /> },
          { path: 'archive', element: <ArchivePage /> },
          { path: 'trash', element: <TrashPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'account', element: <AccountPage /> },
        ],
      },
    ],
  },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <UiProvider>
            <RouterProvider router={router} />
          </UiProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
