import { useCarStore } from '../../../stores/useCarStore'
import { GEAR, UI } from '@/constants/colors'

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 15,
    padding: '20px 25px',
    textAlign: 'center',
    minWidth: 80,
  },
  gear: {
    fontSize: 48,
    fontWeight: 'bold',
    color: GEAR.reverse,
    lineHeight: 1,
    textShadow: '0 0 10px rgba(255, 107, 107, 0.5)',
  },
  label: {
    fontSize: 12,
    color: UI.textDisabled,
    textTransform: 'uppercase' as const,
    letterSpacing: 2,
    marginBottom: 5,
  },
  rpmContainer: {
    marginTop: 8,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 3,
  },
  rpmValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: UI.textPrimary,
    fontFamily: 'monospace',
  },
  rpmBarBg: {
    width: '100%',
    height: 4,
    background: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  rpmBarFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.05s linear, background-color 0.1s ease',
  },
}

const gearLabels: Record<number, string> = {
  [-1]: 'R',
  0: 'N',
  1: '1',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
}

const MAX_RPM = 15000

function getRpmColor(rpmPercent: number): string {
  if (rpmPercent >= 0.95) return GEAR.redline
  if (rpmPercent >= 0.8) return '#ff6600'
  return '#22c55e'
}

export default function GearIndicator() {
  const gear = useCarStore(state => state.gear)
  const rpm = useCarStore(state => state.rpm)
  const displayGear = gearLabels[gear] ?? gear.toString()
  const rpmPercent = Math.min(rpm / MAX_RPM, 1)
  const rpmColor = getRpmColor(rpmPercent)

  return (
    <div style={styles.container}>
      <div style={styles.label}>Gear</div>
      <div
        style={{
          ...styles.gear,
          color: gear === -1 ? GEAR.reverseAlt : GEAR.reverse,
        }}
      >
        {displayGear}
      </div>
      <div style={styles.rpmContainer}>
        <span style={{ ...styles.rpmValue, color: rpmColor }}>
          {Math.round(rpm).toLocaleString()}
        </span>
        <div style={styles.rpmBarBg}>
          <div
            style={{
              ...styles.rpmBarFill,
              width: `${rpmPercent * 100}%`,
              backgroundColor: rpmColor,
            }}
          />
        </div>
      </div>
    </div>
  )
}
