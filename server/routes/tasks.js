const express = require('express');
const router = express.Router({ mergeParams: true });
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getAllTasks, readTask, createTask, updateTask, deleteTask, getHistory, getTaskDir } = require('../utils/fileStore');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const taskDir = getTaskDir(req.params.boardId, req.params.id);
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
  res.json(getAllTasks(req.params.boardId));
});

// PATCH bulk update multiple tasks - must be before /:id
router.patch('/bulk', (req, res) => {
  const updates = req.body
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'Expected array' })
  const results = updates.map(({ id, ...fields }) =>
    updateTask(req.params.boardId, id, fields)
  ).filter(Boolean)
  res.json(results)
})

// PATCH bulk update priorities (no history entries) - must be before /:id
router.patch('/priorities', (req, res) => {
  const updates = req.body
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'Expected array' })
  const results = updates.map(({ id, priority }) =>
    updateTask(req.params.boardId, id, { priority }, true)
  ).filter(Boolean)
  res.json(results)
})

// GET single task
router.get('/:id', (req, res) => {
  const task = readTask(req.params.boardId, req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// POST create task
router.post('/', (req, res) => {
  const task = createTask(req.params.boardId, req.body);
  res.status(201).json(task);
});

// PATCH update task
router.patch('/:id', (req, res) => {
  const onlyPriority = Object.keys(req.body).length === 1 && 'priority' in req.body;
  const task = updateTask(req.params.boardId, req.params.id, req.body, onlyPriority);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// DELETE task
router.delete('/:id', (req, res) => {
  const ok = deleteTask(req.params.boardId, req.params.id);
  if (!ok) return res.status(404).json({ error: 'Task not found' });
  res.json({ success: true });
});

// GET task history
router.get('/:id/history', (req, res) => {
  res.json(getHistory(req.params.boardId, req.params.id));
});

// POST upload image to task
router.post('/:id/images', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ filename: req.file.filename });
});

// GET list images for task
router.get('/:id/images', (req, res) => {
  const taskDir = getTaskDir(req.params.boardId, req.params.id);
  if (!fs.existsSync(taskDir)) return res.json([]);
  const files = fs.readdirSync(taskDir).filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));
  res.json(files);
});

// DELETE image from task
router.delete('/:id/images/:filename', (req, res) => {
  const filePath = path.join(getTaskDir(req.params.boardId, req.params.id), req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Image not found' });
  fs.unlinkSync(filePath);
  res.json({ success: true });
});

// Serve image file
router.get('/:id/images/:filename', (req, res) => {
  const filePath = path.join(getTaskDir(req.params.boardId, req.params.id), req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Image not found' });
  res.sendFile(filePath);
});

module.exports = router;
