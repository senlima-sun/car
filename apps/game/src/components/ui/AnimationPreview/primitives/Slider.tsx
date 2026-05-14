export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className='mb-2'>
      <div className='mb-1 flex items-center justify-between'>
        <span className='text-[10px] uppercase tracking-[0.2em] text-white/45'>{label}</span>
        <span className='font-mono text-[10px] tabular-nums text-white/80'>{value.toFixed(2)}</span>
      </div>
      <input
        type='range'
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className='showroom-slider h-1 w-full cursor-pointer rounded-full outline-none'
        style={{
          background: `linear-gradient(to right, rgb(252 165 165) 0%, rgb(252 165 165) ${pct}%, rgba(255,255,255,0.08) ${pct}%, rgba(255,255,255,0.08) 100%)`,
        }}
      />
    </div>
  )
}
