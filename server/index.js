const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Boards CRUD
app.use('/api/boards', require('./routes/boards'));

// Per-board routes
app.use('/api/boards/:boardId/tasks', require('./routes/tasks'));
app.use('/api/boards/:boardId/states', require('./routes/states'));
app.use('/api/boards/:boardId/swimlanes', require('./routes/swimlanes'));

// Serve built client in production
const clientDist = path.join(__dirname, '../client/dist');
const fs = require('fs');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`SoloSprinter running on http://localhost:${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});
