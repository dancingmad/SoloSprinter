import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { ConfigProvider, theme, Layout, Typography, Spin, message, Button, Tooltip } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import KanbanBoard from './components/KanbanBoard'
import RoadmapBoard from './components/RoadmapBoard'
import ListView from './components/ListView'
import FilterBar from './components/FilterBar'
import BoardPicker from './components/BoardPicker'
import {
  fetchBoards, createBoard, deleteBoard, renameBoard,
  fetchTasks, fetchStates, fetchSwimlanes, fetchLabels,
  createTask, updateTask, deleteTask, bulkUpdateTasks,
  addState, deleteState, reorderStates,
  addSwimlane, deleteSwimlane, reorderSwimlanes,
  addLabel, deleteLabel
} from './api'

const { Header, Content } = Layout

// ── URL helpers ──────────────────────────────────────────────────────────────

function _pad(n) { return String(n).padStart(2, '0') }
function defaultViewStart() {
  const now = new Date()
  const qStart = Math.floor(now.getMonth() / 3) * 3 + 1
  return `${now.getFullYear()}-${_pad(qStart)}`
}

/**
 * Parse the current window.location.hash into structured state.
 * Hash format: #board/<boardId>[?view=kanban&rows=label&compact=1&label=foo&daysOld=7&maxPerColumn=10&qstart=2026-01]
 */
function parseHash() {
  const raw = window.location.hash.slice(1) // strip leading #
  if (!raw.startsWith('board/')) return null
  const qIdx = raw.indexOf('?')
  const boardPart = qIdx === -1 ? raw.slice('board/'.length) : raw.slice('board/'.length, qIdx)
  const search    = qIdx === -1 ? '' : raw.slice(qIdx + 1)
  const boardId   = decodeURIComponent(boardPart)
  if (!boardId) return null
  const p = new URLSearchParams(search)
  return {
    boardId,
    viewMode:         ['kanban', 'roadmap', 'list'].includes(p.get('view')) ? p.get('view') : 'kanban',
    swimlaneMode:     p.get('rows') !== 'label',
    compactView:      p.get('compact') === '1',
    filters: {
      // li= is the new multi-label param; fall back to legacy label= for old shared URLs
      labelsInclude: p.get('li')    ? p.get('li').split('|').filter(Boolean)
                   : p.get('label') ? [p.get('label')]
                   : [],
      daysOld:      p.get('daysOld')      ? parseInt(p.get('daysOld'))      : null,
      maxPerColumn: p.get('maxPerColumn') ? parseInt(p.get('maxPerColumn')) : null,
    },
    roadmapViewStart: p.get('qstart') || null,
  }
}

/**
 * Serialise current view state into a shareable hash string.
 * Only non-default values are included to keep URLs short.
 */
function buildHash(boardId, { viewMode, swimlaneMode, compactView, filters, roadmapViewStart }) {
  const p = new URLSearchParams()
  if (viewMode && viewMode !== 'kanban')  p.set('view',         viewMode)
  if (!swimlaneMode)                      p.set('rows',         'label')
  if (compactView)                        p.set('compact',      '1')
  if (filters?.labelsInclude?.length)     p.set('li', filters.labelsInclude.join('|'))
  if (filters?.daysOld)                   p.set('daysOld',      String(filters.daysOld))
  if (filters?.maxPerColumn)              p.set('maxPerColumn', String(filters.maxPerColumn))
  // Only include the roadmap quarter when the roadmap is active
  if (viewMode === 'roadmap' && roadmapViewStart) p.set('qstart', roadmapViewStart)
  const qs = p.toString()
  return `#board/${encodeURIComponent(boardId)}${qs ? '?' + qs : ''}`
}

export default function App() {
  const [boards, setBoards] = useState([])
  const [activeBoard, setActiveBoard] = useState(null)
  const [tasks, setTasks] = useState([])
  const [states, setStates] = useState([])
  const [swimlanes, setSwimlanes] = useState([])
  const [labels, setLabels] = useState([])
  const [loading, setLoading] = useState(true)
  const [boardLoading, setBoardLoading] = useState(false)
  const [swimlaneMode, setSwimlaneMode] = useState(true)
  const [viewMode, setViewMode] = useState('kanban')
  const [compactView, setCompactView] = useState(false)
  const [filters, setFilters] = useState({ labelsInclude: [], daysOld: null, maxPerColumn: null })
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set())
  const [roadmapViewStart, setRoadmapViewStart] = useState(defaultViewStart)
  const [messageApi, contextHolder] = message.useMessage()

  // Prevent our own hash writes from triggering the hashchange handler
  const suppressHashChange = useRef(false)

  // Load board data when a board is selected.
  // urlState is optional; when provided (URL share / browser nav) it overrides the defaults.
  const loadBoard = useCallback(async (board, urlState = {}) => {
    setBoardLoading(true)
    try {
      const [t, s, sw, lb] = await Promise.all([
        fetchTasks(board.id),
        fetchStates(board.id),
        fetchSwimlanes(board.id),
        fetchLabels(board.id)
      ])
      setTasks(t)
      setStates(s)
      setSwimlanes(sw)
      setLabels(lb)
      setActiveBoard(board)
      setSwimlaneMode(urlState.swimlaneMode !== undefined ? urlState.swimlaneMode : true)
      setViewMode(urlState.viewMode || 'kanban')
      setCompactView(urlState.compactView || false)
      setFilters(urlState.filters || { labelsInclude: [], daysOld: null, maxPerColumn: null })
      if (urlState.roadmapViewStart) setRoadmapViewStart(urlState.roadmapViewStart)
      // Hash will be written by the URL-sync effect once state settles
    } catch (e) {
      messageApi.error('Failed to load board data')
    } finally {
      setBoardLoading(false)
    }
  }, [messageApi])

  // Load boards list on mount
  useEffect(() => {
    fetchBoards()
      .then(setBoards)
      .catch(() => messageApi.error('Failed to load boards'))
      .finally(() => setLoading(false))
  }, [])

  // Auto-navigate to board from URL hash once boards are loaded
  useEffect(() => {
    if (loading) return
    const parsed = parseHash()
    if (parsed && !activeBoard) {
      const board = boards.find(b => b.id === parsed.boardId)
      if (board) loadBoard(board, parsed)
    }
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep URL in sync with current view state whenever it changes
  useEffect(() => {
    if (!activeBoard) return
    suppressHashChange.current = true
    const hash = buildHash(activeBoard.id, { viewMode, swimlaneMode, compactView, filters, roadmapViewStart })
    window.location.hash = hash
    // Reset flag after the hashchange event has had a chance to fire
    requestAnimationFrame(() => { suppressHashChange.current = false })
  }, [activeBoard?.id, viewMode, swimlaneMode, compactView, filters, roadmapViewStart])

  // Handle browser back / forward
  useEffect(() => {
    const applyParsed = (parsed) => {
      setViewMode(parsed.viewMode)
      setSwimlaneMode(parsed.swimlaneMode)
      setCompactView(parsed.compactView)
      setFilters(parsed.filters)
      if (parsed.roadmapViewStart) setRoadmapViewStart(parsed.roadmapViewStart)
    }
    const onHashChange = () => {
      if (suppressHashChange.current) return
      const parsed = parseHash()
      if (!parsed) { setActiveBoard(null); return }
      if (activeBoard && activeBoard.id === parsed.boardId) {
        applyParsed(parsed)
      } else {
        const board = boards.find(b => b.id === parsed.boardId)
        if (board) loadBoard(board, parsed)
        else setActiveBoard(null)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [activeBoard, boards, loadBoard])

  // Poll for task changes every 10 seconds when a board is active
  const activeBoardIdRef = useRef(null)
  useEffect(() => {
    if (!activeBoard) { activeBoardIdRef.current = null; return }
    activeBoardIdRef.current = activeBoard.id
    const poll = async () => {
      if (!activeBoardIdRef.current) return
      try {
        const fresh = await fetchTasks(activeBoardIdRef.current)
        setTasks(prev => {
          const freshMap = new Map(fresh.map(t => [t.id, t]))
          const prevMap = new Map(prev.map(t => [t.id, t]))
          const hasNew = fresh.some(t => !prevMap.has(t.id))
          const hasDeleted = prev.some(t => !freshMap.has(t.id))
          const hasUpdated = fresh.some(t => {
            const e = prevMap.get(t.id)
            return e && e.updated !== t.updated
          })
          if (!hasNew && !hasDeleted && !hasUpdated) return prev
          return fresh.map(t => {
            const existing = prevMap.get(t.id)
            return (existing && existing.updated === t.updated) ? existing : t
          })
        })
      } catch (_) {
        // silently ignore poll errors
      }
    }
    const interval = setInterval(poll, 5000)
    return () => clearInterval(interval)
  }, [activeBoard?.id])

  // Clear selection when switching boards or views
  useEffect(() => {
    setSelectedTaskIds(new Set())
  }, [activeBoard?.id, viewMode])

  // IDs of tasks that survive the current filters (used for "Select all visible")
  const filteredTaskIds = useMemo(() => {
    let result = tasks
    if (filters.labelsInclude && filters.labelsInclude.length > 0) {
      result = result.filter(t => {
        const all = [t.label, ...(t.extraLabels || [])].filter(Boolean)
        return filters.labelsInclude.some(l => all.includes(l))
      })
    }
    if (filters.daysOld) {
      const cutoff = new Date()
      cutoff.setHours(0, 0, 0, 0)
      cutoff.setDate(cutoff.getDate() - (filters.daysOld - 1))
      result = result.filter(t => t.updated && new Date(t.updated).getTime() >= cutoff.getTime())
    }
    return new Set(result.map(t => t.id))
  }, [tasks, filters])

  // ── Label taxonomy derived from tasks ────────────────────────────────────
  // Primary labels  = values used as task.label on at least one task.
  // Extra labels    = values found only in task.extraLabels (never used as a primary label).
  // If a label appears in both places it is treated as primary-only to avoid confusion.
  const primaryLabels = useMemo(
    () => [...new Set(tasks.map(t => t.label).filter(Boolean))],
    [tasks]
  )
  const primaryLabelSet = useMemo(() => new Set(primaryLabels), [primaryLabels])

  const extraLabelsOnly = useMemo(() => {
    const raw = tasks.flatMap(t => (t.extraLabels || []).filter(l => !primaryLabelSet.has(l)))
    return [...new Set(raw)]
  }, [tasks, primaryLabelSet])

  // ── Bulk label states (three per label): selected / semi / unselected ────────────────────────
  //
  // Primary labels:
  //   selected      – ALL selected tasks have this as their task.label
  //   semi-selected – SOME (but not all) selected tasks have it as task.label
  //   unselected    – no selected task has it as task.label
  //
  // Extra labels:
  //   selected      – ALL selected tasks carry it in their extraLabels
  //   semi-selected – SOME (but not all) selected tasks carry it in their extraLabels
  //   unselected    – no selected task carries it

  const { bulkActivePrimaryLabels, bulkSemiPrimaryLabels } = useMemo(() => {
    if (selectedTaskIds.size === 0) return { bulkActivePrimaryLabels: [], bulkSemiPrimaryLabels: [] }
    const selected = tasks.filter(t => selectedTaskIds.has(t.id))
    const active = []
    const semi   = []
    for (const label of primaryLabels) {
      const count = selected.filter(t => t.label === label).length
      if (count === selected.length) active.push(label)
      else if (count > 0)            semi.push(label)
    }
    return { bulkActivePrimaryLabels: active, bulkSemiPrimaryLabels: semi }
  }, [selectedTaskIds, tasks, primaryLabels])

  const { bulkActiveExtraLabels, bulkSemiExtraLabels } = useMemo(() => {
    if (selectedTaskIds.size === 0) return { bulkActiveExtraLabels: [], bulkSemiExtraLabels: [] }
    const selected = tasks.filter(t => selectedTaskIds.has(t.id))
    const active = []
    const semi   = []
    for (const label of extraLabelsOnly) {
      const count = selected.filter(t => (t.extraLabels || []).includes(label)).length
      if (count === selected.length) active.push(label)
      else if (count > 0)            semi.push(label)
    }
    return { bulkActiveExtraLabels: active, bulkSemiExtraLabels: semi }
  }, [selectedTaskIds, tasks, extraLabelsOnly])

  // Board management
  const handleCreateBoard = async (name) => {
    const board = await createBoard(name)
    if (board.error) { messageApi.error(board.error); return }
    setBoards(prev => [...prev, board])
  }

  const handleDeleteBoard = async (id) => {
    await deleteBoard(id)
    setBoards(prev => prev.filter(b => b.id !== id))
    if (activeBoard && activeBoard.id === id) { setActiveBoard(null); window.location.hash = '' }
  }

  const handleRenameBoard = async (id, name) => {
    const board = await renameBoard(id, name)
    if (board.error) { messageApi.error(board.error); return }
    setBoards(prev => prev.map(b => b.id === id ? board : b))
    if (activeBoard && activeBoard.id === id) setActiveBoard(board)
  }

  // Selection handlers
  const handleToggleTaskSelection = useCallback((id) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  // Used by ListView tables: replace the selection for one group's rows
  const handleMergeTaskSelection = useCallback((addIds, removeIds) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev)
      removeIds.forEach(id => next.delete(id))
      addIds.forEach(id => next.add(id))
      return next
    })
  }, [])

  const handleClearSelection = useCallback(() => setSelectedTaskIds(new Set()), [])

  const handleSelectAll = useCallback(() => {
    setSelectedTaskIds(new Set(filteredTaskIds))
  }, [filteredTaskIds])

  // ── Bulk extra-label toggle ───────────────────────────────────────────────────────────────────
  // Selected (all have it)     → remove from all
  // Semi/Unselected            → add to tasks that don't already carry it
  //                              (skip tasks where it's the primary label to avoid duplication)
  const handleBulkLabelToggle = async (label) => {
    const selectedTasks = tasks.filter(t => selectedTaskIds.has(t.id))
    if (selectedTasks.length === 0 || !label) return

    const hasLabel     = (t) => (t.extraLabels || []).includes(label)
    const allHaveLabel = selectedTasks.every(hasLabel)

    // Ensure label exists in board config when adding
    if (!allHaveLabel && !labels.includes(label)) {
      await handleAddLabel(label)
    }

    const updates = selectedTasks.map(t => {
      const currentExtra = t.extraLabels || []
      if (allHaveLabel) {
        // Selected → remove
        return { id: t.id, extraLabels: currentExtra.filter(l => l !== label) }
      } else {
        // Semi or Unselected → add to tasks that don't have it yet
        if (hasLabel(t)) return null           // already has it — skip
        if (t.label === label) return null     // already the primary label — skip (no duplication)
        return { id: t.id, extraLabels: [...currentExtra, label] }
      }
    }).filter(Boolean)

    if (updates.length === 0) return

    const updatedTasks = await bulkUpdateTasks(activeBoard.id, updates)
    if (Array.isArray(updatedTasks)) {
      const map = new Map(updatedTasks.map(t => [t.id, t]))
      setTasks(prev => prev.map(t => map.has(t.id) ? map.get(t.id) : t))
    }
  }

  // ── Bulk primary-label toggle ─────────────────────────────────────────────────────────────────
  // Selected (all have it)     → clear primary label on all selected tasks
  // Semi/Unselected            → set as primary label on all selected tasks
  //                              (clears their existing primary; removes from extraLabels)
  const handleBulkPrimaryLabelToggle = async (label) => {
    const selectedTasks = tasks.filter(t => selectedTaskIds.has(t.id))
    if (selectedTasks.length === 0 || !label) return

    const allHave = selectedTasks.every(t => t.label === label)
    const updates = selectedTasks.map(t => ({
      id: t.id,
      // Selected → clear; Semi/Unselected → assign (replacing whatever primary they had)
      label: allHave ? '' : label,
      // When promoting to primary, scrub it from extraLabels to prevent duplication
      extraLabels: (t.extraLabels || []).filter(l => l !== label),
    }))

    const updatedTasks = await bulkUpdateTasks(activeBoard.id, updates)
    if (Array.isArray(updatedTasks)) {
      const map = new Map(updatedTasks.map(t => [t.id, t]))
      setTasks(prev => prev.map(t => map.has(t.id) ? map.get(t.id) : t))
    }
  }

  // Task handlers
  const handleCreateTask = async (fields) => {
    const task = await createTask(activeBoard.id, fields)
    setTasks(prev => [...prev, task])
    return task
  }

  const handleUpdateTask = async (id, fields) => {
    const task = await updateTask(activeBoard.id, id, fields)
    setTasks(prev => prev.map(t => t.id === id ? task : t))
    return task
  }

  const handleUpdateTaskPriorities = (updates) => {
    // updates: [{id, priority}] — apply optimistically to local state
    setTasks(prev => prev.map(t => {
      const u = updates.find(u => u.id === t.id)
      return u ? { ...t, priority: u.priority } : t
    }))
  }

  const handleDeleteTask = async (id) => {
    await deleteTask(activeBoard.id, id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  // State handlers
  const handleAddState = async (name) => {
    const result = await addState(activeBoard.id, name)
    if (result.error) { messageApi.error(result.error); return }
    setStates(result)
  }

  const handleDeleteState = async (name) => {
    const result = await deleteState(activeBoard.id, name)
    if (result.error) { messageApi.error(result.error); return }
    setStates(result)
  }

  const handleReorderStates = async (order) => {
    setStates(order)
    await reorderStates(activeBoard.id, order)
  }

  // Swimlane handlers
  const handleAddSwimlane = async (name) => {
    const result = await addSwimlane(activeBoard.id, name)
    if (result.error) { messageApi.error(result.error); return }
    setSwimlanes(result)
  }

  const handleDeleteSwimlane = async (name) => {
    const result = await deleteSwimlane(activeBoard.id, name)
    if (result.error) { messageApi.error(result.error); return }
    setSwimlanes(result)
  }

  const handleReorderSwimlanes = async (order) => {
    setSwimlanes(order)
    await reorderSwimlanes(activeBoard.id, order)
  }

  // Label handlers
  const handleAddLabel = async (name) => {
    const result = await addLabel(activeBoard.id, name)
    if (result.error) { messageApi.error(result.error); return }
    setLabels(result)
  }

  const handleDeleteLabel = async (name) => {
    const result = await deleteLabel(activeBoard.id, name)
    if (result.error) { messageApi.error(result.error); return }
    setLabels(result)
  }

  return (
    <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
      {contextHolder}
      <Layout style={{ height: '100vh' }}>
        <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px', background: '#1677ff', gap: 12 }}>
          {activeBoard && (
            <Tooltip title="Back to boards">
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={() => { setActiveBoard(null); window.location.hash = '' }}
                style={{ color: '#fff' }}
              />
            </Tooltip>
          )}
          {activeBoard && (
            <Tooltip title="Copy shareable link">
              <Button
                type="text"
                style={{ color: '#fff', fontSize: 18, lineHeight: 1 }}
                onClick={() => {
                  const url = window.location.href
                  navigator.clipboard.writeText(url).then(
                    () => messageApi.success('Link copied!'),
                    () => messageApi.error('Failed to copy link')
                  )
                }}
              >
                🔗
              </Button>
            </Tooltip>
          )}
          <Typography.Title level={3} style={{ color: '#fff', margin: 0, flex: 1 }}>
            🏃 SoloSprinter{activeBoard ? ` — ${activeBoard.name}` : ''}
          </Typography.Title>
        </Header>
        <Content style={{ padding: activeBoard ? '16px' : 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <Spin size="large" style={{ display: 'block', marginTop: 80, textAlign: 'center' }} />
          ) : !activeBoard ? (
            <BoardPicker
              boards={boards}
              onSelect={loadBoard}
              onCreate={handleCreateBoard}
              onDelete={handleDeleteBoard}
              onRename={handleRenameBoard}
            />
          ) : boardLoading ? (
            <Spin size="large" style={{ display: 'block', marginTop: 80, textAlign: 'center' }} />
          ) : (
            <>
              <FilterBar
                labels={[...new Set([...labels, ...tasks.map(t => t.label), ...tasks.flatMap(t => t.extraLabels || [])].filter(Boolean))]}
                swimlaneMode={swimlaneMode}
                onToggleSwimlaneMode={setSwimlaneMode}
                filters={filters}
                onFiltersChange={setFilters}
                compactView={compactView}
                onToggleCompactView={setCompactView}
                viewMode={viewMode}
                onViewModeChange={(val) => { setViewMode(val); if (val === 'roadmap') setCompactView(true) }}
                selectedCount={selectedTaskIds.size}
                onClearSelection={handleClearSelection}
                onSelectAll={handleSelectAll}
                primaryLabels={primaryLabels}
                extraLabelsOnly={extraLabelsOnly}
                bulkActivePrimaryLabels={bulkActivePrimaryLabels}
                bulkSemiPrimaryLabels={bulkSemiPrimaryLabels}
                bulkActiveExtraLabels={bulkActiveExtraLabels}
                bulkSemiExtraLabels={bulkSemiExtraLabels}
                onBulkPrimaryLabelToggle={handleBulkPrimaryLabelToggle}
                onBulkLabelToggle={handleBulkLabelToggle}
              />
              <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
              {viewMode === 'roadmap' ? (
                <RoadmapBoard
                  boardId={activeBoard.id}
                  tasks={tasks}
                  states={states}
                  swimlanes={swimlanes}
                  labels={labels}
                  filters={filters}
                  swimlaneMode={swimlaneMode}
                  compactView={compactView}
                  viewStart={roadmapViewStart}
                  onViewStartChange={setRoadmapViewStart}
                  onCreateTask={handleCreateTask}
                  onUpdateTask={handleUpdateTask}
                  onDeleteTask={handleDeleteTask}
                  onAddLabel={handleAddLabel}
                  onDeleteLabel={handleDeleteLabel}
                  selectedTaskIds={selectedTaskIds}
                  onToggleTaskSelection={handleToggleTaskSelection}
                />
              ) : viewMode === 'list' ? (
                <ListView
                  boardId={activeBoard.id}
                  tasks={tasks}
                  states={states}
                  swimlanes={swimlanes}
                  labels={labels}
                  filters={filters}
                  swimlaneMode={swimlaneMode}
                  onUpdateTask={handleUpdateTask}
                  onDeleteTask={handleDeleteTask}
                  onAddLabel={handleAddLabel}
                  onDeleteLabel={handleDeleteLabel}
                  selectedTaskIds={selectedTaskIds}
                  onMergeTaskSelection={handleMergeTaskSelection}
                />
              ) : (
                <KanbanBoard
                  boardId={activeBoard.id}
                  compactView={compactView}
                  tasks={tasks}
                  states={states}
                  swimlanes={swimlanes}
                  labels={labels}
                  swimlaneMode={swimlaneMode}
                  filters={filters}
                  onCreateTask={handleCreateTask}
                  onUpdateTask={handleUpdateTask}
                  onUpdateTaskPriorities={handleUpdateTaskPriorities}
                  onDeleteTask={handleDeleteTask}
                  onAddState={handleAddState}
                  onDeleteState={handleDeleteState}
                  onReorderStates={handleReorderStates}
                  onAddSwimlane={handleAddSwimlane}
                  onDeleteSwimlane={handleDeleteSwimlane}
                  onReorderSwimlanes={handleReorderSwimlanes}
                  onAddLabel={handleAddLabel}
                  onDeleteLabel={handleDeleteLabel}
                  selectedTaskIds={selectedTaskIds}
                  onToggleTaskSelection={handleToggleTaskSelection}
                />
              )}
              </div>
            </>
          )}
        </Content>
      </Layout>
    </ConfigProvider>
  )
}
