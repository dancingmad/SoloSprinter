import React from 'react'
import { Row, Col, Switch, Select, InputNumber, Space, Typography, Segmented, Button, Tooltip } from 'antd'
import { TableOutlined, CalendarOutlined, UnorderedListOutlined, CheckSquareOutlined, CloseOutlined, InboxOutlined, UndoOutlined } from '@ant-design/icons'
import LabelPills from './LabelPills'

const DAYS_OPTIONS = [
  { label: 'Today',       value: 1  },
  { label: 'Last 7 days', value: 7  },
  { label: 'Last 30 days',value: 30 },
  { label: 'Last 90 days',value: 90 },
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
  // Primary-label pills (radio-like: only one active at a time per task)
  primaryLabels,
  bulkActivePrimaryLabels,   // labels ALL selected tasks share as primary
  bulkSemiPrimaryLabels,     // labels SOME (not all) selected tasks have as primary
  onBulkPrimaryLabelToggle,
  // Extra-label pills (multi-select)
  extraLabelsOnly,
  bulkActiveExtraLabels,     // labels ALL selected tasks carry in extraLabels
  bulkSemiExtraLabels,       // labels SOME (not all) selected tasks carry in extraLabels
  onBulkLabelToggle,
  // Archive
  archivedMode,
  onToggleArchivedMode,
  onArchiveSelected,
  onRestoreSelected,
}) {
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

        {/* Archived mode toggle */}
        <Col>
          <Button
            icon={<InboxOutlined />}
            onClick={onToggleArchivedMode}
            style={archivedMode ? {
              background: '#fa8c16', borderColor: '#fa8c16', color: '#fff'
            } : {}}
          >
            {archivedMode ? 'Exit Archive View' : 'Archived'}
          </Button>
        </Col>

        {/* Label filter — multi-select dropdown */}
        {labels.length > 0 && (
          <Col style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Typography.Text style={{ whiteSpace: 'nowrap' }}>Labels:</Typography.Text>
            <Select
              mode="multiple"
              allowClear
              placeholder="All labels"
              style={{ minWidth: 160, maxWidth: 320 }}
              value={filters.labelsInclude}
              onChange={val => onFiltersChange({ ...filters, labelsInclude: val || [] })}
              options={labels.map(l => ({ label: l, value: l }))}
              maxTagCount={1}
              maxTagPlaceholder={omitted => `+${omitted.length} more`}
            />
          </Col>
        )}

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

      {/* Archived mode banner */}
      {archivedMode && (
        <div style={{
          marginTop: 8, padding: '5px 12px',
          background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6,
          color: '#d46b08', fontSize: 12,
        }}>
          <InboxOutlined style={{ marginRight: 6 }} />
          Archive view — showing all tasks including archived ones.
          Select tasks and click <strong>Restore selected</strong> to bring them back.
        </div>
      )}

      {/*
        ── Bulk action bar ──
        Shown only when at least one task is selected.

        Each label pill has THREE states:
          Selected      – ALL selected tasks share this label  → full bg + thin border
          Semi-selected – SOME tasks have it, others don't     → muted bg + thick border
          Unselected    – NO selected task has this label      → muted bg + thin border

        Clicking:
          Selected      → remove the label from all selected tasks
          Semi/Unselected (primary)  → set as primary label for all selected tasks
                                       (clears their previous primary)
          Semi/Unselected (extra)    → add to the tasks that don't already have it
      */}
      {selectedCount > 0 && (
        <div style={{
          marginTop: 8,
          padding: '6px 12px',
          background: '#e6f4ff',
          border: '1px solid #91caff',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}>
          {archivedMode ? (
            /* Archive view: only action is restoring the selected archived tasks */
            <>
              <Button
                icon={<UndoOutlined />}
                size="small"
                type="primary"
                onClick={onRestoreSelected}
              >
                Restore selected
              </Button>
              <Tooltip title="Select all visible">
                <Button type="text" size="small" icon={<CheckSquareOutlined />} onClick={onSelectAll} />
              </Tooltip>
              <Tooltip title="Clear selection">
                <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClearSelection} />
              </Tooltip>
            </>
          ) : (
            /* Normal view: label pills + archive action */
            <>
              {(primaryLabels || []).length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>Primary:</Typography.Text>
                  <LabelPills
                    labels={primaryLabels}
                    activePills={bulkActivePrimaryLabels || []}
                    semiPills={bulkSemiPrimaryLabels || []}
                    onToggle={onBulkPrimaryLabelToggle}
                  />
                </div>
              )}
              {(extraLabelsOnly || []).length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>Labels:</Typography.Text>
                  <LabelPills
                    labels={extraLabelsOnly}
                    activePills={bulkActiveExtraLabels || []}
                    semiPills={bulkSemiExtraLabels || []}
                    onToggle={onBulkLabelToggle}
                  />
                </div>
              )}
              <Tooltip title="Archive selected tasks">
                <Button
                  icon={<InboxOutlined />}
                  size="small"
                  danger
                  onClick={onArchiveSelected}
                >
                  Archive
                </Button>
              </Tooltip>
              <Tooltip title="Select all visible">
                <Button type="text" size="small" icon={<CheckSquareOutlined />} onClick={onSelectAll} />
              </Tooltip>
              <Tooltip title="Clear selection">
                <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClearSelection} />
              </Tooltip>
            </>
          )}
        </div>
      )}
    </div>
  )
}
