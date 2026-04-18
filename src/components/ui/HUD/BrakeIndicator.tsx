import { useBrakeStore } from '../../../stores/useBrakeStore'

function biasTone(frontBias: number): string {
  if (frontBias > 60) return '#f97316'
  if (frontBias < 55) return '#60a5fa'
  return '#22c55e'
}

function engineBrakeMeta(level: string): { abbrev: string; color: string } {
  switch (level) {
    case 'Low':
      return { abbrev: 'L', color: '#60a5fa' }
    case 'High':
      return { abbrev: 'H', color: '#f97316' }
    default:
      return { abbrev: 'M', color: '#22c55e' }
  }
}

export default function BrakeIndicator() {
  const frontBias = useBrakeStore(s => s.frontBias)
  const engineBraking = useBrakeStore(s => s.engineBraking)

  const rearBias = 100 - frontBias
  const tone = biasTone(frontBias)
  const eb = engineBrakeMeta(engineBraking)

  return (
    <div
      className='relative flex flex-col gap-2 border border-white/10 bg-gradient-to-b from-black/85 to-black/70 px-3 py-2 backdrop-blur-md shadow-[0_10px_28px_rgba(0,0,0,0.45)]'
      style={{
        clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%, 0 8px)',
        minWidth: 140,
      }}
    >
      <div
        className='absolute left-0 top-0 h-full w-[3px]'
        style={{ background: tone, boxShadow: `0 0 10px ${tone}` }}
      />

      <div className='flex items-center justify-between pl-1'>
        <span className='text-[8px] font-bold uppercase tracking-[0.32em] text-white/45'>
          Brake Bias
        </span>
        <span className='font-mono text-[10px] font-semibold tabular-nums text-white'>
          {Math.round(frontBias)}
          <span className='text-white/35 mx-0.5'>:</span>
          {Math.round(rearBias)}
        </span>
      </div>

      <div className='pl-1'>
        <div className='relative h-2 overflow-hidden border border-white/15 bg-white/5'>
          <div
            className='absolute inset-y-0 left-0 transition-[width] duration-200'
            style={{
              width: `${frontBias}%`,
              background: `linear-gradient(to right, ${tone}, ${tone}aa)`,
            }}
          />
          <div className='absolute inset-y-0 left-1/2 w-px bg-white/30' />
          <div className='absolute inset-0 flex justify-between px-1 text-[7px] font-bold uppercase tracking-[0.2em] text-white/65'>
            <span>F</span>
            <span>R</span>
          </div>
        </div>
      </div>

      <div className='flex items-center justify-between gap-2 border-t border-white/10 pl-1 pt-1.5'>
        <span className='text-[8px] font-bold uppercase tracking-[0.28em] text-white/45'>
          Engine Brake
        </span>
        <div className='flex items-center gap-1'>
          {['L', 'M', 'H'].map(l => {
            const active = l === eb.abbrev
            return (
              <span
                key={l}
                className='flex h-4 w-4 items-center justify-center font-mono text-[9px] font-bold tabular-nums'
                style={{
                  background: active ? eb.color : 'rgba(255,255,255,0.06)',
                  color: active ? '#0a0a0a' : 'rgba(255,255,255,0.4)',
                  border: `1px solid ${active ? eb.color : 'rgba(255,255,255,0.12)'}`,
                }}
              >
                {l}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
