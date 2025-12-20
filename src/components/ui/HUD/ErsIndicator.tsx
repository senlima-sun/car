import { useErsStore } from '../../../stores/useErsStore'
import type { HarvestSource } from '../../../wasm/PhysicsBridge'

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
  // Harvest source section
  harvestSource: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    alignItems: 'center',
    minWidth: 40,
  },
  harvestLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 9,
    textTransform: 'uppercase' as const,
  },
  harvestValue: {
    fontWeight: 'bold',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  // Super clip indicator
  superClipIndicator: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    marginTop: 2,
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
    case 'Overtake':
      return 'OVT'
    case 'SemiAuto':
      return 'AUTO'
    default:
      return 'BAL'
  }
}

function getModeColor(mode: string): string {
  switch (mode) {
    case 'Attack':
      return '#22c55e' // Green
    case 'Balanced':
      return '#ffffff' // White
    case 'Harvest':
      return '#3b82f6' // Blue
    case 'Overtake':
      return '#f97316' // Orange
    case 'SemiAuto':
      return '#a855f7' // Purple
    default:
      return '#ffffff'
  }
}

function getHarvestSourceAbbrev(source: HarvestSource): string {
  switch (source) {
    case 'Braking':
      return 'BRK'
    case 'Coast':
      return 'CST'
    case 'SuperClip':
      return 'CLIP'
    default:
      return '-'
  }
}

function getHarvestSourceColor(source: HarvestSource): string {
  switch (source) {
    case 'Braking':
      return '#ef4444' // Red
    case 'Coast':
      return '#3b82f6' // Blue
    case 'SuperClip':
      return '#a855f7' // Purple
    default:
      return 'rgba(255, 255, 255, 0.3)'
  }
}

export default function ErsIndicator() {
  const batteryCharge = useErsStore(state => state.batteryCharge)
  const mode = useErsStore(state => state.mode)
  const powerFlow = useErsStore(state => state.powerFlow)
  const isDeploying = useErsStore(state => state.isDeploying)
  const isHarvesting = useErsStore(state => state.isHarvesting)
  const superClipActive = useErsStore(state => state.superClipActive)
  const harvestSource = useErsStore(state => state.harvestSource)

  const batteryPercent = Math.max(0, Math.min(100, batteryCharge))
  const batteryColor = getBatteryColor(batteryPercent)
  const modeText = getModeAbbreviation(mode)
  const modeColor = getModeColor(mode)

  // Determine power flow display
  let powerArrow = ''
  let powerColor = 'rgba(255, 255, 255, 0.5)'
  if (isDeploying && isHarvesting) {
    // Super clipping: deploying and harvesting simultaneously
    powerArrow = '⇅'
    powerColor = '#a855f7' // Purple for super clip
  } else if (isDeploying) {
    powerArrow = '↑'
    powerColor = '#22c55e' // Green for deploying
  } else if (isHarvesting) {
    powerArrow = '↓'
    powerColor = '#3b82f6' // Blue for harvesting
  }

  const harvestSourceText = getHarvestSourceAbbrev(harvestSource)
  const harvestSourceColor = getHarvestSourceColor(harvestSource)

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
        <span style={{ ...styles.modeValue, color: modeColor }}>{modeText}</span>
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

      <div style={styles.separator} />

      {/* Harvest source with super clip indicator */}
      <div style={styles.harvestSource as React.CSSProperties}>
        <span style={styles.harvestLabel}>Regen</span>
        <span style={{ ...styles.harvestValue, color: harvestSourceColor }}>
          {harvestSourceText}
        </span>
        {/* Super clip indicator dot */}
        <div
          style={{
            ...styles.superClipIndicator,
            backgroundColor: superClipActive ? '#a855f7' : 'rgba(255, 255, 255, 0.1)',
            boxShadow: superClipActive ? '0 0 8px #a855f7' : 'none',
            animation: superClipActive ? 'pulse 0.5s ease-in-out infinite' : 'none',
          }}
        />
      </div>

      {/* CSS animation for pulse */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}
