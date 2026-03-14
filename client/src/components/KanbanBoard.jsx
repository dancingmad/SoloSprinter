import React, { useState, useMemo } from 'react'
import { Button, Input, Typography, Popconfirm, Tooltip, Modal, Tag } from 'antd'
import { PlusOutlined, MinusOutlined } from '@ant-design/icons'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { updateTaskPriorities } from '../api'
import TaskCard from './TaskCard'
import TaskModal from './TaskModal'

const LABEL_COLORS = ['magenta','red','volcano','orange','gold','lime','green','cyan','blue','geekblue','purple']

function labelColor(label) {
  let hash = 0
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0
  }
  return LABEL_COLORS[hash % LABEL_COLORS.length]
}

function DroppableCell({ id, children, onClick }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      style={{
        minHeight: 80,
        padding: 6,
        background: isOver ? '#e6f4ff' : '#fafafa',
        borderRadius: 6,
        transition: 'background 0.2s',
        cursor: 'pointer'
      }}
    >
      {children}
    </div>
  )
}

function AddNameModal({ title, open, onOk, onCancel }) {
  const [val, setVal] = useState('')
  return (
    <Modal
      title={title}
      open={open}
      onOk={() => { if (val.trim()) { onOk(val.trim()); setVal('') } }}
      onCancel={() => { setVal(''); onCancel() }}
      okText="Add"
    >
      <Input
        value={val}
        onChange={e => setVal(e.target.value)}
        onPressEnter={() => { if (val.trim()) { onOk(val.trim()); setVal('') } }}
        placeholder="Enter name..."
        autoFocus
      />
    </Modal>
  )
}

export default function KanbanBoard({
  boardId,
  tasks, states, swimlanes, labels,
  swimlaneMode, filters,
  onCreateTask, onUpdateTask, onDeleteTask,
  onAddState, onDeleteState,
  onAddSwimlane, onDeleteSwimlane,
  onAddLabel, onDeleteLabel,
  onUpdateTaskPriorities
}) {
  const [selectedTask, setSelectedTask] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [activeTask, setActiveTask] = useState(null)
  const [addStateOpen, setAddStateOpen] = useState(false)
  const [addRowOpen, setAddRowOpen] = useState(false)

  const NO_LABEL = '(No Label)'
  const rows = swimlaneMode ? swimlanes : [NO_LABEL, ...labels]

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Apply filters
  const filteredTasks = useMemo(() => {
    let result = [...tasks]
    if (filters.label) result = result.filter(t => t.label === filters.label)
    if (filters.dateFrom) result = result.filter(t => t.created && t.created >= filters.dateFrom)
    if (filters.dateTo) result = result.filter(t => t.created && t.created <= filters.dateTo + 'T23:59:59')
    return result
  }, [tasks, filters])

  const getTasksForCell = (state, row) => {
    let cellTasks = filteredTasks.filter(t => {
      let rowMatch
      if (!swimlaneMode && row === NO_LABEL) {
        rowMatch = !t.label || t.label === ''
      } else {
        rowMatch = swimlaneMode ? t.swimlane === row : t.label === row
      }
      return t.state === state && rowMatch
    })
    cellTasks.sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999))
    if (filters.maxPerColumn) cellTasks = cellTasks.slice(0, filters.maxPerColumn)
    return cellTasks
  }

  const handleCellClick = async (state, row) => {
    const fields = swimlaneMode
      ? { state, swimlane: row, label: '' }
      : { state, swimlane: swimlanes[0] || 'Backlog', label: row === NO_LABEL ? '' : row }
    const task = await onCreateTask(fields)
    setSelectedTask(task)
    setModalOpen(true)
  }

  const handleDragStart = ({ active }) => {
    const task = tasks.find(t => t.id === active.id)
    setActiveTask(task || null)
  }

  const handleDragEnd = async ({ active, over }) => {
    setActiveTask(null)
    if (!over) return
    const task = tasks.find(t => t.id === active.id)
    if (!task) return

    // over.id is either a droppable cell id "state||row" or a task id
    let targetState = task.state
    let targetRow = swimlaneMode ? task.swimlane : task.label
    let insertBeforeId = null

    const overId = over.id
    if (typeof overId === 'string' && overId.includes('||')) {
      const [st, rw] = overId.split('||')
      targetState = st
      targetRow = rw
    } else {
      // dropped on another task — find its cell and insert before it
      const overTask = tasks.find(t => t.id === overId)
      if (overTask) {
        targetState = overTask.state
        targetRow = swimlaneMode ? overTask.swimlane : overTask.label
        insertBeforeId = overId
      }
    }

    const sourceRow = swimlaneMode ? task.swimlane : task.label
    const movingCell = targetState !== task.state || targetRow !== sourceRow
    const newLabel = swimlaneMode ? task.label : (targetRow === NO_LABEL ? '' : targetRow)

    // Build the new ordered list for the target cell
    const targetRowKey = swimlaneMode ? targetRow : (targetRow === NO_LABEL ? '' : targetRow)
    let targetCellTasks = tasks
      .filter(t => {
        if (t.id === task.id) return false
        const rowVal = swimlaneMode ? t.swimlane : t.label
        return t.state === targetState && rowVal === targetRowKey
      })
      .sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999))

    // Insert the dragged task at the right position
    const insertIdx = insertBeforeId ? targetCellTasks.findIndex(t => t.id === insertBeforeId) : -1
    if (insertIdx >= 0) {
      targetCellTasks.splice(insertIdx, 0, task)
    } else {
      targetCellTasks.push(task)
    }

    // Assign sequential priorities
    const priorityUpdates = targetCellTasks.map((t, i) => ({ id: t.id, priority: i }))

    if (movingCell) {
      const update = swimlaneMode
        ? { state: targetState, swimlane: targetRow }
        : { state: targetState, label: newLabel }
      await onUpdateTask(task.id, update)
    }

    // Also reassign priorities for the source cell if task moved away
    if (movingCell) {
      const sourceRowKey = swimlaneMode ? sourceRow : (sourceRow === NO_LABEL ? '' : sourceRow)
      const sourceCellTasks = tasks
        .filter(t => t.id !== task.id && t.state === task.state && (swimlaneMode ? t.swimlane : t.label) === sourceRowKey)
        .sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999))
      sourceCellTasks.forEach((t, i) => priorityUpdates.push({ id: t.id, priority: i }))
    }

    onUpdateTaskPriorities && onUpdateTaskPriorities(priorityUpdates)
    await updateTaskPriorities(boardId, priorityUpdates)

    // In label mode, clean up labels that no longer have any tasks
    if (!swimlaneMode && movingCell) {
      const allTasks = tasks.map(t => t.id === task.id ? { ...t, label: newLabel } : t)
      for (const lbl of labels) {
        if (lbl && !allTasks.some(t => t.label === lbl)) {
          await onDeleteLabel(lbl)
        }
      }
    }
  }

  const openTask = (task) => {
    setSelectedTask(task)
    setModalOpen(true)
  }

  const handleUpdateTask = async (id, fields) => {
    const updated = await onUpdateTask(id, fields)
    if (selectedTask && selectedTask.id === id) setSelectedTask(updated)
    // Clean up labels with no tasks after a label change
    if ('label' in fields) {
      const allTasks = tasks.map(t => t.id === id ? { ...t, label: fields.label } : t)
      for (const lbl of labels) {
        if (lbl && !allTasks.some(t => t.label === lbl)) {
          await onDeleteLabel(lbl)
        }
      }
    }
    return updated
  }

  const handleModalClose = async (task, newLabel) => {
    // Save label if it changed
    if (newLabel !== (task.label || '')) {
      await onUpdateTask(task.id, { label: newLabel })
    }
    // Add to config if it's a new non-empty label
    if (newLabel && !labels.includes(newLabel)) {
      await onAddLabel(newLabel)
    }
    // Remove labels that no longer have any tasks
    const allTasks = tasks.map(t => t.id === task.id ? { ...t, label: newLabel } : t)
    for (const lbl of labels) {
      if (lbl && !allTasks.some(t => t.label === lbl)) {
        await onDeleteLabel(lbl)
      }
    }
  }

  const colWidth = `${Math.max(180, Math.floor(100 / (states.length + 1)))}px`

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 120 }} />
              {states.map(s => <col key={s} style={{ width: colWidth }} />)}
              <col style={{ width: 48 }} />
            </colgroup>
            <thead>
              <tr>
                <th style={thStyle}></th>
                {states.map(state => (
                  <th key={state} style={thStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                      <Typography.Text strong style={{ fontSize: 13 }}>{state}</Typography.Text>
                      {states.length > 3 && (
                        <Popconfirm
                          title={`Delete column "${state}"?`}
                          onConfirm={() => onDeleteState(state)}
                          okText="Delete"
                          okType="danger"
                        >
                          <Button type="text" size="small" icon={<MinusOutlined />} danger />
                        </Popconfirm>
                      )}
                    </div>
                  </th>
                ))}
                <th style={thStyle}>
                  <Tooltip title="Add column">
                    <Button
                      type="dashed"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => setAddStateOpen(true)}
                    />
                  </Tooltip>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row}>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                      {!swimlaneMode && row !== NO_LABEL
                        ? <Tag color={labelColor(row)} style={{ fontSize: 12, margin: 0 }}>{row}</Tag>
                        : <Typography.Text style={{ fontSize: 12, fontWeight: 500 }}>{row}</Typography.Text>
                      }
                      {rows.length > 1 && row !== NO_LABEL && (
                        <Popconfirm
                          title={`Delete row "${row}"?`}
                          onConfirm={() => swimlaneMode ? onDeleteSwimlane(row) : onDeleteLabel(row)}
                          okText="Delete"
                          okType="danger"
                        >
                          <Button type="text" size="small" icon={<MinusOutlined />} danger />
                        </Popconfirm>
                      )}
                    </div>
                  </td>
                  {states.map(state => {
                    const cellId = `${state}||${row}`
                    const cellTasks = getTasksForCell(state, row)
                    return (
                      <td key={state} style={{ ...tdStyle, verticalAlign: 'top', padding: 4 }}>
                        <SortableContext items={cellTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                          <DroppableCell
                            id={cellId}
                            onClick={(e) => {
                              if (e.target === e.currentTarget) handleCellClick(state, row)
                            }}
                          >
                            {cellTasks.map(task => (
                              <TaskCard
                                key={task.id}
                                task={task}
                                onClick={(e) => { e.stopPropagation(); openTask(task) }}
                              />
                            ))}
                            {cellTasks.length === 0 && (
                              <div
                                style={{ color: '#ccc', fontSize: 12, textAlign: 'center', paddingTop: 20 }}
                                onClick={() => handleCellClick(state, row)}
                              >
                                + add task
                              </div>
                            )}
                          </DroppableCell>
                        </SortableContext>
                      </td>
                    )
                  })}
                  <td style={tdStyle}></td>
                </tr>
              ))}
              <tr>
                <td style={tdStyle}>
                  <Tooltip title={swimlaneMode ? 'Add swimlane' : 'Add label'}>
                    <Button
                      type="dashed"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => setAddRowOpen(true)}
                    />
                  </Tooltip>
                </td>
                {states.map(s => <td key={s} style={tdStyle}></td>)}
                <td style={tdStyle}></td>
              </tr>
            </tbody>
          </table>
        </div>

        <DragOverlay>
          {activeTask && (
            <div style={{ width: 220, opacity: 0.9 }}>
              <TaskCard task={activeTask} onClick={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <TaskModal
        boardId={boardId}
        task={selectedTask}
        states={states}
        swimlanes={swimlanes}
        labels={labels}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onUpdate={handleUpdateTask}
        onDelete={onDeleteTask}
        onModalClose={handleModalClose}
      />

      <AddNameModal
        title="Add new column (state)"
        open={addStateOpen}
        onOk={(name) => { onAddState(name); setAddStateOpen(false) }}
        onCancel={() => setAddStateOpen(false)}
      />

      <AddNameModal
        title={swimlaneMode ? 'Add new swimlane' : 'Add new label'}
        open={addRowOpen}
        onOk={(name) => {
          swimlaneMode ? onAddSwimlane(name) : onAddLabel(name)
          setAddRowOpen(false)
        }}
        onCancel={() => setAddRowOpen(false)}
      />
    </>
  )
}

const thStyle = {
  padding: '8px 6px',
  background: '#f0f2f5',
  border: '1px solid #e8e8e8',
  textAlign: 'left',
  position: 'sticky',
  top: 0,
  zIndex: 2
}

const tdStyle = {
  border: '1px solid #e8e8e8',
  padding: '4px 6px',
  verticalAlign: 'middle'
}
