import { ConfirmButtons } from '../ConfirmButtons'
import { styles } from '../styles'

export function DeleteMode({
  trackName,
  onConfirm,
  onCancel,
}: {
  trackName: string | undefined
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div style={{ padding: '12px 0' }}>
      <div style={styles.menuSectionTitle}>Delete Track</div>
      <div style={{ padding: '8px 12px', color: '#ccc', fontSize: 13 }}>
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
