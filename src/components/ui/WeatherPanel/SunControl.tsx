import { useEnvironmentStore } from '@/stores/useEnvironmentStore'
import { computeSunDirection, getSunIntensity } from '@/components/canvas/Weather/sunDirection'

function formatHour(h: number): string {
  const wrapped = ((h % 24) + 24) % 24
  const hh = Math.floor(wrapped)
  const mm = Math.round((wrapped - hh) * 60)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function describePhase(h: number): string {
  if (h < 5 || h > 20) return 'Night'
  if (h < 7) return 'Sunrise'
  if (h < 10) return 'Morning'
  if (h < 14) return 'Midday'
  if (h < 17) return 'Afternoon'
  if (h < 19) return 'Sunset'
  return 'Dusk'
}

export default function SunControl() {
  const timeOfDay = useEnvironmentStore(s => s.timeOfDay)
  const setTimeOfDay = useEnvironmentStore(s => s.setTimeOfDay)

  const sun = computeSunDirection(timeOfDay)
  const intensity = getSunIntensity(timeOfDay)
  const elevationDeg = (Math.asin(Math.max(-1, Math.min(1, sun.y))) * 180) / Math.PI
  const azimuthDeg =
    ((Math.atan2(sun.z, sun.x) * 180) / Math.PI + 360) % 360

  let compass = 'N'
  if (azimuthDeg < 22.5 || azimuthDeg >= 337.5) compass = 'E'
  else if (azimuthDeg < 67.5) compass = 'SE'
  else if (azimuthDeg < 112.5) compass = 'S'
  else if (azimuthDeg < 157.5) compass = 'SW'
  else if (azimuthDeg < 202.5) compass = 'W'
  else if (azimuthDeg < 247.5) compass = 'NW'
  else if (azimuthDeg < 292.5) compass = 'N'
  else compass = 'NE'

  return (
    <div style={styles.container}>
      <div style={styles.label}>Sun Position</div>
      <div style={styles.skyboxWrap}>
        <SkyboxDiagram timeOfDay={timeOfDay} />
      </div>
      <div style={styles.row}>
        <span style={styles.small}>time</span>
        <input
          style={styles.range}
          type='range'
          min={0}
          max={24}
          step={0.1}
          value={timeOfDay}
          onChange={e => setTimeOfDay(Number(e.target.value))}
        />
        <span style={styles.value}>{formatHour(timeOfDay)}</span>
      </div>
      <div style={styles.statRow}>
        <Stat label='phase' value={describePhase(timeOfDay)} />
        <Stat label='compass' value={compass} />
      </div>
      <div style={styles.statRow}>
        <Stat label='elev' value={`${elevationDeg.toFixed(1)}°`} />
        <Stat label='intensity' value={intensity.toFixed(2)} />
      </div>
      <div style={styles.buttonRow}>
        <button style={styles.button} onClick={() => setTimeOfDay(6)}>
          06:00
        </button>
        <button style={styles.button} onClick={() => setTimeOfDay(9)}>
          09:00
        </button>
        <button style={styles.button} onClick={() => setTimeOfDay(12)}>
          12:00
        </button>
        <button style={styles.button} onClick={() => setTimeOfDay(15)}>
          15:00
        </button>
        <button style={styles.button} onClick={() => setTimeOfDay(18)}>
          18:00
        </button>
      </div>
    </div>
  )
}

interface SkyboxDiagramProps {
  timeOfDay: number
}

function SkyboxDiagram({ timeOfDay }: SkyboxDiagramProps) {
  const SIZE = 140
  const sun = computeSunDirection(timeOfDay)
  const cx = SIZE / 2
  const cz = SIZE / 2
  const r = SIZE / 2 - 6
  const sunX = cx + sun.x * r
  const sunZ = cz - sun.z * r
  const elev = sun.y
  const aboveHorizon = elev > 0
  const sunSize = aboveHorizon ? 6 : 3

  return (
    <svg width={SIZE} height={SIZE} style={{ display: 'block' }}>
      <circle cx={cx} cy={cz} r={r} fill='rgba(20, 30, 50, 0.7)' stroke='rgba(120,160,220,0.4)' />
      <line x1={cx - r} y1={cz} x2={cx + r} y2={cz} stroke='rgba(120,160,220,0.2)' />
      <line x1={cx} y1={cz - r} x2={cx} y2={cz + r} stroke='rgba(120,160,220,0.2)' />
      <text x={cx + r - 6} y={cz - 4} fontSize='8' fill='#88b0ff' textAnchor='end'>
        E
      </text>
      <text x={cx - r + 2} y={cz - 4} fontSize='8' fill='#88b0ff'>
        W
      </text>
      <text x={cx + 4} y={cz - r + 8} fontSize='8' fill='#88b0ff'>
        N
      </text>
      <text x={cx + 4} y={cz + r - 2} fontSize='8' fill='#88b0ff'>
        S
      </text>
      <circle
        cx={sunX}
        cy={sunZ}
        r={sunSize}
        fill={aboveHorizon ? '#ffd28a' : '#445566'}
        stroke={aboveHorizon ? '#fff5d8' : 'transparent'}
        strokeWidth={1}
      />
    </svg>
  )
}

interface StatProps {
  label: string
  value: string
}

function Stat({ label, value }: StatProps) {
  return (
    <div style={styles.stat}>
      <span style={styles.statLabel}>{label}</span>
      <span style={styles.statValue}>{value}</span>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 6,
    minWidth: 200,
  },
  label: {
    fontSize: 11,
    letterSpacing: 1,
    color: '#88b0ff',
  },
  skyboxWrap: {
    display: 'flex' as const,
    justifyContent: 'center' as const,
    padding: 4,
  },
  row: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  small: { fontSize: 10, color: '#9bb0c8', minWidth: 45 },
  range: { flex: 1 },
  value: { fontSize: 10, color: '#e8f0fa', minWidth: 50, textAlign: 'right' as const },
  statRow: {
    display: 'flex' as const,
    gap: 6,
  },
  stat: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    flex: 1,
    background: 'rgba(20, 30, 50, 0.4)',
    padding: 4,
    borderRadius: 3,
  },
  statLabel: { fontSize: 9, color: '#9bb0c8', textTransform: 'uppercase' as const },
  statValue: { fontSize: 11, color: '#e8f0fa' },
  buttonRow: {
    display: 'flex' as const,
    gap: 4,
  },
  button: {
    flex: 1,
    background: 'rgba(60, 90, 130, 0.5)',
    color: '#e8f0fa',
    border: '1px solid rgba(120, 160, 220, 0.4)',
    borderRadius: 3,
    padding: '4px 4px',
    fontSize: 10,
    fontFamily: 'monospace',
    cursor: 'pointer' as const,
  },
}
