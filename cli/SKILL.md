---
name: solosprinter
description: Read, create, update, or delete tasks and boards in a SoloSprinter Kanban board. Use when the user asks about SoloSprinter boards, tasks, states, swimlanes, labels, or syncing between SoloSprinter instances.
---

# SoloSprinter CLI Skill

Use this skill when the user asks you to read, create, update or delete anything in a SoloSprinter Kanban board (boards, tasks, states, swimlanes, labels, images, or syncing between instances).

## Setup

The CLI lives at `cli/ss.js` inside the SoloSprinter project root.
Install dependencies once before first use:

```bash
cd /path/to/SoloSprinter/cli && npm install
```

Run every command as:

```bash
node /path/to/SoloSprinter/cli/ss.js <command> [options]
```

Or, if installed globally / symlinked, just `ss <command>`.

Instance configuration is stored at `~/.solosprinter-cli.json` (overridable with `SS_CONFIG` env var).

---

## Global flags

| Flag | Short | Description |
|------|-------|-------------|
| `--instance <alias>` | `-i` | Override the default instance for this command |
| `--json` | | Output raw JSON (useful for piping / parsing in scripts) |

---

## Instance management

Instances are named aliases pointing to SoloSprinter server URLs. **Maximum 3 instances.**

### `ss instance list`
List all configured instances. Shows alias, URL, and which one is the default.

### `ss instance add <alias> <url>`
Add or update a named instance.
- `alias` — short name, e.g. `local`, `prod`, `staging`
- `url`   — base URL of the server, e.g. `http://localhost:3001` or `https://my-server.com`

**Examples:**
```bash
ss instance add local   http://localhost:3001
ss instance add prod    https://sprinter.example.com
ss instance add staging http://staging.internal:3001
```

### `ss instance remove <alias>`
Remove a named instance. If it was the default, the next remaining instance becomes default.

### `ss instance use <alias>`
Set the default instance (used when `-i` is not specified).

```bash
ss instance use prod
```

---

## Boards

A board is the top-level container. Each board has its own set of states, swimlanes, labels, and tasks.

Board IDs are UUIDs returned by `ss boards list`.

### `ss boards list`
List all boards.

### `ss boards create <name>`
Create a new board. Returns `{ id, name }`.

### `ss boards rename <boardId> <newName>`
Rename a board.

### `ss boards delete <boardId>`
Permanently delete a board and **all** its tasks. Irreversible.

---

## Tasks

Tasks live inside a board. Each task has:
- `id` — UUID
- `title` — string
- `state` — column name (must match a state defined on the board)
- `swimlane` — row name (must match a swimlane defined on the board)
- `label` — optional string (must match a label defined on the board, or be empty)
- `description` — markdown body
- `priority` — integer (lower = higher up within its column; optional)
- `roadmapMonths` — array of `YYYY-MM` strings for roadmap spans (optional)
- `created`, `updated` — ISO timestamps

### `ss tasks list <boardId>`
List all tasks on a board.

**Optional filters (combinable):**
- `--state <name>` — only tasks in this column
- `--swimlane <name>` — only tasks in this swimlane
- `--label <name>` — only tasks with this label

```bash
ss tasks list <boardId>
ss tasks list <boardId> --state "In Progress"
ss tasks list <boardId> --swimlane "Sprint 1" --label "bug"
```

### `ss tasks get <boardId> <taskId>`
Get a single task including its full markdown description.
Use the full UUID for `taskId` (the table view truncates IDs).

### `ss tasks create <boardId>`
Create a new task.

| Option | Required | Description |
|--------|----------|-------------|
| `--title <title>` | **yes** | Task title |
| `--state <name>` | no | Column; defaults to the first state on the board |
| `--swimlane <name>` | no | Row; defaults to the first swimlane on the board |
| `--label <name>` | no | Primary label |
| `--description <text>` | no | Markdown body |
| `--priority <n>` | no | Integer sort priority |
| `--roadmap-months <months>` | no | Comma-separated `YYYY-MM` values, e.g. `2026-03,2026-04` |

```bash
ss tasks create <boardId> --title "Fix login bug" --state "Todo" --swimlane "Backend" --label "bug"
ss tasks create <boardId> --title "Q3 Planning" --roadmap-months "2026-07,2026-08,2026-09"
```

### `ss tasks update <boardId> <taskId>`
Update one or more fields. Only provide options you want to change.

| Option | Description |
|--------|-------------|
| `--title <title>` | New title |
| `--state <name>` | Move to a different column |
| `--swimlane <name>` | Move to a different swimlane |
| `--label <name>` | Change primary label |
| `--description <text>` | Replace markdown body |
| `--priority <n>` | New sort priority |
| `--roadmap-months <months>` | Replace roadmap months (comma-separated `YYYY-MM`) |

```bash
ss tasks update <boardId> <taskId> --state "Done"
ss tasks update <boardId> <taskId> --title "Renamed" --label "feature"
ss tasks update <boardId> <taskId> --description "Updated notes here"
```

### `ss tasks delete <boardId> <taskId>`
Permanently delete a task. Irreversible.

### `ss tasks history <boardId> <taskId>`
Show the state-change history of a task (timestamp, action, state, swimlane).

### `ss tasks priorities <boardId>`
Bulk-update task priorities without creating history entries.
- `--updates <json>` — JSON array of `{id, priority}` objects

```bash
ss tasks priorities <boardId> --updates '[{"id":"<taskId1>","priority":1},{"id":"<taskId2>","priority":2}]'
```

---

## Images

Images are files attached to a task.

### `ss images list <boardId> <taskId>`
List image filenames attached to a task. Also prints the full URL for each image.

### `ss images upload <boardId> <taskId> <filePath>`
Upload a local image file and attach it to a task.

```bash
ss images upload <boardId> <taskId> ./screenshot.png
```

### `ss images delete <boardId> <taskId> <filename>`
Delete an image from a task by its filename (as returned by `ss images list`).

---

## States (columns)

States define the columns of the Kanban board. Minimum 3 states must exist at all times. A state cannot be deleted if any task uses it.

### `ss states list <boardId>`
List all states in order.

### `ss states add <boardId> <name>`
Add a new state column.

### `ss states reorder <boardId> <name1> <name2> ...`
Reorder states. **All existing state names must be provided** in the new desired order.

```bash
ss states reorder <boardId> "Todo" "In Progress" "Review" "Done"
```

### `ss states delete <boardId> <name>`
Delete a state. Fails if any task is in that state or if fewer than 3 states would remain.

---

## Swimlanes

Swimlanes define the row groups of the board. Minimum 1 swimlane must exist. A swimlane cannot be deleted if any task uses it.

### `ss swimlanes list <boardId>`
List all swimlanes in order.

### `ss swimlanes add <boardId> <name>`
Add a new swimlane.

### `ss swimlanes reorder <boardId> <name1> <name2> ...`
Reorder swimlanes. All existing names must be provided.

```bash
ss swimlanes reorder <boardId> "Sprint 1" "Sprint 2" "Backlog"
```

### `ss swimlanes delete <boardId> <name>`
Delete a swimlane. Fails if any task uses it or only 1 swimlane would remain.

---

## Labels

Labels are optional tags on tasks. A label cannot be deleted if any task uses it.

### `ss labels list <boardId>`
List all labels defined on a board.

### `ss labels add <boardId> <name>`
Add a new label.

### `ss labels delete <boardId> <name>`
Delete a label. Fails if any task has that label.

---

## Sync

Sync boards and tasks from one instance to another. This is a **one-way, source-wins** operation:
- Boards are matched by **name**; missing boards on the destination are created.
- Board config (states, swimlanes, labels) is merged: items present on source but missing on destination are added (nothing is deleted from destination).
- Tasks are matched by **title**; new tasks are created, changed tasks are updated, identical tasks are left alone.
- Tasks on the destination that have no matching title on the source are **left untouched**.

### `ss sync <fromAlias> <toAlias>`

| Option | Description |
|--------|-------------|
| `--board <name>` | Sync only the board with this name |
| `--dry-run` | Preview what would happen without making any changes |

```bash
# Preview syncing everything from local to prod
ss sync local prod --dry-run

# Actually sync a specific board
ss sync local prod --board "My Project"

# Sync everything
ss sync local prod
```

---

## Typical agent workflow

1. **Discover** — always start by listing instances and boards:
   ```bash
   ss instance list
   ss boards list
   # or for a specific instance:
   ss -i prod boards list
   ```

2. **Inspect a board** — get its config and tasks:
   ```bash
   ss states list <boardId>
   ss swimlanes list <boardId>
   ss labels list <boardId>
   ss tasks list <boardId>
   ```

3. **Read a task** — use the full UUID:
   ```bash
   ss tasks get <boardId> <taskId>
   ```

4. **Create / update** — supply only the fields you know; the server applies defaults:
   ```bash
   ss tasks create <boardId> --title "New feature" --state "Todo"
   ss tasks update <boardId> <taskId> --state "Done"
   ```

5. **Sync** — always do a dry-run first:
   ```bash
   ss sync local prod --dry-run
   ss sync local prod
   ```

---

## Output modes

- **Default** — human-readable ASCII tables and status messages
- **`--json`** — raw JSON, suitable for `jq` or scripted parsing

```bash
ss --json boards list | jq '.[].name'
ss --json tasks list <boardId> --state "Todo" | jq 'length'
```
