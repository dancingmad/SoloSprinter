'use strict';
const fs   = require('fs');
const path = require('path');

async function apiFetch(baseUrl, method, apiPath, body) {
  const url  = `${baseUrl}/api${apiPath}`;
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(url, opts);
  } catch (err) {
    throw new Error(`Cannot reach ${baseUrl} — ${err.message}`);
  }
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = (data && data.error) ? data.error : (text || res.statusText);
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  return data;
}

// ── Boards ────────────────────────────────────────────────────────────────────

const boards = {
  list:   (base)               => apiFetch(base, 'GET',    '/boards'),
  create: (base, name)         => apiFetch(base, 'POST',   '/boards', { name }),
  rename: (base, id, name)     => apiFetch(base, 'PATCH',  `/boards/${id}`, { name }),
  delete: (base, id)           => apiFetch(base, 'DELETE', `/boards/${id}`),
};

// ── Tasks ─────────────────────────────────────────────────────────────────────

const tasks = {
  list:             (base, boardId)              => apiFetch(base, 'GET',    `/boards/${boardId}/tasks`),
  get:              (base, boardId, taskId)       => apiFetch(base, 'GET',    `/boards/${boardId}/tasks/${taskId}`),
  create:           (base, boardId, fields)       => apiFetch(base, 'POST',   `/boards/${boardId}/tasks`, fields),
  update:           (base, boardId, taskId, fields) => apiFetch(base, 'PATCH', `/boards/${boardId}/tasks/${taskId}`, fields),
  delete:           (base, boardId, taskId)       => apiFetch(base, 'DELETE', `/boards/${boardId}/tasks/${taskId}`),
  history:          (base, boardId, taskId)       => apiFetch(base, 'GET',    `/boards/${boardId}/tasks/${taskId}/history`),
  updatePriorities: (base, boardId, updates)      => apiFetch(base, 'PATCH',  `/boards/${boardId}/tasks/priorities`, updates),
};

// ── Images ────────────────────────────────────────────────────────────────────

const images = {
  list:   (base, boardId, taskId) =>
    apiFetch(base, 'GET', `/boards/${boardId}/tasks/${taskId}/images`),

  delete: (base, boardId, taskId, filename) =>
    apiFetch(base, 'DELETE', `/boards/${boardId}/tasks/${taskId}/images/${encodeURIComponent(filename)}`),

  upload: async (base, boardId, taskId, filePath) => {
    const url  = `${base}/api/boards/${boardId}/tasks/${taskId}/images`;
    const blob = new Blob([fs.readFileSync(filePath)], { type: 'application/octet-stream' });
    const form = new FormData();
    form.append('image', blob, path.basename(filePath));
    let res;
    try {
      res = await fetch(url, { method: 'POST', body: form });
    } catch (err) {
      throw new Error(`Cannot reach ${base} — ${err.message}`);
    }
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(data && data.error) || text}`);
    return data;
  },
};

// ── States ────────────────────────────────────────────────────────────────────

const states = {
  list:    (base, boardId)              => apiFetch(base, 'GET',    `/boards/${boardId}/states`),
  add:     (base, boardId, name)        => apiFetch(base, 'POST',   `/boards/${boardId}/states`, { name }),
  reorder: (base, boardId, order)       => apiFetch(base, 'PUT',    `/boards/${boardId}/states/reorder`, { order }),
  delete:  (base, boardId, name)        => apiFetch(base, 'DELETE', `/boards/${boardId}/states/${encodeURIComponent(name)}`),
};

// ── Swimlanes ─────────────────────────────────────────────────────────────────

const swimlanes = {
  list:    (base, boardId)        => apiFetch(base, 'GET',    `/boards/${boardId}/swimlanes`),
  add:     (base, boardId, name)  => apiFetch(base, 'POST',   `/boards/${boardId}/swimlanes`, { name }),
  reorder: (base, boardId, order) => apiFetch(base, 'PUT',    `/boards/${boardId}/swimlanes/reorder`, { order }),
  delete:  (base, boardId, name)  => apiFetch(base, 'DELETE', `/boards/${boardId}/swimlanes/${encodeURIComponent(name)}`),
};

// ── Labels ────────────────────────────────────────────────────────────────────

const labels = {
  list:   (base, boardId)        => apiFetch(base, 'GET',    `/boards/${boardId}/swimlanes/labels`),
  add:    (base, boardId, name)  => apiFetch(base, 'POST',   `/boards/${boardId}/swimlanes/labels`, { name }),
  delete: (base, boardId, name)  => apiFetch(base, 'DELETE', `/boards/${boardId}/swimlanes/labels/${encodeURIComponent(name)}`),
};

module.exports = { boards, tasks, images, states, swimlanes, labels };
