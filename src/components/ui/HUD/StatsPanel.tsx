import { useTireStore } from '../../../stores/useTireStore'
import {
  useTemperatureStore,
  ENGINE_TEMP_CRITICAL,
  TIRE_TEMP_COLD,
  TIRE_TEMP_CRITICAL,
} from '../../../stores/useTemperatureStore'
import { TIRE_CONFIG, TIRE_WEAR_WARNING, TIRE_WEAR_CRITICAL } from '../../../constants/tires'
import { engineTempToCelsius, tireTempToCelsius } from '../../../wasm/PhysicsBridge'

function wearColor(wear: number): string {
  if (wear >= TIRE_WEAR_CRITICAL) return '#ef4444'
  if (wear >= TIRE_WEAR_WARNING) return '#f59e0b'
  return '#22c55e'
}

function tempColor(normalized: number, isTire: boolean = false): string {
  if (isTire) {
    if (normalized < TIRE_TEMP_COLD) return '#60a5fa'
    if (normalized > TIRE_TEMP_CRITICAL) return '#ef4444'
    return '#22c55e'
  }
  if (normalized >= ENGINE_TEMP_CRITICAL) return '#ef4444'
  if (normalized >= 0.75) return '#f59e0b'
  if (normalized >= 0.4) return '#22c55e'
  return '#60a5fa'
}

function gripColor(g: number): string {
  if (g >= 80) return '#22c55e'
  if (g >= 50) return '#f59e0b'
  return '#ef4444'
}

export default function StatsPanel() {
  const currentCompound = useTireStore(s => s.currentCompound)
  const averageWear = useTireStore(s => s.averageWear)
  const effectiveGrip = useTireStore(s => s.effectiveGripMultiplier)
  const perWheelWear = useTireStore(s => s.perWheelWear)

  const engine = useTemperatureStore(s => s.engine)
  const tires = useTemperatureStore(s => s.tires)

  const config = TIRE_CONFIG[currentCompound]
  const tireLife = Math.max(0, 100 - averageWear)
  const gripPercent = Math.round(effectiveGrip * 100)

  const avgTireTemp =
    (tires.front_left_inner +
      tires.front_left_outer +
      tires.front_right_inner +
      tires.front_right_outer +
      tires.rear_left_inner +
      tires.rear_left_outer +
      tires.rear_right_inner +
      tires.rear_right_outer) /
    8

  const engineTempC = Math.round(engineTempToCelsius(engine.temperature))
  const tireTempC = Math.round(tireTempToCelsius(avgTireTemp))

  const maxWear = Math.max(
    perWheelWear.frontLeft,
    perWheelWear.frontRight,
    perWheelWear.rearLeft,
    perWheelWear.rearRight,
  )
  const isCritical = maxWear >= TIRE_WEAR_CRITICAL

  const tireTone = wearColor(averageWear)
  const gripTone = gripColor(gripPercent)

  return (
    <div
      className='relative flex items-stretch gap-3 border border-white/10 bg-gradient-to-b from-black/85 to-black/70 px-3 py-2 backdrop-blur-md shadow-[0_10px_28px_rgba(0,0,0,0.45)]'
      style={{
        clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%, 0 8px)',
        animation: isCritical ? 'hud-pulse 1s ease-in-out infinite' : undefined,
      }}
    >
      <div className='flex items-center gap-2'>
        <div
          className='flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-black'
          style={{ background: config.color, boxShadow: '0 0 0 2px rgba(255,255,255,0.12)' }}
        >
          {config.icon}
        </div>
        <span className='font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-white'>
          {config.displayName.slice(0, 3)}
        </span>
      </div>

      <div className='w-px self-stretch bg-white/10' />

      <div className='flex min-w-[90px] flex-col justify-center gap-1'>
        <div className='flex items-baseline justify-between'>
          <span className='text-[8px] font-bold uppercase tracking-[0.28em] text-white/45'>Tire</span>
          <span
            className='font-mono text-[10px] font-semibold tabular-nums'
            style={{ color: tireTone }}
          >
            {Math.round(tireLife)}%
          </span>
        </div>
        <div className='h-1 overflow-hidden bg-white/10'>
          <div
            className='h-full transition-[width,background-color] duration-300'
            style={{ width: `${tireLife}%`, background: tireTone }}
          />
        </div>
      </div>

      <div className='w-px self-stretch bg-white/10' />

      <div className='flex items-center gap-2'>
        <div className='flex flex-col items-center'>
          <span className='text-[8px] font-bold uppercase tracking-[0.28em] text-white/40'>Eng</span>
          <span
            className='font-mono text-[11px] font-semibold tabular-nums'
            style={{ color: tempColor(engine.temperature) }}
          >
            {engineTempC}
          </span>
        </div>
        <div className='flex flex-col items-center'>
          <span className='text-[8px] font-bold uppercase tracking-[0.28em] text-white/40'>Tire</span>
          <span
            className='font-mono text-[11px] font-semibold tabular-nums'
            style={{ color: tempColor(avgTireTemp, true) }}
          >
            {tireTempC}
          </span>
        </div>
      </div>

      <div className='w-px self-stretch bg-white/10' />

      <div className='flex flex-col items-center justify-center'>
        <span className='text-[8px] font-bold uppercase tracking-[0.28em] text-white/40'>Grip</span>
        <span
          className='font-mono text-[11px] font-semibold tabular-nums'
          style={{ color: gripTone }}
        >
          {gripPercent}%
        </span>
      </div>
    </div>
  )
}
