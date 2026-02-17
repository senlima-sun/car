import { useActiveAeroStore } from '../../../stores/useActiveAeroStore'
import { AERO_MODE, STATUS, UI } from '@/constants/colors'

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
    color: UI.textPrimary,
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
      return AERO_MODE.corner
    case 'Straight':
      return AERO_MODE.straight
    default:
      return STATUS.neutral
  }
}

export default function AeroIndicator() {
  const mode = useActiveAeroStore(state => state.mode)
  const autoMode = useActiveAeroStore(state => state.autoMode)
  const dragMultiplier = useActiveAeroStore(state => state.dragMultiplier)
  const downforceMultiplier = useActiveAeroStore(state => state.downforceMultiplier)

  const modeColor = getModeColor(mode)

  return (
    <div style={styles.container}>
      <span style={styles.label}>Active Aero</span>

      {/* Auto/Manual badge */}
      <span
        style={{
          fontSize: 9,
          fontWeight: 'bold',
          color: autoMode ? '#00e5ff' : 'rgba(255, 255, 255, 0.6)',
          letterSpacing: 1,
        }}
      >
        {autoMode ? 'AUTO' : 'MANUAL'}
      </span>

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
              color: dragMultiplier > 1 ? STATUS.warning : STATUS.success,
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
              color: downforceMultiplier > 1 ? STATUS.success : STATUS.warning,
            }}
          >
            {downforceMultiplier.toFixed(1)}x
          </span>
        </div>
      </div>
    </div>
  )
}
