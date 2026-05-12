import { useSteeringDebugStore } from '@/stores/useSteeringDebugStore'
import DraggablePanel from './DevTools/DraggablePanel'

export default function SteeringDebugOverlay() {
  const inputSteer = useSteeringDebugStore(s => s.inputSteer)
  const steerAngleDeg = useSteeringDebugStore(s => s.steerAngleDeg)
  const maxSteerAngleDeg = useSteeringDebugStore(s => s.maxSteerAngleDeg)
  const yawRate = useSteeringDebugStore(s => s.yawRate)
  const speedKmh = useSteeringDebugStore(s => s.speedKmh)
  const slipAngleDeg = useSteeringDebugStore(s => s.slipAngleDeg)
  const lateralG = useSteeringDebugStore(s => s.lateralG)
  const isDrifting = useSteeringDebugStore(s => s.isDrifting)

  const steerSaturation =
    maxSteerAngleDeg > 0.01 ? Math.abs(steerAngleDeg) / maxSteerAngleDeg : 0
  const yawClamp = 1.8
  const yawSaturation = Math.min(Math.abs(yawRate) / yawClamp, 1)
  const slipAbs = Math.abs(slipAngleDeg)
  const pacejkaPeakDeg = 8

  return (
    <DraggablePanel id='steering-debug' title='Steering Debug' hotkey='F6'>
      <div style={styles.body}>
        <div style={styles.section}>
          <div style={styles.subheader}>INPUT → ANGLE</div>
          <BarRow
            label='input'
            value={inputSteer}
            min={-1}
            max={1}
            format={v => v.toFixed(2)}
          />
          <BarRow
            label='δ angle'
            value={steerAngleDeg}
            min={-maxSteerAngleDeg || -25}
            max={maxSteerAngleDeg || 25}
            format={v => `${v.toFixed(1)}°`}
          />
          <Row
            label='δ max'
            value={`${maxSteerAngleDeg.toFixed(1)}°`}
            mute
          />
          <Row
            label='δ saturated'
            value={`${(steerSaturation * 100).toFixed(0)}%`}
            warn={steerSaturation > 0.95}
          />
        </div>

        <div style={styles.divider} />

        <div style={styles.section}>
          <div style={styles.subheader}>ANGULAR VELOCITY</div>
          <BarRow
            label='ω y'
            value={yawRate}
            min={-yawClamp}
            max={yawClamp}
            format={v => `${v.toFixed(2)} rad/s`}
          />
          <Row
            label='ω clamp'
            value={`${(yawSaturation * 100).toFixed(0)}%`}
            warn={yawSaturation > 0.95}
          />
          <Row label='drifting' value={isDrifting ? 'YES' : 'no'} warn={isDrifting} />
        </div>

        <div style={styles.divider} />

        <div style={styles.section}>
          <div style={styles.subheader}>GRIP STATE</div>
          <Row label='speed' value={`${speedKmh.toFixed(0)} km/h`} mute />
          <BarRow
            label='slip ang'
            value={slipAngleDeg}
            min={-15}
            max={15}
            format={v => `${v.toFixed(1)}°`}
          />
          <Row
            label='slip pk'
            value={
              slipAbs < pacejkaPeakDeg * 0.6
                ? 'under'
                : slipAbs < pacejkaPeakDeg * 1.2
                  ? 'near peak'
                  : 'past peak'
            }
            warn={slipAbs > pacejkaPeakDeg * 1.2}
            color={
              slipAbs < pacejkaPeakDeg * 0.6
                ? '#4ade80'
                : slipAbs < pacejkaPeakDeg * 1.2
                  ? '#facc15'
                  : '#f87171'
            }
          />
          <BarRow
            label='lat g'
            value={lateralG}
            min={-4}
            max={4}
            format={v => `${v.toFixed(2)} g`}
          />
        </div>
      </div>
    </DraggablePanel>
  )
}

function Row({
  label,
  value,
  warn,
  mute,
  color,
}: {
  label: string
  value: string
  warn?: boolean
  mute?: boolean
  color?: string
}) {
  return (
    <div style={styles.row}>
      <span style={styles.label}>{label}</span>
      <span
        style={{
          ...styles.value,
          color: color ?? (warn ? '#f87171' : mute ? '#9ca3af' : '#e5e7eb'),
        }}
      >
        {value}
      </span>
    </div>
  )
}

function BarRow({
  label,
  value,
  min,
  max,
  format,
}: {
  label: string
  value: number
  min: number
  max: number
  format: (v: number) => string
}) {
  const range = max - min
  const center = (min + max) / 2
  const half = range / 2
  const safeHalf = half > 0.0001 ? half : 1
  const norm = Math.max(-1, Math.min(1, (value - center) / safeHalf))
  const absPct = Math.min(Math.abs(norm), 1) * 50
  const color =
    Math.abs(norm) > 0.92 ? '#f87171' : Math.abs(norm) > 0.7 ? '#facc15' : '#4ade80'
  const fromLeft = norm >= 0 ? 50 : 50 - absPct
  return (
    <div style={styles.row}>
      <span style={styles.label}>{label}</span>
      <div style={styles.barBg}>
        <div style={styles.centerTick} />
        <div
          style={{
            ...styles.barFill,
            left: `${fromLeft}%`,
            width: `${absPct}%`,
            background: color,
          }}
        />
      </div>
      <span style={{ ...styles.value, width: 64 }}>{format(value)}</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    width: 320,
    padding: '10px 12px',
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#e5e7eb',
  },
  section: { marginBottom: 4 },
  subheader: { fontSize: 10, color: '#60a5fa', marginBottom: 2 },
  divider: { borderTop: '1px solid rgba(255,255,255,0.1)', margin: '6px 0' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 18 },
  label: { color: '#9ca3af', width: 70 },
  value: { textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' },
  barBg: {
    flex: 1,
    height: 6,
    background: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    margin: '0 6px',
    overflow: 'hidden',
    position: 'relative' as const,
  },
  centerTick: {
    position: 'absolute' as const,
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1,
    background: 'rgba(255,255,255,0.25)',
  },
  barFill: { position: 'absolute' as const, top: 0, bottom: 0, borderRadius: 3 },
}
