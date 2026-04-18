import { useState, useRef, useEffect, useCallback } from 'react'
import { useActiveAeroStore } from '@/stores/useActiveAeroStore'
import { useCarStore } from '@/stores/useCarStore'
import { useGameStore } from '@/stores/useGameStore'
import { useCarPaintStore, PAINT_PRESETS, CAR_PARTS } from '@/stores/useCarPaintStore'

const TWO_PI = Math.PI * 2

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div style={styles.sliderGroup}>
      <div style={styles.sliderHeader}>
        <span style={styles.sliderLabel}>{label}</span>
        <span style={styles.sliderValue}>{value.toFixed(2)}</span>
      </div>
      <input
        type='range'
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          ...styles.slider,
          background: `linear-gradient(to right, #f97316 0%, #f97316 ${pct}%, rgba(255,255,255,0.15) ${pct}%, rgba(255,255,255,0.15) 100%)`,
        }}
      />
    </div>
  )
}

function PresetButton({
  label,
  onClick,
  active,
}: {
  label: string
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.presetBtn,
        ...(active ? styles.presetBtnActive : {}),
      }}
    >
      {label}
    </button>
  )
}

function CarPaintSection() {
  const partColors = useCarPaintStore(s => s.partColors)
  const selectedPart = useCarPaintStore(s => s.selectedPart)
  const flakeIntensity = useCarPaintStore(s => s.flakeIntensity)
  const clearcoatStrength = useCarPaintStore(s => s.clearcoatStrength)
  const colorDepthFactor = useCarPaintStore(s => s.colorDepthFactor)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const store = useCarPaintStore.getState
  const activeColor = selectedPart === 'all' ? partColors.body : partColors[selectedPart]

  return (
    <div style={styles.section}>
      <div style={styles.subheader}>CAR PAINT</div>

      <div style={styles.partTabs}>
        <button
          onClick={() => store().setSelectedPart('all')}
          style={{
            ...styles.partTab,
            ...(selectedPart === 'all' ? styles.partTabActive : {}),
          }}
        >
          All
        </button>
        {CAR_PARTS.map(part => (
          <button
            key={part.id}
            onClick={() => store().setSelectedPart(part.id)}
            style={{
              ...styles.partTab,
              ...(selectedPart === part.id ? styles.partTabActive : {}),
            }}
          >
            <span
              style={{
                ...styles.partDot,
                backgroundColor: partColors[part.id],
              }}
            />
            {part.label}
          </button>
        ))}
      </div>

      <div style={styles.swatchGrid}>
        {PAINT_PRESETS.map(preset => (
          <button
            key={preset.name}
            title={preset.name}
            onClick={() => {
              if (selectedPart === 'all') {
                store().applyPreset(preset)
              } else {
                store().setPartColor(selectedPart, preset.colors[selectedPart] ?? preset.colors.body ?? '#0a1128')
              }
            }}
            style={{
              ...styles.swatch,
              backgroundColor: selectedPart === 'all' ? preset.colors.body : (preset.colors[selectedPart] ?? preset.colors.body ?? '#0a1128'),
            }}
          />
        ))}
      </div>

      <div style={styles.colorInputRow}>
        <input
          type='color'
          value={activeColor}
          onChange={e => store().setActiveColor(e.target.value)}
          style={styles.colorInput}
        />
        <span style={styles.colorHex}>{activeColor.toUpperCase()}</span>
        <button
          onClick={() => setShowAdvanced(s => !s)}
          style={{
            ...styles.advancedToggle,
            ...(showAdvanced ? styles.partTabActive : {}),
          }}
        >
          {showAdvanced ? 'Hide' : 'Shader'}
        </button>
      </div>

      {showAdvanced && (
        <>
          <Slider
            label='Flake Sparkle'
            value={flakeIntensity}
            min={0}
            max={1}
            step={0.01}
            onChange={v => store().setFlakeIntensity(v)}
          />
          <Slider
            label='Clearcoat'
            value={clearcoatStrength}
            min={0}
            max={1}
            step={0.01}
            onChange={v => store().setClearcoatStrength(v)}
          />
          <Slider
            label='Color Depth'
            value={colorDepthFactor}
            min={0}
            max={0.6}
            step={0.01}
            onChange={v => store().setColorDepthFactor(v)}
          />
        </>
      )}
    </div>
  )
}

export default function AnimationPreviewPanel() {
  const frontWingAngle = useActiveAeroStore(s => s.frontWingAngle)
  const rearWingAngle = useActiveAeroStore(s => s.rearWingAngle)
  const steerAngle = useCarStore(s => s.steerAngle)
  const wheelRotations = useCarStore(s => s.wheelRotations)

  const [autoSpin, setAutoSpin] = useState(false)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)

  const spinLoop = useCallback((time: number) => {
    if (lastTimeRef.current === 0) lastTimeRef.current = time
    const dt = (time - lastTimeRef.current) / 1000
    lastTimeRef.current = time

    const { wheelRotations: cur } = useCarStore.getState()
    const inc = dt * 8
    useCarStore.getState().updateTelemetry({
      wheelRotations: [
        (cur[0] + inc) % TWO_PI,
        (cur[1] + inc) % TWO_PI,
        (cur[2] + inc) % TWO_PI,
        (cur[3] + inc) % TWO_PI,
      ],
    })
    rafRef.current = requestAnimationFrame(spinLoop)
  }, [])

  useEffect(() => {
    if (autoSpin) {
      lastTimeRef.current = 0
      rafRef.current = requestAnimationFrame(spinLoop)
    } else {
      cancelAnimationFrame(rafRef.current)
    }
    return () => cancelAnimationFrame(rafRef.current)
  }, [autoSpin, spinLoop])

  const setFrontWing = (v: number) => useActiveAeroStore.setState({ frontWingAngle: v })
  const setRearWing = (v: number) => useActiveAeroStore.setState({ rearWingAngle: v })
  const setSteer = (v: number) => useCarStore.getState().updateTelemetry({ steerAngle: v })
  const setWheelRot = (v: number) => {
    useCarStore.getState().updateTelemetry({ wheelRotations: [v, v, v, v] })
  }

  const presetCorner = () => {
    useActiveAeroStore.setState({ frontWingAngle: 1, rearWingAngle: 1 })
  }
  const presetStraight = () => {
    useActiveAeroStore.setState({ frontWingAngle: 0, rearWingAngle: 0 })
  }
  const presetLockLeft = () => {
    useCarStore.getState().updateTelemetry({ steerAngle: -0.6 })
  }
  const presetLockRight = () => {
    useCarStore.getState().updateTelemetry({ steerAngle: 0.6 })
  }

  const isCorner = frontWingAngle === 1 && rearWingAngle === 1
  const isStraight = frontWingAngle === 0 && rearWingAngle === 0

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        ANIMATION PREVIEW <span style={styles.hint}>(F2)</span>
      </div>

      <div style={styles.divider} />

      <div style={styles.section}>
        <div style={styles.subheader}>AERO</div>
        <Slider
          label='Front Wing'
          value={frontWingAngle}
          min={0}
          max={1}
          step={0.01}
          onChange={setFrontWing}
        />
        <Slider
          label='Rear Wing'
          value={rearWingAngle}
          min={0}
          max={1}
          step={0.01}
          onChange={setRearWing}
        />
        <div style={styles.presetRow}>
          <PresetButton label='Corner' onClick={presetCorner} active={isCorner} />
          <PresetButton label='Straight' onClick={presetStraight} active={isStraight} />
        </div>
      </div>

      <div style={styles.divider} />

      <div style={styles.section}>
        <div style={styles.subheader}>STEERING</div>
        <Slider
          label='Steer Angle'
          value={steerAngle}
          min={-0.6}
          max={0.6}
          step={0.01}
          onChange={setSteer}
        />
        <div style={styles.presetRow}>
          <PresetButton label='Lock Left' onClick={presetLockLeft} active={steerAngle === -0.6} />
          <PresetButton label='Center' onClick={() => setSteer(0)} active={steerAngle === 0} />
          <PresetButton label='Lock Right' onClick={presetLockRight} active={steerAngle === 0.6} />
        </div>
      </div>

      <div style={styles.divider} />

      <div style={styles.section}>
        <div style={styles.subheader}>WHEELS</div>
        <Slider
          label='Wheel Spin'
          value={wheelRotations[0]}
          min={0}
          max={TWO_PI}
          step={0.01}
          onChange={setWheelRot}
        />
        <div style={styles.presetRow}>
          <PresetButton
            label={autoSpin ? 'Stop Spin' : 'Auto Spin'}
            onClick={() => setAutoSpin(s => !s)}
            active={autoSpin}
          />
        </div>
      </div>

      <div style={styles.divider} />

      <CarPaintSection />

      <div style={styles.divider} />

      <button onClick={() => useGameStore.getState().exitPreviewMode()} style={styles.backBtn}>
        Back to Racing
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 280,
    background: 'rgba(0,0,0,0.92)',
    border: '1px solid rgba(249,115,22,0.4)',
    borderRadius: 10,
    padding: '12px 14px',
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#e5e7eb',
    pointerEvents: 'auto',
    zIndex: 1000,
    userSelect: 'none',
  },
  header: {
    fontSize: 13,
    fontWeight: 700,
    color: '#f97316',
    marginBottom: 4,
  },
  hint: { fontSize: 9, color: '#6b7280', marginLeft: 4 },
  section: { marginBottom: 4 },
  subheader: { fontSize: 10, fontWeight: 600, color: '#f97316', marginBottom: 6 },
  divider: { borderTop: '1px solid rgba(255,255,255,0.08)', margin: '8px 0' },
  sliderGroup: { marginBottom: 8 },
  sliderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  sliderLabel: { color: '#9ca3af', fontSize: 11 },
  sliderValue: { color: '#e5e7eb', fontVariantNumeric: 'tabular-nums', fontSize: 11 },
  slider: {
    width: '100%',
    height: 4,
    appearance: 'none' as React.CSSProperties['appearance'],
    borderRadius: 2,
    outline: 'none',
    cursor: 'pointer',
  },
  presetRow: {
    display: 'flex',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap' as const,
  },
  presetBtn: {
    padding: '3px 10px',
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: 600,
    color: '#d1d5db',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 4,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  presetBtnActive: {
    color: '#fff',
    background: 'rgba(249,115,22,0.3)',
    borderColor: '#f97316',
  },
  backBtn: {
    width: '100%',
    padding: '8px 0',
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: 700,
    color: '#fff',
    background: 'rgba(249,115,22,0.2)',
    border: '1px solid rgba(249,115,22,0.5)',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  swatchGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: 5,
    marginBottom: 8,
  },
  swatch: {
    width: '100%',
    aspectRatio: '1',
    borderRadius: 4,
    border: '2px solid rgba(255,255,255,0.12)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    padding: 0,
  },
  swatchActive: {
    borderColor: '#f97316',
    boxShadow: '0 0 6px rgba(249,115,22,0.5)',
  },
  colorInputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  colorInput: {
    width: 32,
    height: 24,
    padding: 0,
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 3,
    cursor: 'pointer',
    background: 'transparent',
  },
  colorHex: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#9ca3af',
  },
  partTabs: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 4,
    marginBottom: 8,
  },
  partTab: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: 600,
    color: '#9ca3af',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 3,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  partTabActive: {
    color: '#fff',
    background: 'rgba(249,115,22,0.25)',
    borderColor: '#f97316',
  },
  partDot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.2)',
    flexShrink: 0,
  },
  advancedToggle: {
    marginLeft: 'auto',
    padding: '2px 8px',
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: 600,
    color: '#9ca3af',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 3,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
}
