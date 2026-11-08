import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AppShell } from './components/shell'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { UiProvider } from './context/UiContext'
import { WorkspaceProvider } from './context/WorkspaceContext'
import ArchivePage from './pages/ArchivePage'
import CalendarPage from './pages/CalendarPage'
import EditorPage from './pages/EditorPage'
import HomePage from './pages/HomePage'
import InsightsPage from './pages/InsightsPage'
import MapPage from './pages/MapPage'
import NotebooksPage from './pages/NotebooksPage'
import NotesPage from './pages/NotesPage'
import SettingsPage from './pages/SettingsPage'
import TasksPage from './pages/TasksPage'
import TrashPage from './pages/TrashPage'
import WelcomePage from './pages/WelcomePage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: 1 } },
})

const router = createBrowserRouter([
  { path: '/', element: <WelcomePage /> },
  {
    path: '/app',
    element: (
      <WorkspaceProvider>
        <AppShell />
      </WorkspaceProvider>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'notes', element: <NotesPage /> },
      { path: 'notes/:id', element: <EditorPage /> },
      { path: 'notebooks', element: <NotebooksPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'map', element: <MapPage /> },
      { path: 'insights', element: <InsightsPage /> },
      { path: 'archive', element: <ArchivePage /> },
      { path: 'trash', element: <TrashPage /> },
      { path: 'settings', element: <SettingsPage /> },
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
