import { WIND_DIRECTIONS } from '@/stores/useWindStore'
import { COMPASS_GRID, styles } from './styles'

export function CompassPicker({
  currentDirection,
  onSelect,
}: {
  currentDirection: string
  onSelect: (dir: keyof typeof WIND_DIRECTIONS) => void
}) {
  return (
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
                onClick={() => onSelect(dir as keyof typeof WIND_DIRECTIONS)}
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
  )
}
