export function MenuRow({
  icon,
  label,
  trailing,
}: {
  icon: React.ReactNode
  label: string
  trailing: React.ReactNode
}) {
  return (
    <div className='flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm text-white/78'>
      <span className='flex items-center gap-2'>
        <span className='text-white/48'>{icon}</span>
        {label}
      </span>
      {trailing}
    </div>
  )
}
