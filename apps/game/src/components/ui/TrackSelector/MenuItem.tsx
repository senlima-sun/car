export function MenuItem({
  icon,
  name,
  meta,
  isActive,
  onClick,
}: {
  icon: string
  name: string
  meta?: string
  isActive?: boolean
  onClick: () => void
}) {
  return (
    <div
      data-active={isActive ?? false}
      onClick={onClick}
      className='flex items-center gap-2 px-3 py-2.5 text-[13px] text-white cursor-pointer transition-colors hover:bg-white/[0.08] data-[active=true]:bg-sky-500/22'
    >
      <span className='w-[18px] text-center opacity-70'>{icon}</span>
      <span className='flex-1 truncate'>{name}</span>
      {meta && <span className='text-[11px] text-white/45'>{meta}</span>}
    </div>
  )
}
