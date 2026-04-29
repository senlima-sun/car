import { useCallback, useEffect, useState } from 'react'
import {
  getRainDescription,
  getTemperatureDescription,
  useEnvironmentStore,
} from '@/stores/useEnvironmentStore'
import {
  getWindDirectionName,
  useWindStore,
  windSpeedDescription,
  WIND_DIRECTIONS,
} from '@/stores/useWindStore'
import { CompassPicker } from './CompassPicker'
import { SliderRow } from './SliderRow'
import { Toggle } from './Toggle'
import { styles } from './styles'

export default function WeatherControlModal() {
  const { isModalOpen, closeModal, temperature, setTemperature, rainIntensity, setRainIntensity } =
    useEnvironmentStore()
  const { direction, speed, enabled, setWind, setEnabled } = useWindStore()

  const [localTemp, setLocalTemp] = useState(temperature)
  const [localRain, setLocalRain] = useState(rainIntensity)
  const [localWindSpeed, setLocalWindSpeed] = useState(speed)

  useEffect(() => {
    setLocalTemp(temperature)
    setLocalRain(rainIntensity)
    setLocalWindSpeed(speed)
  }, [temperature, rainIntensity, speed])

  const handleClose = useCallback(() => {
    closeModal()
  }, [closeModal])

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

        <SliderRow
          sectionTitle='Temperature'
          rangeLabel='-10°C to 50°C'
          valueLabel={`${Math.round(localTemp)}°C`}
          description={getTemperatureDescription(localTemp)}
          min={-10}
          max={50}
          step={1}
          value={localTemp}
          onChange={handleTempChange}
        />

        <SliderRow
          sectionTitle='Rain Intensity'
          rangeLabel='0% to 100%'
          valueLabel={`${Math.round(localRain * 100)}%`}
          description={getRainDescription(localRain)}
          min={0}
          max={1}
          step={0.01}
          value={localRain}
          onChange={handleRainChange}
        />

        <CompassPicker currentDirection={currentDirection} onSelect={handleDirectionChange} />

        <SliderRow
          sectionTitle='Wind Speed'
          rangeLabel='0 to 25 m/s'
          valueLabel={`${localWindSpeed.toFixed(1)} m/s`}
          description={windSpeedDescription(localWindSpeed)}
          min={0}
          max={25}
          step={0.5}
          value={localWindSpeed}
          onChange={handleWindSpeedChange}
        />

        <Toggle label='Enable Wind' enabled={enabled} onChange={setEnabled} />

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
