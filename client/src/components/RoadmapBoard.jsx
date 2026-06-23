import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Button, Typography, Modal, Input, Select, Tooltip } from 'antd'
import { LeftOutlined, RightOutlined, FullscreenOutlined, FullscreenExitOutlined, EyeInvisibleOutlined, UndoOutlined, UnorderedListOutlined } from '@ant-design/icons'
import TaskModal from './TaskModal'

const ROW_HEADER_WIDTH = 140
const TASK_ROW_HEIGHT = 38
const TASK_ROW_HEIGHT_EXPANDED = 58
const HEADER_ROW_HEIGHT = 30

function descriptionPreview(description) {
  if (!description) return ''
  const line = description.split('\n').find(l => l.trim() && !/^\s*[-*#>]/.test(l) && !/\[[ x]\]/i.test(l))
  if (!line) return ''
  const stripped = line
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1')
    .trim()
  return stripped.slice(0, 120)
}

// Quarter palette: [bg, border, text, bar] per quarter index (0=Q1 … 3=Q4)
const Q_PALETTE = [
  { bg: '#e6f4ff', border: '#91caff', text: '#0958d9', bar: '#4096ff' },
  { bg: '#f6ffed', border: '#b7eb8f', text: '#389e0d', bar: '#52c41a' },
  { bg: '#fff7e6', border: '#ffd591', text: '#d46b08', bar: '#fa8c16' },
  { bg: '#f9f0ff', border: '#d3adf7', text: '#531dab', bar: '#722ed1' },
]

// Returns a solid light tint of a hex colour by mixing it with white.
function lightenHex(hex, amount = 0.85) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.round(r + (255 - r) * amount)},${Math.round(g + (255 - g) * amount)},${Math.round(b + (255 - b) * amount)})`
}

// Presentation-mode row colour palette (cycles if more than 10 rows)
const PRESENTATION_COLORS = [
  '#1677ff', '#52c41a', '#fa8c16', '#722ed1', '#13c2c2',
  '#eb2f96', '#f5222d', '#2f54eb', '#fa541c', '#a0d911',
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
  return Math.floor((parseInt(ym.split('-')[1]) - 1) / 3)
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

// ── State-based bar styling (normal mode only) ────────────────────────────────
const ACTIVE_STATES = new Set(['work in progress', 'wip', 'ready', 'rollout'])

function barStateStyle(task) {
  const state = (task.state || '').toLowerCase().trim()

  if (state === 'done') {
    return { barColor: '#8c8c8c', barOpacity: 0.4, strikethrough: true }
  }
  if (ACTIVE_STATES.has(state)) {
    return { barColor: null, barOpacity: 1, strikethrough: false }
  }

  const startMonth = [...(task.roadmapMonths || [])].sort()[0]
  if (!startMonth) return { barColor: null, barOpacity: 0.6, strikethrough: false }

  const now = new Date()
  const [sy, sm] = startMonth.split('-').map(Number)
  const distanceMonths = (sy - now.getFullYear()) * 12 + (sm - (now.getMonth() + 1))

  if (distanceMonths <= 0) return { barColor: null, barOpacity: 0.7, strikethrough: false }

  const barOpacity = Math.max(0.3, 0.7 - (distanceMonths / 12) * 0.4)
  return { barColor: null, barOpacity, strikethrough: false }
}


// ── component ─────────────────────────────────────────────────────────────────

export default function RoadmapBoard({
  boardId, tasks, swimlanes, labels, states,
  filters = {},
  swimlaneMode = true,
  onCreateTask, onUpdateTask, onDeleteTask,
  compactView,
  viewStart: viewStartProp,
  onViewStartChange,
  selectedTaskIds,
  onToggleTaskSelection,
  archivedMode = false,
  archivedSwimlanes = [],
  onArchiveSwimlane,
  onRestoreSwimlane,
}) {
  const [viewStartLocal, setViewStartLocal]     = useState(defaultViewStart)
  const viewStart    = viewStartProp    ?? viewStartLocal
  const setViewStart = onViewStartChange ?? setViewStartLocal

  const [selectedTask, setSelectedTask]         = useState(null)
  const [modalOpen, setModalOpen]               = useState(false)
  const [dragPreview, setDragPreview]           = useState(null)
  const [pendingAdd, setPendingAdd]             = useState(null)
  const [pendingTitle, setPendingTitle]         = useState('')
  const [isPresentationMode, setIsPresentationMode] = useState(false)
  const [showRowDividers, setShowRowDividers]         = useState(false)
  const [zoomMonths, setZoomMonths]             = useState(3)

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && isPresentationMode) setIsPresentationMode(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isPresentationMode])

  const draggingRef    = useRef(null)
  const dragPreviewRef = useRef(null)
  const lastDraggedRef = useRef(null)
  const gridRef        = useRef(null)

  const visibleMonths = useMemo(
    () => Array.from({ length: zoomMonths }, (_, i) => addMonths(viewStart, i)),
    [viewStart, zoomMonths],
  )

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
    if (archivedMode || isPresentationMode) return
    e.preventDefault()
    e.stopPropagation()
    draggingRef.current = {
      taskId: task.id,
      type,
      startX: e.clientX,
      originalMonths: [...(task.roadmapMonths || [])],
    }
    dragPreviewRef.current = null
  }, [archivedMode, isPresentationMode])

  useEffect(() => {
    const colWidth = () => {
      if (!gridRef.current) return 80
      const gridW = gridRef.current.getBoundingClientRect().width
      return (gridW - (isPresentationMode ? 0 : ROW_HEADER_WIDTH)) / zoomMonths
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
        const newLast = addMonths(orig[orig.length - 1], delta)
        newMonths = newLast < orig[0] ? [orig[0]] : generateRange(orig[0], newLast)
      }
      dragPreviewRef.current = newMonths
      setDragPreview({ taskId: d.taskId, months: newMonths })
    }

    const onUp = () => {
      const d = draggingRef.current
      if (d && dragPreviewRef.current) {
        lastDraggedRef.current = d.taskId
        onUpdateTask(d.taskId, { roadmapMonths: dragPreviewRef.current })
      }
      draggingRef.current    = null
      dragPreviewRef.current = null
      setDragPreview(null)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [onUpdateTask, isPresentationMode, zoomMonths])

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

  // ── filtered tasks ─────────────────────────────────────────────────────────

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

  // ── layout rows ────────────────────────────────────────────────────────────

  const layoutItems = useMemo(() => {
    const items = []
    let row = 3  // rows 1+2 are sticky headers

    if (swimlaneMode) {
      const effectiveSwimlanes = archivedMode
        ? swimlanes
        : swimlanes.filter(s => !archivedSwimlanes.includes(s))
      for (const swimlane of effectiveSwimlanes) {
        const slTasks = filteredTasks.filter(t =>
          t.swimlane === swimlane && (getEffectiveMonths(t).length > 0)
        )
        items.push({ type: 'swimlane-header', swimlane, gridRow: row++ })
        for (const task of slTasks) {
          items.push({ type: 'task', task, gridRow: row++, rowKey: swimlane })
        }
      }
    } else {
      for (const label of labels) {
        const labelTasks = filteredTasks.filter(t =>
          t.label === label && (getEffectiveMonths(t).length > 0)
        )
        if (labelTasks.length === 0) continue
        items.push({ type: 'label-header', label, gridRow: row++ })
        for (const task of labelTasks) {
          items.push({ type: 'task', task, gridRow: row++, rowKey: label })
        }
      }
      const noLabelTasks = filteredTasks.filter(t =>
        !t.label && (getEffectiveMonths(t).length > 0)
      )
      if (noLabelTasks.length > 0) {
        items.push({ type: 'label-header', label: '(No Label)', gridRow: row++ })
        for (const task of noLabelTasks) {
          items.push({ type: 'task', task, gridRow: row++, rowKey: '(No Label)' })
        }
      }
    }

    return items
  }, [swimlanes, labels, filteredTasks, getEffectiveMonths, swimlaneMode, compactView, archivedSwimlanes, archivedMode])

  // ── presentation mode: row → colour mapping ────────────────────────────────

  const presentationRows = useMemo(() => {
    if (swimlaneMode) {
      return swimlanes.filter(s => !archivedSwimlanes.includes(s))
    }
    const usedLabels = labels.filter(l =>
      filteredTasks.some(t => t.label === l && (t.roadmapMonths || []).length > 0)
    )
    const hasNoLabel = filteredTasks.some(t =>
      !t.label && (t.roadmapMonths || []).length > 0
    )
    return [...usedLabels, ...(hasNoLabel ? ['(No Label)'] : [])]
  }, [swimlaneMode, swimlanes, labels, filteredTasks, archivedSwimlanes])

  const rowColorMap = useMemo(() => {
    const map = {}
    presentationRows.forEach((row, i) => {
      map[row] = PRESENTATION_COLORS[i % PRESENTATION_COLORS.length]
    })
    return map
  }, [presentationRows])

  // ── navigation ─────────────────────────────────────────────────────────────

  const navStep   = zoomMonths === 3 ? 1 : zoomMonths === 6 ? 2 : 3
  const prevLabel = zoomMonths === 3 ? 'Prev month' : zoomMonths === 6 ? 'Prev 2 months' : 'Prev quarter'
  const nextLabel = zoomMonths === 3 ? 'Next month' : zoomMonths === 6 ? 'Next 2 months' : 'Next quarter'

  const headerRange = (() => {
    const first = visibleMonths[0]
    const last  = visibleMonths[visibleMonths.length - 1]
    const [fy, fm] = first.split('-').map(Number)
    const [ly, lm] = last.split('-').map(Number)
    return fy === ly
      ? `${MONTH_NAMES[fm - 1]} – ${MONTH_NAMES[lm - 1]} ${fy}`
      : `${MONTH_NAMES[fm - 1]} ${fy} – ${MONTH_NAMES[lm - 1]} ${ly}`
  })()

  // Presentation font size: uniform across all bars, scales down as task count grows.
  // Formula: clamp(11, 150 / max(taskCount, 6), 22)
  const presentationTaskCount = layoutItems.filter(i => i.type === 'task').length
  const presentationFontSize  = Math.max(14, Math.min(26, Math.round(180 / Math.max(presentationTaskCount, 6))))

  // Col 1 is always the row-header / pre-column; month content starts at col 2.
  const colOff = 2

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div style={isPresentationMode ? {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 1000, background: '#fff', padding: 16,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    } : { display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`@keyframes fadeInBar { from { opacity: 0 } to { opacity: 1 } }`}</style>

      {/* ── Navigation bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Button
          icon={<LeftOutlined />}
          onClick={() => setViewStart(v => addMonths(v, -navStep))}
        >
          {prevLabel}
        </Button>
        <Typography.Text strong style={{ minWidth: 220, textAlign: 'center', display: 'inline-block' }}>
          {headerRange}
        </Typography.Text>
        <Button
          iconPosition="end"
          icon={<RightOutlined />}
          onClick={() => setViewStart(v => addMonths(v, navStep))}
        >
          {nextLabel}
        </Button>
        <Select
          value={zoomMonths}
          onChange={setZoomMonths}
          style={{ width: 130 }}
          options={[
            { label: '3 months', value: 3 },
            { label: '6 months', value: 6 },
            { label: '9 months', value: 9 },
            { label: '12 months', value: 12 },
          ]}
        />
        {isPresentationMode && (
          <Button
            icon={<UnorderedListOutlined />}
            onClick={() => setShowRowDividers(v => !v)}
            type={showRowDividers ? 'primary' : 'default'}
          >
            Row labels
          </Button>
        )}
        <div style={{ flex: 1 }} />
        <Button
          type={isPresentationMode ? 'primary' : 'default'}
          icon={isPresentationMode ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
          onClick={() => setIsPresentationMode(v => !v)}
        >
          {isPresentationMode ? 'Exit Presentation' : 'Presentation'}
        </Button>
      </div>

      {/* ── Grid ── */}
      <div
        ref={gridRef}
        style={{
          display: 'grid',
          gridTemplateColumns: isPresentationMode
            ? `minmax(120px, 1fr) repeat(${zoomMonths}, minmax(80px, 1fr))`
            : `${ROW_HEADER_WIDTH}px repeat(${zoomMonths}, minmax(56px, 1fr))`,
          border: isPresentationMode ? 'none' : '1px solid #e8e8e8',
          background: isPresentationMode ? '#fff' : undefined,
          overflowX: 'auto',
          overflowY: 'auto',
          flex: 1,
          userSelect: draggingRef.current ? 'none' : undefined,
        }}
      >
        {/* ── Header row 1: quarter groups ── */}
        {/* Col 1: row-header corner (normal) or blank pre-column (presentation) */}
        <div style={{
          ...stickyTH,
          gridColumn: 1, gridRow: 1, zIndex: 4,
          background: isPresentationMode ? '#fff' : undefined,
          border: isPresentationMode ? 'none' : undefined,
          borderBottom: isPresentationMode ? 'none' : undefined,
        }} />
        {quarterGroups.map((qg, i) => {
          const p = Q_PALETTE[qg.colorIdx]
          return (
            <div key={i} style={{
              ...stickyTH,
              gridColumn: `${qg.startIdx + colOff} / ${qg.startIdx + qg.span + colOff}`,
              gridRow: 1,
              background: isPresentationMode ? p.bar : p.bg,
              border: isPresentationMode ? 'none' : undefined,
              borderRight: isPresentationMode ? '2px solid rgba(255,255,255,0.35)' : undefined,
              borderBottom: isPresentationMode ? 'none' : `2px solid ${p.border}`,
              color: isPresentationMode ? '#fff' : p.text,
              fontWeight: 700,
              fontSize: isPresentationMode ? 16 : 13,
              letterSpacing: isPresentationMode ? '0.03em' : undefined,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 3,
            }}>
              {qg.label}
            </div>
          )
        })}

        {/* ── Header row 2: month names ── */}
        {/* Col 1: row-header corner (normal) or blank pre-column (presentation) */}
        <div style={{
          ...stickyTH,
          gridColumn: 1, gridRow: 2, top: HEADER_ROW_HEIGHT, zIndex: 4,
          background: isPresentationMode ? '#fff' : undefined,
          border: isPresentationMode ? 'none' : undefined,
          borderBottom: isPresentationMode ? '2px solid #e0e0e0' : undefined,
        }} />
        {visibleMonths.map((m, i) => {
          const p = Q_PALETTE[quarterIndex(m)]
          return (
            <div key={m} style={{
              ...stickyTH,
              gridColumn: i + colOff,
              gridRow: 2,
              top: HEADER_ROW_HEIGHT,
              background: isPresentationMode ? '#fff' : p.bg,
              border: isPresentationMode ? 'none' : undefined,
              borderBottom: isPresentationMode ? '2px solid #e0e0e0' : `1px solid ${p.border}`,
              borderRight: isPresentationMode ? `${(colIdx => (colIdx + 1) % 3 === 0)(i) ? '3px solid #aaa' : '1px solid #e8e8e8'}` : undefined,
              color: isPresentationMode ? '#444' : p.text,
              fontWeight: isPresentationMode ? 600 : 500,
              fontSize: isPresentationMode ? 14 : 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 3,
            }}>
              {monthName(m)}
            </div>
          )
        })}

        {/* ── Body rows ── */}
        {(() => {
          let presRow = 3  // counter for flattened presentation rows
          return layoutItems.map((item) => {

            // ── Presentation mode: flat task list, optional group dividers ────
            if (isPresentationMode) {
              // Divider rows when toggled on
              if (item.type === 'swimlane-header' || item.type === 'label-header') {
                if (!showRowDividers) return null
                const rowKey   = item.swimlane ?? item.label
                const rowColor = rowColorMap[rowKey] ?? '#8c8c8c'
                const currentRow = presRow++
                return (
                  <React.Fragment key={`pres-divider-${rowKey}`}>
                    {/* Pre-column cell with coloured top border */}
                    <div style={{
                      gridColumn: 1,
                      gridRow: currentRow,
                      background: '#fafafa',
                      borderTop: `3px solid ${rowColor}`,
                      borderBottom: '1px solid #e8e8e8',
                      borderRight: '1px solid #e0e0e0',
                      height: 36,
                    }} />
                    {/* Per-column background cells — preserves vertical grid lines */}
                    {visibleMonths.map((m, colIdx) => {
                      const isQuarterEnd = (colIdx + 1) % 3 === 0
                      return (
                        <div key={colIdx} style={{
                          gridColumn: colIdx + 2,
                          gridRow: currentRow,
                          background: '#fafafa',
                          borderTop: `3px solid ${rowColor}`,
                          borderBottom: '1px solid #e8e8e8',
                          borderRight: isQuarterEnd ? '3px solid #aaa' : '1px solid #ebebeb',
                          height: 36,
                        }} />
                      )
                    })}
                    {/* Label pill — task-like, starts at col 1, zIndex covers bg cells */}
                    <div style={{
                      gridColumn: 1,
                      gridRow: currentRow,
                      zIndex: 3,
                      padding: '5px 6px',
                      height: 36,
                      display: 'flex',
                      alignItems: 'center',
                    }}>
                      <div style={{
                        background: lightenHex(rowColor, 0.8),
                        border: `1.5px solid ${rowColor}`,
                        borderRadius: 6,
                        padding: '3px 12px 3px 10px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                        fontWeight: 700,
                        fontSize: Math.max(12, Math.round(presentationFontSize * 0.80)),
                        color: rowColor,
                        whiteSpace: 'nowrap',
                        display: 'flex', alignItems: 'center', gap: 7,
                      }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: rowColor, flexShrink: 0 }} />
                        {rowKey}
                      </div>
                    </div>
                  </React.Fragment>
                )
              }
              const currentRow = presRow++
              const months = getEffectiveMonths(item.task)
              const range  = taskColRange(months, visibleMonths)
              if (!range) return null
              const rowColor = rowColorMap[item.rowKey] ?? '#8c8c8c'

              return (
                <React.Fragment key={`task-pres-${item.task.id}`}>
                  {/* Pre-column background cell */}
                  <div style={{
                    gridColumn: 1,
                    gridRow: currentRow,
                    background: '#fafafa',
                    borderBottom: '1px solid #f0f0f0',
                    borderRight: '1px solid #e0e0e0',
                    height: TASK_ROW_HEIGHT_EXPANDED,
                  }} />
                  {/* Month background cells */}
                  {visibleMonths.map((m, colIdx) => {
                    const p = Q_PALETTE[quarterIndex(m)]
                    const isQuarterEnd = (colIdx + 1) % 3 === 0
                    return (
                      <div key={colIdx} style={{
                        gridColumn: colIdx + 2,
                        gridRow: currentRow,
                        background: '#fff',
                        borderBottom: '1px solid #f0f0f0',
                        borderRight: `${isQuarterEnd ? '3px solid #aaa' : '1px solid #ebebeb'}`,
                        height: TASK_ROW_HEIGHT_EXPANDED,
                        overflow: 'hidden',
                      }} />
                    )
                  })}

                  {/* Task bar — extendsBefore tasks start at col 1 (pre-column) */}
                  <div style={{
                    gridColumn: range.extendsBefore
                      ? `1 / ${range.endIdx + 3}`
                      : `${range.startIdx + 2} / ${range.endIdx + 3}`,
                    gridRow: currentRow,
                    zIndex: 2,
                    padding: '7px 5px',
                    height: TASK_ROW_HEIGHT_EXPANDED,
                    display: 'flex',
                    alignItems: 'center',
                    position: 'relative',
                    animation: 'fadeInBar 300ms ease',
                  }}>
                    <div
                      style={{
                        flex: 1,
                        height: 44,
                        background: lightenHex(rowColor, 0.85),
                        border: `1.5px solid ${rowColor}`,
                        borderRadius: 6,
                        boxShadow: '0 3px 10px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: '0 14px',
                        gap: 8,
                        cursor: 'pointer',
                        overflow: 'hidden',
                      }}
                      onClick={e => {
                        e.stopPropagation()
                        setSelectedTask(item.task)
                        setModalOpen(true)
                      }}
                    >
                      <div style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: 700,
                        fontSize: presentationFontSize,
                        color: 'rgba(0,0,0,0.82)',
                        lineHeight: 1.2,
                      }}>
                        {item.task.title || '(untitled)'}
                      </div>
                      {item.task.logo && (
                        <img
                          src={item.task.logo}
                          alt=""
                          style={{
                            height: 34, width: 34,
                            objectFit: 'contain',
                            borderRadius: 4,
                            flexShrink: 0,
                            background: 'rgba(255,255,255,0.18)',
                            padding: 2,
                          }}
                        />
                      )}
                    </div>
                  </div>
                </React.Fragment>
              )
            }

            // ── Normal mode rendering ────────────────────────────────────────

            if (item.type === 'swimlane-header') {
              const isArchived = archivedSwimlanes.includes(item.swimlane)
              return (
                <div key={`sl-${item.swimlane}`} style={{
                  gridColumn: `1 / ${zoomMonths + 2}`,
                  gridRow: item.gridRow,
                  background: isArchived ? '#fff7e6' : '#f0f2f5',
                  borderBottom: `1px solid ${isArchived ? '#ffd591' : '#d9d9d9'}`,
                  borderTop: `1px solid ${isArchived ? '#ffd591' : '#d9d9d9'}`,
                  padding: '0 10px',
                  fontWeight: 600,
                  fontSize: 13,
                  height: TASK_ROW_HEIGHT,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ flex: 1 }}>{item.swimlane}</span>
                  {isArchived ? (
                    <Tooltip title="Restore swimlane">
                      <Button type="text" size="small" icon={<UndoOutlined />}
                        style={{ color: '#fa8c16' }}
                        onClick={() => onRestoreSwimlane(item.swimlane)} />
                    </Tooltip>
                  ) : (
                    !archivedMode && (
                      <Tooltip title="Archive swimlane">
                        <Button type="text" size="small" icon={<EyeInvisibleOutlined />}
                          style={{ color: '#8c8c8c' }}
                          onClick={() => onArchiveSwimlane(item.swimlane)} />
                      </Tooltip>
                    )
                  )}
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
              const months   = getEffectiveMonths(item.task)
              const range    = taskColRange(months, visibleMonths)
              const isDragging = draggingRef.current?.taskId === item.task.id
              const taskRowH = compactView ? TASK_ROW_HEIGHT : TASK_ROW_HEIGHT_EXPANDED
              const desc     = compactView ? '' : descriptionPreview(item.task.description)
              const inView   = range !== null
              const rowH     = inView ? taskRowH : 0
              const { barColor, barOpacity, strikethrough } = barStateStyle(item.task)
              const barBg    = barColor ?? Q_PALETTE[quarterIndex(months[0] ?? visibleMonths[0])].bar

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
                          background: compactView ? barBg : barBg + '22',
                          border: compactView ? undefined : `2px solid ${barBg}`,
                          opacity: isDragging ? 0.75 : barOpacity,
                          borderRadius: range.extendsBefore ? '0 4px 4px 0' : range.extendsAfter ? '4px 0 0 4px' : 4,
                          borderLeft: range.extendsBefore ? (compactView ? '3px solid rgba(0,0,0,0.25)' : `3px solid ${barBg}`) : undefined,
                          outline: selectedTaskIds?.has(item.task.id) ? '2px solid #fff' : undefined,
                          boxShadow: selectedTaskIds?.has(item.task.id) ? '0 0 0 4px #1677ff' : '0 1px 4px rgba(0,0,0,0.18)',
                          display: 'flex',
                          flexDirection: compactView ? 'row' : 'column',
                          alignItems: compactView ? 'center' : 'flex-start',
                          justifyContent: compactView ? undefined : 'center',
                          padding: compactView ? '0 22px 0 8px' : '4px 22px 4px 8px',
                          color: compactView ? '#fff' : 'rgba(0,0,0,0.82)',
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
                          if (onToggleTaskSelection && (e.ctrlKey || e.metaKey)) {
                            onToggleTaskSelection(item.task.id)
                            return
                          }
                          setSelectedTask(item.task)
                          setModalOpen(true)
                        }}
                      >
                        <div style={{
                          fontSize: compactView ? 12 : 14,
                          fontWeight: compactView ? 500 : 700,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          width: '100%',
                          textDecoration: strikethrough ? 'line-through' : 'none',
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

                        {/* Resize handle */}
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

            return null
          })
        })()}
      </div>

      {/* ── Presentation mode: colour legend overlay ── */}
      {isPresentationMode && !showRowDividers && presentationRows.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 28,
          right: 28,
          zIndex: 1001,
          background: 'rgba(255,255,255,0.96)',
          border: '1px solid #e0e0e0',
          borderRadius: 10,
          padding: '12px 18px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.13)',
          minWidth: 150,
          maxWidth: 240,
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#444' }}>
            {swimlaneMode ? 'Swimlanes' : 'Labels'}
          </div>
          {presentationRows.map(row => (
            <div key={row} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
              <div style={{
                width: 14, height: 14,
                borderRadius: 3,
                background: rowColorMap[row],
                flexShrink: 0,
                boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
              }} />
              <span style={{ fontSize: 13, color: '#333', lineHeight: 1.3 }}>{row}</span>
            </div>
          ))}
        </div>
      )}

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
        readOnly={archivedMode}
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
