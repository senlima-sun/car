export function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className='flex items-center gap-2'>
      <span className='w-20 shrink-0 text-[10px] uppercase tracking-[0.2em] text-white/45'>
        {label}
      </span>
      <input
        type='color'
        value={value}
        onChange={e => onChange(e.target.value)}
        className='showroom-color h-6 w-8'
      />
      <span className='font-mono text-[10px] tabular-nums text-white/55'>
        {value.toUpperCase()}
      </span>
    </div>
  )
}
