import { useActiveAeroStore } from '../../../stores/useActiveAeroStore'

function modeColor(mode: string): string {
  if (mode === 'Corner') return '#00e5ff'
  if (mode === 'Straight') return '#22c55e'
  return '#ffffff'
}

export default function AeroIndicator() {
  const mode = useActiveAeroStore(s => s.mode)
  const autoMode = useActiveAeroStore(s => s.autoMode)
  const dragMultiplier = useActiveAeroStore(s => s.dragMultiplier)
  const downforceMultiplier = useActiveAeroStore(s => s.downforceMultiplier)

  const tone = modeColor(mode)

  return (
    <div
      className='relative flex flex-col gap-1.5 border border-white/10 bg-gradient-to-b from-black/85 to-black/70 px-3 py-2 backdrop-blur-md shadow-[0_10px_28px_rgba(0,0,0,0.45)]'
      style={{
        clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%, 0 8px)',
        minWidth: 120,
      }}
    >
      <div
        className='absolute left-0 top-0 h-full w-[3px]'
        style={{ background: tone, boxShadow: `0 0 10px ${tone}` }}
      />

      <div className='flex items-center justify-between pl-1'>
        <span className='text-[8px] font-bold uppercase tracking-[0.32em] text-white/45'>Aero</span>
        <span
          className='font-mono text-[9px] font-bold tabular-nums'
          style={{ color: autoMode ? '#00e5ff' : 'rgba(255,255,255,0.5)' }}
        >
          {autoMode ? 'AUTO' : 'MAN'}
        </span>
      </div>

      <span
        className='pl-1 font-sans text-[15px] font-bold uppercase tracking-[0.18em]'
        style={{ color: tone, textShadow: `0 0 12px ${tone}33` }}
      >
        {mode}
      </span>

      <div className='mt-1 flex items-stretch gap-2 pl-1'>
        <div className='flex flex-col'>
          <span className='text-[8px] font-bold uppercase tracking-[0.28em] text-white/40'>
            Drag
          </span>
          <span
            className='font-mono text-[11px] font-semibold tabular-nums'
            style={{ color: dragMultiplier > 1 ? '#f59e0b' : '#22c55e' }}
          >
            {dragMultiplier.toFixed(1)}×
          </span>
        </div>
        <div className='h-7 w-px bg-white/10' />
        <div className='flex flex-col'>
          <span className='text-[8px] font-bold uppercase tracking-[0.28em] text-white/40'>DF</span>
          <span
            className='font-mono text-[11px] font-semibold tabular-nums'
            style={{ color: downforceMultiplier > 1 ? '#22c55e' : '#f59e0b' }}
          >
            {downforceMultiplier.toFixed(1)}×
          </span>
        </div>
      </div>
    </div>
  )
}
