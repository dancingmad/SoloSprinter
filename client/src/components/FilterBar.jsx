import React from 'react'
import { Row, Col, Switch, Select, InputNumber, Space, Typography } from 'antd'

const DAYS_OPTIONS = [
  { label: 'Today', value: 1 },
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
]

export default function FilterBar({ labels, swimlaneMode, onToggleSwimlaneMode, filters, onFiltersChange, compactView, onToggleCompactView }) {
  return (
    <Row gutter={16} align="middle" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
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
          <Typography.Text>Filter label:</Typography.Text>
          <Select
            allowClear
            placeholder="All labels"
            style={{ minWidth: 140 }}
            value={filters.label}
            onChange={val => onFiltersChange({ ...filters, label: val || null })}
            options={labels.map(l => ({ label: l, value: l }))}
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
      <Col>
        <Space>
          <Typography.Text>Compact:</Typography.Text>
          <Switch
            checked={compactView}
            onChange={onToggleCompactView}
          />
        </Space>
      </Col>
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
    </Row>
  )
}
