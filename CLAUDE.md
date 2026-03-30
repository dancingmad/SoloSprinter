# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Development (runs server + client concurrently):**
```
npm run dev
```

**Production build and start:**
```
npm run build    # builds client to client/dist/
npm start        # builds client then starts server
```

**Server only / client only:**
```
npm run server   # node server/index.js on port 3001
npm run client   # vite dev server on port 5173
```

There are no tests in this project.

## Architecture

SoloSprinter is a personal Kanban board. The Express server both serves the REST API and (in production) the built React client. In development, Vite runs separately and proxies `/api` to port 3001.

### Data storage

All data lives in `data/` (or `$DATA_DIR`). There is no database — everything is plain files on disk.

- `data/boards.json` — list of boards `[{ id, name }]`
- `data/<boardId>/config.json` — board config with `states`, `swimlanes`, and `labels` arrays
- `data/<boardId>/<taskId>/task.md` — task stored as a markdown file with YAML front matter (title, state, swimlane, label, created, updated, priority)
- `data/<boardId>/<taskId>/history.json` — append-only JSON array of state change events
- `data/<boardId>/<taskId>/img_*.{png,jpg,...}` — images attached to a task

The `server/utils/fileStore.js` module is the single source of truth for all read/write operations. It uses `gray-matter` to parse/stringify the YAML front matter + markdown body of task files.

### Server routes

All routes are scoped under `/api`:
- `/api/boards` — CRUD for boards (`server/routes/boards.js`)
- `/api/boards/:boardId/tasks` — CRUD for tasks + image upload (`server/routes/tasks.js`)
- `/api/boards/:boardId/states` — add/delete/reorder columns (`server/routes/states.js`)
- `/api/boards/:boardId/swimlanes` — add/delete/reorder swimlanes and manage labels (`server/routes/swimlanes.js`)

### Client

`client/src/api.js` contains all fetch calls. The base URL is `/api` so it works both in dev (via Vite proxy) and production (same origin).

State is managed in `App.jsx` and passed down as props. The component tree is:
```
App.jsx              — board selection, all data state, all handlers
  BoardPicker.jsx    — list/create/rename/delete boards
  FilterBar.jsx      — label filter, date range, max-per-column, swimlane mode toggle
  KanbanBoard.jsx    — columns x rows grid with drag-and-drop (@dnd-kit)
    TaskCard.jsx     — individual task card
    TaskModal.jsx    — task detail/edit view with markdown editor (@uiw/react-md-editor)
```

### Swimlane vs label mode

The board has two display modes toggled in the UI:
- **Swimlane mode**: rows represent swimlanes; dragging a task between rows reassigns its `swimlane` field
- **Label mode**: rows represent labels; dragging a task between rows reassigns its `label` field

Both swimlanes and labels are string arrays in `config.json`.
