# Notely

Notely is a local personal knowledge workspace with the feel of an illustrated woodland. It keeps notes, notebooks, tasks, a calendar, and the links between ideas on your own machine.

Day mode is a sunlit forest. Night mode is the same world under lantern light. Both themes share one layout and the same data.

![Welcome](docs/screenshots/welcome-dayjpg)

## Features

- Rich-text notes with formatting, checklists, links, and images
- Autosave, a save indicator, and restorable version history
- Search across notes, notebooks, tags, and tasks
- Card and list views, colour, tags, pin, favourite, archive, and trash
- Notebooks, folders, and illustrated covers
- Tasks with priority, due dates, and a three-column board
- Calendar with month, week, and day views, plus daily notes
- Knowledge map of linked notes
- Writing statistics and streaks counted from stored notes and completed tasks
- Local keyword suggestions, with no external AI service
- Markdown and JSON import and export
- Command palette and keyboard shortcuts
- Day and night themes, accent colours, and focus mode

## Technology

| Layer | Stack |
| --- | --- |
| Client | React 19, Vite, TypeScript, React Router, TanStack Query, TipTap |
| Server | Node.js, Express |
| Database | SQLite, through `node:sqlite` |
| Tests | Node test runner, Vitest |

## Architecture

The client talks only to the JSON API. The server owns validation, SQLite, and file import and export. The API listens on `127.0.0.1` so it is not exposed on the network by default.

```text
client/src
  api/          typed HTTP client
  components/   shell, editor, cards, illustrations
  context/      theme, workspace, toasts, UI
  lib/          dates, theme, layout, shortcuts
  pages/        one screen per route
  styles/       shared woodland theme
server/src
  routes.js     HTTP routes
  schema.sql    SQLite schema
  repo/         queries and commands
  db.js         connection, migrations, transactions
```

## Database

SQLite file: `server/data/notely.db` (gitignored). WAL files are gitignored too.

| Table | Role |
| --- | --- |
| `profile` | Display name and tagline |
| `workspaces` | Separate libraries |
| `folders` | Nested notebook folders |
| `notebooks` | Volumes, with colour and cover |
| `notes` | Documents, including pin, archive, trash, and daily notes |
| `notes_fts` | Full-text index for title and body |
| `tags`, `note_tags`, `task_tags` | Labels |
| `tasks` | Quests, with status, priority, and due date |
| `note_links` | Directed links between notes |
| `note_versions` | Earlier copies that can be restored |
| `preferences` | Theme, accent, editor, and dashboard settings |
| `activity` | A short local history of changes |

## API

All responses use `{ data }` and errors use `{ error: { message } }`.

| Area | Routes |
| --- | --- |
| Health | `GET /api/health` |
| Profile and workspaces | `GET/PATCH /api/profile`, `GET/POST /api/workspaces`, `PATCH/DELETE /api/workspaces/:id` |
| Organisation | `/api/folders`, `/api/notebooks`, `/api/tags` |
| Notes | `/api/notes`, including archive, trash, restore, duplicate, versions, links, and markdown |
| Tasks | `/api/tasks`, including restore and permanent delete |
| Planning | `POST /api/daily-notes`, `GET /api/calendar`, `GET /api/graph` |
| Insight | `GET /api/stats`, `GET /api/search`, `GET /api/suggestions`, `GET /api/activity` |
| Transfer | `GET /api/export/json`, `GET /api/export/markdown`, `POST /api/import/json`, `POST /api/import/markdown` |
| Preferences | `GET/PATCH /api/preferences` |

Notely is a single-user local app. There is no login and no admin role. Do not expose the API port on a shared network.

## Screenshots

Home, day:

![Home in day mode](docs/screenshots/home-dayjpg)

Home, night:

![Home in night mode](docs/screenshots/home-nightjpg)

Notes:

![Notes library](docs/screenshots/notes-dayjpg)

Editor:

![Note editor](docs/screenshots/editor-dayjpg)

Notebooks:

![Notebooks](docs/screenshots/notebooks-dayjpg)

Tasks:

![Tasks](docs/screenshots/tasks-dayjpg)

Knowledge map:

![Knowledge map](docs/screenshots/map-dayjpg)

Calendar, night:

![Calendar at night](docs/screenshots/calendar-nightjpg)

## Installation

Requires Node.js 22.5 or newer.

```bash
npm install
copy .env.example .env
npm run dev
```

On macOS or Linux, use `cp .env.example .env`.

- App: http://localhost:5173
- API: http://127.0.0.1:3001

The first launch creates the database and, unless you disable it, fills it with fictional sample notes.

## Environment

Copy `.env.example`. It contains placeholders only.

| Variable | Purpose |
| --- | --- |
| `PORT` | API port. Default `3001`. |
| `CLIENT_ORIGIN` | Allowed browser origin for CORS. |
| `NOTELY_DB` | Optional SQLite path. Default `server/data/notely.db`. |
| `NOTELY_AUTO_SEED` | Set to `0` to start with an empty library. |

## Development

```bash
npm run dev          # API and client together
npm run lint         # client lint
npm test             # server and client tests
npm run build        # production client build
npm run seed         # add sample data if the library is empty
npm run seed:reset   # rebuild the local database and sample data
```

Open `/` for the woodland gate, then enter the workspace at `/app`.

Keyboard shortcuts from inside the workspace:

| Shortcut | Action |
| --- | --- |
| Ctrl or Cmd + K | Command palette |
| Ctrl or Cmd + N | New note |
| Ctrl or Cmd + Shift + N | New notebook |
| Ctrl or Cmd + Shift + T | New task |
| Ctrl or Cmd + Shift + L | Toggle day and night |
| Ctrl or Cmd + Shift + F | Focus mode |
| Ctrl or Cmd + \ | Collapse the sidebar |

## Testing

```bash
npm test
```

Server tests use a temporary database and cover notes, tasks, search, import, and persistence after reopen. Client tests cover theme resolution, greetings, and the calendar grid.

## Security notes

- The API binds to `127.0.0.1`.
- Helmet sets the usual browser security headers.
- CORS allows only `CLIENT_ORIGIN`.
- `.env` files and the SQLite database are gitignored.
- No third-party AI or paid asset service is called.
