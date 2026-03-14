const BASE = '/api'

export async function fetchTasks() {
  const r = await fetch(`${BASE}/tasks`)
  return r.json()
}

export async function createTask(fields) {
  const r = await fetch(`${BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields)
  })
  return r.json()
}

export async function updateTask(id, fields) {
  const r = await fetch(`${BASE}/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields)
  })
  return r.json()
}

export async function deleteTask(id) {
  const r = await fetch(`${BASE}/tasks/${id}`, { method: 'DELETE' })
  return r.json()
}

export async function fetchStates() {
  const r = await fetch(`${BASE}/states`)
  return r.json()
}

export async function addState(name) {
  const r = await fetch(`${BASE}/states`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  return r.json()
}

export async function deleteState(name) {
  const r = await fetch(`${BASE}/states/${encodeURIComponent(name)}`, { method: 'DELETE' })
  return r.json()
}

export async function fetchSwimlanes() {
  const r = await fetch(`${BASE}/swimlanes`)
  return r.json()
}

export async function addSwimlane(name) {
  const r = await fetch(`${BASE}/swimlanes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  return r.json()
}

export async function deleteSwimlane(name) {
  const r = await fetch(`${BASE}/swimlanes/${encodeURIComponent(name)}`, { method: 'DELETE' })
  return r.json()
}

export async function fetchLabels() {
  const r = await fetch(`${BASE}/swimlanes/labels`)
  return r.json()
}

export async function addLabel(name) {
  const r = await fetch(`${BASE}/swimlanes/labels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  return r.json()
}

export async function deleteLabel(name) {
  const r = await fetch(`${BASE}/swimlanes/labels/${encodeURIComponent(name)}`, { method: 'DELETE' })
  return r.json()
}

export async function uploadImage(taskId, file) {
  const form = new FormData()
  form.append('image', file)
  const r = await fetch(`${BASE}/tasks/${taskId}/images`, { method: 'POST', body: form })
  return r.json()
}

export function imageUrl(taskId, filename) {
  return `${BASE}/tasks/${taskId}/images/${filename}`
}
