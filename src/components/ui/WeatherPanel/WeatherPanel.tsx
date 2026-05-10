import { useEffect, useState } from 'react'
import RadarMinimap from './RadarMinimap'
import WeatherFrontEditor from './WeatherFrontEditor'
import SunControl from './SunControl'

export default function WeatherPanel() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'F7') setEnabled(prev => !prev)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!enabled) return null

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        WEATHER RADAR <span style={styles.hint}>(F7)</span>
      </div>
      <div style={styles.content}>
        <div style={styles.column}>
          <div style={styles.subLabel}>Live radar</div>
          <RadarMinimap />
        </div>
        <div style={styles.column}>
          <WeatherFrontEditor />
        </div>
        <div style={styles.column}>
          <SunControl />
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    position: 'fixed' as const,
    top: 12,
    right: 12,
    padding: 12,
    background: 'rgba(10, 12, 18, 0.9)',
    color: '#d8e3f0',
    fontFamily: 'monospace',
    fontSize: 11,
    border: '1px solid rgba(120, 160, 220, 0.35)',
    borderRadius: 6,
    zIndex: 9999,
    pointerEvents: 'auto' as const,
  },
  header: {
    fontSize: 11,
    letterSpacing: 1.4,
    color: '#88b0ff',
    marginBottom: 10,
  },
  hint: { color: '#5a7799', fontSize: 10 },
  content: {
    display: 'flex' as const,
    gap: 12,
  },
  column: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 6,
  },
  subLabel: {
    fontSize: 11,
    letterSpacing: 1,
    color: '#88b0ff',
  },
}
