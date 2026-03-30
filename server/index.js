const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3001;
const READ_ONLY = process.argv.includes('--read-only') || process.env.READ_ONLY === 'true';

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');

function initDataDir() {
  const boardsFile = path.join(DATA_DIR, 'boards.json');
  if (!fs.existsSync(boardsFile)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(boardsFile, JSON.stringify([{ id: 'default', name: 'My Board' }], null, 2));
    console.log('Created default boards.json');
  }

  const defaultConfigDir = path.join(DATA_DIR, 'default');
  const defaultConfigFile = path.join(defaultConfigDir, 'config.json');
  if (!fs.existsSync(defaultConfigFile)) {
    fs.mkdirSync(defaultConfigDir, { recursive: true });
    fs.writeFileSync(defaultConfigFile, JSON.stringify({
      states: ['Todo', 'In Progress', 'Done'],
      swimlanes: ['Backlog'],
      labels: []
    }, null, 2));
    console.log('Created default board config');
  }
}

if (!READ_ONLY) {
  initDataDir();
}

app.use(cors());
app.use(express.json());

if (READ_ONLY) {
  app.use((req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return res.status(403).json({ error: 'Server is running in read-only mode' });
    }
    next();
  });
}

// Boards CRUD
app.use('/api/boards', require('./routes/boards'));

// Per-board routes
app.use('/api/boards/:boardId/tasks', require('./routes/tasks'));
app.use('/api/boards/:boardId/states', require('./routes/states'));
app.use('/api/boards/:boardId/swimlanes', require('./routes/swimlanes'));

// MCP API
app.use('/api/mcp', require('./routes/mcp'));

// Serve built client in production
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  const mode = READ_ONLY ? ' [READ-ONLY]' : '';
  console.log(`SoloSprinter${mode} running on http://localhost:${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
  if (READ_ONLY) {
    console.log('Write operations are disabled — data directory is shared read-only.');
  }
});
