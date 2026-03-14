import React from 'react'
import { Row, Col, Switch, Select, DatePicker, InputNumber, Space, Typography } from 'antd'

const { RangePicker } = DatePicker

export default function FilterBar({ labels, swimlaneMode, onToggleSwimlaneMode, filters, onFiltersChange }) {
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
          <Typography.Text>Date range:</Typography.Text>
          <RangePicker
            onChange={(_, strs) => onFiltersChange({
              ...filters,
              dateFrom: strs[0] || null,
              dateTo: strs[1] || null
            })}
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
