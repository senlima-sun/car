import { useGhostCarStore } from '@/stores/useGhostCarStore'

export default function DeltaDisplay() {
  const ghostDelta = useGhostCarStore(s => s.ghostTimeDelta)
  const isLoaded = useGhostCarStore(s => s.isLoaded)
  const replay = useGhostCarStore(s => s.replayData)

  if (!isLoaded || !replay) return null
  if (ghostDelta === null || Number.isNaN(ghostDelta)) return null

  const delta = ghostDelta
  const isAhead = delta < 0
  const magnitude = Math.abs(delta)
  const accent = isAhead ? '#22c55e' : '#ef4444'
  const subtle = isAhead ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'

  return (
    <div className='absolute top-3 right-3 pointer-events-none select-none z-30'>
      <div
        className='relative border border-white/10 bg-gradient-to-b from-black/85 to-black/70 px-4 py-2 backdrop-blur-md shadow-[0_12px_30px_rgba(0,0,0,0.5)]'
        style={{
          clipPath: 'polygon(10px 0, 100% 0, 100% 100%, 0 100%, 0 10px)',
        }}
      >
        <div
          className='absolute left-0 top-0 h-full w-[3px]'
          style={{ background: accent, boxShadow: `0 0 14px ${accent}` }}
        />
        <div className='flex items-center gap-3 pl-1.5'>
          <div className='flex flex-col items-start'>
            <span className='text-[8px] font-semibold uppercase tracking-[0.32em] text-white/45'>
              Ghost Δ
            </span>
            <span
              className='font-mono text-[22px] font-semibold leading-none tabular-nums'
              style={{ color: accent, textShadow: `0 0 18px ${subtle}` }}
            >
              {isAhead ? '−' : '+'}
              {magnitude.toFixed(3)}
              <span className='text-[12px] text-white/55'>s</span>
            </span>
          </div>
          <div
            className='flex h-7 w-7 items-center justify-center border border-white/15 text-[13px] font-bold leading-none'
            style={{
              color: accent,
              background: subtle,
              clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
            }}
          >
            {isAhead ? '' : ''}
          </div>
        </div>
      </div>
    </div>
  )
}
