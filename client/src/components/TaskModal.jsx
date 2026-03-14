import React, { useState, useEffect, useRef } from 'react'
import { Modal, Input, Button, Space, Tag, Typography, Image, Popconfirm, Divider } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import MDEditor from '@uiw/react-md-editor'
import { uploadImage, imageUrl } from '../api'

export default function TaskModal({ task, states, swimlanes, labels, open, onClose, onUpdate, onDelete }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [images, setImages] = useState([])
  const [previewImg, setPreviewImg] = useState(null)
  const titleTimer = useRef(null)
  const descTimer = useRef(null)

  useEffect(() => {
    if (task) {
      setTitle(task.title || '')
      setDescription(task.description || '')
      // fetch images list
      fetch(`/api/tasks/${task.id}/images`)
        .then(r => r.json())
        .then(setImages)
        .catch(() => setImages([]))
    }
  }, [task])

  const saveTitle = (val) => {
    clearTimeout(titleTimer.current)
    setTitle(val)
    titleTimer.current = setTimeout(() => {
      if (val.trim()) onUpdate(task.id, { title: val })
    }, 600)
  }

  const saveDescription = (val) => {
    clearTimeout(descTimer.current)
    setDescription(val || '')
    descTimer.current = setTimeout(() => {
      onUpdate(task.id, { description: val || '' })
    }, 800)
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    for (const file of files) {
      const result = await uploadImage(task.id, file)
      if (result.filename) {
        setImages(prev => [...prev, result.filename])
      }
    }
  }

  const toggleSubtask = (lineIndex) => {
    const lines = description.split('\n')
    const line = lines[lineIndex]
    if (/\[x\]/i.test(line)) {
      lines[lineIndex] = line.replace(/\[x\]/i, '[ ]')
    } else if (/\[ \]/.test(line)) {
      lines[lineIndex] = line.replace('[ ]', '[x]')
    }
    const newDesc = lines.join('\n')
    setDescription(newDesc)
    onUpdate(task.id, { description: newDesc })
  }

  const renderDescriptionWithSubtasks = () => {
    if (!description) return null
    const lines = description.split('\n')
    return lines.map((line, i) => {
      const unchecked = /\[ \]/.test(line)
      const checked = /\[x\]/i.test(line)
      if (unchecked || checked) {
        const text = line.replace(/\[x\]|\[ \]/i, '').trim()
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggleSubtask(i)}
              style={{ cursor: 'pointer', width: 16, height: 16 }}
            />
            <span style={{ textDecoration: checked ? 'line-through' : 'none', color: checked ? '#999' : 'inherit' }}>
              {text}
            </span>
          </div>
        )
      }
      return <div key={i} style={{ minHeight: line ? undefined : 8 }}>{line}</div>
    })
  }

  if (!task) return null

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="80vw"
      title={
        <Input
          value={title}
          onChange={e => saveTitle(e.target.value)}
          placeholder="Task title..."
          variant="borderless"
          style={{ fontSize: 18, fontWeight: 600, padding: 0 }}
        />
      }
    >
      <Space wrap style={{ marginBottom: 12 }}>
        <Tag color="blue">{task.state}</Tag>
        <Tag color="green">{task.swimlane}</Tag>
        {task.label && <Tag color="orange">{task.label}</Tag>}
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Created: {task.created ? new Date(task.created).toLocaleDateString() : '—'}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Updated: {task.updated ? new Date(task.updated).toLocaleDateString() : '—'}
        </Typography.Text>
      </Space>

      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        style={{ border: '1px dashed #d9d9d9', borderRadius: 6, padding: 4, marginBottom: 12 }}
      >
        <MDEditor
          value={description}
          onChange={saveDescription}
          preview="live"
          height={320}
          data-color-mode="light"
        />
      </div>

      {images.length > 0 && (
        <>
          <Divider orientation="left" style={{ fontSize: 13 }}>Images (drag &amp; drop to add)</Divider>
          <Image.PreviewGroup>
            <Space wrap>
              {images.map(img => (
                <Image
                  key={img}
                  src={imageUrl(task.id, img)}
                  width={120}
                  style={{ objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }}
                />
              ))}
            </Space>
          </Image.PreviewGroup>
        </>
      )}

      {images.length === 0 && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Drop images onto the editor above to attach them.
        </Typography.Text>
      )}

      <Divider />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Popconfirm title="Delete this task?" onConfirm={() => { onDelete(task.id); onClose() }} okText="Delete" okType="danger">
          <Button danger icon={<DeleteOutlined />}>Delete task</Button>
        </Popconfirm>
      </div>
    </Modal>
  )
}
