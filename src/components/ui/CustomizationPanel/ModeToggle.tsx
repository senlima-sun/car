import { useGameStore } from '../../../stores/useGameStore'

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 20,
    right: 70,
    display: 'flex',
    gap: 4,
    background: 'rgba(0, 0, 0, 0.7)',
    padding: 4,
    borderRadius: 8,
    pointerEvents: 'auto',
  },
  button: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
  },
  active: {
    background: '#00ff00',
    color: '#000',
  },
  inactive: {
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#999',
  },
  hint: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    fontSize: 10,
    color: '#666',
    whiteSpace: 'nowrap',
  },
}

export default function ModeToggle() {
  const status = useGameStore(s => s.status)
  const toggleCustomizeMode = useGameStore(s => s.toggleCustomizeMode)

  const isCustomize = status === 'customize'

  return (
    <div style={styles.container}>
      <button
        style={{
          ...styles.button,
          ...(isCustomize ? styles.inactive : styles.active),
        }}
        onClick={() => isCustomize && toggleCustomizeMode()}
      >
        RACE
      </button>
      <button
        style={{
          ...styles.button,
          ...(isCustomize ? styles.active : styles.inactive),
        }}
        onClick={() => !isCustomize && toggleCustomizeMode()}
      >
        EDIT
      </button>
      <span style={styles.hint as React.CSSProperties}>Press T to toggle</span>
    </div>
  )
}
