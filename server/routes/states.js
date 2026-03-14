const express = require('express');
const router = express.Router({ mergeParams: true });
const { getConfig, saveConfig, getAllTasks } = require('../utils/fileStore');

// GET all states
router.get('/', (req, res) => {
  const config = getConfig(req.params.boardId);
  res.json(config.states);
});

// POST add state
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const config = getConfig(req.params.boardId);
  if (config.states.includes(name)) return res.status(409).json({ error: 'State already exists' });
  config.states.push(name);
  saveConfig(req.params.boardId, config);
  res.status(201).json(config.states);
});

// PUT reorder states
router.put('/reorder', (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order array required' });
  const config = getConfig(req.params.boardId);
  if (order.length !== config.states.length || !order.every(s => config.states.includes(s))) {
    return res.status(400).json({ error: 'Invalid order: must contain same states' });
  }
  config.states = order;
  saveConfig(req.params.boardId, config);
  res.json(config.states);
});

// DELETE state (only if no tasks use it)
router.delete('/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const config = getConfig(req.params.boardId);
  if (config.states.length <= 3) {
    return res.status(400).json({ error: 'Cannot delete: minimum 3 states required' });
  }
  const tasks = getAllTasks(req.params.boardId);
  if (tasks.some(t => t.state === name)) {
    return res.status(400).json({ error: 'Cannot delete: state has tasks' });
  }
  config.states = config.states.filter(s => s !== name);
  saveConfig(req.params.boardId, config);
  res.json(config.states);
});

module.exports = router;
