import { useEffect, useRef } from 'react'
import { ConfirmButtons } from '../ConfirmButtons'
import { styles } from '../styles'

export function InputMode({
  title,
  confirmLabel,
  value,
  onChange,
  onConfirm,
  onCancel,
}: {
  title: string
  confirmLabel: string
  value: string
  onChange: (next: string) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onConfirm()
    else if (e.key === 'Escape') onCancel()
  }

  return (
    <div style={{ padding: '12px 0' }}>
      <div style={styles.menuSectionTitle}>{title}</div>
      <input
        ref={inputRef}
        style={{ ...styles.input, width: 'calc(100% - 24px)' }}
        type='text'
        placeholder='Track name...'
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <ConfirmButtons onCancel={onCancel} onConfirm={onConfirm} confirmLabel={confirmLabel} />
    </div>
  )
}
