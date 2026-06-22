import React, { useMemo, useState } from 'react'
import { Card, Tag, Typography, Progress } from 'antd'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ReactMarkdown from 'react-markdown'

const LABEL_COLORS = ['magenta','red','volcano','orange','gold','lime','green','cyan','blue','geekblue','purple']

function labelColor(label) {
  let hash = 0
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0
  }
  return LABEL_COLORS[hash % LABEL_COLORS.length]
}

function countSubtasks(description) {
  if (!description) return { total: 0, done: 0 }
  const lines = description.split('\n')
  const total = lines.filter(l => /\[ \]|\[x\]/i.test(l)).length
  const done  = lines.filter(l => /\[x\]/i.test(l)).length
  return { total, done }
}

export default function TaskCard({ task, onClick, compactView, swimlaneMode = true, selected = false, onToggleSelect }) {
  const [hovered,      setHovered]      = useState(false)
  const [titleHovered, setTitleHovered] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity:  isDragging ? 0.4 : (task.archived ? 0.5 : 1),
    cursor:   'grab',
    marginBottom: 8,
    width: '100%',
    zIndex:   hovered ? 10 : undefined,
    position: hovered ? 'relative' : undefined,
  }

  const { total, done } = useMemo(() => countSubtasks(task.description), [task.description])

  const fullPreviewText = useMemo(() => {
    if (!task.description) return ''
    return task.description
      .split('\n')
      .filter(l => !/\[ \]|\[x\]/i.test(l))
      .join('\n')
  }, [task.description])

  const previewText = hovered ? fullPreviewText : fullPreviewText.slice(0, 200)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setTitleHovered(false) }}
    >
      <Card
        size="small"
        hoverable
        onClick={
          onToggleSelect
            // Selection mode (Kanban): body click = toggle; title click handled separately
            ? (e) => { e.stopPropagation(); onToggleSelect(task.id) }
            // Normal mode: whole card opens the modal
            : onClick
        }
        style={{
          width: '100%',
          boxShadow: isDragging
            ? '0 4px 12px rgba(0,0,0,0.2)'
            : hovered ? '0 6px 20px rgba(0,0,0,0.18)' : undefined,
          border:     selected ? '2px solid #1677ff' : undefined,
          background: selected ? '#f0f8ff' : undefined,
        }}
        styles={{ body: { padding: '8px 10px' } }}
      >
        {/* ── Title row ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          {onToggleSelect ? (
            /*
             * Selection mode: title is a "link".
             * – Hovering the title shows an underline (signals it opens the modal).
             * – Clicking the title opens the modal (stopPropagation prevents body-click toggle).
             * – Clicking anywhere else on the card body toggles selection (Card onClick above).
             */
            <span
              onMouseEnter={() => setTitleHovered(true)}
              onMouseLeave={() => setTitleHovered(false)}
              onClick={e => { e.stopPropagation(); onClick(e) }}
              style={{
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: titleHovered ? 'underline' : 'none',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                minWidth: 0,
              }}
            >
              {task.title || <span style={{ color: '#bbb', fontWeight: 'normal' }}>Untitled</span>}
            </span>
          ) : (
            <Typography.Text
              strong
              style={{ fontSize: 13, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {task.title || <span style={{ color: '#bbb' }}>Untitled</span>}
            </Typography.Text>
          )}

          {task.priority !== undefined && task.priority !== null && (
            <span style={{ fontSize: 11, color: '#aaa', marginLeft: 6, flexShrink: 0 }}>
              #{task.priority + 1}
            </span>
          )}
        </div>

        {!compactView && previewText && (
          <div style={{
            fontSize: 12,
            color: '#555',
            maxHeight: hovered ? 400 : 60,
            overflow: hovered ? 'auto' : 'hidden',
            marginBottom: 4,
            transition: 'max-height 0.25s ease',
          }}>
            <ReactMarkdown>{previewText}</ReactMarkdown>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {task.archived && (
            <Tag style={{ fontSize: 10, margin: 0, background: '#f5f5f5', borderColor: '#d9d9d9', color: '#8c8c8c' }}>📦 archived</Tag>
          )}
          {swimlaneMode && task.label && (
            <Tag color={labelColor(task.label)} style={{ fontSize: 11, margin: 0 }}>{task.label}</Tag>
          )}
          {(task.extraLabels || []).map(lbl => (
            <Tag key={lbl} color={labelColor(lbl)} style={{ fontSize: 11, margin: 0 }}>{lbl}</Tag>
          ))}
        </div>

        {total > 0 && (
          <div style={{ marginTop: 6 }}>
            <Progress
              percent={Math.round((done / total) * 100)}
              size="small"
              format={() => `${done}/${total}`}
              strokeColor={done === total ? '#52c41a' : '#1677ff'}
            />
          </div>
        )}
      </Card>
    </div>
  )
}
