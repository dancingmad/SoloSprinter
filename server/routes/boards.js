const express = require('express');
const router = express.Router();
const { getBoards, createBoard, deleteBoard, renameBoard } = require('../utils/fileStore');

// GET all boards
router.get('/', (req, res) => {
  res.json(getBoards());
});

// POST create board
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const board = createBoard(name);
  res.status(201).json(board);
});

// PATCH rename board
router.patch('/:id', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const board = renameBoard(req.params.id, name);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  res.json(board);
});

// DELETE board
router.delete('/:id', (req, res) => {
  const ok = deleteBoard(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Board not found' });
  res.json({ success: true });
});

module.exports = router;
