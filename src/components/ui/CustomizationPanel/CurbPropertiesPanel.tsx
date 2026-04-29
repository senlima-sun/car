import { useCustomizationStore } from '../../../stores/useCustomizationStore'
import { useEditorStore } from '../../../stores/useEditorStore'
import type { CurbType } from '../../../types/trackObjects'
import { CURB_PHYSICS_PER_TYPE, CURB_PEAK_HEIGHTS } from '../../../constants/curb'

const CURB_TYPES: { type: CurbType; label: string; description: string }[] = [
  { type: 'apex', label: 'Apex', description: 'Inside-corner kerb' },
  { type: 'exit', label: 'Exit', description: 'Sawtooth, aggressive' },
  { type: 'flat', label: 'Flat', description: 'Low transition' },
]

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '10px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    marginTop: 6,
  },
  title: {
    color: '#8a8a8a',
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  typeRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 4,
    marginBottom: 8,
  },
  typeButton: {
    padding: '6px 4px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 'bold',
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#aaa',
    transition: 'all 0.15s ease',
  },
  typeButtonActive: {
    background: 'rgba(234, 179, 8, 0.25)',
    borderColor: '#eab308',
    color: '#fde68a',
  },
  description: {
    color: '#888',
    fontSize: 10,
    marginBottom: 8,
    minHeight: 14,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '4px 10px',
    fontSize: 10,
    color: '#aaa',
  },
  statLabel: {
    color: '#666',
  },
  statValue: {
    color: '#ddd',
    textAlign: 'right' as const,
    fontVariantNumeric: 'tabular-nums' as const,
  },
}

export default function CurbPropertiesPanel() {
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const updateObject = useCustomizationStore(s => s.updateObject)
  const selectedObjectId = useEditorStore(s => s.selectedObjectId)

  const selectedCurb = selectedObjectId
    ? placedObjects.find(o => o.id === selectedObjectId && o.type === 'curb')
    : null

  if (!selectedCurb) return null

  const currentType: CurbType = selectedCurb.curbType ?? 'apex'
  const physics = CURB_PHYSICS_PER_TYPE[currentType]
  const peakHeight = CURB_PEAK_HEIGHTS[currentType]
  const currentMeta = CURB_TYPES.find(t => t.type === currentType)

  const handleSelectType = (type: CurbType) => {
    if (type === currentType) return
    updateObject(selectedCurb.id, { curbType: type })
  }

  return (
    <div style={styles.container}>
      <div style={styles.title}>Curb Type</div>
      <div style={styles.typeRow}>
        {CURB_TYPES.map(({ type, label }) => (
          <button
            key={type}
            style={{
              ...styles.typeButton,
              ...(currentType === type ? styles.typeButtonActive : {}),
            }}
            onClick={() => handleSelectType(type)}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={styles.description}>{currentMeta?.description ?? ''}</div>
      <div style={styles.statsGrid}>
        <span style={styles.statLabel}>Grip</span>
        <span style={styles.statValue}>{physics.grip.toFixed(2)}×</span>
        <span style={styles.statLabel}>Drag</span>
        <span style={styles.statValue}>{physics.drag.toFixed(2)}×</span>
        <span style={styles.statLabel}>Stability</span>
        <span style={styles.statValue}>{physics.stability.toFixed(2)}×</span>
        <span style={styles.statLabel}>Peak height</span>
        <span style={styles.statValue}>{(peakHeight * 1000).toFixed(0)} mm</span>
      </div>
    </div>
  )
}
