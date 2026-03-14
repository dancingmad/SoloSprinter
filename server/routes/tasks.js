const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getAllTasks, readTask, createTask, updateTask, deleteTask, getHistory, getTaskDir, DATA_DIR } = require('../utils/fileStore');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const taskDir = getTaskDir(req.params.id);
    if (!fs.existsSync(taskDir)) fs.mkdirSync(taskDir, { recursive: true });
    cb(null, taskDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `img_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// GET all tasks
router.get('/', (req, res) => {
  res.json(getAllTasks());
});

// GET single task
router.get('/:id', (req, res) => {
  const task = readTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// POST create task
router.post('/', (req, res) => {
  const task = createTask(req.body);
  res.status(201).json(task);
});

// PATCH update task
router.patch('/:id', (req, res) => {
  const task = updateTask(req.params.id, req.body);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// DELETE task
router.delete('/:id', (req, res) => {
  const ok = deleteTask(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Task not found' });
  res.json({ success: true });
});

// GET task history
router.get('/:id/history', (req, res) => {
  res.json(getHistory(req.params.id));
});

// POST upload image to task
router.post('/:id/images', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ filename: req.file.filename });
});

// GET list images for task
router.get('/:id/images', (req, res) => {
  const taskDir = getTaskDir(req.params.id);
  if (!fs.existsSync(taskDir)) return res.json([]);
  const files = fs.readdirSync(taskDir).filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));
  res.json(files);
});

// Serve image file
router.get('/:id/images/:filename', (req, res) => {
  const filePath = path.join(getTaskDir(req.params.id), req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Image not found' });
  res.sendFile(filePath);
});

module.exports = router;
