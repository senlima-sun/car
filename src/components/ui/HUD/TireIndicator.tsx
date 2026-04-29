import { selectAverageWear, useTireStore } from '../../../stores/useTireStore'
import { TIRE_CONFIG, TIRE_WEAR_WARNING, TIRE_WEAR_CRITICAL } from '../../../constants/tires'
import { HUD_LABEL_CLASS, HudPanel } from './hudChrome'

function wearColor(wear: number): string {
  if (wear >= TIRE_WEAR_CRITICAL) return '#ef4444'
  if (wear >= TIRE_WEAR_WARNING) return '#f59e0b'
  return '#22c55e'
}

function gripColor(g: number): string {
  if (g >= 80) return '#22c55e'
  if (g >= 50) return '#f59e0b'
  return '#ef4444'
}

function WheelCell({
  label,
  wear,
  compoundColor,
}: {
  label: string
  wear: number
  compoundColor: string
}) {
  const remaining = Math.max(0, 100 - wear)
  const color = wearColor(wear)
  return (
    <div className='flex flex-col items-center gap-1'>
      <span className='text-[8px] font-bold uppercase tracking-[0.28em] text-white/45'>
        {label}
      </span>
      <div
        className='relative flex h-12 w-7 flex-col justify-end overflow-hidden bg-white/5'
        style={{ border: `1.5px solid ${compoundColor}`, borderRadius: 2 }}
      >
        <div
          className='w-full transition-[height,background-color] duration-300'
          style={{ height: `${remaining}%`, background: color }}
        />
      </div>
      <span className='font-mono text-[10px] font-semibold tabular-nums' style={{ color }}>
        {Math.round(remaining)}
      </span>
    </div>
  )
}

export default function TireIndicator() {
  const currentCompound = useTireStore(s => s.currentCompound)
  const perWheelWear = useTireStore(s => s.perWheelWear)
  const averageWear = useTireStore(selectAverageWear)
  const effectiveGrip = useTireStore(s => s.effectiveGripMultiplier)
  const tireMaterial = useTireStore(s => s.tireMaterial)

  const config = TIRE_CONFIG[currentCompound]
  const avgRemaining = Math.max(0, 100 - averageWear)
  const gripPercent = Math.round(effectiveGrip * 100)

  const maxWear = Math.max(
    perWheelWear.frontLeft,
    perWheelWear.frontRight,
    perWheelWear.rearLeft,
    perWheelWear.rearRight,
  )
  const isCritical = maxWear >= TIRE_WEAR_CRITICAL

  const maxGraining = tireMaterial ? Math.max(...tireMaterial.per_wheel_graining) : 0
  const maxBlistering = tireMaterial ? Math.max(...tireMaterial.per_wheel_blistering) : 0
  const hasGrainingWarn = maxGraining > 0.3
  const hasBlisteringWarn = maxBlistering > 0.1

  return (
    <HudPanel
      accent={config.color}
      className='min-w-[188px]'
      contentClassName='pb-2'
      edge='left'
      style={{ animation: isCritical ? 'hud-critical 1.1s ease-in-out infinite' : undefined }}
    >
      <div className='flex items-center justify-between border-b border-white/10 px-3 py-1.5'>
        <div className='flex items-center gap-2'>
          <div
            className='flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold text-black'
            style={{ background: config.color, boxShadow: '0 0 0 2px rgba(255,255,255,0.12)' }}
          >
            {config.icon}
          </div>
          <span className='font-sans text-[11px] font-bold uppercase tracking-[0.24em] text-white'>
            {config.displayName}
          </span>
        </div>
        <div className='flex items-baseline gap-1'>
          <span className={HUD_LABEL_CLASS}>Grip</span>
          <span
            className='font-mono text-[12px] font-semibold tabular-nums'
            style={{ color: gripColor(gripPercent) }}
          >
            {gripPercent}%
          </span>
        </div>
      </div>

      <div className='flex items-center justify-center gap-3 px-3 py-3'>
        <div className='flex flex-col gap-2'>
          <WheelCell label='FL' wear={perWheelWear.frontLeft} compoundColor={config.color} />
          <WheelCell label='RL' wear={perWheelWear.rearLeft} compoundColor={config.color} />
        </div>

        <div className='relative h-[104px] w-2 rounded-full bg-gradient-to-b from-white/15 via-white/5 to-white/15' />

        <div className='flex flex-col gap-2'>
          <WheelCell label='FR' wear={perWheelWear.frontRight} compoundColor={config.color} />
          <WheelCell label='RR' wear={perWheelWear.rearRight} compoundColor={config.color} />
        </div>
      </div>

      <div className='border-t border-white/10 px-3 py-2'>
        <div className='mb-1 flex items-baseline justify-between'>
          <span className={HUD_LABEL_CLASS}>Avg Life</span>
          <span
            className='font-mono text-[11px] font-semibold tabular-nums'
            style={{ color: wearColor(averageWear) }}
          >
            {Math.round(avgRemaining)}%
          </span>
        </div>
        <div className='h-1 overflow-hidden bg-white/10'>
          <div
            className='h-full transition-[width,background-color] duration-300'
            style={{ width: `${avgRemaining}%`, background: wearColor(averageWear) }}
          />
        </div>

        {(hasGrainingWarn || hasBlisteringWarn) && (
          <div className='mt-2 flex flex-col gap-1'>
            {hasGrainingWarn && (
              <div
                className='flex items-center justify-between px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.28em]'
                style={{
                  background: 'rgba(245,158,11,0.14)',
                  border: '1px solid rgba(245,158,11,0.35)',
                  color: '#f59e0b',
                }}
              >
                <span>Graining</span>
                <span className='font-mono tabular-nums'>{Math.round(maxGraining * 100)}%</span>
              </div>
            )}
            {hasBlisteringWarn && (
              <div
                className='flex items-center justify-between px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.28em]'
                style={{
                  background: 'rgba(239,68,68,0.14)',
                  border: '1px solid rgba(239,68,68,0.35)',
                  color: '#ef4444',
                }}
              >
                <span>Blistering</span>
                <span className='font-mono tabular-nums'>{Math.round(maxBlistering * 100)}%</span>
              </div>
            )}
          </div>
        )}
      </div>
    </HudPanel>
  )
}
