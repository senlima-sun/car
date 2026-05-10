import { useEffect, useState } from 'react'
import { useEnvironmentStore } from '@/stores/useEnvironmentStore'
import { useWeatherSourcesStore } from '@/stores/useWeatherSourcesStore'
import { usePhysicsOptional } from '@/wasm/PhysicsProvider'
import {
  pickTopStates,
  computeWeights,
  SKY_STATES,
  type BlendInputs,
  type SkyState,
} from '@/components/canvas/Weather/skyStates'

const POLL_INTERVAL_MS = 250

export default function SkyStateDebug() {
  const [enabled, setEnabled] = useState(false)
  const [snapshot, setSnapshot] = useState<{
    input: BlendInputs
    ids: SkyState[]
    weights: number[]
  } | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'F8') setEnabled(prev => !prev)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (!enabled) return
    const tick = () => {
      const { temperature, rainIntensity } = useEnvironmentStore.getState()
      const input: BlendInputs = { temperature, rainIntensity, isDusk: false }
      const ids = pickTopStates(input, 4)
      const weights = computeWeights(input, ids)
      setSnapshot({ input, ids, weights })
    }
    tick()
    const id = window.setInterval(tick, POLL_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [enabled])

  const physics = usePhysicsOptional()
  const sourceCount = useWeatherSourcesStore(s => s.sources.length)

  if (!enabled || !snapshot) return null

  const placeTestSource = () => {
    if (!physics) return
    physics.addWeatherSource({
      x: 0,
      z: -300,
      radius: 250,
      intensity: 1,
      vx: 0,
      vz: 0,
    })
  }

  const clearSources = () => {
    if (!physics) return
    physics.clearWeatherSources()
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        SKY STATE <span style={styles.hint}>(F8)</span>
      </div>
      <div style={styles.section}>
        <Row label='temp' value={snapshot.input.temperature.toFixed(1)} suffix='°C' />
        <Row label='rain' value={snapshot.input.rainIntensity.toFixed(2)} />
        <Row label='dusk' value={snapshot.input.isDusk ? 'yes' : 'no'} />
      </div>
      <div style={styles.section}>
        {snapshot.ids.map((id, idx) => (
          <Row
            key={id}
            label={id}
            value={snapshot.weights[idx]?.toFixed(3) ?? '0.000'}
            highlight={idx === 0}
            suffix={`(exp ${SKY_STATES[id].exposure})`}
          />
        ))}
      </div>
      <div style={styles.section}>
        <Row label='sources' value={String(sourceCount)} />
        <div style={styles.buttonRow}>
          <button style={styles.button} onClick={placeTestSource}>
            +source N
          </button>
          <button style={styles.button} onClick={clearSources}>
            clear
          </button>
        </div>
      </div>
    </div>
  )
}

interface RowProps {
  label: string
  value: string
  suffix?: string
  highlight?: boolean
}

function Row({ label, value, suffix, highlight }: RowProps) {
  return (
    <div style={{ ...styles.row, ...(highlight ? styles.rowHighlight : {}) }}>
      <span style={styles.label}>{label}</span>
      <span style={styles.value}>
        {value}
        {suffix ? ` ${suffix}` : ''}
      </span>
    </div>
  )
}

const styles = {
  container: {
    position: 'fixed' as const,
    top: 12,
    left: 12,
    minWidth: 220,
    padding: 10,
    background: 'rgba(10, 12, 18, 0.85)',
    color: '#d8e3f0',
    fontFamily: 'monospace',
    fontSize: 11,
    border: '1px solid rgba(120, 160, 220, 0.35)',
    borderRadius: 4,
    zIndex: 9999,
    pointerEvents: 'auto' as const,
  },
  header: {
    fontSize: 10,
    letterSpacing: 1.2,
    color: '#88b0ff',
    marginBottom: 8,
  },
  hint: { color: '#5a7799' },
  section: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 2,
    paddingTop: 4,
    paddingBottom: 4,
    borderTop: '1px solid rgba(120, 160, 220, 0.15)',
  },
  row: { display: 'flex' as const, justifyContent: 'space-between' as const },
  rowHighlight: { color: '#ffd28a', fontWeight: 600 as const },
  label: { color: '#9bb0c8' },
  value: { color: '#e8f0fa' },
  buttonRow: {
    display: 'flex' as const,
    gap: 6,
    marginTop: 4,
  },
  button: {
    flex: 1,
    background: 'rgba(60, 90, 130, 0.5)',
    color: '#e8f0fa',
    border: '1px solid rgba(120, 160, 220, 0.4)',
    borderRadius: 3,
    padding: '4px 6px',
    fontSize: 10,
    fontFamily: 'monospace',
    cursor: 'pointer' as const,
  },
}
