import { usePartEditorStore } from '@/stores/usePartEditorStore'
import { GEOMETRY_DEFAULTS } from '@/constants/partEditor'

const listItemStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: '4px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '13px',
  transition: 'background 0.1s',
}

export default function PartListPanel() {
  const parts = usePartEditorStore((s) => s.parts)
  const selectedPartId = usePartEditorStore((s) => s.selectedPartId)
  const selectPart = usePartEditorStore((s) => s.selectPart)
  const removePart = usePartEditorStore((s) => s.removePart)

  return (
    <div>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>
        Parts ({parts.length})
      </h3>
      {parts.length === 0 ? (
        <div style={{ color: '#666', fontSize: '12px', padding: '8px' }}>
          No parts yet. Add shapes above.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {parts.map((part) => {
            const isSelected = selectedPartId === part.id
            const icon = GEOMETRY_DEFAULTS[part.geometryType]?.icon || '?'
            return (
              <div
                key={part.id}
                style={{
                  ...listItemStyle,
                  background: isSelected ? '#4a4a70' : 'transparent',
                  color: isSelected ? '#fff' : '#ccc',
                }}
                onClick={() => selectPart(part.id)}
              >
                <span style={{ fontSize: '14px' }}>{icon}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {part.name}
                </span>
                <button
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#888',
                    cursor: 'pointer',
                    padding: '2px 6px',
                    fontSize: '14px',
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    removePart(part.id)
                  }}
                  title="Delete part"
                >
                  x
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
