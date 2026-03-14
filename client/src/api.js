const BASE = '/api'

export async function fetchBoards() {
  const r = await fetch(`${BASE}/boards`)
  return r.json()
}

export async function createBoard(name) {
  const r = await fetch(`${BASE}/boards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  return r.json()
}

export async function renameBoard(id, name) {
  const r = await fetch(`${BASE}/boards/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  return r.json()
}

export async function deleteBoard(id) {
  const r = await fetch(`${BASE}/boards/${id}`, { method: 'DELETE' })
  return r.json()
}

function boardBase(boardId) {
  return `${BASE}/boards/${boardId}`
}

export async function fetchTasks(boardId) {
  const r = await fetch(`${boardBase(boardId)}/tasks`)
  return r.json()
}

export async function createTask(boardId, fields) {
  const r = await fetch(`${boardBase(boardId)}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields)
  })
  return r.json()
}

export async function updateTask(boardId, id, fields) {
  const r = await fetch(`${boardBase(boardId)}/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields)
  })
  return r.json()
}

export async function deleteTask(boardId, id) {
  const r = await fetch(`${boardBase(boardId)}/tasks/${id}`, { method: 'DELETE' })
  return r.json()
}

export async function fetchStates(boardId) {
  const r = await fetch(`${boardBase(boardId)}/states`)
  return r.json()
}

export async function addState(boardId, name) {
  const r = await fetch(`${boardBase(boardId)}/states`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  return r.json()
}

export async function deleteState(boardId, name) {
  const r = await fetch(`${boardBase(boardId)}/states/${encodeURIComponent(name)}`, { method: 'DELETE' })
  return r.json()
}

export async function fetchSwimlanes(boardId) {
  const r = await fetch(`${boardBase(boardId)}/swimlanes`)
  return r.json()
}

export async function addSwimlane(boardId, name) {
  const r = await fetch(`${boardBase(boardId)}/swimlanes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  return r.json()
}

export async function deleteSwimlane(boardId, name) {
  const r = await fetch(`${boardBase(boardId)}/swimlanes/${encodeURIComponent(name)}`, { method: 'DELETE' })
  return r.json()
}

export async function fetchLabels(boardId) {
  const r = await fetch(`${boardBase(boardId)}/swimlanes/labels`)
  return r.json()
}

export async function addLabel(boardId, name) {
  const r = await fetch(`${boardBase(boardId)}/swimlanes/labels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  return r.json()
}

export async function deleteLabel(boardId, name) {
  const r = await fetch(`${boardBase(boardId)}/swimlanes/labels/${encodeURIComponent(name)}`, { method: 'DELETE' })
  return r.json()
}

export async function updateTaskPriorities(boardId, updates) {
  const r = await fetch(`${boardBase(boardId)}/tasks/priorities`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  })
  return r.json()
}

export async function uploadImage(boardId, taskId, file) {
  const form = new FormData()
  form.append('image', file)
  const r = await fetch(`${boardBase(boardId)}/tasks/${taskId}/images`, { method: 'POST', body: form })
  return r.json()
}

export function imageUrl(boardId, taskId, filename) {
  return `${boardBase(boardId)}/tasks/${taskId}/images/${filename}`
}
