export function Chip({
  label,
  onClick,
  active,
  disabled,
}: {
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[0.2em] transition ${
        active
          ? 'border-red-300/60 bg-red-400/15 text-red-100'
          : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25 hover:text-white/90'
      } ${disabled ? 'cursor-not-allowed opacity-40 hover:border-white/10 hover:text-white/60' : ''}`}
    >
      {label}
    </button>
  )
}
