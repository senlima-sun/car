import { useEffect, useRef } from 'react'
import { LabelTag } from '@/components/ui/primitives'
import { ConfirmButtons } from '../ConfirmButtons'

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
    <div className='py-3'>
      <LabelTag className='block px-3 py-2'>{title}</LabelTag>
      <input
        ref={inputRef}
        type='text'
        placeholder='Track name...'
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className='block mx-3 mb-2 w-[calc(100%-24px)] px-3 py-2 rounded-md bg-white/[0.08] border border-white/15 text-white text-[13px] outline-none focus:border-white/30'
      />
      <ConfirmButtons onCancel={onCancel} onConfirm={onConfirm} confirmLabel={confirmLabel} />
    </div>
  )
}
