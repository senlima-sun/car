import { usePhysicsDebugStore } from '@/stores/usePhysicsDebugStore'
import DraggablePanel from './DevTools/DraggablePanel'

const LABEL_NAMES = ['FL', 'FR', 'RL', 'RR'] as const

export default function PhysicsDebugOverlay() {
  const posY = usePhysicsDebugStore(s => s.posY)
  const velY = usePhysicsDebugStore(s => s.velY)
  const totalForceY = usePhysicsDebugStore(s => s.totalForceY)
  const groundedCount = usePhysicsDebugStore(s => s.groundedCount)
  const wheels = usePhysicsDebugStore(s => s.wheels)

  const netAccel = totalForceY / 600 - 9.81

  return (
    <DraggablePanel id='physics-debug' title='Physics Debug'>
      <div style={styles.body}>
        <div style={styles.section}>
          <Row label='pos.y' value={posY.toFixed(3)} />
          <Row label='vel.y' value={velY.toFixed(3)} warn={Math.abs(velY) > 5} />
          <Row label='force.y' value={totalForceY.toFixed(0)} suffix='N' />
          <Row
            label='net accel'
            value={netAccel.toFixed(2)}
            suffix='m/s²'
            warn={netAccel > 15 || netAccel < -15}
          />
          <Row
            label='grounded'
            value={`${groundedCount}/4`}
            color={groundedCount === 4 ? '#4ade80' : groundedCount > 0 ? '#facc15' : '#f87171'}
          />
        </div>

        <div style={styles.divider} />

        <div style={styles.section}>
          <div style={styles.subheader}>WHEELS</div>
          {wheels.map((w, i) => (
            <div key={i} style={styles.wheelRow}>
              <span style={{ ...styles.badge, background: w.isGrounded ? '#166534' : '#7f1d1d' }}>
                {LABEL_NAMES[i]}
              </span>
              <span style={styles.mono}>
                comp={w.compression.toFixed(3)} hit={w.hitY.toFixed(3)} ray={w.rayOriginY.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <div style={styles.divider} />
        <div style={styles.section}>
          <div style={styles.subheader}>SUSPENSION HEALTH</div>
          <BarRow label='Spring eq.' value={1 / 8} max={0.4} />
          {wheels.map((w, i) => (
            <BarRow key={i} label={LABEL_NAMES[i]} value={w.compression} max={0.4} />
          ))}
        </div>
      </div>
    </DraggablePanel>
  )
}

function Row({
  label,
  value,
  suffix,
  warn,
  color,
}: {
  label: string
  value: string
  suffix?: string
  warn?: boolean
  color?: string
}) {
  return (
    <div style={styles.row}>
      <span style={styles.label}>{label}</span>
      <span
        style={{
          ...styles.value,
          color: color ?? (warn ? '#f87171' : '#e5e7eb'),
        }}
      >
        {value}
        {suffix && <span style={styles.unit}>{suffix}</span>}
      </span>
    </div>
  )
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(value / max, 1) * 100
  const color = pct > 80 ? '#f87171' : pct > 50 ? '#facc15' : '#4ade80'
  return (
    <div style={styles.row}>
      <span style={styles.label}>{label}</span>
      <div style={styles.barBg}>
        <div style={{ ...styles.barFill, width: `${pct}%`, background: color }} />
      </div>
      <span style={{ ...styles.value, width: 44 }}>{value.toFixed(3)}</span>
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
  label: { color: '#9ca3af', width: 80 },
  value: { textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' },
  unit: { color: '#6b7280', marginLeft: 2 },
  mono: { fontSize: 10, color: '#d1d5db' },
  badge: {
    display: 'inline-block',
    width: 22,
    textAlign: 'center' as const,
    borderRadius: 3,
    fontSize: 9,
    fontWeight: 700,
    color: '#fff',
    marginRight: 6,
    padding: '1px 0',
  },
  wheelRow: { display: 'flex', alignItems: 'center', height: 18 },
  barBg: {
    flex: 1,
    height: 6,
    background: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    margin: '0 6px',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3, transition: 'width 0.05s' },
}
