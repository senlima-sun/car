import { useEffect, useCallback, useState } from 'react'
import {
  useEnvironmentStore,
  getRainDescription,
  getTemperatureDescription,
} from '@/stores/useEnvironmentStore'
import {
  useWindStore,
  WIND_DIRECTIONS,
  windSpeedDescription,
  getWindDirectionName,
} from '@/stores/useWindStore'

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
    zIndex: 1000,
  },
  modal: {
    background: 'rgba(20, 20, 20, 0.95)',
    borderRadius: 12,
    padding: '24px 32px',
    minWidth: 360,
    maxWidth: '90vw',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    paddingBottom: 4,
  },
  sliderRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  sliderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderLabel: {
    color: '#fff',
    fontSize: 13,
  },
  sliderValue: {
    color: '#4CAF50',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  slider: {
    width: '100%',
    height: 6,
    WebkitAppearance: 'none',
    appearance: 'none',
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    outline: 'none',
    cursor: 'pointer',
  },
  sliderDescription: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    textAlign: 'right',
  },
  compassContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 12,
  },
  compass: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 40px)',
    gridTemplateRows: 'repeat(3, 40px)',
    gap: 4,
  },
  compassButton: {
    width: 40,
    height: 40,
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  compassButtonActive: {
    background: '#4CAF50',
    border: '1px solid #4CAF50',
  },
  compassCenter: {
    background: 'transparent',
    border: 'none',
    cursor: 'default',
  },
  toggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
  },
  toggleLabel: {
    color: '#fff',
    fontSize: 13,
  },
  toggle: {
    width: 44,
    height: 24,
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    position: 'relative',
    cursor: 'pointer',
    transition: 'background 0.2s ease',
  },
  toggleActive: {
    background: '#4CAF50',
  },
  toggleKnob: {
    width: 18,
    height: 18,
    background: '#fff',
    borderRadius: '50%',
    position: 'absolute',
    top: 3,
    left: 3,
    transition: 'left 0.2s ease',
  },
  toggleKnobActive: {
    left: 23,
  },
  closeButton: {
    width: '100%',
    marginTop: 16,
    padding: '10px 20px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    color: '#fff',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'background 0.2s ease',
  },
  hint: {
    textAlign: 'center',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 12,
  },
}

// Compass direction order for grid layout
const COMPASS_GRID = [
  ['NW', 'N', 'NE'],
  ['W', null, 'E'],
  ['SW', 'S', 'SE'],
] as const

export default function WeatherControlModal() {
  const { isModalOpen, closeModal, temperature, setTemperature, rainIntensity, setRainIntensity } =
    useEnvironmentStore()
  const { direction, speed, enabled, setWind, setEnabled } = useWindStore()

  // Local state for slider values to avoid too many store updates
  const [localTemp, setLocalTemp] = useState(temperature)
  const [localRain, setLocalRain] = useState(rainIntensity)
  const [localWindSpeed, setLocalWindSpeed] = useState(speed)

  // Sync local state with store on mount
  useEffect(() => {
    setLocalTemp(temperature)
    setLocalRain(rainIntensity)
    setLocalWindSpeed(speed)
  }, [temperature, rainIntensity, speed])

  const handleClose = useCallback(() => {
    closeModal()
  }, [closeModal])

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isModalOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'KeyM') {
        handleClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isModalOpen, handleClose])

  // Debounced store update
  const handleTempChange = (value: number) => {
    setLocalTemp(value)
    setTemperature(value)
  }

  const handleRainChange = (value: number) => {
    setLocalRain(value)
    setRainIntensity(value)
  }

  const handleWindSpeedChange = (value: number) => {
    setLocalWindSpeed(value)
    setWind(direction, value)
  }

  const handleDirectionChange = (dir: keyof typeof WIND_DIRECTIONS) => {
    setWind(WIND_DIRECTIONS[dir], speed)
  }

  const currentDirection = getWindDirectionName(direction)

  if (!isModalOpen) return null

  return (
    <div style={styles.backdrop} onClick={handleClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.title as React.CSSProperties}>Environment Control</div>

        {/* Temperature Section */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Temperature</div>
          <div style={styles.sliderRow}>
            <div style={styles.sliderHeader}>
              <span style={styles.sliderLabel}>-10°C to 50°C</span>
              <span style={styles.sliderValue}>{Math.round(localTemp)}°C</span>
            </div>
            <input
              type='range'
              min={-10}
              max={50}
              step={1}
              value={localTemp}
              onChange={e => handleTempChange(Number(e.target.value))}
              style={styles.slider}
            />
            <div style={styles.sliderDescription as React.CSSProperties}>
              {getTemperatureDescription(localTemp)}
            </div>
          </div>
        </div>

        {/* Rain Section */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Rain Intensity</div>
          <div style={styles.sliderRow}>
            <div style={styles.sliderHeader}>
              <span style={styles.sliderLabel}>0% to 100%</span>
              <span style={styles.sliderValue}>{Math.round(localRain * 100)}%</span>
            </div>
            <input
              type='range'
              min={0}
              max={1}
              step={0.01}
              value={localRain}
              onChange={e => handleRainChange(Number(e.target.value))}
              style={styles.slider}
            />
            <div style={styles.sliderDescription as React.CSSProperties}>
              {getRainDescription(localRain)}
            </div>
          </div>
        </div>

        {/* Wind Direction Section */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Wind Direction</div>
          <div style={styles.compassContainer}>
            <div style={styles.compass}>
              {COMPASS_GRID.flat().map((dir, index) => {
                if (dir === null) {
                  return (
                    <div key={index} style={{ ...styles.compassButton, ...styles.compassCenter }} />
                  )
                }
                const isActive = currentDirection === dir
                return (
                  <button
                    key={dir}
                    style={{
                      ...styles.compassButton,
                      ...(isActive ? styles.compassButtonActive : {}),
                    }}
                    onClick={() => handleDirectionChange(dir as keyof typeof WIND_DIRECTIONS)}
                    onMouseEnter={e => {
                      if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
                    }}
                    onMouseLeave={e => {
                      if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    {dir}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Wind Speed Section */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Wind Speed</div>
          <div style={styles.sliderRow}>
            <div style={styles.sliderHeader}>
              <span style={styles.sliderLabel}>0 to 25 m/s</span>
              <span style={styles.sliderValue}>{localWindSpeed.toFixed(1)} m/s</span>
            </div>
            <input
              type='range'
              min={0}
              max={25}
              step={0.5}
              value={localWindSpeed}
              onChange={e => handleWindSpeedChange(Number(e.target.value))}
              style={styles.slider}
            />
            <div style={styles.sliderDescription as React.CSSProperties}>
              {windSpeedDescription(localWindSpeed)}
            </div>
          </div>
        </div>

        {/* Wind Toggle */}
        <div style={styles.toggleRow}>
          <span style={styles.toggleLabel}>Enable Wind</span>
          <div
            style={{
              ...styles.toggle,
              ...(enabled ? styles.toggleActive : {}),
            }}
            onClick={() => setEnabled(!enabled)}
          >
            <div
              style={{
                ...styles.toggleKnob,
                ...(enabled ? styles.toggleKnobActive : {}),
              }}
            />
          </div>
        </div>

        <button
          style={styles.closeButton}
          onClick={handleClose}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
          }}
        >
          Close
        </button>

        <div style={styles.hint as React.CSSProperties}>Press M or ESC to close</div>
      </div>
    </div>
  )
}
