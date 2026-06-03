import React from 'react'

const LABEL_NAMES = ['magenta','red','volcano','orange','gold','lime','green','cyan','blue','geekblue','purple']

// Ant Design palette values per label color name.
//   light      — full Tag light background (selected state fill)
//   border     — Tag border color (used for normal / thin ring)
//   text       — Tag dark accent color (used for strong / thick ring and text)
//   lightMuted — rgba tint at 35 % opacity so the pill stays colored but clearly dimmer
//                than `light`; avoids element-level opacity so the ring stays crisp.
const PALETTE = {
  magenta:  { light: '#fff0f6', border: '#ffadd2', text: '#c41d7f', lightMuted: 'rgba(255,173,210,0.35)', punchy: '#ff85c0' },
  red:      { light: '#fff1f0', border: '#ffa39e', text: '#cf1322', lightMuted: 'rgba(255,163,158,0.35)', punchy: '#ff7875' },
  volcano:  { light: '#fff2e8', border: '#ffbb96', text: '#d4380d', lightMuted: 'rgba(255,187,150,0.35)', punchy: '#ff9c6e' },
  orange:   { light: '#fff7e6', border: '#ffd591', text: '#d46b08', lightMuted: 'rgba(255,213,145,0.35)', punchy: '#ffc069' },
  gold:     { light: '#fffbe6', border: '#ffe58f', text: '#d48806', lightMuted: 'rgba(255,229,143,0.35)', punchy: '#ffd666' },
  lime:     { light: '#fcffe6', border: '#d3f261', text: '#5b8c00', lightMuted: 'rgba(211,242, 97,0.35)', punchy: '#d3f261' },
  green:    { light: '#f6ffed', border: '#b7eb8f', text: '#389e0d', lightMuted: 'rgba(183,235,143,0.35)', punchy: 'rgb(187,211,11)' },
  cyan:     { light: '#e6fffb', border: '#87e8de', text: '#08979c', lightMuted: 'rgba(135,232,222,0.35)', punchy: '#5cdbd3' },
  blue:     { light: '#e6f4ff', border: '#91caff', text: '#0958d9', lightMuted: 'rgba(145,202,255,0.35)', punchy: '#69b1ff' },
  geekblue: { light: '#f0f5ff', border: '#adc6ff', text: '#1d39c4', lightMuted: 'rgba(173,198,255,0.35)', punchy: '#85a5ff' },
  purple:   { light: '#f9f0ff', border: '#d3adf7', text: '#531dab', lightMuted: 'rgba(211,173,247,0.35)', punchy: '#b37feb' },
}

function labelColorName(label) {
  let hash = 0
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0
  return LABEL_NAMES[hash % LABEL_NAMES.length]
}

/**
 * A row of colored label pills with three explicit visual states.
 *
 * Props
 * ─────
 * labels      – pills to render
 * activePills – labels where ALL selected tasks share this label   → State 1: Selected
 * semiPills   – labels where SOME (not all) tasks share this label → State 2: Semi-selected
 * onToggle    – called with the label string on click
 *
 * Visual mapping (no extra colours — only border and background change):
 *   State 1 – Selected:      colored fill (p.light)  + thin colored border (p.border)
 *   State 2 – Semi-selected: white fill              + black border  1.5 px
 *   State 3 – Unselected:    white fill              + white border  1 px  (invisible on white, subtle on the blue bulk bar)
 */
export default function LabelPills({ labels = [], activePills = [], semiPills = [], onToggle, style }) {
  if (labels.length === 0) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, ...style }}>
      {labels.map(label => {
        const p = PALETTE[labelColorName(label)] || PALETTE.blue
        const isActive = activePills.includes(label)
        const isSemi   = !isActive && semiPills.includes(label)

        let pillStyle
        if (isActive) {
          // State 1: Selected — full color fill + thin colored border
          pillStyle = { background: p.light, boxShadow: `0 0 0 1px ${p.border}`, color: p.text }
        } else if (isSemi) {
          // State 2: Semi-selected — punchy half / white half diagonal split, no border
          pillStyle = { background: `linear-gradient(135deg, ${p.punchy} 50%, #fff 50%)`, boxShadow: 'none', color: p.text }
        } else {
          // State 3: Unselected — white fill + white border + muted text
          pillStyle = { background: '#fff', boxShadow: '0 0 0 1px #fff', color: '#d9d9d9' }
        }

        return (
          <span
            key={label}
            onClick={() => onToggle(label)}
            style={{
              ...pillStyle,
              display: 'inline-block',
              borderRadius: 10,
              padding: '2px 10px',
              fontSize: 12,
              lineHeight: '18px',
              cursor: 'pointer',
              userSelect: 'none',
              whiteSpace: 'nowrap',
              transition: 'box-shadow 0.15s',
            }}
          >
            {label}
          </span>
        )
      })}
    </div>
  )
}
