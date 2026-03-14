import React, { useState, useMemo } from 'react'
import { Button, Input, Typography, Popconfirm, Tooltip, Modal } from 'antd'
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
import TaskCard from './TaskCard'
import TaskModal from './TaskModal'

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
  tasks, states, swimlanes, labels,
  swimlaneMode, filters,
  onCreateTask, onUpdateTask, onDeleteTask,
  onAddState, onDeleteState,
  onAddSwimlane, onDeleteSwimlane,
  onAddLabel, onDeleteLabel
}) {
  const [selectedTask, setSelectedTask] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [activeTask, setActiveTask] = useState(null)
  const [addStateOpen, setAddStateOpen] = useState(false)
  const [addRowOpen, setAddRowOpen] = useState(false)

  const rows = swimlaneMode ? swimlanes : labels

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
      const rowMatch = swimlaneMode ? t.swimlane === row : t.label === row
      return t.state === state && rowMatch
    })
    if (filters.maxPerColumn) cellTasks = cellTasks.slice(-filters.maxPerColumn)
    return cellTasks
  }

  const handleCellClick = async (state, row) => {
    const fields = swimlaneMode
      ? { state, swimlane: row, label: '' }
      : { state, swimlane: swimlanes[0] || 'Backlog', label: row }
    const task = await onCreateTask(fields)
    setSelectedTask(task)
    setModalOpen(true)
  }

  const handleDragStart = ({ active }) => {
    const task = tasks.find(t => t.id === active.id)
    setActiveTask(task || null)
  }

  const handleDragEnd = ({ active, over }) => {
    setActiveTask(null)
    if (!over) return
    const task = tasks.find(t => t.id === active.id)
    if (!task) return

    // over.id is either a droppable cell id "state||row" or a task id
    let targetState = task.state
    let targetRow = swimlaneMode ? task.swimlane : task.label

    const overId = over.id
    if (typeof overId === 'string' && overId.includes('||')) {
      const [st, rw] = overId.split('||')
      targetState = st
      targetRow = rw
    } else {
      // dropped on another task — find its cell
      const overTask = tasks.find(t => t.id === overId)
      if (overTask) {
        targetState = overTask.state
        targetRow = swimlaneMode ? overTask.swimlane : overTask.label
      }
    }

    if (targetState === task.state && targetRow === (swimlaneMode ? task.swimlane : task.label)) return

    const update = swimlaneMode
      ? { state: targetState, swimlane: targetRow }
      : { state: targetState, label: targetRow }
    onUpdateTask(task.id, update)
  }

  const openTask = (task) => {
    setSelectedTask(task)
    setModalOpen(true)
  }

  const handleUpdateTask = async (id, fields) => {
    const updated = await onUpdateTask(id, fields)
    if (selectedTask && selectedTask.id === id) setSelectedTask(updated)
    return updated
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
                      <Typography.Text style={{ fontSize: 12, fontWeight: 500 }}>{row}</Typography.Text>
                      {rows.length > 1 && (
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
        task={selectedTask}
        states={states}
        swimlanes={swimlanes}
        labels={labels}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onUpdate={handleUpdateTask}
        onDelete={onDeleteTask}
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
