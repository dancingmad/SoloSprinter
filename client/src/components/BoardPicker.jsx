import React, { useState } from 'react'
import { Card, Button, Input, Typography, Space, Popconfirm, Tooltip, Empty } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, CheckOutlined } from '@ant-design/icons'

export default function BoardPicker({ boards, onSelect, onCreate, onDelete, onRename }) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  const handleCreate = () => {
    if (newName.trim()) {
      onCreate(newName.trim())
      setNewName('')
      setCreating(false)
    }
  }

  const handleRename = (id) => {
    if (editName.trim()) {
      onRename(id, editName.trim())
      setEditingId(null)
      setEditName('')
    }
  }

  return (
    <div style={{ maxWidth: 700, margin: '60px auto', padding: '0 24px' }}>
      <Typography.Title level={2} style={{ marginBottom: 8 }}>
        🏃 SoloSprinter
      </Typography.Title>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 32 }}>
        Select a board to open, or create a new one.
      </Typography.Text>

      {boards.length === 0 && !creating && (
        <Empty description="No boards yet" style={{ marginBottom: 24 }} />
      )}

      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        {boards.map(board => (
          <Card
            key={board.id}
            size="small"
            hoverable={editingId !== board.id}
            style={{ cursor: editingId === board.id ? 'default' : 'pointer' }}
            onClick={() => editingId !== board.id && onSelect(board)}
            styles={{ body: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 } }}
          >
            {editingId === board.id ? (
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onPressEnter={() => handleRename(board.id)}
                autoFocus
                style={{ flex: 1 }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <Typography.Text strong style={{ fontSize: 15, flex: 1 }}>{board.name}</Typography.Text>
            )}
            <Space onClick={e => e.stopPropagation()}>
              {editingId === board.id ? (
                <Tooltip title="Save">
                  <Button
                    size="small"
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={() => handleRename(board.id)}
                  />
                </Tooltip>
              ) : (
                <Tooltip title="Rename">
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => { setEditingId(board.id); setEditName(board.name) }}
                  />
                </Tooltip>
              )}
              <Popconfirm
                title={`Delete board "${board.name}"? All tasks will be lost.`}
                onConfirm={() => onDelete(board.id)}
                okText="Delete"
                okType="danger"
              >
                <Tooltip title="Delete board">
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            </Space>
          </Card>
        ))}

        {creating ? (
          <Card size="small" styles={{ body: { display: 'flex', gap: 8 } }}>
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onPressEnter={handleCreate}
              placeholder="Board name..."
              autoFocus
              style={{ flex: 1 }}
            />
            <Button type="primary" onClick={handleCreate}>Create</Button>
            <Button onClick={() => { setCreating(false); setNewName('') }}>Cancel</Button>
          </Card>
        ) : (
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => setCreating(true)}
            style={{ width: '100%' }}
          >
            New Board
          </Button>
        )}
      </Space>
    </div>
  )
}
