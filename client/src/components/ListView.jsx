import React, { useState, useMemo } from 'react'
import { Table, Tag, Collapse, Typography } from 'antd'
import TaskModal from './TaskModal'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const LABEL_COLORS = ['magenta','red','volcano','orange','gold','lime','green','cyan','blue','geekblue','purple']

function labelColor(label) {
  let hash = 0
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0
  }
  return LABEL_COLORS[hash % LABEL_COLORS.length]
}

function formatMonth(ym) {
  if (!ym) return '—'
  const [y, m] = ym.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

function formatQuarters(roadmapMonths) {
  if (!roadmapMonths || roadmapMonths.length === 0) return '—'
  const [startY, startM] = roadmapMonths[0].split('-').map(Number)
  const last = roadmapMonths[roadmapMonths.length - 1]
  const [endY, endM] = last.split('-').map(Number)
  const startQ = Math.ceil(startM / 3)
  const endQ = Math.ceil(endM / 3)
  if (startY === endY && startQ === endQ) return `Q${startQ} ${startY}`
  if (startY === endY) return `Q${startQ}–Q${endQ} ${startY}`
  return `Q${startQ} ${startY} – Q${endQ} ${endY}`
}

export default function ListView({ boardId, tasks, states, swimlanes, labels, filters = {}, onUpdateTask, onDeleteTask, onAddLabel, onDeleteLabel }) {
  const [selectedTask, setSelectedTask] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  const stateOrder = useMemo(
    () => Object.fromEntries(states.map((s, i) => [s, i])),
    [states]
  )

  const filteredTasks = useMemo(() => {
    let result = [...tasks]
    if (filters.label) result = result.filter(t =>
      t.label === filters.label || (t.extraLabels || []).includes(filters.label)
    )
    if (filters.daysOld) {
      const cutoff = new Date()
      cutoff.setHours(0, 0, 0, 0)
      cutoff.setDate(cutoff.getDate() - (filters.daysOld - 1))
      const cutoffTime = cutoff.getTime()
      result = result.filter(t => t.updated && new Date(t.updated).getTime() >= cutoffTime)
    }
    return result
  }, [tasks, filters])

  function sortedTasksForSwimlane(swimlaneTasks) {
    return [...swimlaneTasks].sort((a, b) => {
      const aStart = a.roadmapMonths?.[0] || '9999-99'
      const bStart = b.roadmapMonths?.[0] || '9999-99'
      if (aStart !== bStart) return aStart < bStart ? -1 : 1
      const aState = stateOrder[a.state] ?? 999
      const bState = stateOrder[b.state] ?? 999
      if (aState !== bState) return aState - bState
      return (a.title || '').localeCompare(b.title || '')
    })
  }

  const columns = [
    {
      title: 'Feature',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <Typography.Link onClick={() => { setSelectedTask(record); setModalOpen(true) }}>
          {text || '(untitled)'}
        </Typography.Link>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'state',
      key: 'state',
      render: (state) => {
        const colorMap = {
          'Todo': 'red',
          'Work in Progress': 'gold',
          'Done': 'green',
          'Analyzing': 'blue',
        }
        const color = colorMap[state] || 'default'
        return state ? <Tag color={color}>{state}</Tag> : <span style={{ color: '#bbb' }}>—</span>
      },
    },
    {
      title: 'Type',
      dataIndex: 'label',
      key: 'label',
      render: (lbl) => lbl ? <Tag color={labelColor(lbl)}>{lbl}</Tag> : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Labels',
      dataIndex: 'extraLabels',
      key: 'extraLabels',
      render: (extraLabels) =>
        (extraLabels || []).length > 0
          ? (extraLabels).map(l => <Tag key={l} color={labelColor(l)}>{l}</Tag>)
          : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Start date',
      key: 'startDate',
      render: (_, record) => formatMonth(record.roadmapMonths?.[0]),
    },
    {
      title: 'End date',
      key: 'endDate',
      render: (_, record) => {
        const months = record.roadmapMonths
        return formatMonth(months?.[months.length - 1])
      },
    },
    {
      title: 'Quarters',
      key: 'quarters',
      render: (_, record) => formatQuarters(record.roadmapMonths),
    },
  ]

  const handleUpdateTask = async (id, fields) => {
    const updated = await onUpdateTask(id, fields)
    if (selectedTask && selectedTask.id === id) setSelectedTask(updated)
    return updated
  }

  const items = swimlanes.map(swimlane => {
    const swimlaneTasks = filteredTasks.filter(t => t.swimlane === swimlane)
    const sorted = sortedTasksForSwimlane(swimlaneTasks)
    return {
      key: swimlane,
      label: (
        <Typography.Text strong>
          {swimlane}
          <Typography.Text type="secondary" style={{ fontWeight: 400, marginLeft: 6 }}>
            ({sorted.length})
          </Typography.Text>
        </Typography.Text>
      ),
      children: (
        <Table
          columns={columns}
          dataSource={sorted}
          rowKey="id"
          pagination={false}
          size="small"
          style={{ marginBottom: 0 }}
        />
      ),
    }
  })

  return (
    <>
      <Collapse
        items={items}
        defaultActiveKey={swimlanes}
        style={{ borderRadius: 0, border: '1px solid #e8e8e8' }}
      />
      <TaskModal
        boardId={boardId}
        task={selectedTask}
        states={states}
        swimlanes={swimlanes}
        labels={labels}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onUpdate={handleUpdateTask}
        onDelete={(id) => { onDeleteTask(id); setModalOpen(false) }}
        onModalClose={() => {}}
      />
    </>
  )
}
