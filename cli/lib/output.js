'use strict';

// ── ANSI helpers (no external deps) ──────────────────────────────────────────

const tty   = process.stdout.isTTY;
const bold  = s => tty ? `\x1b[1m${s}\x1b[0m`  : s;
const dim   = s => tty ? `\x1b[2m${s}\x1b[0m`  : s;
const green = s => tty ? `\x1b[32m${s}\x1b[0m` : s;
const cyan  = s => tty ? `\x1b[36m${s}\x1b[0m` : s;
const red   = s => tty ? `\x1b[31m${s}\x1b[0m` : s;
const yellow = s => tty ? `\x1b[33m${s}\x1b[0m` : s;

// ── Output helpers ────────────────────────────────────────────────────────────

function ok(msg)    { console.log(green('✔ ') + msg); }
function warn(msg)  { console.log(yellow('⚠ ') + msg); }
function info(msg)  { console.log(cyan('ℹ ') + msg); }

function printError(err) {
  console.error(red('✖ ') + (err.message || String(err)));
  process.exitCode = 1;
}

function printJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

// ── Table printer ─────────────────────────────────────────────────────────────

/**
 * Render data as an ASCII table.
 * @param {string[]} headers
 * @param {string[][]} rows
 */
function table(headers, rows) {
  const allRows = [headers, ...rows];
  const widths  = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length))
  );
  const sep  = widths.map(w => '─'.repeat(w + 2)).join('┼');
  const line = row =>
    row.map((cell, i) => ` ${String(cell ?? '').padEnd(widths[i])} `).join('│');

  console.log('┌' + widths.map(w => '─'.repeat(w + 2)).join('┬') + '┐');
  console.log('│' + bold(line(headers)) + '│');
  console.log('├' + sep + '┤');
  for (const r of rows) {
    console.log('│' + line(r) + '│');
  }
  console.log('└' + widths.map(w => '─'.repeat(w + 2)).join('┴') + '┘');
}

// ── Domain-specific printers ──────────────────────────────────────────────────

function printBoards(boards) {
  if (!boards.length) { info('No boards found.'); return; }
  table(
    ['ID', 'Name'],
    boards.map(b => [b.id, b.name])
  );
}

function printTasks(taskList) {
  if (!taskList.length) { info('No tasks found.'); return; }
  table(
    ['ID', 'Title', 'State', 'Swimlane', 'Label', 'Priority', 'Updated'],
    taskList.map(t => [
      t.id.slice(0, 8) + '…',
      truncate(t.title, 40),
      t.state,
      t.swimlane,
      t.label || dim('—'),
      t.priority ?? dim('—'),
      t.updated ? t.updated.slice(0, 10) : dim('—'),
    ])
  );
}

function printTask(t) {
  const rows = [
    ['ID',          t.id],
    ['Title',       t.title],
    ['State',       t.state],
    ['Swimlane',    t.swimlane],
    ['Label',       t.label || dim('—')],
    ['Priority',    t.priority ?? dim('—')],
    ['Created',     t.created],
    ['Updated',     t.updated],
  ];
  if (t.roadmapMonths && t.roadmapMonths.length) {
    rows.push(['Roadmap', t.roadmapMonths.join(', ')]);
  }
  console.log();
  for (const [k, v] of rows) {
    console.log(`  ${bold(k.padEnd(12))} ${v}`);
  }
  if (t.description) {
    console.log();
    console.log(dim('  ─── Description ───────────────────────────────'));
    for (const line of t.description.split('\n')) {
      console.log('  ' + line);
    }
  }
  console.log();
}

function printHistory(history) {
  if (!history.length) { info('No history entries.'); return; }
  table(
    ['Timestamp', 'Action', 'State', 'Swimlane'],
    history.map(h => [h.timestamp.slice(0, 19).replace('T', ' '), h.action, h.state, h.swimlane])
  );
}

function printStringList(label, items) {
  if (!items.length) { info(`No ${label} found.`); return; }
  items.forEach((item, i) => console.log(`  ${dim(String(i + 1).padStart(2) + '.')} ${item}`));
}

function printInstances(cfg) {
  const aliases = Object.keys(cfg.instances);
  if (!aliases.length) {
    info('No instances configured. Add one with: ss instance add <alias> <url>');
    return;
  }
  table(
    ['Alias', 'URL', 'Default'],
    aliases.map(a => [
      a,
      cfg.instances[a].url,
      a === cfg.default ? green('●') : '',
    ])
  );
}

// ── Sync output ───────────────────────────────────────────────────────────────

function printSyncPlan(plan) {
  if (!plan.length) { info('Nothing to sync.'); return; }
  table(
    ['Action', 'Board', 'Type', 'Name / Detail'],
    plan.map(p => [p.action, p.board, p.type, p.detail])
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

module.exports = { ok, warn, info, printError, printJson, table, printBoards, printTasks, printTask, printHistory, printStringList, printInstances, printSyncPlan, bold, dim, green, red, yellow, cyan };
