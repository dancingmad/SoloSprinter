import React, { useEffect, useState, useCallback, useRef } from 'react'
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
  createTask, updateTask, deleteTask,
  addState, deleteState, reorderStates,
  addSwimlane, deleteSwimlane, reorderSwimlanes,
  addLabel, deleteLabel
} from './api'

const { Header, Content } = Layout

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
  const [filters, setFilters] = useState({ label: null, daysOld: null, maxPerColumn: null })
  const [messageApi, contextHolder] = message.useMessage()

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
    const match = window.location.hash.match(/^#board\/(.+)$/)
    if (match && !activeBoard) {
      const board = boards.find(b => b.id === decodeURIComponent(match[1]))
      if (board) loadBoard(board)
    }
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle browser back/forward via hashchange
  useEffect(() => {
    const onHashChange = () => {
      if (!window.location.hash.startsWith('#board/')) {
        setActiveBoard(null)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

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

  // Load board data when a board is selected
  const loadBoard = useCallback(async (board) => {
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
      setSwimlaneMode(true)
      setViewMode('kanban')
      setFilters({ label: null, daysOld: null, maxPerColumn: null })
      window.location.hash = `#board/${encodeURIComponent(board.id)}`
    } catch (e) {
      messageApi.error('Failed to load board data')
    } finally {
      setBoardLoading(false)
    }
  }, [messageApi])

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
                labels={[...new Set([...labels, ...tasks.flatMap(t => t.extraLabels || [])].filter(Boolean))]}
                swimlaneMode={swimlaneMode}
                onToggleSwimlaneMode={setSwimlaneMode}
                filters={filters}
                onFiltersChange={setFilters}
                compactView={compactView}
                onToggleCompactView={setCompactView}
                viewMode={viewMode}
                onViewModeChange={(val) => { setViewMode(val); if (val === 'roadmap') setCompactView(true) }}
              />
              <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
              {viewMode === 'roadmap' ? (
                <RoadmapBoard
                  boardId={activeBoard.id}
                  tasks={tasks}
                  states={states}
                  swimlanes={swimlanes}
                  labels={labels}
                  compactView={compactView}
                  onCreateTask={handleCreateTask}
                  onUpdateTask={handleUpdateTask}
                  onDeleteTask={handleDeleteTask}
                  onAddLabel={handleAddLabel}
                  onDeleteLabel={handleDeleteLabel}
                />
              ) : viewMode === 'list' ? (
                <ListView
                  boardId={activeBoard.id}
                  tasks={tasks}
                  states={states}
                  swimlanes={swimlanes}
                  labels={labels}
                  filters={filters}
                  onUpdateTask={handleUpdateTask}
                  onDeleteTask={handleDeleteTask}
                  onAddLabel={handleAddLabel}
                  onDeleteLabel={handleDeleteLabel}
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
