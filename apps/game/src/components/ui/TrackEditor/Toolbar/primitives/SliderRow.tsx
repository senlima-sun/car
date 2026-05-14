export function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
}) {
  return (
    <div className='mb-2'>
      <div className='mb-1 flex items-center justify-between text-[10px] text-white/62'>
        <span>{label}</span>
        <span className='font-mono text-white/82'>
          {value.toFixed(step < 1 ? 1 : 0)} {unit}
        </span>
      </div>
      <input
        type='range'
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className='h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-sky-400'
      />
    </div>
  )
}
