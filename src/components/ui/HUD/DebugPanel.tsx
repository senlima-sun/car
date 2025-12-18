import { useTireStore } from '../../../stores/useTireStore'
import { useErsStore } from '../../../stores/useErsStore'
import { TIRE_CONFIG, TIRE_ORDER, type TireCompound } from '../../../constants/tires'
import {
  TireCompound as TireCompoundWasm,
  setTireCompound as setTireCompoundWasm,
  setErsBatteryCharge,
  setErsMode,
  type ErsMode,
} from '../../../wasm/PhysicsBridge'

// Map string compound to WASM enum
const compoundToWasm: Record<TireCompound, TireCompoundWasm> = {
  soft: TireCompoundWasm.Soft,
  medium: TireCompoundWasm.Medium,
  hard: TireCompoundWasm.Hard,
  wet: TireCompoundWasm.Wet,
  intermediate: TireCompoundWasm.Intermediate,
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 10,
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontSize: 11,
    minWidth: 180,
    border: '1px solid rgba(255, 165, 0, 0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#ffa500',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  badge: {
    background: 'rgba(255, 165, 0, 0.2)',
    color: '#ffa500',
    fontSize: 8,
    padding: '2px 6px',
    borderRadius: 4,
    fontWeight: 'bold',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    minWidth: 70,
  },
  slider: {
    flex: 1,
    height: 4,
    appearance: 'none' as const,
    background: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 2,
    outline: 'none',
    cursor: 'pointer',
  },
  value: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 11,
    minWidth: 35,
    textAlign: 'right' as const,
    fontFamily: 'monospace',
  },
  buttonRow: {
    display: 'flex',
    gap: 6,
    marginTop: 4,
  },
  button: {
    flex: 1,
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    borderRadius: 4,
    padding: '6px 8px',
    color: '#fff',
    fontSize: 10,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  syncIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingTop: 6,
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  },
  checkbox: {
    width: 14,
    height: 14,
    cursor: 'pointer',
    accentColor: '#22c55e',
  },
  checkboxLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 9,
  },
  compoundRow: {
    display: 'flex',
    gap: 4,
    marginTop: 4,
  },
  compoundButton: {
    flex: 1,
    padding: '6px 4px',
    borderRadius: 4,
    border: '2px solid transparent',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 2,
    transition: 'all 0.15s',
  },
  compoundIcon: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  compoundName: {
    fontSize: 7,
    textTransform: 'uppercase' as const,
    opacity: 0.8,
  },
}

function getWearColor(wear: number): string {
  if (wear >= 90) return '#ef4444'
  if (wear >= 70) return '#f59e0b'
  return '#22c55e'
}

const ERS_MODES: ErsMode[] = ['Harvest', 'Balanced', 'Attack', 'Overtake']

function getErsModeColor(mode: ErsMode): string {
  switch (mode) {
    case 'Harvest': return '#3b82f6'
    case 'Balanced': return '#ffffff'
    case 'Attack': return '#22c55e'
    case 'Overtake': return '#f97316'
    default: return '#ffffff'
  }
}

function getBatteryColor(charge: number): string {
  if (charge > 50) return '#22c55e'
  if (charge > 20) return '#f59e0b'
  return '#ef4444'
}

export default function DebugPanel() {
  const averageWear = useTireStore(state => state.averageWear)
  const debugMode = useTireStore(state => state.debugMode)
  const setWearDebug = useTireStore(state => state.setWearDebug)
  const disableDebugMode = useTireStore(state => state.disableDebugMode)
  const currentCompound = useTireStore(state => state.currentCompound)
  const setTireCompound = useTireStore(state => state.setTireCompound)

  // ERS state
  const batteryCharge = useErsStore(state => state.batteryCharge)
  const ersMode = useErsStore(state => state.mode)
  const setErsModeStore = useErsStore(state => state.setMode)
  const powerFlow = useErsStore(state => state.powerFlow)
  const superClipActive = useErsStore(state => state.superClipActive)
  const harvestSource = useErsStore(state => state.harvestSource)

  const tireLife = Math.max(0, 100 - averageWear)

  const handleCompoundChange = (compound: TireCompound) => {
    // Update store
    setTireCompound(compound)
    // Update WASM physics engine
    try {
      setTireCompoundWasm(compoundToWasm[compound])
    } catch {
      // WASM may not be initialized yet
    }
  }

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const wear = Number(e.target.value)
    setWearDebug(wear)
  }

  const handleReset = () => {
    setWearDebug(0)
  }

  const handlePreset = (wear: number) => {
    setWearDebug(wear)
  }

  const handleSyncToggle = () => {
    if (debugMode) {
      disableDebugMode()
    }
  }

  // ERS handlers
  const handleBatteryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const charge = Number(e.target.value) / 100 // Convert 0-100 to 0-1
    try {
      setErsBatteryCharge(charge)
    } catch {
      // WASM may not be initialized yet
    }
  }

  const handleErsModeChange = (mode: ErsMode) => {
    setErsModeStore(mode)
    try {
      setErsMode(mode)
    } catch {
      // WASM may not be initialized yet
    }
  }

  const handleBatteryPreset = (charge: number) => {
    try {
      setErsBatteryCharge(charge / 100)
    } catch {
      // WASM may not be initialized yet
    }
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>Debug Tools</span>
        {debugMode && <span style={styles.badge}>PAUSED</span>}
      </div>

      {/* Tire Compound Selector */}
      <div style={styles.row}>
        <span style={styles.label}>Compound</span>
      </div>
      <div style={styles.compoundRow}>
        {TIRE_ORDER.map(compound => {
          const config = TIRE_CONFIG[compound]
          const isActive = currentCompound === compound
          return (
            <button
              key={compound}
              onClick={() => handleCompoundChange(compound)}
              style={{
                ...styles.compoundButton,
                background: isActive ? config.color : 'rgba(255, 255, 255, 0.1)',
                borderColor: isActive ? config.color : 'transparent',
                color: isActive ? (compound === 'hard' ? '#000' : '#fff') : 'rgba(255, 255, 255, 0.7)',
              }}
            >
              <span style={styles.compoundIcon}>{config.icon}</span>
              <span style={styles.compoundName}>{config.displayName.slice(0, 3)}</span>
            </button>
          )
        })}
      </div>

      {/* Tire Wear Slider */}
      <div style={styles.row}>
        <span style={styles.label}>Tire Wear</span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={averageWear}
          onChange={handleSliderChange}
          style={{
            ...styles.slider,
            background: `linear-gradient(to right, ${getWearColor(averageWear)} ${averageWear}%, rgba(255,255,255,0.15) ${averageWear}%)`,
          }}
        />
        <span style={{ ...styles.value, color: getWearColor(averageWear) }}>{Math.round(averageWear)}%</span>
      </div>

      {/* Tire Life display */}
      <div style={styles.row}>
        <span style={styles.label}>Tire Life</span>
        <span
          style={{
            ...styles.value,
            flex: 1,
            textAlign: 'left' as const,
            color: getWearColor(averageWear),
          }}
        >
          {Math.round(tireLife)}%
        </span>
      </div>

      {/* Preset buttons */}
      <div style={styles.buttonRow}>
        <button
          style={styles.button}
          onClick={handleReset}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34, 197, 94, 0.3)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
        >
          New (0%)
        </button>
        <button
          style={styles.button}
          onClick={() => handlePreset(50)}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245, 158, 11, 0.3)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
        >
          Half (50%)
        </button>
        <button
          style={styles.button}
          onClick={() => handlePreset(85)}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
        >
          Worn (85%)
        </button>
      </div>

      {/* Sync toggle */}
      <div style={styles.syncIndicator}>
        <input
          type="checkbox"
          id="debug-sync"
          checked={!debugMode}
          onChange={handleSyncToggle}
          style={styles.checkbox}
        />
        <label htmlFor="debug-sync" style={styles.checkboxLabel}>
          {debugMode ? 'Enable wear sync (resume normal)' : 'Wear syncing from physics'}
        </label>
      </div>

      {/* ERS Section Separator */}
      <div style={{
        height: 1,
        background: 'rgba(255, 165, 0, 0.3)',
        margin: '8px 0'
      }} />

      {/* ERS Header */}
      <div style={styles.header}>
        <span style={styles.title}>ERS Tuning</span>
        {superClipActive && (
          <span style={{ ...styles.badge, background: 'rgba(168, 85, 247, 0.3)', color: '#a855f7' }}>
            CLIP
          </span>
        )}
      </div>

      {/* ERS Mode Selector */}
      <div style={styles.row}>
        <span style={styles.label}>Mode</span>
      </div>
      <div style={styles.compoundRow}>
        {ERS_MODES.map(mode => {
          const isActive = ersMode === mode
          const color = getErsModeColor(mode)
          return (
            <button
              key={mode}
              onClick={() => handleErsModeChange(mode)}
              style={{
                ...styles.compoundButton,
                background: isActive ? color : 'rgba(255, 255, 255, 0.1)',
                borderColor: isActive ? color : 'transparent',
                color: isActive ? (mode === 'Balanced' ? '#000' : '#fff') : 'rgba(255, 255, 255, 0.7)',
              }}
            >
              <span style={styles.compoundIcon}>
                {mode === 'Harvest' ? '↓' : mode === 'Attack' ? '↑' : mode === 'Overtake' ? '⚡' : '⟷'}
              </span>
              <span style={styles.compoundName}>{mode.slice(0, 3).toUpperCase()}</span>
            </button>
          )
        })}
      </div>

      {/* Battery Charge Slider */}
      <div style={styles.row}>
        <span style={styles.label}>Battery</span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={batteryCharge}
          onChange={handleBatteryChange}
          style={{
            ...styles.slider,
            background: `linear-gradient(to right, ${getBatteryColor(batteryCharge)} ${batteryCharge}%, rgba(255,255,255,0.15) ${batteryCharge}%)`,
          }}
        />
        <span style={{ ...styles.value, color: getBatteryColor(batteryCharge) }}>
          {Math.round(batteryCharge)}%
        </span>
      </div>

      {/* Power Flow Display */}
      <div style={styles.row}>
        <span style={styles.label}>Power</span>
        <span
          style={{
            ...styles.value,
            flex: 1,
            textAlign: 'left' as const,
            color: powerFlow > 0 ? '#22c55e' : powerFlow < 0 ? '#3b82f6' : 'rgba(255,255,255,0.5)',
          }}
        >
          {powerFlow > 0 ? '↑' : powerFlow < 0 ? '↓' : ''} {Math.abs(Math.round(powerFlow))} kW
        </span>
        {harvestSource !== 'None' && (
          <span style={{
            fontSize: 9,
            color: harvestSource === 'SuperClip' ? '#a855f7' : harvestSource === 'Braking' ? '#ef4444' : '#3b82f6'
          }}>
            {harvestSource === 'SuperClip' ? 'CLIP' : harvestSource === 'Braking' ? 'BRK' : 'CST'}
          </span>
        )}
      </div>

      {/* Battery Preset Buttons */}
      <div style={styles.buttonRow}>
        <button
          style={styles.button}
          onClick={() => handleBatteryPreset(100)}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34, 197, 94, 0.3)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
        >
          Full
        </button>
        <button
          style={styles.button}
          onClick={() => handleBatteryPreset(50)}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245, 158, 11, 0.3)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
        >
          50%
        </button>
        <button
          style={styles.button}
          onClick={() => handleBatteryPreset(0)}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
        >
          Empty
        </button>
      </div>
    </div>
  )
}
