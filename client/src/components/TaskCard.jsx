import React, { useMemo } from 'react'
import { Card, Tag, Typography, Progress } from 'antd'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ReactMarkdown from 'react-markdown'

function countSubtasks(description) {
  if (!description) return { total: 0, done: 0 }
  const lines = description.split('\n')
  const total = lines.filter(l => /\[ \]|\[x\]/i.test(l)).length
  const done = lines.filter(l => /\[x\]/i.test(l)).length
  return { total, done }
}

export default function TaskCard({ task, onClick }) {
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
    width: '100%'
  }

  const { total, done } = useMemo(() => countSubtasks(task.description), [task.description])

  // Strip subtask markers for preview
  const previewText = useMemo(() => {
    if (!task.description) return ''
    return task.description
      .split('\n')
      .filter(l => !/\[ \]|\[x\]/i.test(l))
      .join('\n')
      .slice(0, 200)
  }, [task.description])

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        size="small"
        hoverable
        onClick={onClick}
        style={{ width: '100%', boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.2)' : undefined }}
        styles={{ body: { padding: '8px 10px' } }}
      >
        <Typography.Text strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>
          {task.title || <span style={{ color: '#bbb' }}>Untitled</span>}
        </Typography.Text>

        {previewText && (
          <div style={{ fontSize: 12, color: '#555', maxHeight: 60, overflow: 'hidden', marginBottom: 4 }}>
            <ReactMarkdown>{previewText}</ReactMarkdown>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {task.label && <Tag color="orange" style={{ fontSize: 11, margin: 0 }}>{task.label}</Tag>}
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
