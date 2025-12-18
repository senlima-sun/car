import { useBrakeStore } from '../../../stores/useBrakeStore'

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 10,
    padding: '8px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'center',
    minWidth: 120,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 9,
    textTransform: 'uppercase' as const,
    textAlign: 'center' as const,
  },
  balanceContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    width: '100%',
  },
  balanceBar: {
    flex: 1,
    height: 20,
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative' as const,
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
  frontFill: {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    bottom: 0,
    transition: 'width 0.2s ease, background-color 0.2s ease',
  },
  biasText: {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontWeight: 'bold',
    fontSize: 10,
    color: '#fff',
    textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
    zIndex: 1,
  },
  separator: {
    width: '100%',
    height: 1,
    background: 'rgba(255, 255, 255, 0.15)',
  },
  engineBraking: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    alignItems: 'center',
  },
  engineBrakingLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 8,
    textTransform: 'uppercase' as const,
  },
  engineBrakingValue: {
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center' as const,
  },
}

function getBiasColor(frontBias: number): string {
  if (frontBias > 60) return '#f97316' // Orange - more front brake
  if (frontBias < 55) return '#3b82f6' // Blue - more rear brake
  return '#22c55e' // Green - balanced
}

function getEngineBrakingAbbreviation(level: string): string {
  switch (level) {
    case 'Low':
      return 'L'
    case 'Medium':
      return 'M'
    case 'High':
      return 'H'
    default:
      return 'M'
  }
}

function getEngineBrakingColor(level: string): string {
  switch (level) {
    case 'Low':
      return '#3b82f6' // Blue
    case 'Medium':
      return '#22c55e' // Green
    case 'High':
      return '#f97316' // Orange
    default:
      return '#22c55e'
  }
}

export default function BrakeIndicator() {
  const frontBias = useBrakeStore(state => state.frontBias)
  const engineBraking = useBrakeStore(state => state.engineBraking)

  const rearBias = 100 - frontBias
  const biasColor = getBiasColor(frontBias)
  const engineBrakingAbbr = getEngineBrakingAbbreviation(engineBraking)
  const engineBrakingColor = getEngineBrakingColor(engineBraking)

  return (
    <div style={styles.container}>
      {/* Label */}
      <span style={styles.label}>Brake Balance</span>

      {/* Brake balance bar */}
      <div style={styles.balanceContainer as React.CSSProperties}>
        <div style={styles.balanceBar}>
          <div
            style={{
              ...styles.frontFill,
              width: `${frontBias}%`,
              backgroundColor: biasColor,
            }}
          />
          <div style={styles.biasText}>
            {Math.round(frontBias)} | {Math.round(rearBias)}
          </div>
        </div>
      </div>

      <div style={styles.separator} />

      {/* Engine braking level */}
      <div style={styles.engineBraking as React.CSSProperties}>
        <span style={styles.engineBrakingLabel}>Engine Brake</span>
        <span style={{ ...styles.engineBrakingValue, color: engineBrakingColor }}>
          {engineBrakingAbbr}
        </span>
      </div>
    </div>
  )
}
