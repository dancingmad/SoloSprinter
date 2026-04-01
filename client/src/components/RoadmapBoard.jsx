import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Button, Typography, Modal, Input } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import TaskModal from './TaskModal'

const ROW_HEADER_WIDTH = 140
const TASK_ROW_HEIGHT = 38
const TASK_ROW_HEIGHT_EXPANDED = 58
const HEADER_ROW_HEIGHT = 30

function descriptionPreview(description) {
  if (!description) return ''
  const line = description.split('\n').find(l => l.trim() && !/^\s*[-*#>]/.test(l) && !/\[[ x]\]/i.test(l))
  if (!line) return ''
  return line.trim().slice(0, 120)
}

// Quarter palette: [bg, border, text] per quarter index (0=Q1, 1=Q2, 2=Q3, 3=Q4)
const Q_PALETTE = [
  { bg: '#e6f4ff', border: '#91caff', text: '#0958d9', bar: '#4096ff' },
  { bg: '#f6ffed', border: '#b7eb8f', text: '#389e0d', bar: '#52c41a' },
  { bg: '#fff7e6', border: '#ffd591', text: '#d46b08', bar: '#fa8c16' },
  { bg: '#f9f0ff', border: '#d3adf7', text: '#531dab', bar: '#722ed1' },
]

// ── helpers ──────────────────────────────────────────────────────────────────

function pad(n) { return String(n).padStart(2, '0') }
function ymStr(year, month) { return `${year}-${pad(month)}` }

function addMonths(ym, n) {
  let [y, m] = ym.split('-').map(Number)
  m += n
  while (m > 12) { m -= 12; y++ }
  while (m < 1)  { m += 12; y-- }
  return ymStr(y, m)
}

function quarterIndex(ym) {
  return Math.floor((parseInt(ym.split('-')[1]) - 1) / 3)  // 0-3
}

function quarterLabel(ym) {
  const [y, m] = ym.split('-').map(Number)
  return `Q${Math.floor((m - 1) / 3) + 1} ${y}`
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function monthName(ym) { return MONTH_NAMES[parseInt(ym.split('-')[1]) - 1] }

function defaultViewStart() {
  const now = new Date()
  const qStart = Math.floor(now.getMonth() / 3) * 3 + 1
  return ymStr(now.getFullYear(), qStart)
}

function generateRange(from, to) {
  if (to < from) return [from]
  const months = []
  let cur = from
  for (let i = 0; i < 48; i++) {
    months.push(cur)
    if (cur === to) break
    cur = addMonths(cur, 1)
  }
  return months
}

function taskColRange(roadmapMonths, visibleMonths) {
  if (!roadmapMonths || roadmapMonths.length === 0) return null
  const sorted = [...roadmapMonths].sort()
  const taskFirst = sorted[0]
  const taskLast  = sorted[sorted.length - 1]
  const winFirst  = visibleMonths[0]
  const winLast   = visibleMonths[11]

  if (taskLast < winFirst || taskFirst > winLast) return null

  const dispFirst = taskFirst < winFirst ? winFirst : taskFirst
  const dispLast  = taskLast  > winLast  ? winLast  : taskLast
  return {
    startIdx:      visibleMonths.indexOf(dispFirst),
    endIdx:        visibleMonths.indexOf(dispLast),
    extendsBefore: taskFirst < winFirst,
    extendsAfter:  taskLast  > winLast,
  }
}

// ── component ─────────────────────────────────────────────────────────────────

export default function RoadmapBoard({
  boardId, tasks, swimlanes, labels, states,
  onCreateTask, onUpdateTask, onDeleteTask,
  onAddLabel, onDeleteLabel,
  compactView,
}) {
  const [viewStart, setViewStart]       = useState(defaultViewStart)
  const [selectedTask, setSelectedTask] = useState(null)
  const [modalOpen, setModalOpen]       = useState(false)
  const [dragPreview, setDragPreview]   = useState(null)  // { taskId, months }
  const [pendingAdd, setPendingAdd]     = useState(null)  // { swimlane } awaiting title
  const [pendingTitle, setPendingTitle] = useState('')

  const draggingRef    = useRef(null)
  const dragPreviewRef = useRef(null)
  const lastDraggedRef = useRef(null)  // taskId of last drag that moved; suppresses the following click
  const gridRef        = useRef(null)

  const visibleMonths = useMemo(
    () => Array.from({ length: 12 }, (_, i) => addMonths(viewStart, i)),
    [viewStart],
  )

  const quarterGroups = useMemo(() =>
    [0, 1, 2, 3].map(i => ({
      months:    visibleMonths.slice(i * 3, i * 3 + 3),
      colorIdx:  quarterIndex(visibleMonths[i * 3]),
      label:     quarterLabel(visibleMonths[i * 3]),
    })),
    [visibleMonths],
  )

  const getEffectiveMonths = useCallback((task) => {
    if (dragPreview && dragPreview.taskId === task.id) return dragPreview.months
    return task.roadmapMonths || []
  }, [dragPreview])

  // ── drag ──────────────────────────────────────────────────────────────────

  const startDrag = useCallback((e, task, type) => {
    e.preventDefault()
    e.stopPropagation()
    draggingRef.current = {
      taskId: task.id,
      type,
      startX: e.clientX,
      originalMonths: [...(task.roadmapMonths || [])],
    }
    dragPreviewRef.current = null
  }, [])

  useEffect(() => {
    const colWidth = () => {
      if (!gridRef.current) return 80
      return (gridRef.current.getBoundingClientRect().width - ROW_HEADER_WIDTH) / 12
    }

    const onMove = (e) => {
      const d = draggingRef.current
      if (!d || d.originalMonths.length === 0) return
      const delta = Math.round((e.clientX - d.startX) / colWidth())
      if (delta === 0) return
      const orig = d.originalMonths

      let newMonths
      if (d.type === 'move') {
        newMonths = orig.map(m => addMonths(m, delta))
      } else {
        // resize: keep first month fixed, move last month
        const newLast = addMonths(orig[orig.length - 1], delta)
        newMonths = newLast < orig[0] ? [orig[0]] : generateRange(orig[0], newLast)
      }
      dragPreviewRef.current = newMonths
      setDragPreview({ taskId: d.taskId, months: newMonths })
    }

    const onUp = () => {
      const d = draggingRef.current
      if (d && dragPreviewRef.current) {
        lastDraggedRef.current = d.taskId  // block the click that follows mouseup
        onUpdateTask(d.taskId, { roadmapMonths: dragPreviewRef.current })
      }
      draggingRef.current   = null
      dragPreviewRef.current = null
      setDragPreview(null)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [onUpdateTask])

  // ── add task ───────────────────────────────────────────────────────────────

  const handleAddTask = useCallback((swimlane) => {
    setPendingAdd({ swimlane })
    setPendingTitle('')
  }, [])

  const handleConfirmNewTask = useCallback(async () => {
    if (!pendingTitle.trim() || !pendingAdd) return
    const task = await onCreateTask({
      state:         states[0] || 'Todo',
      swimlane:      pendingAdd.swimlane,
      label:         '',
      roadmapMonths: [visibleMonths[0]],
      title:         pendingTitle.trim(),
    })
    setPendingAdd(null)
    setPendingTitle('')
    setSelectedTask(task)
    setModalOpen(true)
  }, [pendingTitle, pendingAdd, onCreateTask, states, visibleMonths])

  const handleUpdateTask = useCallback(async (id, fields) => {
    const updated = await onUpdateTask(id, fields)
    if (selectedTask && selectedTask.id === id) setSelectedTask(updated)
    return updated
  }, [onUpdateTask, selectedTask])

  // ── layout rows ────────────────────────────────────────────────────────────

  const layoutItems = useMemo(() => {
    const items = []
    let row = 3  // rows 1+2 are sticky headers
    for (const swimlane of swimlanes) {
      const slTasks = tasks.filter(t =>
        t.swimlane === swimlane && (getEffectiveMonths(t).length > 0)
      )
      items.push({ type: 'swimlane-header', swimlane, gridRow: row++ })
      for (const task of slTasks) {
        items.push({ type: 'task', task, gridRow: row++ })
      }
      items.push({ type: 'add-task', swimlane, gridRow: row++ })
    }
    return items
  }, [swimlanes, tasks, getEffectiveMonths])

  // ── render ─────────────────────────────────────────────────────────────────

  const headerRange = `${quarterLabel(visibleMonths[0])} – ${quarterLabel(visibleMonths[9])}`

  return (
    <>
      {/* Navigation bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Button
          icon={<LeftOutlined />}
          onClick={() => setViewStart(v => addMonths(v, -3))}
        >
          Prev quarter
        </Button>
        <Typography.Text strong style={{ minWidth: 260, textAlign: 'center', display: 'inline-block' }}>
          {headerRange}
        </Typography.Text>
        <Button
          iconPosition="end"
          icon={<RightOutlined />}
          onClick={() => setViewStart(v => addMonths(v, 3))}
        >
          Next quarter
        </Button>
      </div>

      {/* Grid */}
      <div
        ref={gridRef}
        style={{
          display: 'grid',
          gridTemplateColumns: `${ROW_HEADER_WIDTH}px repeat(12, minmax(56px, 1fr))`,
          border: '1px solid #e8e8e8',
          overflowX: 'auto',
          overflowY: 'auto',
          flex: 1,
          userSelect: draggingRef.current ? 'none' : undefined,
        }}
      >
        {/* ── Header row 1: quarter groups ── */}
        <div style={{ ...stickyTH, gridColumn: 1, gridRow: 1, zIndex: 4 }} />
        {quarterGroups.map((qg, i) => {
          const p = Q_PALETTE[qg.colorIdx]
          return (
            <div key={i} style={{
              ...stickyTH,
              gridColumn: `${i * 3 + 2} / ${i * 3 + 5}`,
              gridRow: 1,
              background: p.bg,
              borderBottom: `2px solid ${p.border}`,
              color: p.text,
              fontWeight: 700,
              fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 3,
            }}>
              {qg.label}
            </div>
          )
        })}

        {/* ── Header row 2: month names ── */}
        <div style={{ ...stickyTH, gridColumn: 1, gridRow: 2, top: HEADER_ROW_HEIGHT, zIndex: 4 }} />
        {visibleMonths.map((m, i) => {
          const p = Q_PALETTE[quarterIndex(m)]
          return (
            <div key={m} style={{
              ...stickyTH,
              gridColumn: i + 2,
              gridRow: 2,
              top: HEADER_ROW_HEIGHT,
              background: p.bg,
              borderBottom: `1px solid ${p.border}`,
              color: p.text,
              fontWeight: 500,
              fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 3,
            }}>
              {monthName(m)}
            </div>
          )
        })}

        {/* ── Body rows ── */}
        {layoutItems.map((item) => {
          if (item.type === 'swimlane-header') {
            return (
              <div key={`sl-${item.swimlane}`} style={{
                gridColumn: '1 / 14',
                gridRow: item.gridRow,
                background: '#f0f2f5',
                borderBottom: '1px solid #d9d9d9',
                borderTop: '1px solid #d9d9d9',
                padding: '0 10px',
                fontWeight: 600,
                fontSize: 13,
                height: TASK_ROW_HEIGHT,
                display: 'flex', alignItems: 'center',
              }}>
                {item.swimlane}
              </div>
            )
          }

          if (item.type === 'task') {
            const months = getEffectiveMonths(item.task)
            const range  = taskColRange(months, visibleMonths)
            const isDragging = draggingRef.current?.taskId === item.task.id
            const taskRowH = compactView ? TASK_ROW_HEIGHT : TASK_ROW_HEIGHT_EXPANDED
            const desc = compactView ? '' : descriptionPreview(item.task.description)

            return (
              <React.Fragment key={`task-${item.task.id}`}>
                {/* Row header cell */}
                <div style={{
                  gridColumn: 1, gridRow: item.gridRow,
                  background: '#fafafa',
                  borderRight: '1px solid #e8e8e8',
                  borderBottom: '1px solid #f0f0f0',
                  height: taskRowH,
                }} />

                {/* Month background cells */}
                {visibleMonths.map((m, colIdx) => {
                  const p = Q_PALETTE[quarterIndex(m)]
                  const isQuarterEnd = (colIdx + 1) % 3 === 0
                  return (
                    <div key={colIdx} style={{
                      gridColumn: colIdx + 2,
                      gridRow: item.gridRow,
                      background: p.bg,
                      borderBottom: '1px solid #f0f0f0',
                      borderRight: `1px solid ${isQuarterEnd ? p.border : '#f0f0f0'}`,
                      height: taskRowH,
                      opacity: 0.5,
                    }} />
                  )
                })}

                {/* Task bar */}
                {range && (
                  <div style={{
                    gridColumn: `${range.startIdx + 2} / ${range.endIdx + 3}`,
                    gridRow: item.gridRow,
                    zIndex: 1,
                    padding: '5px 3px',
                    height: taskRowH,
                    display: 'flex',
                    alignItems: 'center',
                    position: 'relative',
                  }}>
                    <div
                      style={{
                        flex: 1,
                        height: compactView ? 26 : 46,
                        background: Q_PALETTE[quarterIndex(months[0])].bar,
                        opacity: isDragging ? 0.75 : 1,
                        borderRadius: range.extendsBefore ? '0 4px 4px 0' : range.extendsAfter ? '4px 0 0 4px' : 4,
                        borderLeft:  range.extendsBefore ? '3px solid rgba(0,0,0,0.25)' : undefined,
                        display: 'flex',
                        flexDirection: compactView ? 'row' : 'column',
                        alignItems: compactView ? 'center' : 'flex-start',
                        justifyContent: compactView ? undefined : 'center',
                        padding: compactView ? '0 22px 0 8px' : '4px 22px 4px 8px',
                        color: '#fff',
                        cursor: 'grab',
                        userSelect: 'none',
                        overflow: 'hidden',
                        position: 'relative',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                      }}
                      onMouseDown={e => startDrag(e, item.task, 'move')}
                      onClick={e => {
                        e.stopPropagation()
                        if (lastDraggedRef.current === item.task.id) {
                          lastDraggedRef.current = null
                          return
                        }
                        setSelectedTask(item.task)
                        setModalOpen(true)
                      }}
                    >
                      <div style={{
                        fontSize: 12,
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        width: '100%',
                      }}>
                        {item.task.title || '(untitled)'}
                      </div>
                      {!compactView && desc && (
                        <div style={{
                          fontSize: 11,
                          opacity: 0.85,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          width: '100%',
                          marginTop: 2,
                        }}>
                          {desc}
                        </div>
                      )}

                      {/* Right-side resize handle */}
                      <div
                        title="Drag to resize"
                        style={{
                          position: 'absolute', right: 0, top: 0, bottom: 0,
                          width: 18,
                          cursor: 'ew-resize',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(0,0,0,0.12)',
                          borderRadius: '0 4px 4px 0',
                          fontSize: 10, color: 'rgba(255,255,255,0.8)',
                        }}
                        onMouseDown={e => { e.stopPropagation(); startDrag(e, item.task, 'resize') }}
                      >
                        ⠿
                      </div>
                    </div>
                  </div>
                )}
              </React.Fragment>
            )
          }

          if (item.type === 'add-task') {
            return null
          }

          return null
        })}
      </div>

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

      <Modal
        title="New roadmap task"
        open={!!pendingAdd}
        onOk={handleConfirmNewTask}
        onCancel={() => { setPendingAdd(null); setPendingTitle('') }}
        okText="Add"
        okButtonProps={{ disabled: !pendingTitle.trim() }}
      >
        <Input
          value={pendingTitle}
          onChange={e => setPendingTitle(e.target.value)}
          onPressEnter={handleConfirmNewTask}
          placeholder="Task title..."
          autoFocus
        />
      </Modal>
    </>
  )
}

const stickyTH = {
  position: 'sticky',
  top: 0,
  background: '#f0f2f5',
  border: '1px solid #e8e8e8',
  height: HEADER_ROW_HEIGHT,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
