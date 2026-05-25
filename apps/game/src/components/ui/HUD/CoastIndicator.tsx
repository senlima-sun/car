import { useErsStore } from '../../../stores/useErsStore'
import { AccentBar, Divider, LabelTag, Surface } from '../primitives'

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
    <div className='flex flex-col items-stretch gap-1'>
      <Surface
        variant='card'
        className='relative flex items-center gap-3 px-3 py-1.5 min-w-[200px]'
        style={{
          animation: is_critical ? 'hud-critical 0.6s ease-in-out infinite' : undefined,
        }}
      >
        <AccentBar color={accent} />
        <div className='flex items-center gap-1.5 pl-1'>
          <span
            className='flex h-5 w-5 items-center justify-center text-[13px] font-bold'
            style={{ color: accent }}
          >
            {statusGlyph}
          </span>
          <div className='flex flex-col'>
            <LabelTag>Auto</LabelTag>
            <span
              className='font-mono text-[12px] font-semibold tabular-nums'
              style={{ color: accent }}
            >
              {statusText}
            </span>
          </div>
        </div>

        <Divider orientation='vertical' className='h-7' />

        <div className='flex flex-col'>
          <LabelTag>{isCoastActive ? 'Benefit' : 'Efficiency'}</LabelTag>
          <span
            className='font-mono text-[12px] font-semibold tabular-nums'
            style={{ color: accent }}
          >
            {isCoastActive ? coastBenefitPercent : efficiencyPercent}%
          </span>
        </div>

        <div
          className='ml-auto border border-white/15 px-2 py-0.5 font-mono text-[9px] font-bold tabular-nums rounded-full'
          style={{ background: 'rgba(179,136,255,0.14)', color: '#b388ff' }}
        >
          {presetAbbrev(preset)}
        </div>
      </Surface>

      {is_critical && (
        <Surface
          variant='card'
          className='relative flex items-center gap-2 px-3 py-1 pointer-events-none'
        >
          <AccentBar color='#ef4444' />
          <span className='pl-1 text-[11px] font-bold text-[#ef4444]' aria-hidden>
            !
          </span>
          <span className='font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-[#ffb4b4]'>
            Harvest Only
          </span>
        </Surface>
      )}
    </div>
  )
}
