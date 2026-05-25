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
  const confirmClass =
    variant === 'danger'
      ? 'bg-red-500/30 hover:bg-red-500/45 text-red-50'
      : 'bg-sky-500/22 hover:bg-sky-500/32 text-white'
  return (
    <div className='flex gap-2 px-3 py-2'>
      <button
        type='button'
        onClick={onCancel}
        className='flex-1 px-3 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-white text-[12px] font-semibold transition'
      >
        Cancel
      </button>
      <button
        type='button'
        onClick={onConfirm}
        className={`flex-1 px-3 py-1.5 rounded-full text-[12px] font-semibold transition ${confirmClass}`}
      >
        {confirmLabel}
      </button>
    </div>
  )
}
