import { styles } from './styles'

export function SliderRow({
  sectionTitle,
  rangeLabel,
  valueLabel,
  description,
  min,
  max,
  step,
  value,
  onChange,
}: {
  sectionTitle: string
  rangeLabel: string
  valueLabel: string
  description: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>{sectionTitle}</div>
      <div style={styles.sliderRow}>
        <div style={styles.sliderHeader}>
          <span style={styles.sliderLabel}>{rangeLabel}</span>
          <span style={styles.sliderValue}>{valueLabel}</span>
        </div>
        <input
          type='range'
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={styles.slider}
        />
        <div style={styles.sliderDescription as React.CSSProperties}>{description}</div>
      </div>
    </div>
  )
}
