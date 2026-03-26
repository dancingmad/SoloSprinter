import React, { useState, useEffect, useRef } from 'react'
import { Modal, Input, Button, Space, Tag, Typography, Image, Popconfirm, Divider, AutoComplete, Tooltip, message, Select } from 'antd'
import { DeleteOutlined, CopyOutlined, CalendarOutlined } from '@ant-design/icons'

const LABEL_COLORS = ['magenta','red','volcano','orange','gold','lime','green','cyan','blue','geekblue','purple']
function labelColor(label) {
  let hash = 0
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0
  return LABEL_COLORS[hash % LABEL_COLORS.length]
}
import MDEditor from '@uiw/react-md-editor'
import { uploadImage, imageUrl } from '../api'

export default function TaskModal({ boardId, task, states, swimlanes, labels, open, onClose, onUpdate, onDelete, onModalClose }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [label, setLabel] = useState('')
  const [extraLabels, setExtraLabels] = useState([])
  const [extraLabelInput, setExtraLabelInput] = useState('')
  const [images, setImages] = useState([])
  const [roadmapStart, setRoadmapStart] = useState('')
  const [roadmapEnd, setRoadmapEnd] = useState('')
  const titleTimer = useRef(null)
  const descTimer = useRef(null)

  useEffect(() => {
    if (task) {
      setTitle(task.title || '')
      setDescription(task.description || '')
      setLabel(task.label || '')
      setExtraLabels(task.extraLabels || [])
      setExtraLabelInput('')
      const months = task.roadmapMonths || []
      const sorted = [...months].sort()
      setRoadmapStart(sorted[0] || '')
      setRoadmapEnd(sorted[sorted.length - 1] || '')
      // fetch images list
      fetch(`/api/boards/${boardId}/tasks/${task.id}/images`)
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

  const handleDeleteImage = async (filename) => {
    await fetch(`/api/boards/${boardId}/tasks/${task.id}/images/${filename}`, { method: 'DELETE' })
    setImages(prev => prev.filter(f => f !== filename))
  }

  const handleCopyImageUrl = (filename) => {
    const url = imageUrl(boardId, task.id, filename)
    const mdSnippet = `![${filename}](${url})`
    navigator.clipboard.writeText(mdSnippet)
    message.success('Image markdown copied to clipboard')
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    for (const file of files) {
      const result = await uploadImage(boardId, task.id, file)
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

  const addExtraLabel = (val) => {
    const trimmed = val?.trim()
    if (!trimmed || trimmed === label || extraLabels.includes(trimmed)) return
    const next = [...extraLabels, trimmed]
    setExtraLabels(next)
    setExtraLabelInput('')
    onUpdate(task.id, { extraLabels: next })
  }

  const removeExtraLabel = (lbl) => {
    const next = extraLabels.filter(l => l !== lbl)
    setExtraLabels(next)
    onUpdate(task.id, { extraLabels: next })
  }

  // ── roadmap helpers ──
  const saveRoadmapMonths = (start, end) => {
    if (!start) { onUpdate(task.id, { roadmapMonths: [] }); return }
    const realEnd = (!end || end < start) ? start : end
    const months = []
    let cur = start
    for (let i = 0; i < 48; i++) {
      months.push(cur)
      if (cur === realEnd) break
      const [y, m] = cur.split('-').map(Number)
      const nm = m + 1 > 12 ? 1 : m + 1
      const ny = m + 1 > 12 ? y + 1 : y
      cur = `${ny}-${String(nm).padStart(2, '0')}`
    }
    onUpdate(task.id, { roadmapMonths: months })
  }

  const handleRoadmapStart = (val) => {
    setRoadmapStart(val || '')
    if (!val) { setRoadmapEnd(''); onUpdate(task.id, { roadmapMonths: [] }); return }
    const newEnd = roadmapEnd && roadmapEnd >= val ? roadmapEnd : val
    setRoadmapEnd(newEnd)
    saveRoadmapMonths(val, newEnd)
  }

  const handleRoadmapEnd = (val) => {
    setRoadmapEnd(val || '')
    if (roadmapStart) saveRoadmapMonths(roadmapStart, val || roadmapStart)
  }

  // generate month options: current year -1 to +3
  const monthOptions = (() => {
    const opts = []
    const now = new Date()
    for (let y = now.getFullYear() - 1; y <= now.getFullYear() + 3; y++) {
      for (let m = 1; m <= 12; m++) {
        const val = `${y}-${String(m).padStart(2, '0')}`
        const label = `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]} ${y}`
        opts.push({ value: val, label })
      }
    }
    return opts
  })()

  if (!task) return null

  return (
    <Modal
      open={open}
      onCancel={() => { onModalClose && onModalClose(task, label); onClose() }}
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
        <AutoComplete
          value={label}
          options={(labels || []).map(l => ({ value: l }))}
          onChange={val => setLabel(val || '')}
          placeholder="Primary label..."
          allowClear
          style={{ width: 160 }}
          filterOption={(input, option) =>
            option.value.toLowerCase().includes(input.toLowerCase())
          }
        />
        {extraLabels.map(lbl => (
          <Tag
            key={lbl}
            color={labelColor(lbl)}
            closable
            onClose={() => removeExtraLabel(lbl)}
            style={{ margin: 0 }}
          >
            {lbl}
          </Tag>
        ))}
        <AutoComplete
          value={extraLabelInput}
          options={(labels || [])
            .filter(l => l && l !== label && !extraLabels.includes(l))
            .map(l => ({ value: l }))}
          onChange={val => setExtraLabelInput(val || '')}
          onSelect={val => addExtraLabel(val)}
          onKeyDown={e => { if (e.key === 'Enter') addExtraLabel(extraLabelInput) }}
          placeholder="Add extra label..."
          style={{ width: 150 }}
          filterOption={(input, option) =>
            option.value.toLowerCase().includes(input.toLowerCase())
          }
        />
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
                <div key={img} style={{ position: 'relative', display: 'inline-block' }}>
                  <Image
                    src={imageUrl(boardId, task.id, img)}
                    width={120}
                    style={{ objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', gap: 4, marginTop: 4, justifyContent: 'center' }}>
                    <Tooltip title="Copy image URL">
                      <Button
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => handleCopyImageUrl(img)}
                      />
                    </Tooltip>
                    <Popconfirm
                      title="Delete this image?"
                      onConfirm={() => handleDeleteImage(img)}
                      okText="Delete"
                      okType="danger"
                    >
                      <Tooltip title="Delete image">
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Tooltip>
                    </Popconfirm>
                  </div>
                </div>
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

      <Divider orientation="left" style={{ fontSize: 13 }}>
        <CalendarOutlined /> Roadmap
      </Divider>
      <Space wrap style={{ marginBottom: 8 }}>
        <Typography.Text style={{ fontSize: 13 }}>From</Typography.Text>
        <Select
          allowClear
          placeholder="Start month"
          style={{ width: 150 }}
          value={roadmapStart || undefined}
          onChange={handleRoadmapStart}
          options={monthOptions}
          showSearch
          filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
        />
        <Typography.Text style={{ fontSize: 13 }}>to</Typography.Text>
        <Select
          allowClear
          placeholder="End month"
          style={{ width: 150 }}
          value={roadmapEnd || undefined}
          disabled={!roadmapStart}
          onChange={handleRoadmapEnd}
          options={monthOptions.filter(o => !roadmapStart || o.value >= roadmapStart)}
          showSearch
          filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
        />
        {roadmapStart && (
          <Button
            size="small"
            onClick={() => { setRoadmapStart(''); setRoadmapEnd(''); onUpdate(task.id, { roadmapMonths: [] }) }}
          >
            Clear
          </Button>
        )}
      </Space>

      <Divider />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Popconfirm title="Delete this task?" onConfirm={() => { onDelete(task.id); onClose() }} okText="Delete" okType="danger">
          <Button danger icon={<DeleteOutlined />}>Delete task</Button>
        </Popconfirm>
      </div>
    </Modal>
  )
}
