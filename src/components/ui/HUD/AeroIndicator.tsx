import { useActiveAeroStore } from '../../../stores/useActiveAeroStore'

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 10,
    padding: '8px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    alignItems: 'center',
    minWidth: 100,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 9,
    textTransform: 'uppercase' as const,
    textAlign: 'center' as const,
  },
  modeValue: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#fff',
    textAlign: 'center' as const,
  },
  multipliers: {
    display: 'flex',
    gap: 12,
    fontSize: 10,
  },
  multiplierItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  multiplierLabel: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 8,
  },
  multiplierValue: {
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
}

function getModeColor(mode: string): string {
  switch (mode) {
    case 'Corner':
      return '#3b82f6' // Blue for high downforce
    case 'Straight':
      return '#22c55e' // Green for low drag
    default:
      return '#ffffff'
  }
}

export default function AeroIndicator() {
  const mode = useActiveAeroStore(state => state.mode)
  const dragMultiplier = useActiveAeroStore(state => state.dragMultiplier)
  const downforceMultiplier = useActiveAeroStore(state => state.downforceMultiplier)

  const modeColor = getModeColor(mode)

  return (
    <div style={styles.container}>
      <span style={styles.label}>Active Aero</span>

      {/* Mode display */}
      <span style={{ ...styles.modeValue, color: modeColor }}>{mode.toUpperCase()}</span>

      {/* Multipliers */}
      <div style={styles.multipliers as React.CSSProperties}>
        {/* Drag multiplier */}
        <div style={styles.multiplierItem as React.CSSProperties}>
          <span style={styles.multiplierLabel}>Drag</span>
          <span
            style={{
              ...styles.multiplierValue,
              color: dragMultiplier > 1 ? '#f59e0b' : '#22c55e',
            }}
          >
            {dragMultiplier.toFixed(1)}x
          </span>
        </div>

        {/* Downforce multiplier */}
        <div style={styles.multiplierItem as React.CSSProperties}>
          <span style={styles.multiplierLabel}>Downforce</span>
          <span
            style={{
              ...styles.multiplierValue,
              color: downforceMultiplier > 1 ? '#22c55e' : '#f59e0b',
            }}
          >
            {downforceMultiplier.toFixed(1)}x
          </span>
        </div>
      </div>
    </div>
  )
}
