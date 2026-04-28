#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const cfg = require('./lib/config');
const api = require('./lib/api');
const out = require('./lib/output');

const program = new Command();

program
  .name('ss')
  .description('SoloSprinter CLI — manage boards and tasks across multiple instances')
  .version('1.0.0')
  .option('-i, --instance <alias>', 'Instance alias to target (overrides the configured default)')
  .option('--json', 'Output raw JSON instead of formatted tables');

// Helper: resolve base URL from global -i flag
function base() {
  return cfg.getInstanceUrl(program.opts().instance);
}

// Helper: check --json flag
function isJson() {
  return !!program.opts().json;
}

// Wrap async actions so unhandled rejections print nicely
function run(fn) {
  return (...args) => fn(...args).catch(err => out.printError(err));
}

// ── instance ──────────────────────────────────────────────────────────────────

const instanceCmd = program
  .command('instance')
  .description('Manage SoloSprinter instances (up to 3)');

instanceCmd
  .command('list')
  .description('List all configured instances')
  .action(() => {
    const config = cfg.listInstances();
    if (isJson()) { out.printJson(config.instances); return; }
    out.printInstances(config);
  });

instanceCmd
  .command('add <alias> <url>')
  .description('Add or update an instance (e.g. ss instance add local http://localhost:3001)')
  .action((alias, url) => {
    try {
      cfg.addInstance(alias, url);
      out.ok(`Instance "${alias}" saved → ${url}`);
    } catch (err) {
      out.printError(err);
    }
  });

instanceCmd
  .command('remove <alias>')
  .description('Remove an instance')
  .action((alias) => {
    try {
      cfg.removeInstance(alias);
      out.ok(`Instance "${alias}" removed.`);
    } catch (err) {
      out.printError(err);
    }
  });

instanceCmd
  .command('use <alias>')
  .description('Set the default instance')
  .action((alias) => {
    try {
      cfg.setDefault(alias);
      out.ok(`Default instance set to "${alias}".`);
    } catch (err) {
      out.printError(err);
    }
  });

// ── boards ────────────────────────────────────────────────────────────────────

const boardsCmd = program
  .command('boards')
  .description('Manage boards');

boardsCmd
  .command('list')
  .description('List all boards on the target instance')
  .action(run(async () => {
    const data = await api.boards.list(base());
    if (isJson()) { out.printJson(data); return; }
    out.printBoards(data);
  }));

boardsCmd
  .command('create <name>')
  .description('Create a new board')
  .action(run(async (name) => {
    const board = await api.boards.create(base(), name);
    if (isJson()) { out.printJson(board); return; }
    out.ok(`Board created: ${out.bold(board.name)} (id: ${board.id})`);
  }));

boardsCmd
  .command('rename <boardId> <newName>')
  .description('Rename a board')
  .action(run(async (boardId, newName) => {
    const board = await api.boards.rename(base(), boardId, newName);
    if (isJson()) { out.printJson(board); return; }
    out.ok(`Board renamed to "${board.name}"`);
  }));

boardsCmd
  .command('delete <boardId>')
  .description('Permanently delete a board and all its tasks')
  .action(run(async (boardId) => {
    const data = await api.boards.delete(base(), boardId);
    if (isJson()) { out.printJson(data); return; }
    out.ok(`Board ${boardId} deleted.`);
  }));

// ── tasks ─────────────────────────────────────────────────────────────────────

const tasksCmd = program
  .command('tasks')
  .description('Manage tasks');

tasksCmd
  .command('list <boardId>')
  .description('List all tasks on a board')
  .option('--state <state>',       'Filter by state/column (exact match)')
  .option('--swimlane <swimlane>', 'Filter by swimlane (exact match)')
  .option('--label <label>',       'Filter by label (exact match)')
  .action(run(async (boardId, opts) => {
    let data = await api.tasks.list(base(), boardId);
    if (opts.state)    data = data.filter(t => t.state    === opts.state);
    if (opts.swimlane) data = data.filter(t => t.swimlane === opts.swimlane);
    if (opts.label)    data = data.filter(t => t.label    === opts.label);
    if (isJson()) { out.printJson(data); return; }
    out.printTasks(data);
  }));

tasksCmd
  .command('get <boardId> <taskId>')
  .description('Get a single task with full description')
  .action(run(async (boardId, taskId) => {
    const task = await api.tasks.get(base(), boardId, taskId);
    if (isJson()) { out.printJson(task); return; }
    out.printTask(task);
  }));

tasksCmd
  .command('create <boardId>')
  .description('Create a new task')
  .requiredOption('--title <title>',         'Task title (required)')
  .option('--state <state>',                 'Column/state name (defaults to first state on board)')
  .option('--swimlane <swimlane>',           'Swimlane name (defaults to first swimlane on board)')
  .option('--label <label>',                 'Primary label')
  .option('--description <description>',     'Task body in markdown')
  .option('--priority <number>',             'Sort priority (integer, lower = higher up)', v => parseInt(v, 10))
  .option('--roadmap-months <months>',       'Comma-separated roadmap months, e.g. 2026-03,2026-04')
  .action(run(async (boardId, opts) => {
    const fields = {
      title:       opts.title,
      state:       opts.state,
      swimlane:    opts.swimlane,
      label:       opts.label,
      description: opts.description,
      priority:    opts.priority,
    };
    if (opts.roadmapMonths) {
      fields.roadmapMonths = opts.roadmapMonths.split(',').map(s => s.trim());
    }
    // Remove undefined fields so server defaults apply
    Object.keys(fields).forEach(k => fields[k] === undefined && delete fields[k]);

    const task = await api.tasks.create(base(), boardId, fields);
    if (isJson()) { out.printJson(task); return; }
    out.ok(`Task created: "${task.title}" (id: ${task.id})`);
  }));

tasksCmd
  .command('update <boardId> <taskId>')
  .description('Update one or more fields of an existing task')
  .option('--title <title>',             'New title')
  .option('--state <state>',             'Move to a different column/state')
  .option('--swimlane <swimlane>',       'Move to a different swimlane')
  .option('--label <label>',             'Change primary label')
  .option('--description <description>', 'New body in markdown')
  .option('--priority <number>',         'Sort priority (integer)', v => parseInt(v, 10))
  .option('--roadmap-months <months>',   'Replace roadmap months, comma-separated, e.g. 2026-06,2026-07')
  .action(run(async (boardId, taskId, opts) => {
    const fields = {
      title:       opts.title,
      state:       opts.state,
      swimlane:    opts.swimlane,
      label:       opts.label,
      description: opts.description,
      priority:    opts.priority,
    };
    if (opts.roadmapMonths) {
      fields.roadmapMonths = opts.roadmapMonths.split(',').map(s => s.trim());
    }
    Object.keys(fields).forEach(k => fields[k] === undefined && delete fields[k]);

    if (!Object.keys(fields).length) {
      out.printError(new Error('No fields to update. Specify at least one option.'));
      return;
    }
    const task = await api.tasks.update(base(), boardId, taskId, fields);
    if (isJson()) { out.printJson(task); return; }
    out.ok(`Task updated: "${task.title}"`);
  }));

tasksCmd
  .command('delete <boardId> <taskId>')
  .description('Permanently delete a task')
  .action(run(async (boardId, taskId) => {
    const data = await api.tasks.delete(base(), boardId, taskId);
    if (isJson()) { out.printJson(data); return; }
    out.ok(`Task ${taskId} deleted.`);
  }));

tasksCmd
  .command('history <boardId> <taskId>')
  .description('Show the state-change history of a task')
  .action(run(async (boardId, taskId) => {
    const history = await api.tasks.history(base(), boardId, taskId);
    if (isJson()) { out.printJson(history); return; }
    out.printHistory(history);
  }));

tasksCmd
  .command('priorities <boardId>')
  .description('Bulk-update task priorities (does not create history entries)')
  .option('--updates <json>',
    'JSON array of {id, priority} objects, e.g. \'[{"id":"abc","priority":1}]\'')
  .action(run(async (boardId, opts) => {
    if (!opts.updates) {
      out.printError(new Error('--updates <json> is required'));
      return;
    }
    let updates;
    try { updates = JSON.parse(opts.updates); }
    catch { out.printError(new Error('--updates must be valid JSON')); return; }
    const data = await api.tasks.updatePriorities(base(), boardId, updates);
    if (isJson()) { out.printJson(data); return; }
    out.ok(`Updated priorities for ${data.length} task(s).`);
  }));

// ── images ────────────────────────────────────────────────────────────────────

const imagesCmd = program
  .command('images')
  .description('Manage task images');

imagesCmd
  .command('list <boardId> <taskId>')
  .description('List images attached to a task')
  .action(run(async (boardId, taskId) => {
    const data = await api.images.list(base(), boardId, taskId);
    if (isJson()) { out.printJson(data); return; }
    if (!data.length) { out.info('No images attached.'); return; }
    data.forEach(f => console.log(`  ${f}  →  ${base()}/api/boards/${boardId}/tasks/${taskId}/images/${encodeURIComponent(f)}`));
  }));

imagesCmd
  .command('upload <boardId> <taskId> <filePath>')
  .description('Upload an image file and attach it to a task')
  .action(run(async (boardId, taskId, filePath) => {
    const data = await api.images.upload(base(), boardId, taskId, filePath);
    if (isJson()) { out.printJson(data); return; }
    out.ok(`Image uploaded: ${data.filename}`);
  }));

imagesCmd
  .command('delete <boardId> <taskId> <filename>')
  .description('Delete an image from a task')
  .action(run(async (boardId, taskId, filename) => {
    const data = await api.images.delete(base(), boardId, taskId, filename);
    if (isJson()) { out.printJson(data); return; }
    out.ok(`Image "${filename}" deleted.`);
  }));

// ── states ────────────────────────────────────────────────────────────────────

const statesCmd = program
  .command('states')
  .description('Manage board columns (states)');

statesCmd
  .command('list <boardId>')
  .description('List all states/columns on a board')
  .action(run(async (boardId) => {
    const data = await api.states.list(base(), boardId);
    if (isJson()) { out.printJson(data); return; }
    out.printStringList('states', data);
  }));

statesCmd
  .command('add <boardId> <name>')
  .description('Add a new state/column to a board')
  .action(run(async (boardId, name) => {
    const data = await api.states.add(base(), boardId, name);
    if (isJson()) { out.printJson(data); return; }
    out.ok(`State "${name}" added. States: ${data.join(' → ')}`);
  }));

statesCmd
  .command('reorder <boardId> <names...>')
  .description('Reorder states by listing all names in the desired order')
  .action(run(async (boardId, names) => {
    const data = await api.states.reorder(base(), boardId, names);
    if (isJson()) { out.printJson(data); return; }
    out.ok(`States reordered: ${data.join(' → ')}`);
  }));

statesCmd
  .command('delete <boardId> <name>')
  .description('Delete a state (must have no tasks and board must keep ≥3 states)')
  .action(run(async (boardId, name) => {
    const data = await api.states.delete(base(), boardId, name);
    if (isJson()) { out.printJson(data); return; }
    out.ok(`State "${name}" deleted. Remaining: ${data.join(', ')}`);
  }));

// ── swimlanes ─────────────────────────────────────────────────────────────────

const swimlanesCmd = program
  .command('swimlanes')
  .description('Manage board swimlane rows');

swimlanesCmd
  .command('list <boardId>')
  .description('List all swimlanes on a board')
  .action(run(async (boardId) => {
    const data = await api.swimlanes.list(base(), boardId);
    if (isJson()) { out.printJson(data); return; }
    out.printStringList('swimlanes', data);
  }));

swimlanesCmd
  .command('add <boardId> <name>')
  .description('Add a new swimlane to a board')
  .action(run(async (boardId, name) => {
    const data = await api.swimlanes.add(base(), boardId, name);
    if (isJson()) { out.printJson(data); return; }
    out.ok(`Swimlane "${name}" added. Swimlanes: ${data.join(', ')}`);
  }));

swimlanesCmd
  .command('reorder <boardId> <names...>')
  .description('Reorder swimlanes by listing all names in the desired order')
  .action(run(async (boardId, names) => {
    const data = await api.swimlanes.reorder(base(), boardId, names);
    if (isJson()) { out.printJson(data); return; }
    out.ok(`Swimlanes reordered: ${data.join(', ')}`);
  }));

swimlanesCmd
  .command('delete <boardId> <name>')
  .description('Delete a swimlane (must have no tasks; at least 1 swimlane must remain)')
  .action(run(async (boardId, name) => {
    const data = await api.swimlanes.delete(base(), boardId, name);
    if (isJson()) { out.printJson(data); return; }
    out.ok(`Swimlane "${name}" deleted. Remaining: ${data.join(', ')}`);
  }));

// ── labels ────────────────────────────────────────────────────────────────────

const labelsCmd = program
  .command('labels')
  .description('Manage board labels');

labelsCmd
  .command('list <boardId>')
  .description('List all labels on a board')
  .action(run(async (boardId) => {
    const data = await api.labels.list(base(), boardId);
    if (isJson()) { out.printJson(data); return; }
    out.printStringList('labels', data);
  }));

labelsCmd
  .command('add <boardId> <name>')
  .description('Add a new label to a board')
  .action(run(async (boardId, name) => {
    const data = await api.labels.add(base(), boardId, name);
    if (isJson()) { out.printJson(data); return; }
    out.ok(`Label "${name}" added. Labels: ${data.join(', ')}`);
  }));

labelsCmd
  .command('delete <boardId> <name>')
  .description('Delete a label (must have no tasks assigned to it)')
  .action(run(async (boardId, name) => {
    const data = await api.labels.delete(base(), boardId, name);
    if (isJson()) { out.printJson(data); return; }
    out.ok(`Label "${name}" deleted. Remaining: ${data.join(', ')}`);
  }));

// ── sync ──────────────────────────────────────────────────────────────────────

program
  .command('sync <from> <to>')
  .description(
    'Sync boards and tasks from one instance to another.\n' +
    'Boards are matched by name. Tasks are matched by title.\n' +
    'This is a one-way, source-wins operation.'
  )
  .option('--board <name>',  'Sync only the board with this name (otherwise all boards)')
  .option('--dry-run',       'Preview what would be synced without making any changes')
  .action(run(async (fromAlias, toAlias, opts) => {
    const srcUrl = cfg.getInstanceUrl(fromAlias);
    const dstUrl = cfg.getInstanceUrl(toAlias);

    out.info(`Syncing  ${out.bold(fromAlias)} (${srcUrl})  →  ${out.bold(toAlias)} (${dstUrl})`);
    if (opts.dryRun) out.warn('DRY RUN — no changes will be made');

    // 1. Fetch board lists
    const srcBoards = await api.boards.list(srcUrl);
    const dstBoards = await api.boards.list(dstUrl);
    const dstByName = Object.fromEntries(dstBoards.map(b => [b.name, b]));

    const plan   = [];   // for dry-run display
    let created  = 0;
    let updated  = 0;
    let skipped  = 0;

    // Filter boards if --board was specified
    const boardsToSync = opts.board
      ? srcBoards.filter(b => b.name === opts.board)
      : srcBoards;

    if (!boardsToSync.length) {
      out.warn(opts.board
        ? `No board named "${opts.board}" found on ${fromAlias}.`
        : `No boards found on ${fromAlias}.`
      );
      return;
    }

    for (const srcBoard of boardsToSync) {
      // 2. Ensure destination board exists
      let dstBoard = dstByName[srcBoard.name];
      if (!dstBoard) {
        plan.push({ action: 'CREATE', board: srcBoard.name, type: 'board', detail: srcBoard.name });
        if (!opts.dryRun) {
          dstBoard = await api.boards.create(dstUrl, srcBoard.name);
          created++;
        }
      }

      if (opts.dryRun) {
        // Just record that we'd process this board
        plan.push({ action: 'SYNC', board: srcBoard.name, type: 'board-config', detail: 'states / swimlanes / labels' });
        plan.push({ action: 'SYNC', board: srcBoard.name, type: 'tasks', detail: '(all tasks)' });
        continue;
      }

      // 3. Sync config: states, swimlanes, labels
      const [srcCfgStates, srcCfgSwimlanes, srcCfgLabels, dstCfgStates, dstCfgSwimlanes, dstCfgLabels] =
        await Promise.all([
          api.states.list(srcUrl,    srcBoard.id),
          api.swimlanes.list(srcUrl, srcBoard.id),
          api.labels.list(srcUrl,    srcBoard.id),
          api.states.list(dstUrl,    dstBoard.id),
          api.swimlanes.list(dstUrl, dstBoard.id),
          api.labels.list(dstUrl,    dstBoard.id),
        ]);

      for (const s of srcCfgStates)    { if (!dstCfgStates.includes(s))    { await api.states.add(dstUrl,    dstBoard.id, s); } }
      for (const s of srcCfgSwimlanes) { if (!dstCfgSwimlanes.includes(s)) { await api.swimlanes.add(dstUrl, dstBoard.id, s); } }
      for (const l of srcCfgLabels)    { if (!dstCfgLabels.includes(l))    { await api.labels.add(dstUrl,    dstBoard.id, l); } }

      // 4. Sync tasks
      const [srcTasks, dstTasks] = await Promise.all([
        api.tasks.list(srcUrl, srcBoard.id),
        api.tasks.list(dstUrl, dstBoard.id),
      ]);
      const dstTaskByTitle = Object.fromEntries(dstTasks.map(t => [t.title, t]));

      for (const srcTask of srcTasks) {
        const dstTask = dstTaskByTitle[srcTask.title];
        const payload = {
          title:       srcTask.title,
          state:       srcTask.state,
          swimlane:    srcTask.swimlane,
          label:       srcTask.label,
          description: srcTask.description,
          priority:    srcTask.priority,
        };
        if (srcTask.roadmapMonths && srcTask.roadmapMonths.length) {
          payload.roadmapMonths = srcTask.roadmapMonths;
        }
        if (!dstTask) {
          await api.tasks.create(dstUrl, dstBoard.id, payload);
          created++;
        } else {
          // Only update if something actually changed
          const changed =
            srcTask.title       !== dstTask.title       ||
            srcTask.state       !== dstTask.state       ||
            srcTask.swimlane    !== dstTask.swimlane     ||
            srcTask.label       !== dstTask.label       ||
            srcTask.description !== dstTask.description ||
            srcTask.priority    !== dstTask.priority    ||
            JSON.stringify(srcTask.roadmapMonths || []) !== JSON.stringify(dstTask.roadmapMonths || []);
          if (changed) {
            await api.tasks.update(dstUrl, dstBoard.id, dstTask.id, payload);
            updated++;
          } else {
            skipped++;
          }
        }
      }
    }

    if (opts.dryRun) {
      out.printSyncPlan(plan);
    } else {
      console.log();
      out.ok(`Sync complete — created: ${created}, updated: ${updated}, unchanged: ${skipped}`);
    }
  }));

// ── Parse ─────────────────────────────────────────────────────────────────────

program.parse(process.argv);
