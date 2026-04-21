import { useCustomizationStore } from '../../../stores/useCustomizationStore'

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  button: {
    height: 28,
    padding: '0 10px',
    border: '2px solid transparent',
    borderRadius: 5,
    cursor: 'pointer',
    fontSize: 10,
    fontWeight: 'bold',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  },
  active: {
    borderColor: '#ffe55c',
    background: 'rgba(255, 229, 92, 0.15)',
    color: '#ffe55c',
  },
  inactive: {
    background: 'rgba(255, 255, 255, 0.08)',
    color: 'rgba(255, 255, 255, 0.5)',
  },
}

export default function RaceDirectionControl() {
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const updateObject = useCustomizationStore(s => s.updateObject)

  const sf = placedObjects.find(
    o => o.type === 'checkpoint' && (o.checkpointType ?? 'start-finish') === 'start-finish',
  )
  if (!sf) return null

  const current: 'forward' | 'backward' = sf.flowDirection === 'backward' ? 'backward' : 'forward'

  return (
    <div style={styles.wrapper}>
      <span style={styles.label}>Race Dir</span>
      {(['forward', 'backward'] as const).map(dir => (
        <button
          key={dir}
          style={{
            ...styles.button,
            ...(current === dir ? styles.active : styles.inactive),
          }}
          onClick={() => updateObject(sf.id, { flowDirection: dir })}
          title={dir === 'forward' ? 'Race direction: forward' : 'Race direction: reverse'}
        >
          {dir === 'forward' ? '→' : '←'}
        </button>
      ))}
    </div>
  )
}
