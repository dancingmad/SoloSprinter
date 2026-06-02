import React, { useState } from 'react'
import { Row, Col, Switch, Select, InputNumber, Space, Typography, Segmented, Button, AutoComplete } from 'antd'
import { TableOutlined, CalendarOutlined, UnorderedListOutlined, CheckSquareOutlined, CloseOutlined } from '@ant-design/icons'

const DAYS_OPTIONS = [
  { label: 'Today', value: 1 },
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
]

export default function FilterBar({
  labels,
  swimlaneMode, onToggleSwimlaneMode,
  filters, onFiltersChange,
  compactView, onToggleCompactView,
  viewMode, onViewModeChange,
  // Selection / bulk actions
  selectedCount,
  onClearSelection,
  onSelectAll,
  onBulkLabelToggle,
}) {
  const [bulkLabel, setBulkLabel] = useState(null)

  return (
    <div style={{ marginBottom: 16 }}>
      {/* ── Main filter row ── */}
      <Row gutter={16} align="middle" style={{ flexWrap: 'wrap', gap: 8 }}>
        <Col>
          <Segmented
            value={viewMode}
            onChange={onViewModeChange}
            options={[
              { label: 'Kanban',  value: 'kanban',  icon: <TableOutlined /> },
              { label: 'Roadmap', value: 'roadmap', icon: <CalendarOutlined /> },
              { label: 'List',    value: 'list',    icon: <UnorderedListOutlined /> },
            ]}
          />
        </Col>

        <Col>
          <Space>
            <Typography.Text>Rows:</Typography.Text>
            <Switch
              checkedChildren="Swimlanes"
              unCheckedChildren="Labels"
              checked={swimlaneMode}
              onChange={onToggleSwimlaneMode}
            />
          </Space>
        </Col>

        <Col>
          <Space>
            <Typography.Text>Labels:</Typography.Text>
            {/*
              Empty = all tasks visible (no filtering).
              Picking labels shows only tasks that carry at least one of them.
              To hide "Archived", select every label except "Archived".
              maxTagCount="responsive" keeps the chip list compact: it collapses
              overflow into "+N more" and the full list is shown when focused.
            */}
            <Select
              mode="multiple"
              allowClear
              placeholder="All labels"
              style={{ minWidth: 180, maxWidth: 340 }}
              value={filters.labelsInclude}
              onChange={vals => onFiltersChange({ ...filters, labelsInclude: vals || [] })}
              options={labels.map(l => ({ label: l, value: l }))}
              maxTagCount="responsive"
            />
          </Space>
        </Col>

        <Col>
          <Space>
            <Typography.Text>Updated within:</Typography.Text>
            <Select
              allowClear
              placeholder="All time"
              style={{ minWidth: 130 }}
              value={filters.daysOld}
              onChange={val => onFiltersChange({ ...filters, daysOld: val || null })}
              options={DAYS_OPTIONS}
            />
          </Space>
        </Col>

        {(viewMode === 'kanban' || viewMode === 'roadmap') && (
          <Col>
            <Space>
              <Typography.Text>Compact:</Typography.Text>
              <Switch checked={compactView} onChange={onToggleCompactView} />
            </Space>
          </Col>
        )}

        {viewMode === 'kanban' && (
          <Col>
            <Space>
              <Typography.Text>Max per column:</Typography.Text>
              <InputNumber
                min={1}
                max={200}
                placeholder="All"
                style={{ width: 80 }}
                value={filters.maxPerColumn}
                onChange={val => onFiltersChange({ ...filters, maxPerColumn: val || null })}
              />
            </Space>
          </Col>
        )}
      </Row>

      {/* ── Bulk action bar — visible only when tasks are selected ── */}
      {selectedCount > 0 && (
        <Row
          align="middle"
          style={{
            marginTop: 8,
            padding: '6px 12px',
            background: '#e6f4ff',
            border: '1px solid #91caff',
            borderRadius: 6,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <Col>
            <Typography.Text strong style={{ color: '#0958d9' }}>
              {selectedCount} task{selectedCount !== 1 ? 's' : ''} selected
            </Typography.Text>
          </Col>

          <Col>
            <Space>
              {/*
                AutoComplete allows picking an existing label or typing a new one.
                The smart toggle is evaluated in App.jsx:
                  • if ALL selected tasks already have this label  → remove it from all
                  • otherwise                                       → add it to all
              */}
              <AutoComplete
                placeholder="Pick or type a label…"
                style={{ minWidth: 180 }}
                value={bulkLabel}
                onChange={val => setBulkLabel(val || null)}
                options={labels.map(l => ({ value: l }))}
                filterOption={(input, option) =>
                  option.value.toLowerCase().includes(input.toLowerCase())
                }
                allowClear
              />
              <Button
                type="primary"
                disabled={!bulkLabel}
                onClick={() => { onBulkLabelToggle(bulkLabel); setBulkLabel(null) }}
              >
                Toggle label
              </Button>
            </Space>
          </Col>

          <Col>
            <Button
              icon={<CheckSquareOutlined />}
              onClick={onSelectAll}
            >
              Select all visible
            </Button>
          </Col>

          <Col>
            <Button
              icon={<CloseOutlined />}
              onClick={() => { onClearSelection(); setBulkLabel(null) }}
            >
              Clear selection
            </Button>
          </Col>
        </Row>
      )}
    </div>
  )
}
