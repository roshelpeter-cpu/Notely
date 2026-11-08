export interface Profile {
  id: number
  displayName: string
  tagline: string
  createdAt: string
}

export interface Workspace {
  id: number
  name: string
  description: string
  isDefault: boolean
  noteCount: number
  createdAt: string
  updatedAt: string
}

export interface Folder {
  id: number
  workspaceId: number
  parentId: number | null
  name: string
  createdAt: string
  updatedAt: string
}

export interface Notebook {
  id: number
  workspaceId: number
  folderId: number | null
  folderName: string | null
  name: string
  description: string
  color: string
  cover: string
  noteCount: number
  createdAt: string
  updatedAt: string
}

export interface Tag {
  id: number
  workspaceId: number
  name: string
  color: string
  noteCount?: number
  createdAt?: string
}

export interface Note {
  id: number
  workspaceId: number
  notebookId: number | null
  notebookName: string | null
  notebookColor: string | null
  notebookCover: string | null
  folderId: number | null
  title: string
  excerpt: string
  contentJson?: NoteDoc
  contentText?: string
  color: string
  isPinned: boolean
  isFavourite: boolean
  isArchived: boolean
  isDaily: boolean
  dailyDate: string | null
  wordCount: number
  charCount: number
  tags: Tag[]
  createdAt: string
  updatedAt: string
  createdOn: string
  updatedOn: string
  deletedAt: string | null
}

export interface NoteDoc {
  type?: string
  attrs?: Record<string, unknown>
  content?: NoteDoc[]
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  text?: string
}

export interface NoteVersion {
  id: number
  noteId: number
  title: string
  excerpt: string
  contentJson?: NoteDoc
  contentText?: string
  wordCount: number
  createdAt: string
}

export interface NoteLink {
  id: number
  title: string
  excerpt: string
  color: string
  notebookName: string | null
  updatedAt: string
}

export interface Task {
  id: number
  workspaceId: number
  noteId: number | null
  noteTitle: string | null
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
  dueDate: string | null
  tags: Tag[]
  createdAt: string
  updatedAt: string
  createdOn: string
  completedAt: string | null
  completedOn: string | null
  deletedAt: string | null
}

export interface DashboardSections {
  focus: boolean
  recent: boolean
  notebooks: boolean
  calendar: boolean
  map: boolean
  activity: boolean
  writing: boolean
}

export interface Preferences {
  theme: 'day' | 'night' | 'system'
  accent: 'forest' | 'gold' | 'berry' | 'river'
  motion: 'full' | 'reduce'
  editorFont: 'sans' | 'serif' | 'literata' | 'mono'
  editorSize: 'sm' | 'md' | 'lg'
  autosave: boolean
  defaultNotebookId: number | null
  noteView: 'card' | 'list'
  noteSort: 'updated' | 'created' | 'title' | 'words'
  dashboard: DashboardSections
}

export interface Activity {
  id: number
  workspaceId: number
  type: string
  entityType: string
  entityId: number | null
  summary: string
  createdAt: string
}

export interface Stats {
  totals: {
    notes: number
    archived: number
    notebooks: number
    openTasks: number
    completedTasks: number
    words: number
  }
  streak: { current: number; longest: number; activeDays: number }
  notesByWeek: { weekStart: string; count: number; words: number }[]
  tasksByWeek: { weekStart: string; count: number; words: number }[]
  recentDays: { date: string; count: number; words: number }[]
  weekdays: { day: string; count: number }[]
  topTags: { name: string; color: string; count: number }[]
  notebooks: { name: string; color: string; cover: string; count: number }[]
}

export interface GraphData {
  nodes: {
    id: number
    title: string
    color: string
    notebookId: number | null
    notebookName: string | null
    linkCount: number
  }[]
  edges: { source: number; target: number; kind?: 'link' | 'notebook' | 'tag' }[]
}

export interface CalendarData {
  notes: {
    id: number
    title: string
    color: string
    isDaily: boolean
    dailyDate: string | null
    createdOn: string
    notebookName: string | null
  }[]
  tasks: {
    id: number
    title: string
    status: string
    priority: string
    dueDate: string
    noteId: number | null
  }[]
}

export interface SearchResults {
  notes: Note[]
  notebooks: Pick<Notebook, 'id' | 'name' | 'description' | 'color' | 'cover'>[]
  tags: Tag[]
  tasks: Task[]
}

export interface Suggestions {
  method: string
  related: { id: number; title: string; score: number; reason: string }[]
  tagSuggestions: { id: number; name: string; color: string; reason: string }[]
  unassigned: { id: number; title: string; reason: string }[]
  untagged: { id: number; title: string; reason: string }[]
  duplicateTitles: { title: string; notes: { id: number; title: string }[]; reason: string }[]
}

export interface BackupFile {
  format: 'notely-backup'
  version: 1
  [key: string]: unknown
}
