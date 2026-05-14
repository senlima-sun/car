import { useErsStore } from '../../../stores/useErsStore'

function presetAbbrev(preset: string): string {
  switch (preset) {
    case 'Aggressive':
      return 'AGG'
    case 'Conservative':
      return 'CON'
    default:
      return 'BAL'
  }
}

export default function CoastIndicator() {
  const mode = useErsStore(s => s.mode)
  const semiAuto = useErsStore(s => s.semiAuto)
  const semiAutoConfig = useErsStore(s => s.semiAutoConfig)
  const coastIndicatorVisible = useErsStore(s => s.coastIndicatorVisible)

  if (mode !== 'SemiAuto' || !coastIndicatorVisible) return null

  const { coast_recommended, coast_benefit, is_critical, deploy_efficiency } = semiAuto
  const { preset } = semiAutoConfig

  const coastBenefitPercent = Math.round(coast_benefit * 100)
  const efficiencyPercent = Math.round(deploy_efficiency * 100)

  const isCoastActive = coast_recommended && coast_benefit > 0.1
  const accent = is_critical ? '#ef4444' : isCoastActive ? '#00e5ff' : '#22c55e'
  const statusText = is_critical ? 'CRITICAL' : isCoastActive ? 'COAST' : 'DEPLOY'
  const statusGlyph = is_critical ? '!' : isCoastActive ? '▼' : '▲'

  return (
    <>
      <div
        className='relative flex items-center gap-3 border border-white/10 bg-gradient-to-b from-black/85 to-black/70 px-3 py-1.5 backdrop-blur-md shadow-[0_10px_28px_rgba(0,0,0,0.45)]'
        style={{
          clipPath: 'polygon(8px 0, 100% 0, 100% 100%, 0 100%, 0 8px)',
          animation: is_critical ? 'hud-critical 0.6s ease-in-out infinite' : undefined,
          minWidth: 200,
        }}
      >
        <div
          className='absolute left-0 top-0 h-full w-[3px]'
          style={{ background: accent, boxShadow: `0 0 10px ${accent}` }}
        />
        <div className='flex items-center gap-1.5 pl-1'>
          <span
            className='flex h-5 w-5 items-center justify-center text-[13px] font-bold'
            style={{ color: accent }}
          >
            {statusGlyph}
          </span>
          <div className='flex flex-col'>
            <span className='text-[8px] font-bold uppercase tracking-[0.28em] text-white/45'>
              Auto
            </span>
            <span
              className='font-mono text-[12px] font-semibold tabular-nums'
              style={{ color: accent }}
            >
              {statusText}
            </span>
          </div>
        </div>

        <div className='h-7 w-px bg-white/10' />

        <div className='flex flex-col'>
          <span className='text-[8px] font-bold uppercase tracking-[0.28em] text-white/45'>
            {isCoastActive ? 'Benefit' : 'Efficiency'}
          </span>
          <span
            className='font-mono text-[12px] font-semibold tabular-nums'
            style={{ color: accent }}
          >
            {isCoastActive ? coastBenefitPercent : efficiencyPercent}%
          </span>
        </div>

        <div
          className='ml-auto border border-white/15 px-2 py-0.5 font-mono text-[9px] font-bold tabular-nums'
          style={{ background: 'rgba(179,136,255,0.14)', color: '#b388ff' }}
        >
          {presetAbbrev(preset)}
        </div>
      </div>

      {is_critical && (
        <div
          className='fixed left-1/2 top-1/2 z-[1000] -translate-x-1/2 -translate-y-1/2 border px-6 py-3 pointer-events-none'
          style={{
            borderColor: 'rgba(239,68,68,0.7)',
            background: 'rgba(40,10,10,0.85)',
            animation: 'hud-critical 0.5s ease-in-out infinite',
            clipPath: 'polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%, 0 10px)',
          }}
        >
          <span className='font-sans text-[13px] font-bold uppercase tracking-[0.32em] text-[#ffb4b4]'>
            Critical Battery — Harvest Only
          </span>
        </div>
      )}
    </>
  )
}
