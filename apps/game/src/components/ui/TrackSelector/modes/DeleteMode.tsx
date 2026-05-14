import { ConfirmButtons } from '../ConfirmButtons'
import { styles } from '../styles'

export function DeleteMode({
  trackName,
  onConfirm,
  onCancel,
}: {
  trackName: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div style={styles.modeContainer}>
      <div style={styles.menuSectionTitle}>Delete Track</div>
      <div style={styles.deleteConfirmText}>
        Are you sure you want to delete &quot;{trackName}&quot;?
      </div>
      <ConfirmButtons
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel='Delete'
        variant='danger'
      />
    </div>
  )
}
