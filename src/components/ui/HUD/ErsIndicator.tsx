import { useErsStore } from '../../../stores/useErsStore'

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 10,
    padding: '8px 12px',
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    fontSize: 11,
  },
  // Battery section
  battery: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 60,
  },
  batteryLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 9,
    textTransform: 'uppercase' as const,
    textAlign: 'center' as const,
  },
  batteryBarContainer: {
    width: '100%',
    height: 50,
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative' as const,
    border: '2px solid rgba(255, 255, 255, 0.2)',
  },
  batteryFill: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    transition: 'height 0.3s ease, background-color 0.3s ease',
    borderRadius: '2px 2px 0 0',
  },
  batteryText: {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontWeight: 'bold',
    fontSize: 12,
    color: '#fff',
    textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
    zIndex: 1,
  },
  separator: {
    width: 1,
    height: 50,
    background: 'rgba(255, 255, 255, 0.15)',
  },
  // Mode section
  mode: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    alignItems: 'center',
    minWidth: 50,
  },
  modeLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 9,
    textTransform: 'uppercase' as const,
  },
  modeValue: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#fff',
  },
  // Power flow section
  powerFlow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    alignItems: 'center',
    minWidth: 50,
  },
  powerLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 9,
    textTransform: 'uppercase' as const,
  },
  powerValue: {
    fontWeight: 'bold',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  powerArrow: {
    fontSize: 16,
    lineHeight: '16px',
  },
}

function getBatteryColor(charge: number): string {
  if (charge > 50) return '#22c55e' // Green
  if (charge > 20) return '#f59e0b' // Yellow
  return '#ef4444' // Red
}

function getModeAbbreviation(mode: string): string {
  switch (mode) {
    case 'Attack':
      return 'ATK'
    case 'Balanced':
      return 'BAL'
    case 'Harvest':
      return 'HRV'
    default:
      return 'BAL'
  }
}

export default function ErsIndicator() {
  const batteryCharge = useErsStore(state => state.batteryCharge)
  const mode = useErsStore(state => state.mode)
  const powerFlow = useErsStore(state => state.powerFlow)
  const isDeploying = useErsStore(state => state.isDeploying)
  const isHarvesting = useErsStore(state => state.isHarvesting)

  const batteryPercent = Math.max(0, Math.min(100, batteryCharge))
  const batteryColor = getBatteryColor(batteryPercent)
  const modeText = getModeAbbreviation(mode)

  // Determine power flow display
  let powerArrow = ''
  let powerColor = 'rgba(255, 255, 255, 0.5)'
  if (isDeploying) {
    powerArrow = '↑'
    powerColor = '#22c55e' // Green for deploying
  } else if (isHarvesting) {
    powerArrow = '↓'
    powerColor = '#3b82f6' // Blue for harvesting
  }

  return (
    <div style={styles.container}>
      {/* Battery charge vertical bar */}
      <div style={styles.battery as React.CSSProperties}>
        <span style={styles.batteryLabel}>Battery</span>
        <div style={styles.batteryBarContainer}>
          <div
            style={{
              ...styles.batteryFill,
              height: `${batteryPercent}%`,
              backgroundColor: batteryColor,
            }}
          />
          <div style={styles.batteryText}>{Math.round(batteryPercent)}%</div>
        </div>
      </div>

      <div style={styles.separator} />

      {/* ERS mode */}
      <div style={styles.mode as React.CSSProperties}>
        <span style={styles.modeLabel}>Mode</span>
        <span style={styles.modeValue}>{modeText}</span>
      </div>

      <div style={styles.separator} />

      {/* Power flow indicator */}
      <div style={styles.powerFlow as React.CSSProperties}>
        <span style={styles.powerLabel}>Power</span>
        {powerArrow && (
          <span style={{ ...styles.powerArrow, color: powerColor }}>{powerArrow}</span>
        )}
        <span style={{ ...styles.powerValue, color: powerColor }}>
          {Math.abs(Math.round(powerFlow))} kW
        </span>
      </div>
    </div>
  )
}
