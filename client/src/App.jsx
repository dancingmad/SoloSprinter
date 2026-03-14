import React, { useEffect, useState, useCallback } from 'react'
import { ConfigProvider, theme, Layout, Typography, Spin, message } from 'antd'
import KanbanBoard from './components/KanbanBoard'
import FilterBar from './components/FilterBar'
import {
  fetchTasks, fetchStates, fetchSwimlanes, fetchLabels,
  createTask, updateTask, deleteTask,
  addState, deleteState, addSwimlane, deleteSwimlane,
  addLabel, deleteLabel
} from './api'

const { Header, Content } = Layout

export default function App() {
  const [tasks, setTasks] = useState([])
  const [states, setStates] = useState([])
  const [swimlanes, setSwimlanes] = useState([])
  const [labels, setLabels] = useState([])
  const [loading, setLoading] = useState(true)
  const [swimlaneMode, setSwimlaneMode] = useState(true) // true = swimlane rows, false = label rows
  const [filters, setFilters] = useState({ label: null, dateFrom: null, dateTo: null, maxPerColumn: null })
  const [messageApi, contextHolder] = message.useMessage()

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [t, s, sw, lb] = await Promise.all([fetchTasks(), fetchStates(), fetchSwimlanes(), fetchLabels()])
      setTasks(t)
      setStates(s)
      setSwimlanes(sw)
      setLabels(lb)
    } catch (e) {
      messageApi.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [messageApi])

  useEffect(() => { reload() }, [reload])

  const handleCreateTask = async (fields) => {
    const task = await createTask(fields)
    setTasks(prev => [...prev, task])
    return task
  }

  const handleUpdateTask = async (id, fields) => {
    const task = await updateTask(id, fields)
    setTasks(prev => prev.map(t => t.id === id ? task : t))
    return task
  }

  const handleDeleteTask = async (id) => {
    await deleteTask(id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const handleAddState = async (name) => {
    const result = await addState(name)
    if (result.error) { messageApi.error(result.error); return }
    setStates(result)
  }

  const handleDeleteState = async (name) => {
    const result = await deleteState(name)
    if (result.error) { messageApi.error(result.error); return }
    setStates(result)
  }

  const handleAddSwimlane = async (name) => {
    const result = await addSwimlane(name)
    if (result.error) { messageApi.error(result.error); return }
    setSwimlanes(result)
  }

  const handleDeleteSwimlane = async (name) => {
    const result = await deleteSwimlane(name)
    if (result.error) { messageApi.error(result.error); return }
    setSwimlanes(result)
  }

  const handleAddLabel = async (name) => {
    const result = await addLabel(name)
    if (result.error) { messageApi.error(result.error); return }
    setLabels(result)
  }

  const handleDeleteLabel = async (name) => {
    const result = await deleteLabel(name)
    if (result.error) { messageApi.error(result.error); return }
    setLabels(result)
  }

  return (
    <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
      {contextHolder}
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px', background: '#1677ff' }}>
          <Typography.Title level={3} style={{ color: '#fff', margin: 0 }}>
            🏃 SoloSprinter
          </Typography.Title>
        </Header>
        <Content style={{ padding: '16px', overflow: 'auto' }}>
          {loading ? (
            <Spin size="large" style={{ display: 'block', marginTop: 80, textAlign: 'center' }} />
          ) : (
            <>
              <FilterBar
                labels={labels}
                swimlaneMode={swimlaneMode}
                onToggleSwimlaneMode={setSwimlaneMode}
                filters={filters}
                onFiltersChange={setFilters}
              />
              <KanbanBoard
                tasks={tasks}
                states={states}
                swimlanes={swimlanes}
                labels={labels}
                swimlaneMode={swimlaneMode}
                filters={filters}
                onCreateTask={handleCreateTask}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={handleDeleteTask}
                onAddState={handleAddState}
                onDeleteState={handleDeleteState}
                onAddSwimlane={handleAddSwimlane}
                onDeleteSwimlane={handleDeleteSwimlane}
                onAddLabel={handleAddLabel}
                onDeleteLabel={handleDeleteLabel}
              />
            </>
          )}
        </Content>
      </Layout>
    </ConfigProvider>
  )
}
