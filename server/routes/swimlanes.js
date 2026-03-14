const express = require('express');
const router = express.Router();
const { getConfig, saveConfig } = require('../utils/fileStore');

// GET all swimlanes
router.get('/', (req, res) => {
  const config = getConfig();
  res.json(config.swimlanes);
});

// POST add swimlane
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const config = getConfig();
  if (config.swimlanes.includes(name)) return res.status(409).json({ error: 'Swimlane already exists' });
  config.swimlanes.push(name);
  saveConfig(config);
  res.status(201).json(config.swimlanes);
});

// DELETE swimlane (only if no tasks use it)
router.delete('/:name', (req, res) => {
  const { getAllTasks } = require('../utils/fileStore');
  const name = decodeURIComponent(req.params.name);
  const config = getConfig();
  if (config.swimlanes.length <= 1) {
    return res.status(400).json({ error: 'Cannot delete: minimum 1 swimlane required' });
  }
  const tasks = getAllTasks();
  if (tasks.some(t => t.swimlane === name)) {
    return res.status(400).json({ error: 'Cannot delete: swimlane has tasks' });
  }
  config.swimlanes = config.swimlanes.filter(s => s !== name);
  saveConfig(config);
  res.json(config.swimlanes);
});

// GET all labels
router.get('/labels', (req, res) => {
  const config = getConfig();
  res.json(config.labels || []);
});

// POST add label
router.post('/labels', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const config = getConfig();
  if (!config.labels) config.labels = [];
  if (config.labels.includes(name)) return res.status(409).json({ error: 'Label already exists' });
  config.labels.push(name);
  saveConfig(config);
  res.status(201).json(config.labels);
});

// DELETE label (only if no tasks use it)
router.delete('/labels/:name', (req, res) => {
  const { getAllTasks } = require('../utils/fileStore');
  const name = decodeURIComponent(req.params.name);
  const config = getConfig();
  const tasks = getAllTasks();
  if (tasks.some(t => t.label === name)) {
    return res.status(400).json({ error: 'Cannot delete: label has tasks' });
  }
  config.labels = (config.labels || []).filter(l => l !== name);
  saveConfig(config);
  res.json(config.labels);
});

module.exports = router;
