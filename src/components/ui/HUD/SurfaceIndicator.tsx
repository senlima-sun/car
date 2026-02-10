import { useSurfaceStore, type SurfaceType } from '../../../stores/useSurfaceStore'

const SURFACE_CONFIG: Record<SurfaceType, { label: string; color: string; bgColor: string }> = {
  road: { label: 'ROAD', color: '#4ade80', bgColor: 'rgba(74, 222, 128, 0.15)' },
  curb: { label: 'CURB', color: '#60a5fa', bgColor: 'rgba(96, 165, 250, 0.15)' },
  pitroad: { label: 'PIT', color: '#fbbf24', bgColor: 'rgba(251, 191, 36, 0.15)' },
  gravel: { label: 'GRAVEL', color: '#f97316', bgColor: 'rgba(249, 115, 22, 0.15)' },
  grass: { label: 'GRASS', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)' },
}

const GRIP_VALUES: Record<SurfaceType, number> = {
  road: 100,
  curb: 115,
  pitroad: 100,
  gravel: 55,
  grass: 35,
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    letterSpacing: 1,
    transition: 'all 0.3s ease',
    minWidth: 90,
  },
  gripValue: {
    fontSize: 10,
    fontWeight: 400,
    opacity: 0.8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },
}

export default function SurfaceIndicator() {
  const currentSurface = useSurfaceStore(s => s.currentSurface)
  const config = SURFACE_CONFIG[currentSurface]
  const grip = GRIP_VALUES[currentSurface]

  return (
    <div
      style={{
        ...styles.container,
        color: config.color,
        background: config.bgColor,
        border: `1px solid ${config.color}33`,
      }}
    >
      <div style={{ ...styles.dot, background: config.color }} />
      <span>{config.label}</span>
      <span style={styles.gripValue}>{grip}%</span>
    </div>
  )
}
