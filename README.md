# SoloSprinter

## Summary

This tool is intended for self management, but following the kanban principles of minimising waste by reducing work in progress. 
It allows to create tasks with labels to easily analyse what time was spent on and use it for further purposes like time reporting.
The tool is only intended to run locally and not for collaboration. It provides all data via API so synchronising it with collaboration tools like Jira is possible.
It follows the UI features of tools like Jira, Trello and Wekan, allowing to quickly edit the description, mark subtasks as done and move tasks from one state to the next.

## Setup

Download the tool, run the build and start it as a server. It will expose both UI and API via a configurable port. A data folder will be created, which source location can be adjusted, for example using the users local folders for easy backup of the data. 
Required tools are: node and npm

## Core features

There is no login, since it's single user only. All tasks are loaded from the data directory. Each task is stored as a folder. Tasks are stored as .md files, with images attached to the task also stored in the folder. Each task can have subtask like a todo list, but they are managed in the .md file using bracket formatting in a structured way.
Also the task status, label, basic timestamps like created and last udpate are also stored in the .md file. 
A history to make it easier for an external tool via API to understand how the task was handled is stored in a separate file as json, it's not needed to be readable by the user.

## UI

### States and Swimlanes

It should be possible to add new columns, which are states and remove them if there are no tasks in that column. The same for rows, which are swimlanes. 
There is a minimum of three columns, starting with the names "Todo", "Work in Progress" and "Done". And there is a minimum of 1 row wich is called swimlane. 
There is a toggle to switch the swimlane view showing the tasks per assigned swimlane or showing the tasks per assigned label. 
If a task is moved from one row to another, it either gets assigned a different swimlane if swimlane mode is enabled, or it gets assigned the lable that is assigned to the row it is dragged into. There is a filter option to hide all tasks per label or with a date filter as well as limiting the number of tasks shown per column (to avoid tasks piling up in the Done column, only recent tasks are relevant to be shown).


### Task

Can be created, edited and via drag and drop moved between states, swimlanes and labels as explained in the states and swimlanes section. 
Each task has an MD description that can be edited when clicking on the task. It is easily possible to add subtasks which are added as MD text using brackets [] to indicate here is a subtask which can be flagged as done by marking it with an [x].
Its also possible to drag and drop an image into a task to add some relevant images. The should be displayed inline in the task, but can be expanded full size when clicking on them. 

### API

All tasks are exposed via API to be editable via third party tools or an MCP. The available states/columns and rows/swimlanes/labels, are also avaialbe via API to be added or removed. 

