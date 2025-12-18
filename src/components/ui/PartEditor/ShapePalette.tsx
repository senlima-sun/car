import { usePartEditorStore } from '@/stores/usePartEditorStore'
import { GEOMETRY_DEFAULTS } from '@/constants/partEditor'
import type { GeometryType } from '@/types/partEditor'

const buttonStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: '#3a3a50',
  border: 'none',
  borderRadius: '6px',
  color: '#eee',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '13px',
  transition: 'background 0.15s',
}

export default function ShapePalette() {
  const addPart = usePartEditorStore((s) => s.addPart)

  const shapes = Object.entries(GEOMETRY_DEFAULTS) as [GeometryType, typeof GEOMETRY_DEFAULTS[GeometryType]][]

  return (
    <div>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>
        Add Shape
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        {shapes.map(([type, config]) => (
          <button
            key={type}
            style={buttonStyle}
            onClick={() => addPart(type)}
            onMouseOver={(e) => (e.currentTarget.style.background = '#4a4a60')}
            onMouseOut={(e) => (e.currentTarget.style.background = '#3a3a50')}
          >
            <span style={{ fontSize: '16px' }}>{config.icon}</span>
            <span>{config.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
