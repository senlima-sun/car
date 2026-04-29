export function DirChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition ${
        active
          ? 'bg-white/[0.14] text-white'
          : 'text-white/50 hover:bg-white/[0.06] hover:text-white/80'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
