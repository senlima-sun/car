import { styles } from './styles'

export function ConfirmButtons({
  onCancel,
  onConfirm,
  confirmLabel,
  variant = 'primary',
}: {
  onCancel: () => void
  onConfirm: () => void
  confirmLabel: string
  variant?: 'primary' | 'danger'
}) {
  const confirmStyle =
    variant === 'danger' ? styles.confirmButtonDanger : styles.confirmButtonPrimary
  return (
    <div style={styles.confirmButtons}>
      <button
        style={{ ...styles.confirmButton, ...styles.confirmButtonSecondary }}
        onClick={onCancel}
      >
        Cancel
      </button>
      <button style={{ ...styles.confirmButton, ...confirmStyle }} onClick={onConfirm}>
        {confirmLabel}
      </button>
    </div>
  )
}
