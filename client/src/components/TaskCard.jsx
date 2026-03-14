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
  const done = lines.filter(l => /\[x\]/i.test(l)).length
  return { total, done }
}

export default function TaskCard({ task, onClick }) {
  const [hovered, setHovered] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: 'grab',
    marginBottom: 8,
    width: '100%',
    zIndex: hovered ? 10 : undefined,
    position: hovered ? 'relative' : undefined
  }

  const { total, done } = useMemo(() => countSubtasks(task.description), [task.description])

  // Strip subtask markers for preview; truncate only when not hovered
  const fullPreviewText = useMemo(() => {
    if (!task.description) return ''
    return task.description
      .split('\n')
      .filter(l => !/\[ \]|\[x\]/i.test(l))
      .join('\n')
  }, [task.description])

  const previewText = hovered ? fullPreviewText : fullPreviewText.slice(0, 200)

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <Card
        size="small"
        hoverable
        onClick={onClick}
        style={{ width: '100%', boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.2)' : hovered ? '0 6px 20px rgba(0,0,0,0.18)' : undefined }}
        styles={{ body: { padding: '8px 10px' } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <Typography.Text strong style={{ fontSize: 13 }}>
            {task.title || <span style={{ color: '#bbb' }}>Untitled</span>}
          </Typography.Text>
          {task.priority !== undefined && task.priority !== null && (
            <span style={{ fontSize: 11, color: '#aaa', marginLeft: 6, flexShrink: 0 }}>#{task.priority + 1}</span>
          )}
        </div>

        {previewText && (
          <div style={{ fontSize: 12, color: '#555', maxHeight: hovered ? 400 : 60, overflow: hovered ? 'auto' : 'hidden', marginBottom: 4, transition: 'max-height 0.25s ease' }}>
            <ReactMarkdown>{previewText}</ReactMarkdown>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {task.label && <Tag color={labelColor(task.label)} style={{ fontSize: 11, margin: 0 }}>{task.label}</Tag>}
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
