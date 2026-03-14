# SoloSprinter

## Summary

This tool is intended for self management, but following the kanban principles of minimising waste by reducing work in progress. 
It allows to create tasks with labels to easily analyse what time was spent on and use it for further purposes like time reporting.
The tool is only intended to run locally and not for collaboration. It provides all data via API so synchronising it with collaboration tools like Jira is possible.
It follows the UI features of tools like Jira, Trello and Wekan, allowing to quickly edit the description, mark subtasks as done and move tasks from one state to the next.

## Setup

Download the tool, run npm dev, it will build the client and run the server serving the client. 
It will expose both UI and API via a configurable port. A data folder will be created, which source location can be adjusted, for example using the users local folders for easy backup of the data. 
Required tools are: node and npm

## Core features

There is no login, since it's single user only. All tasks are loaded from the data directory. Each task is stored as a folder. Tasks are stored as .md files, with images attached to the task also stored in the folder. Each task can have subtask like a todo list, but they are managed in the .md file using bracket formatting in a structured way.
Also the task status, label, basic timestamps like created and last udpate are also stored in the .md file. 
A history to make it easier for an external tool via API to understand how the task was handled is stored in a separate file as json, it's not needed to be readable by the user.

## UI

### States and Swimlanes

The whole UI is based on a Kanban board, it will show the states as columns and the swimlanes as rows. 
To minimise the UI creating tasks is done by clicking in a cell in the board. The task is created with empty title and description. 
Once the title has been edited, the task will be saved. Any changes to the title or description will be updated automatically, there is no save button needed.  
The task will immediately show as a box in the cell and has the state of the column and the swimlane of the row assigned to the task. 
If the label toggle was enabled it will use the label assigned to the row.

It should be possible to add new columns, which are states and remove them if there are no tasks in that column. The same for rows, which are swimlanes. 
There is a + button next to the coluns and below the rows to add and a - button to delete rows or columns (only if empty).  

There is a minimum of three columns, starting with the names "Todo", "Work in Progress" and "Done". And of course starting with a single row, the "Backlog" row.
There is a toggle to switch the swimlane view showing the tasks per assigned swimlane or showing the tasks per assigned label. 
If a task is moved from one row to another, it either gets assigned a different swimlane if swimlane mode is enabled, or it gets assigned the lable that is assigned to the row it is dragged into. There is a filter option to hide all tasks per label or with a date filter as well as limiting the number of tasks shown per column (to avoid tasks piling up in the Done column, only recent tasks are relevant to be shown).


### Task

Can be created, edited and via drag and drop moved between states, swimlanes and labels as explained in the states and swimlanes section. 
Each task has an MD description that can be edited when clicking on the task. The MD view is rendered when the task is not in edit mode. 100% of the width of the cell is used. 
It is easily possible to add subtasks which are added as MD text using brackets [] to indicate here is a subtask which can be flagged as done by marking it with an [x].
Its also possible to drag and drop an image into a task to add some relevant images. The should be displayed inline in the task, but can be expanded full size when clicking on them. 

### API

All tasks are exposed via API to be editable via third party tools or an MCP. The available states/columns and rows/swimlanes/labels, are also avaialbe via API to be added or removed. 

## Tech Stack

### Key Technology Decisions

| Need | Decision |
|---|---|
| Server | Express.js |
| Frontend framework | React (via Vite) |
| UI component library | Ant Design (AntD) |
| Drag & drop | @dnd-kit/core + @dnd-kit/sortable |
| Markdown editor | @uiw/react-md-editor |
| MD file parsing | gray-matter + marked |
| Image upload | HTML5 File API + multer (Express) |

### Project Structure

```
SoloSprinter/
├── server/
│   ├── index.js          # Express app entry point
│   ├── routes/
│   │   ├── tasks.js      # CRUD for tasks
│   │   ├── states.js     # Columns (Todo, WIP, Done, ...)
│   │   └── swimlanes.js  # Rows / labels
│   └── utils/
│       ├── fileStore.js  # Read/write .md files & JSON history
│       └── mdParser.js   # Parse subtasks, metadata from .md
├── client/               # Vite + React app
│   ├── src/
│   │   ├── components/
│   │   │   ├── KanbanBoard.jsx   # Main board (columns × rows grid)
│   │   │   ├── TaskCard.jsx      # Individual task box
│   │   │   ├── TaskModal.jsx     # Task detail / edit view (MD editor)
│   │   │   └── FilterBar.jsx     # Label/date filters + toggle
│   │   └── App.jsx
│   └── package.json
├── data/                 # Task folders (auto-created at runtime)
└── package.json          # Root: runs server + serves built client
```

