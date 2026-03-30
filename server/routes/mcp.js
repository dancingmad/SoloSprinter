const express = require('express');
const router = express.Router({ mergeParams: true });
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');
const {
  getBoards, createBoard,
  getAllTasks, readTask, createTask, updateTask, deleteTask,
  getConfig,
} = require('../utils/fileStore');

function buildMcpServer() {
  const server = new McpServer({ name: 'SoloSprinter', version: '1.0.0' });

  // ── Discovery tools ────────────────────────────────────────────────────────

  server.tool(
    'list_boards',
    'List all boards. Call this first to find board IDs needed by other tools.',
    {},
    async () => ({ content: [{ type: 'text', text: JSON.stringify(getBoards()) }] })
  );

  server.tool(
    'list_states',
    'List the workflow columns (states) for a board, e.g. ["Todo","In Progress","Done"].',
    { boardId: z.string().describe('Board ID from list_boards') },
    async ({ boardId }) => {
      const config = getConfig(boardId);
      return { content: [{ type: 'text', text: JSON.stringify(config.states) }] };
    }
  );

  server.tool(
    'list_swimlanes',
    'List the swimlane row groups for a board.',
    { boardId: z.string().describe('Board ID from list_boards') },
    async ({ boardId }) => {
      const config = getConfig(boardId);
      return { content: [{ type: 'text', text: JSON.stringify(config.swimlanes) }] };
    }
  );

  server.tool(
    'list_labels',
    'List the labels defined for a board.',
    { boardId: z.string().describe('Board ID from list_boards') },
    async ({ boardId }) => {
      const config = getConfig(boardId);
      return { content: [{ type: 'text', text: JSON.stringify(config.labels || []) }] };
    }
  );

  // ── Task read tools ────────────────────────────────────────────────────────

  server.tool(
    'list_tasks',
    'List tasks for a board. All filter parameters are optional and can be combined. ' +
    'Use list_states / list_swimlanes / list_labels first to know valid filter values.',
    {
      boardId: z.string().describe('Board ID from list_boards'),
      state: z.string().optional().describe('Filter by column/state name (exact match)'),
      swimlane: z.string().optional().describe('Filter by swimlane name (exact match)'),
      label: z.string().optional().describe('Filter by label (matches primary label or extraLabels)'),
      days_old: z.number().optional().describe('Only tasks created more than this many days ago'),
      roadmap_month_from: z.string().optional().describe(
        'Roadmap filter: include tasks whose span ends at or after this month (YYYY-MM). ' +
        'Combine with roadmap_month_to for range overlap.'
      ),
      roadmap_month_to: z.string().optional().describe(
        'Roadmap filter: include tasks whose span starts at or before this month (YYYY-MM). ' +
        'Combine with roadmap_month_from for range overlap.'
      ),
    },
    async ({ boardId, state, swimlane, label, days_old, roadmap_month_from, roadmap_month_to }) => {
      let tasks = getAllTasks(boardId);

      if (state)    tasks = tasks.filter(t => t.state === state);
      if (swimlane) tasks = tasks.filter(t => t.swimlane === swimlane);
      if (label)    tasks = tasks.filter(t => t.label === label || (t.extraLabels || []).includes(label));

      if (days_old != null) {
        const cutoff = new Date(Date.now() - days_old * 86_400_000).toISOString();
        tasks = tasks.filter(t => t.created < cutoff);
      }

      if (roadmap_month_from) {
        // keep tasks whose roadmap span ends at or after the filter start
        tasks = tasks.filter(t => {
          const months = t.roadmapMonths;
          if (!months || months.length === 0) return false;
          return months[months.length - 1] >= roadmap_month_from;
        });
      }

      if (roadmap_month_to) {
        // keep tasks whose roadmap span starts at or before the filter end
        tasks = tasks.filter(t => {
          const months = t.roadmapMonths;
          if (!months || months.length === 0) return false;
          return months[0] <= roadmap_month_to;
        });
      }

      return { content: [{ type: 'text', text: JSON.stringify(tasks) }] };
    }
  );

  server.tool(
    'get_task',
    'Get a single task by ID, including its full description.',
    {
      boardId: z.string().describe('Board ID from list_boards'),
      taskId: z.string().describe('Task ID from list_tasks'),
    },
    async ({ boardId, taskId }) => {
      const task = readTask(boardId, taskId);
      if (!task) throw new Error(`Task ${taskId} not found on board ${boardId}`);
      return { content: [{ type: 'text', text: JSON.stringify(task) }] };
    }
  );

  // ── Board mutation tools ───────────────────────────────────────────────────

  server.tool(
    'create_board',
    'Create a new board.',
    { name: z.string().describe('Display name for the new board') },
    async ({ name }) => {
      const board = createBoard(name);
      return { content: [{ type: 'text', text: JSON.stringify(board) }] };
    }
  );

  // ── Task mutation tools ────────────────────────────────────────────────────

  server.tool(
    'create_task',
    'Create a new task on a board. Call list_states and list_swimlanes first to pick valid values.',
    {
      boardId: z.string().describe('Board ID from list_boards'),
      title: z.string().describe('Task title'),
      state: z.string().optional().describe('Column/state name. Defaults to the first state on the board.'),
      swimlane: z.string().optional().describe('Swimlane name. Defaults to the first swimlane on the board.'),
      label: z.string().optional().describe('Primary label'),
      description: z.string().optional().describe('Task body in markdown'),
      roadmapMonths: z.array(z.string()).optional().describe(
        'Months this task spans on the roadmap, as YYYY-MM strings, e.g. ["2026-03","2026-04","2026-05"]'
      ),
    },
    async ({ boardId, title, state, swimlane, label, description, roadmapMonths }) => {
      const config = getConfig(boardId);
      const task = createTask(boardId, {
        title,
        state:         state    || config.states[0]    || 'Todo',
        swimlane:      swimlane || config.swimlanes[0] || 'Backlog',
        label:         label       || '',
        description:   description || '',
        roadmapMonths: roadmapMonths || [],
      });
      return { content: [{ type: 'text', text: JSON.stringify(task) }] };
    }
  );

  server.tool(
    'update_task',
    'Update one or more fields of an existing task. Only supply the fields you want to change.',
    {
      boardId:       z.string().describe('Board ID from list_boards'),
      taskId:        z.string().describe('Task ID from list_tasks'),
      title:         z.string().optional().describe('New title'),
      state:         z.string().optional().describe('Move to a different column/state'),
      swimlane:      z.string().optional().describe('Move to a different swimlane'),
      label:         z.string().optional().describe('Change primary label'),
      description:   z.string().optional().describe('New body in markdown'),
      priority:      z.number().optional().describe('Sort priority within its column (lower = higher up)'),
      roadmapMonths: z.array(z.string()).optional().describe(
        'Replace roadmap months span, e.g. ["2026-06","2026-07"]'
      ),
    },
    async ({ boardId, taskId, title, state, swimlane, label, description, priority, roadmapMonths }) => {
      const fields = Object.fromEntries(
        Object.entries({ title, state, swimlane, label, description, priority, roadmapMonths })
          .filter(([, v]) => v !== undefined)
      );
      const task = updateTask(boardId, taskId, fields);
      if (!task) throw new Error(`Task ${taskId} not found on board ${boardId}`);
      return { content: [{ type: 'text', text: JSON.stringify(task) }] };
    }
  );

  server.tool(
    'delete_task',
    'Permanently delete a task from a board.',
    {
      boardId: z.string().describe('Board ID from list_boards'),
      taskId:  z.string().describe('Task ID from list_tasks'),
    },
    async ({ boardId, taskId }) => {
      const ok = deleteTask(boardId, taskId);
      if (!ok) throw new Error(`Task ${taskId} not found on board ${boardId}`);
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, taskId }) }] };
    }
  );

  return server;
}

// ── HTTP transport (stateless — new server instance per request) ───────────

router.post('/', async (req, res) => {
  const server = buildMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('finish', async () => {
      await transport.close();
      await server.close();
    });
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: err.message }, id: null });
    }
  }
});

// SSE and session endpoints not needed in stateless mode
router.get('/',    (_, res) => res.status(405).json({ error: 'Use POST for MCP requests (stateless mode)' }));
router.delete('/', (_, res) => res.status(405).json({ error: 'Sessions not used in stateless mode' }));

module.exports = router;
