const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const BOARDS_FILE = path.join(DATA_DIR, 'boards.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ── Boards ────────────────────────────────────────────────────────────────────

function getBoards() {
  ensureDataDir();
  if (!fs.existsSync(BOARDS_FILE)) {
    // Migrate: if there is an existing config.json at root, treat it as a default board
    const legacyConfig = path.join(DATA_DIR, 'config.json');
    if (fs.existsSync(legacyConfig)) {
      const defaultBoard = { id: 'default', name: 'My Board' };
      const boards = [defaultBoard];
      fs.writeFileSync(BOARDS_FILE, JSON.stringify(boards, null, 2));
      // Move legacy config + task folders into data/default/
      const boardDir = path.join(DATA_DIR, 'default');
      if (!fs.existsSync(boardDir)) fs.mkdirSync(boardDir);
      // Move config.json
      fs.renameSync(legacyConfig, path.join(boardDir, 'config.json'));
      // Move task folders (uuid-named directories)
      const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== 'default') {
          fs.renameSync(path.join(DATA_DIR, entry.name), path.join(boardDir, entry.name));
        }
      }
      return boards;
    }
    const boards = [];
    fs.writeFileSync(BOARDS_FILE, JSON.stringify(boards, null, 2));
    return boards;
  }
  return JSON.parse(fs.readFileSync(BOARDS_FILE, 'utf8'));
}

function saveBoards(boards) {
  ensureDataDir();
  fs.writeFileSync(BOARDS_FILE, JSON.stringify(boards, null, 2));
}

function createBoard(name) {
  const boards = getBoards();
  const id = uuidv4();
  const board = { id, name };
  boards.push(board);
  saveBoards(boards);
  const boardDir = path.join(DATA_DIR, id);
  if (!fs.existsSync(boardDir)) fs.mkdirSync(boardDir, { recursive: true });
  return board;
}

function deleteBoard(id) {
  const boards = getBoards();
  const idx = boards.findIndex(b => b.id === id);
  if (idx === -1) return false;
  boards.splice(idx, 1);
  saveBoards(boards);
  const boardDir = path.join(DATA_DIR, id);
  if (fs.existsSync(boardDir)) fs.rmSync(boardDir, { recursive: true });
  return true;
}

function renameBoard(id, name) {
  const boards = getBoards();
  const board = boards.find(b => b.id === id);
  if (!board) return null;
  board.name = name;
  saveBoards(boards);
  return board;
}

// ── Board config (states / swimlanes / labels) ────────────────────────────────

function getBoardDir(boardId) {
  return path.join(DATA_DIR, boardId);
}

function getConfigFile(boardId) {
  return path.join(DATA_DIR, boardId, 'config.json');
}

function getConfig(boardId) {
  const boardDir = getBoardDir(boardId);
  if (!fs.existsSync(boardDir)) fs.mkdirSync(boardDir, { recursive: true });
  const configFile = getConfigFile(boardId);
  if (!fs.existsSync(configFile)) {
    const defaultConfig = {
      states: ['Todo', 'Work in Progress', 'Done'],
      swimlanes: ['Backlog'],
      labels: []
    };
    fs.writeFileSync(configFile, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  return JSON.parse(fs.readFileSync(configFile, 'utf8'));
}

function saveConfig(boardId, config) {
  const boardDir = getBoardDir(boardId);
  if (!fs.existsSync(boardDir)) fs.mkdirSync(boardDir, { recursive: true });
  fs.writeFileSync(getConfigFile(boardId), JSON.stringify(config, null, 2));
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

function getTaskDir(boardId, taskId) {
  return path.join(DATA_DIR, boardId, taskId);
}

function getAllTasks(boardId) {
  const boardDir = getBoardDir(boardId);
  if (!fs.existsSync(boardDir)) return [];
  const tasks = [];
  const entries = fs.readdirSync(boardDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const taskFile = path.join(boardDir, entry.name, 'task.md');
      if (fs.existsSync(taskFile)) {
        const task = readTask(boardId, entry.name);
        if (task) tasks.push(task);
      }
    }
  }
  return tasks;
}

function readTask(boardId, id) {
  const taskFile = path.join(DATA_DIR, boardId, id, 'task.md');
  if (!fs.existsSync(taskFile)) return null;
  const raw = fs.readFileSync(taskFile, 'utf8');
  const { data, content } = matter(raw);
  return { id, ...data, description: content.trim() };
}

function writeTask(boardId, id, taskData) {
  const taskDir = path.join(DATA_DIR, boardId, id);
  if (!fs.existsSync(taskDir)) fs.mkdirSync(taskDir, { recursive: true });
  const { description = '', ...frontmatter } = taskData;
  const fileContent = matter.stringify(description, frontmatter);
  fs.writeFileSync(path.join(taskDir, 'task.md'), fileContent);
}

function createTask(boardId, fields) {
  const id = uuidv4();
  const now = new Date().toISOString();
  const taskData = {
    title: fields.title || '',
    state: fields.state || 'Todo',
    swimlane: fields.swimlane || 'Backlog',
    label: fields.label || '',
    created: now,
    updated: now,
    description: fields.description || ''
  };
  writeTask(boardId, id, taskData);
  appendHistory(boardId, id, { action: 'created', state: taskData.state, swimlane: taskData.swimlane, timestamp: now });
  return { id, ...taskData };
}

function updateTask(boardId, id, fields, skipHistory = false) {
  const existing = readTask(boardId, id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const updated = { ...existing, ...fields, updated: now };
  const { id: _id, ...taskData } = updated;
  writeTask(boardId, id, taskData);
  if (!skipHistory) {
    appendHistory(boardId, id, { action: 'updated', state: updated.state, swimlane: updated.swimlane, timestamp: now });
  }
  return updated;
}

function deleteTask(boardId, id) {
  const taskDir = path.join(DATA_DIR, boardId, id);
  if (!fs.existsSync(taskDir)) return false;
  fs.rmSync(taskDir, { recursive: true });
  return true;
}

function appendHistory(boardId, id, entry) {
  const historyFile = path.join(DATA_DIR, boardId, id, 'history.json');
  let history = [];
  if (fs.existsSync(historyFile)) {
    history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
  }
  history.push(entry);
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
}

function getHistory(boardId, id) {
  const historyFile = path.join(DATA_DIR, boardId, id, 'history.json');
  if (!fs.existsSync(historyFile)) return [];
  return JSON.parse(fs.readFileSync(historyFile, 'utf8'));
}

module.exports = {
  getBoards, saveBoards, createBoard, deleteBoard, renameBoard,
  getConfig, saveConfig,
  getAllTasks, readTask, createTask, updateTask, deleteTask,
  getHistory, getTaskDir, DATA_DIR
};
