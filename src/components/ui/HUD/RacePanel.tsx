import { useCarStore } from '../../../stores/useCarStore'
import { useActiveAeroStore } from '../../../stores/useActiveAeroStore'
import { useErsStore } from '../../../stores/useErsStore'
import { useTireStore } from '../../../stores/useTireStore'
import { useBrakeStore } from '../../../stores/useBrakeStore'
import { TIRE_CONFIG, TIRE_WEAR_WARNING, TIRE_WEAR_CRITICAL } from '../../../constants/tires'

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 10,
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  separator: {
    width: 1,
    height: 44,
    background: 'rgba(255, 255, 255, 0.15)',
  },
  // Left section (Aero + ERS)
  leftSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  // Center section (Gear + Speed)
  centerSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  gearBox: {
    width: 44,
    height: 44,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255, 107, 107, 0.15)',
    border: '2px solid rgba(255, 107, 107, 0.4)',
  },
  gear: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ff6b6b',
    lineHeight: 1,
    fontFamily: 'monospace',
  },
  speedSection: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 4,
  },
  speed: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#00ff88',
    lineHeight: 1,
    fontFamily: 'monospace',
    minWidth: 72,
    textAlign: 'right',
  },
  unit: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase' as const,
  },
  // Right section (Tires + Brake)
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  // Compact Aero
  aeroBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    minWidth: 40,
  },
  aeroLabel: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.4)',
    textTransform: 'uppercase' as const,
  },
  aeroMode: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  // Compact ERS
  ersBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 70,
  },
  ersBatteryContainer: {
    width: 20,
    height: 40,
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative' as const,
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
  ersBatteryFill: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    transition: 'height 0.3s ease',
    borderRadius: '1px 1px 0 0',
  },
  ersBatteryText: {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: 8,
    fontWeight: 'bold',
    color: '#fff',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
  },
  ersInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  ersLabel: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.4)',
    textTransform: 'uppercase' as const,
  },
  ersMode: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  // Compact Tires
  tireBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 70,
  },
  tireCompound: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: 12,
    color: '#000',
  },
  tireInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    minWidth: 40,
  },
  tireLabel: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.4)',
    textTransform: 'uppercase' as const,
  },
  tireLifeBar: {
    width: 40,
    height: 6,
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  tireLifeFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.3s ease',
  },
  // Compact Brake
  brakeBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    minWidth: 40,
  },
  brakeLabel: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.4)',
    textTransform: 'uppercase' as const,
  },
  brakeValue: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#fff',
  },
  brakeEngineLevel: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'monospace',
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
}

function getAeroModeAbbrev(mode: string): string {
  return mode === 'Corner' ? 'CRN' : 'STR'
}

function getAeroModeColor(mode: string): string {
  return mode === 'Corner' ? '#3b82f6' : '#22c55e'
}

function getErsPresetAbbrev(preset: string): string {
  switch (preset) {
    case 'Aggressive':
      return 'AGR'
    case 'Conservative':
      return 'CON'
    case 'Balanced':
    default:
      return 'BAL'
  }
}

function getErsPresetColor(preset: string): string {
  switch (preset) {
    case 'Aggressive':
      return '#ef4444' // Red for aggressive
    case 'Conservative':
      return '#3b82f6' // Blue for conservative
    case 'Balanced':
    default:
      return '#f59e0b' // Yellow/amber for balanced
  }
}

function getTireWearColor(wear: number): string {
  if (wear >= TIRE_WEAR_CRITICAL) return '#ef4444'
  if (wear >= TIRE_WEAR_WARNING) return '#f59e0b'
  return '#22c55e'
}

function getBrakeEngineColor(level: string): string {
  switch (level) {
    case 'Low':
      return '#3b82f6'
    case 'Medium':
      return '#22c55e'
    case 'High':
      return '#f97316'
    default:
      return '#22c55e'
  }
}

function getBrakeEngineAbbrev(level: string): string {
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

export default function RacePanel() {
  // Car state
  const gear = useCarStore(state => state.gear)
  const speed = useCarStore(state => state.speed)

  // Aero state
  const aeroMode = useActiveAeroStore(state => state.mode)

  // ERS state
  const batteryCharge = useErsStore(state => state.batteryCharge)
  const semiAutoConfig = useErsStore(state => state.semiAutoConfig)

  // Tire state
  const currentCompound = useTireStore(state => state.currentCompound)
  const averageWear = useTireStore(state => state.averageWear)

  // Brake state
  const frontBias = useBrakeStore(state => state.frontBias)
  const engineBraking = useBrakeStore(state => state.engineBraking)

  // Derived values
  const displayGear = gearLabels[gear] ?? gear.toString()
  const displaySpeed = Math.round(Math.abs(speed))
  const tireConfig = TIRE_CONFIG[currentCompound]
  const tireLife = Math.max(0, 100 - averageWear)
  const batteryPercent = Math.max(0, Math.min(100, batteryCharge))
  const rearBias = 100 - frontBias

  return (
    <div style={styles.container}>
      {/* LEFT SECTION: Aero + ERS */}
      <div style={styles.leftSection as React.CSSProperties}>
        {/* Compact Aero */}
        <div style={styles.aeroBox as React.CSSProperties}>
          <span style={styles.aeroLabel}>Aero</span>
          <span style={{ ...styles.aeroMode, color: getAeroModeColor(aeroMode) }}>
            {getAeroModeAbbrev(aeroMode)}
          </span>
        </div>

        {/* Compact ERS */}
        <div style={styles.ersBox as React.CSSProperties}>
          <div style={styles.ersBatteryContainer}>
            {/* Target range zone */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: `${semiAutoConfig.targetMin}%`,
                height: `${semiAutoConfig.targetMax - semiAutoConfig.targetMin}%`,
                background: 'rgba(168, 85, 247, 0.2)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                ...styles.ersBatteryFill,
                height: `${batteryPercent}%`,
                backgroundColor: '#a855f7',
              }}
            />
            {/* Target range markers */}
            {/* Min marker */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: `${semiAutoConfig.targetMin}%`,
                height: 1,
                background: '#a855f7',
                boxShadow: '0 0 2px #a855f7',
              }}
            />
            {/* Max marker */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: `${semiAutoConfig.targetMax}%`,
                height: 1,
                background: '#a855f7',
                boxShadow: '0 0 2px #a855f7',
              }}
            />
            <span style={styles.ersBatteryText}>{Math.round(batteryPercent)}</span>
          </div>
          <div style={styles.ersInfo as React.CSSProperties}>
            <span style={styles.ersLabel}>ERS</span>
            <span style={{ ...styles.ersMode, color: getErsPresetColor(semiAutoConfig.preset) }}>
              {getErsPresetAbbrev(semiAutoConfig.preset)}
            </span>
          </div>
        </div>
      </div>

      <div style={styles.separator} />

      {/* CENTER SECTION: Gear + Speed */}
      <div style={styles.centerSection}>
        <div
          style={{
            ...styles.gearBox,
            background: gear === -1 ? 'rgba(255, 159, 67, 0.15)' : 'rgba(255, 107, 107, 0.15)',
            borderColor: gear === -1 ? 'rgba(255, 159, 67, 0.4)' : 'rgba(255, 107, 107, 0.4)',
          }}
        >
          <span
            style={{
              ...styles.gear,
              color: gear === -1 ? '#ff9f43' : '#ff6b6b',
            }}
          >
            {displayGear}
          </span>
        </div>
        <div style={styles.speedSection}>
          <span style={styles.speed as React.CSSProperties}>{displaySpeed}</span>
          <span style={styles.unit}>km/h</span>
        </div>
      </div>

      <div style={styles.separator} />

      {/* RIGHT SECTION: Tires + Brake */}
      <div style={styles.rightSection as React.CSSProperties}>
        {/* Compact Tires */}
        <div style={styles.tireBox as React.CSSProperties}>
          <div style={{ ...styles.tireCompound, backgroundColor: tireConfig.color }}>
            {tireConfig.icon}
          </div>
          <div style={styles.tireInfo as React.CSSProperties}>
            <span style={styles.tireLabel}>Tire</span>
            <div style={styles.tireLifeBar}>
              <div
                style={{
                  ...styles.tireLifeFill,
                  width: `${tireLife}%`,
                  backgroundColor: getTireWearColor(averageWear),
                }}
              />
            </div>
          </div>
        </div>

        {/* Compact Brake */}
        <div style={styles.brakeBox as React.CSSProperties}>
          <span style={styles.brakeLabel}>Brake</span>
          <span style={styles.brakeValue}>
            {Math.round(frontBias)}:{Math.round(rearBias)}
          </span>
          <span
            style={{
              ...styles.brakeEngineLevel,
              color: getBrakeEngineColor(engineBraking),
            }}
          >
            EB:{getBrakeEngineAbbrev(engineBraking)}
          </span>
        </div>
      </div>
    </div>
  )
}
