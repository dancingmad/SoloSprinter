import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Button, Typography, Modal, Input, Segmented } from 'antd'
import { LeftOutlined, RightOutlined, FullscreenOutlined, FullscreenExitOutlined } from '@ant-design/icons'
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
  const winLast   = visibleMonths[visibleMonths.length - 1]

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
  filters = {},
  swimlaneMode = true,
  onCreateTask, onUpdateTask, onDeleteTask,
  onAddLabel, onDeleteLabel,
  compactView,
  viewStart: viewStartProp,
  onViewStartChange,
  selectedTaskIds,
  onToggleTaskSelection,
}) {
  const [viewStartLocal, setViewStartLocal] = useState(defaultViewStart)
  const viewStart    = viewStartProp    ?? viewStartLocal
  const setViewStart = onViewStartChange ?? setViewStartLocal
  const [selectedTask, setSelectedTask] = useState(null)
  const [modalOpen, setModalOpen]       = useState(false)
  const [dragPreview, setDragPreview]   = useState(null)  // { taskId, months }
  const [pendingAdd, setPendingAdd]     = useState(null)  // { swimlane } awaiting title
  const [pendingTitle, setPendingTitle] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [zoomMonths, setZoomMonths]       = useState(12)

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isFullscreen])

  const draggingRef    = useRef(null)
  const dragPreviewRef = useRef(null)
  const lastDraggedRef = useRef(null)  // taskId of last drag that moved; suppresses the following click
  const gridRef        = useRef(null)

  const visibleMonths = useMemo(
    () => Array.from({ length: zoomMonths }, (_, i) => addMonths(viewStart, i)),
    [viewStart, zoomMonths],
  )

  // Quarter-group headers: consecutive months that share the same calendar quarter
  // are merged into one spanning cell. Works for any zoom level.
  const quarterGroups = useMemo(() => {
    const groups = []
    let i = 0
    while (i < visibleMonths.length) {
      const label    = quarterLabel(visibleMonths[i])
      const colorIdx = quarterIndex(visibleMonths[i])
      const startIdx = i
      while (i < visibleMonths.length && quarterLabel(visibleMonths[i]) === label) i++
      groups.push({ label, colorIdx, startIdx, span: i - startIdx })
    }
    return groups
  }, [visibleMonths])

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

  const filteredTasks = useMemo(() => {
    let result = tasks
    if (filters.labelsInclude && filters.labelsInclude.length > 0) {
      result = result.filter(t => {
        const all = [t.label, ...(t.extraLabels || [])].filter(Boolean)
        return filters.labelsInclude.some(l => all.includes(l))
      })
    }
    if (filters.daysOld) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - (filters.daysOld - 1))
      cutoff.setHours(0, 0, 0, 0)
      result = result.filter(t => t.updated && new Date(t.updated) >= cutoff)
    }
    return result
  }, [tasks, filters])

  const layoutItems = useMemo(() => {
    const items = []
    let row = 3  // rows 1+2 are sticky headers

    if (swimlaneMode) {
      // group by swimlane
      for (const swimlane of swimlanes) {
        const slTasks = filteredTasks.filter(t =>
          t.swimlane === swimlane && (getEffectiveMonths(t).length > 0)
        )
        items.push({ type: 'swimlane-header', swimlane, gridRow: row++ })
        for (const task of slTasks) {
          items.push({ type: 'task', task, gridRow: row++ })
        }
      }
    } else {
      // group by label
      for (const label of labels) {
        const labelTasks = filteredTasks.filter(t =>
          t.label === label && (getEffectiveMonths(t).length > 0)
        )
        if (labelTasks.length === 0) continue
        items.push({ type: 'label-header', label, gridRow: row++ })
        for (const task of labelTasks) {
          items.push({ type: 'task', task, gridRow: row++ })
        }
      }
      // tasks with no label
      const noLabelTasks = filteredTasks.filter(t =>
        !t.label && (getEffectiveMonths(t).length > 0)
      )
      if (noLabelTasks.length > 0) {
        items.push({ type: 'label-header', label: '(No Label)', gridRow: row++ })
        for (const task of noLabelTasks) {
          items.push({ type: 'task', task, gridRow: row++ })
        }
      }
    }

    return items
  }, [swimlanes, labels, filteredTasks, getEffectiveMonths, swimlaneMode, compactView])

  // Navigation step: 1 month in 4-month view, 1 quarter in 12-month view
  const navStep = zoomMonths === 4 ? 1 : 3

  // Range label shown between the prev/next buttons
  const headerRange = (() => {
    const first = visibleMonths[0]
    const last  = visibleMonths[visibleMonths.length - 1]
    const [fy, fm] = first.split('-').map(Number)
    const [ly, lm] = last.split('-').map(Number)
    return fy === ly
      ? `${MONTH_NAMES[fm - 1]} – ${MONTH_NAMES[lm - 1]} ${fy}`
      : `${MONTH_NAMES[fm - 1]} ${fy} – ${MONTH_NAMES[lm - 1]} ${ly}`
  })()

  return (
    <div style={isFullscreen ? {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 1000, background: '#fff', padding: 16,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    } : { display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`@keyframes fadeInBar { from { opacity: 0 } to { opacity: 1 } }`}</style>
      {/* Navigation bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Button
          icon={<LeftOutlined />}
          onClick={() => setViewStart(v => addMonths(v, -navStep))}
        >
          {zoomMonths === 4 ? 'Prev month' : 'Prev quarter'}
        </Button>
        <Typography.Text strong style={{ minWidth: 220, textAlign: 'center', display: 'inline-block' }}>
          {headerRange}
        </Typography.Text>
        <Button
          iconPosition="end"
          icon={<RightOutlined />}
          onClick={() => setViewStart(v => addMonths(v, navStep))}
        >
          {zoomMonths === 4 ? 'Next month' : 'Next quarter'}
        </Button>
        <Segmented
          value={zoomMonths}
          onChange={setZoomMonths}
          options={[
            { label: '4 months', value: 4 },
            { label: '12 months', value: 12 },
          ]}
        />
        <div style={{ flex: 1 }} />
        <Button
          icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
          onClick={() => setIsFullscreen(v => !v)}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        </Button>
      </div>

      {/* Grid */}
      <div
        ref={gridRef}
        style={{
          display: 'grid',
          gridTemplateColumns: `${ROW_HEADER_WIDTH}px repeat(${zoomMonths}, minmax(56px, 1fr))`,
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
              gridColumn: `${qg.startIdx + 2} / ${qg.startIdx + qg.span + 2}`,
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
                gridColumn: `1 / ${zoomMonths + 2}`,
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

          if (item.type === 'label-header') {
            return (
              <div key={`lh-${item.label}`} style={{
                gridColumn: `1 / ${zoomMonths + 2}`,
                gridRow: item.gridRow,
                background: '#e6f4ff',
                borderBottom: '1px solid #91caff',
                borderTop: '1px solid #91caff',
                padding: '0 10px',
                fontWeight: 600,
                fontSize: 13,
                color: '#0958d9',
                height: TASK_ROW_HEIGHT,
                display: 'flex', alignItems: 'center',
                gap: 6,
              }}>
                <span style={{
                  display: 'inline-block',
                  width: 8, height: 8,
                  borderRadius: '50%',
                  background: '#4096ff',
                  flexShrink: 0,
                }} />
                {item.label}
              </div>
            )
          }

          if (item.type === 'task') {
            const months = getEffectiveMonths(item.task)
            const range  = taskColRange(months, visibleMonths)
            const isDragging = draggingRef.current?.taskId === item.task.id
            const taskRowH = compactView ? TASK_ROW_HEIGHT : TASK_ROW_HEIGHT_EXPANDED
            const desc = compactView ? '' : descriptionPreview(item.task.description)
            const inView = range !== null
            const rowH = inView ? taskRowH : 0

            return (
              <React.Fragment key={`task-${item.task.id}`}>
                {/* Row header cell */}
                <div style={{
                  gridColumn: 1, gridRow: item.gridRow,
                  background: '#fafafa',
                  borderRight: '1px solid #e8e8e8',
                  borderBottom: '1px solid #f0f0f0',
                  height: rowH,
                  overflow: 'hidden',
                  opacity: inView ? 1 : 0,
                  transition: 'height 300ms ease, opacity 300ms ease',
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
                      height: rowH,
                      overflow: 'hidden',
                      opacity: inView ? 0.5 : 0,
                      transition: 'height 300ms ease, opacity 300ms ease',
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
                    animation: 'fadeInBar 300ms ease',
                  }}>
                    <div
                      style={{
                        flex: 1,
                        height: compactView ? 26 : 46,
                        background: Q_PALETTE[quarterIndex(months[0])].bar,
                        opacity: isDragging ? 0.75 : 1,
                        borderRadius: range.extendsBefore ? '0 4px 4px 0' : range.extendsAfter ? '4px 0 0 4px' : 4,
                        borderLeft:  range.extendsBefore ? '3px solid rgba(0,0,0,0.25)' : undefined,
                        outline: selectedTaskIds?.has(item.task.id) ? '2px solid #fff' : undefined,
                        boxShadow: selectedTaskIds?.has(item.task.id) ? '0 0 0 4px #1677ff' : '0 1px 4px rgba(0,0,0,0.18)',
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
                      }}
                      onMouseDown={e => startDrag(e, item.task, 'move')}
                      onClick={e => {
                        e.stopPropagation()
                        if (lastDraggedRef.current === item.task.id) {
                          lastDraggedRef.current = null
                          return
                        }
                        // Ctrl/Cmd+click toggles task selection
                        if (onToggleTaskSelection && (e.ctrlKey || e.metaKey)) {
                          onToggleTaskSelection(item.task.id)
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
                      {!compactView && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          width: '100%', marginTop: 2, overflow: 'hidden',
                        }}>
                          {desc && (
                            <div style={{
                              fontSize: 11,
                              opacity: 0.85,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              flex: 1,
                            }}>
                              {desc}
                            </div>
                          )}
                          {/* In swimlane-row mode show the primary label; hidden in label-row mode (redundant) */}
                          {swimlaneMode && item.task.label && (
                            <div style={{
                              fontSize: 10,
                              background: 'rgba(255,255,255,0.25)',
                              borderRadius: 3,
                              padding: '1px 5px',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}>
                              {item.task.label}
                            </div>
                          )}
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
    </div>
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
