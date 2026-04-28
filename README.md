# SoloSprinter

## Summary

SoloSprinter is a personal Kanban board built around the principle of minimising waste by reducing work in progress. It lets you create and manage tasks with labels so you can easily analyse where time was spent — useful for time reporting or retrospectives.

The tool is designed to run locally without a database. All data is stored as plain files on disk, making backups trivial and enabling sync with collaboration tools like Jira via the REST API or MCP server. It follows the UI conventions of tools like Jira, Trello and Wekan — quick inline editing, drag-and-drop, markdown descriptions with subtasks, and image attachments.

---

## Setup

```bash
git clone <repo>
cd SoloSprinter
npm install
npm run dev        # starts both the Express server (port 3001) and the Vite dev server (port 5173)
```

For production:

```bash
npm run build      # builds the React client into client/dist/
npm start          # serves UI + API from port 3001
```

**Requirements:** Node.js and npm. No database needed.

The data directory is created automatically on first start. Its location defaults to `./data/` and can be overridden with the `DATA_DIR` environment variable — useful for pointing it at a folder that is already backed up (e.g. a synced cloud folder).

---

## Core Features

### Multiple Boards

The board picker lets you create, rename and delete boards. Each board has its own set of states (columns), swimlanes (rows), labels and tasks. Boards are independent — you might use one per project, team or time horizon.

### Kanban Board

The default view shows states as columns and swimlanes (or labels) as rows. Tasks can be created by clicking any empty cell and are immediately saved once a title is entered — no save button needed. Drag and drop moves tasks between columns and rows, updating state, swimlane or label automatically.

Columns and rows can be added and removed via `+` / `−` buttons. A minimum of three columns (`Todo`, `Work in Progress`, `Done`) and one row (`Backlog`) is enforced. Columns and rows can also be reordered by drag and drop.

There is a toggle to switch between **swimlane mode** and **label mode**:
- **Swimlane mode** — rows represent swimlanes; dragging between rows reassigns the swimlane.
- **Label mode** — rows represent labels; dragging between rows reassigns the label.

### Roadmap View

The roadmap view shows tasks on a timeline grouped by swimlane. Each task is rendered as a horizontal bar spanning the months assigned to it. The timeline is navigable by quarter, with colour-coded quarters for quick orientation. Tasks can be clicked to open the full editor. Roadmap month spans are set per task in the task detail view and are stored as an array of `YYYY-MM` strings.

### List View

The list view shows all tasks in a flat, sortable table grouped by swimlane. It provides a quick overview across states without the spatial layout of the Kanban board. Tasks can be opened and edited inline from the list.

### Tasks

Each task has:
- **Title** — edited inline on the card or in the detail modal
- **Markdown description** — full MD editor with live preview; supports subtask checkboxes (`[ ]` / `[x]`), code blocks, tables etc.
- **State, swimlane, label, priority** — managed via drag-and-drop or the detail modal
- **Roadmap months** — optional month range for the roadmap view
- **Images** — drag and drop images directly onto a task; they are displayed inline and can be expanded to full size

### Filtering

The filter bar lets you:
- Filter by label
- Filter by date (hide tasks older than N days)
- Limit the number of tasks shown per column (useful to keep the Done column from overflowing)

### Simple Collaboration via Automatic Refresh

The UI polls the server every 5 seconds and silently refreshes data if anything has changed. This makes it practical for lightweight collaboration scenarios — for example, running SoloSprinter on a shared server where multiple people have the board open.

For a stricter read-only setup, the server can be started in **read-only mode**, which disables all write operations:

```bash
node server/index.js --read-only
# or
READ_ONLY=true npm start
```

This is useful for displaying a live mirror of a board (e.g. on a shared screen or dashboard) without risk of accidental edits.

---

## AI Integration

### MCP Server

SoloSprinter exposes a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server at `/api/mcp`. Any MCP-compatible client (Claude Desktop, Cursor, etc.) can connect to it and read/create/update/delete boards and tasks using natural language.

Add it to your MCP client config:

```json
{
  "mcpServers": {
    "solosprinter": {
      "url": "http://localhost:3001/api/mcp"
    }
  }
}
```

### CLI Skill (`ss`)

A command-line interface lives in `cli/ss.js`. It is also packaged as a **pi skill** (`cli/SKILL.md`) so that AI agents running inside [pi](https://github.com/mariozechner/pi) can operate SoloSprinter boards directly.

**Setup:**

```bash
cd cli && npm install
node cli/ss.js --help
```

**Examples:**

```bash
# List all boards
node cli/ss.js boards list

# Create a task
node cli/ss.js tasks create <boardId> --title "Fix login bug" --state "Todo" --label "bug"

# Move a task to Done
node cli/ss.js tasks update <boardId> <taskId> --state "Done"

# Sync from local to a remote instance
node cli/ss.js sync local prod --dry-run
node cli/ss.js sync local prod
```

The CLI supports multiple named **instances** (e.g. `local`, `prod`, `staging`) stored in `~/.solosprinter-cli.json`, and a `--json` flag for scripted / agent use. See `cli/SKILL.md` for the full command reference.

---

## Data Storage

No database. All data lives in `data/` (or `$DATA_DIR`):

| Path | Contents |
|------|----------|
| `data/boards.json` | List of boards `[{ id, name }]` |
| `data/<boardId>/config.json` | Board config: `states`, `swimlanes`, `labels` arrays |
| `data/<boardId>/<taskId>/task.md` | Task as Markdown with YAML front matter (title, state, swimlane, label, priority, roadmapMonths, created, updated) |
| `data/<boardId>/<taskId>/history.json` | Append-only log of state-change events |
| `data/<boardId>/<taskId>/img_*` | Images attached to the task |

---

## API

All data is accessible via a REST API under `/api`. This makes it straightforward to sync with external tools like Jira or build custom integrations.

| Resource | Endpoints |
|----------|-----------|
| Boards | `GET/POST /api/boards`, `PUT/DELETE /api/boards/:id` |
| Tasks | `GET/POST /api/boards/:boardId/tasks`, `GET/PUT/DELETE /api/boards/:boardId/tasks/:taskId` |
| States | `GET/POST /api/boards/:boardId/states`, `DELETE/PUT` for remove/reorder |
| Swimlanes & Labels | `GET/POST /api/boards/:boardId/swimlanes`, plus label sub-routes |

---

## Tech Stack

| Need | Decision |
|------|----------|
| Server | Express.js |
| Frontend framework | React (via Vite) |
| UI component library | Ant Design (AntD) |
| Drag & drop | @dnd-kit/core + @dnd-kit/sortable |
| Markdown editor | @uiw/react-md-editor |
| MD file parsing | gray-matter + marked |
| Image upload | HTML5 File API + multer (Express) |
| MCP server | @modelcontextprotocol/sdk |

## Project Structure

```
SoloSprinter/
├── server/
│   ├── index.js              # Express entry point (supports --read-only flag)
│   ├── routes/
│   │   ├── boards.js         # Board CRUD
│   │   ├── tasks.js          # Task CRUD + image upload
│   │   ├── states.js         # Column management
│   │   ├── swimlanes.js      # Row + label management
│   │   └── mcp.js            # MCP server endpoint
│   └── utils/
│       └── fileStore.js      # All file I/O (single source of truth)
├── client/
│   └── src/
│       ├── App.jsx            # Board selection, all state, polling loop
│       ├── api.js             # All fetch calls
│       └── components/
│           ├── BoardPicker.jsx    # Board list / create / rename / delete
│           ├── FilterBar.jsx      # Filters + view mode toggles
│           ├── KanbanBoard.jsx    # Columns × rows grid with drag-and-drop
│           ├── RoadmapBoard.jsx   # Timeline view by quarter / month
│           ├── ListView.jsx       # Flat table view grouped by swimlane
│           ├── TaskCard.jsx       # Task box on the board
│           └── TaskModal.jsx      # Task detail / MD editor
├── cli/
│   ├── ss.js                 # CLI tool (multi-instance, --json flag)
│   └── SKILL.md              # pi agent skill definition
├── data/                     # Auto-created at runtime
└── package.json
```
