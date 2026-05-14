import { styles } from './styles'

export function Toggle({
  label,
  enabled,
  onChange,
}: {
  label: string
  enabled: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div style={styles.toggleRow}>
      <span style={styles.toggleLabel}>{label}</span>
      <div
        style={{
          ...styles.toggle,
          ...(enabled ? styles.toggleActive : {}),
        }}
        onClick={() => onChange(!enabled)}
      >
        <div
          style={{
            ...styles.toggleKnob,
            ...(enabled ? styles.toggleKnobActive : {}),
          }}
        />
      </div>
    </div>
  )
}
