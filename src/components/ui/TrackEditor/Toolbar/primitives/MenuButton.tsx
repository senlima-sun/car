export function MenuButton({
  onClick,
  label,
  sub,
}: {
  onClick: () => void
  label: string
  sub?: string
}) {
  return (
    <button
      className='flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm text-white/82 transition hover:bg-white/[0.08] hover:text-white'
      onClick={onClick}
    >
      <span>{label}</span>
      {sub && <span className='truncate pl-2 text-xs text-white/42'>{sub}</span>}
    </button>
  )
}
