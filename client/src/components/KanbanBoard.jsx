import React, { useState, useMemo } from 'react'
import { Button, Input, Typography, Popconfirm, Tooltip, Modal, Tag } from 'antd'
import { PlusOutlined, MinusOutlined, HolderOutlined, EyeInvisibleOutlined, UndoOutlined } from '@ant-design/icons'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
  closestCenter
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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

function DroppableCell({ id, children, onClick, baseBg = '#fafafa' }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      style={{
        minHeight: 80,
        padding: 6,
        background: isOver ? '#e6f4ff' : baseBg,
        borderRadius: 6,
        transition: 'background 0.2s',
        cursor: 'pointer'
      }}
    >
      {children}
    </div>
  )
}

function SortableColumnHeader({ state, states, onDeleteState }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `col::${state}` })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <th ref={setNodeRef} style={{ ...thStyle, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <span {...attributes} {...listeners} style={{ cursor: 'grab', color: '#bbb', marginRight: 2, display: 'flex', alignItems: 'center' }}>
          <HolderOutlined />
        </span>
        <Typography.Text strong style={{ fontSize: 13, flex: 1 }}>{state}</Typography.Text>
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
  )
}

function SortableRowHeader({ row, rows, swimlaneMode, NO_LABEL, onDeleteSwimlane,
  isArchivedSwimlane, onArchiveSwimlane, onRestoreSwimlane, archivedMode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `row::${row}`,
    disabled: !swimlaneMode || row === NO_LABEL
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <td ref={setNodeRef} style={{ ...tdStyle, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        {swimlaneMode && row !== NO_LABEL && (
          <span {...attributes} {...listeners} style={{ cursor: 'grab', color: '#bbb', marginRight: 2, display: 'flex', alignItems: 'center' }}>
            <HolderOutlined />
          </span>
        )}
        {!swimlaneMode && row !== NO_LABEL
          ? <Tag color={labelColor(row)} style={{ fontSize: 12, margin: 0 }}>{row}</Tag>
          : <Typography.Text style={{ fontSize: 12, fontWeight: 500 }}>{row}</Typography.Text>
        }
        <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
          {/* Archive / restore swimlane — only in swimlane mode, not for pseudo-rows */}
          {swimlaneMode && row !== NO_LABEL && (
            isArchivedSwimlane ? (
              <Tooltip title="Restore swimlane">
                <Button type="text" size="small" icon={<UndoOutlined />}
                  style={{ color: '#fa8c16' }}
                  onClick={() => onRestoreSwimlane(row)} />
              </Tooltip>
            ) : (
              !archivedMode && (
                <Tooltip title="Archive swimlane">
                  <Button type="text" size="small" icon={<EyeInvisibleOutlined />}
                    style={{ color: '#8c8c8c' }}
                    onClick={() => onArchiveSwimlane(row)} />
                </Tooltip>
              )
            )
          )}
          {swimlaneMode && rows.length > 1 && row !== NO_LABEL && !archivedMode && (
            <Popconfirm
              title={`Delete row "${row}"?`}
              onConfirm={() => onDeleteSwimlane(row)}
              okText="Delete"
              okType="danger"
            >
              <Button type="text" size="small" icon={<MinusOutlined />} danger />
            </Popconfirm>
          )}
        </div>
      </div>
    </td>
  )
}

function AddNameModal({ title, placeholder = 'Enter name...', open, onOk, onCancel }) {
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
        placeholder={placeholder}
        autoFocus
      />
    </Modal>
  )
}

export default function KanbanBoard({
  boardId,
  compactView,
  tasks, states, swimlanes, labels,
  swimlaneMode, filters,
  onCreateTask, onUpdateTask, onDeleteTask,
  onAddState, onDeleteState, onReorderStates,
  onAddSwimlane, onDeleteSwimlane, onReorderSwimlanes,
  onUpdateTaskPriorities,
  selectedTaskIds, onToggleTaskSelection,
  archivedMode = false,
  archivedSwimlanes = [],
  onArchiveSwimlane,
  onRestoreSwimlane,
}) {
  const [selectedTask, setSelectedTask] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [activeTask, setActiveTask] = useState(null)
  const [addStateOpen, setAddStateOpen] = useState(false)
  const [addRowOpen, setAddRowOpen] = useState(false)
  const [pendingTask, setPendingTask] = useState(null)  // fields awaiting a title before creation

  // Apply filters first — rows in label mode are derived from filtered tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks]
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
      const cutoffTime = cutoff.getTime()
      result = result.filter(t => t.updated && new Date(t.updated).getTime() >= cutoffTime)
    }
    return result
  }, [tasks, filters])

  const NO_LABEL = '(No Label)'
  const rows = useMemo(() => {
    if (swimlaneMode) {
      // In archive mode show all swimlanes (including archived); in normal mode hide archived ones
      const effective = archivedMode
        ? swimlanes
        : swimlanes.filter(s => !archivedSwimlanes.includes(s))
      return effective
    }
    // In label mode only show rows that have at least one task after filtering.
    // (Unlike swimlane mode we don't need empty rows for drag-and-drop targets.)
    const hasNoLabel = filteredTasks.some(t => !t.label || t.label === '')
    const usedLabels = labels.filter(lbl => filteredTasks.some(t => t.label === lbl))
    return [...(hasNoLabel ? [NO_LABEL] : []), ...usedLabels]
  }, [swimlaneMode, swimlanes, labels, filteredTasks, archivedMode, archivedSwimlanes])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

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

  const handleCellClick = (state, row) => {
    if (archivedMode) return  // no creating tasks in archive view
    const fields = swimlaneMode
      ? { state, swimlane: row, label: '' }
      : { state, swimlane: swimlanes[0] || 'Backlog', label: row === NO_LABEL ? '' : row }
    setPendingTask(fields)
  }

  const handleConfirmNewTask = async (title) => {
    const task = await onCreateTask({ ...pendingTask, title })
    setPendingTask(null)
    setSelectedTask(task)
    setModalOpen(true)
  }

  const handleDragStart = ({ active }) => {
    const task = tasks.find(t => t.id === active.id)
    setActiveTask(task || null)
  }

  const handleDragEnd = async ({ active, over }) => {
    setActiveTask(null)
    if (archivedMode) return  // no drag in archive view
    if (!over || active.id === over.id) return

    // Column reorder
    if (String(active.id).startsWith('col::')) {
      const activeState = String(active.id).slice(5)
      const overState = String(over.id).slice(5)
      const oldIndex = states.indexOf(activeState)
      const newIndex = states.indexOf(overState)
      if (oldIndex !== -1 && newIndex !== -1) onReorderStates && onReorderStates(arrayMove(states, oldIndex, newIndex))
      return
    }

    // Row reorder
    if (String(active.id).startsWith('row::')) {
      const activeRow = String(active.id).slice(5)
      const overRow = String(over.id).slice(5)
      const oldIndex = swimlanes.indexOf(activeRow)
      const newIndex = swimlanes.indexOf(overRow)
      if (oldIndex !== -1 && newIndex !== -1) onReorderSwimlanes && onReorderSwimlanes(arrayMove(swimlanes, oldIndex, newIndex))
      return
    }

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

  const handleModalClose = async (task, newLabel) => {
    // Save primary label when modal closes (it is not auto-saved like title/description)
    if (newLabel !== (task.label || '')) {
      await onUpdateTask(task.id, { label: newLabel })
    }
  }

  const colWidth = `${Math.max(180, Math.floor(100 / (states.length + 1)))}px`

  return (
    <>
      <DndContext
        sensors={archivedMode ? [] : sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div>
          <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 120 }} />
              {states.map(s => <col key={s} style={{ width: colWidth }} />)}
              <col style={{ width: 48 }} />
            </colgroup>
            <thead>
                  <SortableContext items={states.map(s => `col::${s}`)} strategy={horizontalListSortingStrategy}>
                  <tr>
                    <th style={thStyle}></th>
                    {states.map(state => (
                      <SortableColumnHeader
                        key={state}
                        state={state}
                        states={states}
                        onDeleteState={onDeleteState}
                      />
                    ))}
                    <th style={thStyle}>
                      {!archivedMode && (
                      <Tooltip title="Add column">
                        <Button
                          type="dashed"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => setAddStateOpen(true)}
                        />
                      </Tooltip>
                      )}
                    </th>
                  </tr>
                </SortableContext>
            </thead>
            <tbody>
                <SortableContext items={(swimlaneMode ? swimlanes : rows).map(r => `row::${r}`)} strategy={verticalListSortingStrategy}>
              {rows.map((row, rowIndex) => {
                const rowBg = rowIndex % 2 === 0 ? '#f0ebfa' : '#eaf1fb'
                return (
                <tr key={row} style={{
                    background: archivedSwimlanes.includes(row) ? '#fff7e6' : rowBg
                  }}>
                  <SortableRowHeader
                    row={row}
                    rows={rows}
                    swimlaneMode={swimlaneMode}
                    NO_LABEL={NO_LABEL}
                    onDeleteSwimlane={onDeleteSwimlane}
                    isArchivedSwimlane={archivedSwimlanes.includes(row)}
                    onArchiveSwimlane={onArchiveSwimlane}
                    onRestoreSwimlane={onRestoreSwimlane}
                    archivedMode={archivedMode}
                  />
                  {states.map(state => {
                    const cellId = `${state}||${row}`
                    const cellTasks = getTasksForCell(state, row)
                    return (
                      <td key={state} style={{ ...tdStyle, verticalAlign: 'top', padding: 4 }}>
                        <SortableContext items={cellTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                          <DroppableCell
                            id={cellId}
                            baseBg={rowBg}
                            onClick={(e) => {
                              if (e.target === e.currentTarget) handleCellClick(state, row)
                            }}
                          >
                            {cellTasks.map(task => (
                              <TaskCard
                                key={task.id}
                                task={task}
                                compactView={compactView}
                                swimlaneMode={swimlaneMode}
                                selected={selectedTaskIds?.has(task.id)}
                                onToggleSelect={onToggleTaskSelection}
                                onClick={(e) => { e.stopPropagation(); openTask(task) }}
                              />
                            ))}
                            {cellTasks.length === 0 && !archivedMode && (
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
                )
              })}
                </SortableContext>
              <tr>
                <td style={tdStyle}>
                  {swimlaneMode && !archivedMode && (
                  <Tooltip title="Add swimlane">
                    <Button
                      type="dashed"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => setAddRowOpen(true)}
                    />
                  </Tooltip>
                  )}
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
              <TaskCard task={activeTask} compactView={compactView} swimlaneMode={swimlaneMode} onClick={() => {}} />
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
        readOnly={archivedMode}
      />

      <AddNameModal
        title="Add new column (state)"
        open={addStateOpen}
        onOk={(name) => { onAddState(name); setAddStateOpen(false) }}
        onCancel={() => setAddStateOpen(false)}
      />

      <AddNameModal
        title="Add new swimlane"
        open={addRowOpen}
        onOk={(name) => { onAddSwimlane(name); setAddRowOpen(false) }}
        onCancel={() => setAddRowOpen(false)}
      />

      <AddNameModal
        title="New task"
        placeholder="Task title..."
        open={!!pendingTask}
        onOk={handleConfirmNewTask}
        onCancel={() => setPendingTask(null)}
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
