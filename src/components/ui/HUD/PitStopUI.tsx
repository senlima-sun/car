import { usePitStore } from '../../../stores/usePitStore'
import { useTireStore } from '../../../stores/useTireStore'
import { useCarStore } from '../../../stores/useCarStore'
import { TireCompound, TIRE_CONFIG, TIRE_ORDER } from '../../../constants/tires'

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1000,
    pointerEvents: 'auto',
  },
  panel: {
    background: 'rgba(20, 20, 20, 0.95)',
    borderRadius: 16,
    padding: 24,
    minWidth: 400,
    border: '2px solid #ff6600',
    boxShadow: '0 0 30px rgba(255, 102, 0, 0.3)',
  },
  title: {
    color: '#ff6600',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  subtitle: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },
  tireGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 10,
    marginBottom: 20,
  },
  tireButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: 12,
    border: '2px solid transparent',
    borderRadius: 10,
    background: 'rgba(255, 255, 255, 0.1)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  tireButtonSelected: {
    background: 'rgba(255, 255, 255, 0.2)',
    transform: 'scale(1.05)',
  },
  tireBadge: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: 24,
    color: '#000',
    marginBottom: 8,
    border: '3px solid rgba(255, 255, 255, 0.3)',
  },
  tireName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tireGrip: {
    color: '#888',
    fontSize: 10,
    marginTop: 4,
  },
  currentTireInfo: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currentLabel: {
    color: '#888',
    fontSize: 12,
  },
  currentValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionRow: {
    display: 'flex',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    padding: '14px 24px',
    border: 'none',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textTransform: 'uppercase',
  },
  confirmButtonEnabled: {
    background: '#22c55e',
    color: '#fff',
  },
  confirmButtonDisabled: {
    background: '#444',
    color: '#888',
    cursor: 'not-allowed',
  },
  cancelButton: {
    padding: '14px 24px',
    border: '2px solid #666',
    borderRadius: 8,
    background: 'transparent',
    color: '#888',
    fontSize: 16,
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  hint: {
    color: '#666',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
  },
  speedWarning: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    padding: 10,
    background: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 6,
  },
}

export default function PitStopUI() {
  const isPitStopActive = usePitStore(s => s.isPitStopActive)
  const selectedNewTire = usePitStore(s => s.selectedNewTire)
  const pitStopSpeedThreshold = usePitStore(s => s.pitStopSpeedThreshold)
  const selectTire = usePitStore(s => s.selectTire)
  const completePitStop = usePitStore(s => s.completePitStop)
  const cancelPitStop = usePitStore(s => s.cancelPitStop)

  const currentCompound = useTireStore(s => s.currentCompound)
  const wear = useTireStore(s => s.wear)
  const setTireCompound = useTireStore(s => s.setTireCompound)
  const resetWear = useTireStore(s => s.resetWear)

  const speed = useCarStore(s => s.speed)
  const speedMs = speed / 3.6 // Convert km/h to m/s

  // Only show when pit stop is active
  if (!isPitStopActive) return null

  const canChangeTires = speedMs < pitStopSpeedThreshold

  const handleConfirm = () => {
    if (!selectedNewTire || !canChangeTires) return

    // Complete pit stop
    const newTire = completePitStop()
    if (newTire) {
      setTireCompound(newTire)
      resetWear()
    }
  }

  const handleSelectTire = (compound: TireCompound) => {
    selectTire(compound)
  }

  const currentConfig = TIRE_CONFIG[currentCompound]
  const selectedConfig = selectedNewTire ? TIRE_CONFIG[selectedNewTire] : null

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <div style={styles.title}>PIT STOP</div>
        <div style={styles.subtitle}>Select new tire compound</div>

        {!canChangeTires && <div style={styles.speedWarning}>STOP THE CAR TO CHANGE TIRES</div>}

        {/* Current tire info */}
        <div style={styles.currentTireInfo}>
          <div>
            <div style={styles.currentLabel}>Current</div>
            <div style={styles.currentValue}>
              <span style={{ color: currentConfig.color }}>{currentConfig.icon}</span>{' '}
              {currentConfig.displayName} ({Math.round(100 - wear)}% life)
            </div>
          </div>
          {selectedConfig && (
            <div style={{ textAlign: 'right' }}>
              <div style={styles.currentLabel}>New</div>
              <div style={styles.currentValue}>
                <span style={{ color: selectedConfig.color }}>{selectedConfig.icon}</span>{' '}
                {selectedConfig.displayName}
              </div>
            </div>
          )}
        </div>

        {/* Tire selection grid */}
        <div style={styles.tireGrid}>
          {TIRE_ORDER.map(compound => {
            const config = TIRE_CONFIG[compound]
            const isSelected = selectedNewTire === compound
            const gripPercent = Math.round(config.gripMultiplier * 100)

            return (
              <button
                key={compound}
                style={{
                  ...styles.tireButton,
                  ...(isSelected ? styles.tireButtonSelected : {}),
                  borderColor: isSelected ? config.color : 'transparent',
                }}
                onClick={() => handleSelectTire(compound)}
              >
                <div
                  style={{
                    ...styles.tireBadge,
                    backgroundColor: config.color,
                  }}
                >
                  {config.icon}
                </div>
                <div style={styles.tireName}>{config.displayName}</div>
                <div style={styles.tireGrip}>Grip: {gripPercent}%</div>
              </button>
            )
          })}
        </div>

        {/* Action buttons */}
        <div style={styles.actionRow}>
          <button style={styles.cancelButton} onClick={cancelPitStop}>
            Cancel
          </button>
          <button
            style={{
              ...styles.confirmButton,
              ...(selectedNewTire && canChangeTires
                ? styles.confirmButtonEnabled
                : styles.confirmButtonDisabled),
            }}
            onClick={handleConfirm}
            disabled={!selectedNewTire || !canChangeTires}
          >
            Change Tires
          </button>
        </div>

        <div style={styles.hint}>Press ESC to cancel</div>
      </div>
    </div>
  )
}
