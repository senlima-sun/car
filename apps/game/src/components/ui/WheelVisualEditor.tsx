import { useState, type CSSProperties } from 'react'
import DraggablePanel from './DevTools/DraggablePanel'
import {
  useWheelVisualTuningStore,
  type WheelVisualKey,
  type WheelVisualOffset,
} from '@/stores/useWheelVisualTuningStore'

const WHEELS: { key: WheelVisualKey; label: string }[] = [
  { key: 'fl', label: 'FL' },
  { key: 'fr', label: 'FR' },
  { key: 'rl', label: 'RL' },
  { key: 'rr', label: 'RR' },
]

const OFFSET_AXES: (keyof WheelVisualOffset)[] = ['x', 'y', 'z']

export default function WheelVisualEditor() {
  const wheels = useWheelVisualTuningStore(s => s.wheels)
  const setWheelSpinAxis = useWheelVisualTuningStore(s => s.setWheelSpinAxis)
  const setWheelCamber = useWheelVisualTuningStore(s => s.setWheelCamber)
  const setWheelSpinSign = useWheelVisualTuningStore(s => s.setWheelSpinSign)
  const setWheelOffset = useWheelVisualTuningStore(s => s.setWheelOffset)
  const reset = useWheelVisualTuningStore(s => s.reset)
  const [copied, setCopied] = useState(false)

  const exportTuning = async () => {
    const { wheels } = useWheelVisualTuningStore.getState()
    const text = JSON.stringify({ wheels }, null, 2)
    await navigator.clipboard?.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <DraggablePanel id='wheel-visual' title='Wheel Visual' hotkey='F10' defaultSize={{ width: 380, height: 520 }}>
      <div style={styles.body}>
        <div style={styles.headerRow}>
          <button type='button' style={styles.actionButton} onClick={reset}>
            Reset
          </button>
          <button type='button' style={styles.actionButton} onClick={exportTuning}>
            {copied ? 'Copied' : 'Copy JSON'}
          </button>
        </div>

        {WHEELS.map(({ key, label }) => {
          const wheel = wheels[key]
          return (
            <section key={key} style={styles.section}>
              <div style={styles.wheelHeader}>
                <span style={styles.sectionTitle}>{label}</span>
                <button
                  type='button'
                  style={styles.signButton}
                  onClick={() => setWheelSpinSign(key, wheel.spinSign > 0 ? -1 : 1)}
                >
                  Spin {wheel.spinSign > 0 ? '+' : '-'}
                </button>
              </div>
              <SliderRow
                label='Camber'
                value={wheel.camberDeg}
                min={-12}
                max={12}
                step={0.1}
                suffix='deg'
                onChange={value => setWheelCamber(key, value)}
              />
              {OFFSET_AXES.map(axis => (
                <SliderRow
                  key={axis}
                  label={`Spin ${axis.toUpperCase()}`}
                  value={wheel.spinAxis[axis]}
                  min={-1}
                  max={1}
                  step={0.01}
                  onChange={value => setWheelSpinAxis(key, axis, value)}
                />
              ))}
              {OFFSET_AXES.map(axis => (
                <SliderRow
                  key={axis}
                  label={`Offset ${axis.toUpperCase()}`}
                  value={wheel.offset[axis]}
                  min={-0.25}
                  max={0.25}
                  step={0.001}
                  suffix='m'
                  onChange={value => setWheelOffset(key, axis, value)}
                />
              ))}
            </section>
          )
        })}
      </div>
    </DraggablePanel>
  )
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix?: string
  onChange: (value: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <label style={styles.sliderRow}>
      <span style={styles.label}>{label}</span>
      <input
        type='range'
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        style={{
          ...styles.range,
          background: `linear-gradient(to right, #38bdf8 0%, #38bdf8 ${pct}%, rgba(255,255,255,0.12) ${pct}%, rgba(255,255,255,0.12) 100%)`,
        }}
      />
      <span style={styles.value}>
        {value.toFixed(step < 0.01 ? 3 : 2)}
        {suffix && <span style={styles.suffix}>{suffix}</span>}
      </span>
    </label>
  )
}

const styles: Record<string, CSSProperties> = {
  body: {
    width: 380,
    maxHeight: 'calc(100vh - 130px)',
    overflowY: 'auto',
    padding: '10px 12px',
    color: '#e5e7eb',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 11,
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: 8,
  },
  actionButton: {
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.08)',
    color: '#e5e7eb',
    padding: '4px 8px',
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer',
  },
  signButton: {
    border: '1px solid rgba(56,189,248,0.32)',
    background: 'rgba(56,189,248,0.12)',
    color: '#bae6fd',
    padding: '3px 7px',
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer',
  },
  section: {
    borderTop: '1px solid rgba(255,255,255,0.1)',
    paddingTop: 8,
    marginTop: 8,
  },
  sectionTitle: {
    color: '#7dd3fc',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
  },
  wheelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sliderRow: {
    display: 'grid',
    gridTemplateColumns: '74px 1fr 74px',
    alignItems: 'center',
    gap: 8,
    height: 24,
  },
  label: {
    color: '#9ca3af',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  range: {
    width: '100%',
    height: 4,
    appearance: 'none',
    borderRadius: 999,
    outline: 'none',
    cursor: 'pointer',
  },
  value: {
    color: '#f8fafc',
    fontFamily: 'monospace',
    fontSize: 10,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  suffix: {
    color: '#64748b',
    marginLeft: 2,
  },
}
