const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getConfig() {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultConfig = {
      states: ['Todo', 'Work in Progress', 'Done'],
      swimlanes: ['Backlog'],
      labels: []
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

function saveConfig(config) {
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function getAllTasks() {
  ensureDataDir();
  const tasks = [];
  const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const taskFile = path.join(DATA_DIR, entry.name, 'task.md');
      if (fs.existsSync(taskFile)) {
        const task = readTask(entry.name);
        if (task) tasks.push(task);
      }
    }
  }
  return tasks;
}

function readTask(id) {
  const taskFile = path.join(DATA_DIR, id, 'task.md');
  if (!fs.existsSync(taskFile)) return null;
  const raw = fs.readFileSync(taskFile, 'utf8');
  const { data, content } = matter(raw);
  return { id, ...data, description: content.trim() };
}

function writeTask(id, taskData) {
  const taskDir = path.join(DATA_DIR, id);
  if (!fs.existsSync(taskDir)) fs.mkdirSync(taskDir, { recursive: true });
  const { description = '', ...frontmatter } = taskData;
  const fileContent = matter.stringify(description, frontmatter);
  fs.writeFileSync(path.join(taskDir, 'task.md'), fileContent);
}

function createTask(fields) {
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
  writeTask(id, taskData);
  appendHistory(id, { action: 'created', state: taskData.state, swimlane: taskData.swimlane, timestamp: now });
  return { id, ...taskData };
}

function updateTask(id, fields) {
  const existing = readTask(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const updated = { ...existing, ...fields, updated: now };
  const { id: _id, ...taskData } = updated;
  writeTask(id, taskData);
  appendHistory(id, { action: 'updated', state: updated.state, swimlane: updated.swimlane, timestamp: now });
  return updated;
}

function deleteTask(id) {
  const taskDir = path.join(DATA_DIR, id);
  if (!fs.existsSync(taskDir)) return false;
  fs.rmSync(taskDir, { recursive: true });
  return true;
}

function appendHistory(id, entry) {
  const historyFile = path.join(DATA_DIR, id, 'history.json');
  let history = [];
  if (fs.existsSync(historyFile)) {
    history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
  }
  history.push(entry);
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
}

function getHistory(id) {
  const historyFile = path.join(DATA_DIR, id, 'history.json');
  if (!fs.existsSync(historyFile)) return [];
  return JSON.parse(fs.readFileSync(historyFile, 'utf8'));
}

function saveImage(taskId, file) {
  const taskDir = path.join(DATA_DIR, taskId);
  if (!fs.existsSync(taskDir)) fs.mkdirSync(taskDir, { recursive: true });
  return file.filename;
}

function getTaskDir(taskId) {
  return path.join(DATA_DIR, taskId);
}

module.exports = {
  getConfig, saveConfig,
  getAllTasks, readTask, createTask, updateTask, deleteTask,
  getHistory, saveImage, getTaskDir, DATA_DIR
};
