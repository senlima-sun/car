import { useTemperatureStore } from '../../../stores/useTemperatureStore'
import { engineTempToCelsius, tireTempToCelsius } from '../../../wasm/PhysicsBridge'
import { celsiusToColor } from '../../../utils/temperatureColors'
import { HUD_LABEL_CLASS, HudPanel } from './hudChrome'

function engineTempColor(normalized: number): string {
  if (normalized >= 0.857) return '#dc2626' // ~140C — bearing damage zone
  if (normalized >= 0.75) return '#ef4444' // ~125C — derate
  if (normalized >= 0.679) return '#f59e0b' // ~115C — warn
  if (normalized >= 0.286) return '#22c55e' // ~60C+ — operating
  return '#60a5fa'
}

function TireCell({
  label,
  inner,
  outer,
  inWindow,
  blowoutRisk,
  blown,
}: {
  label: string
  inner: number
  outer: number
  inWindow: boolean
  blowoutRisk: number
  blown: boolean
}) {
  const avg = (inner + outer) / 2
  const tempC = Math.round(tireTempToCelsius(avg))
  const innerC = tireTempToCelsius(inner)
  const outerC = tireTempToCelsius(outer)

  const danger = blown || blowoutRisk > 0.4
  const borderColor = blown
    ? '#ef4444'
    : blowoutRisk > 0.4
      ? '#f59e0b'
      : inWindow
        ? '#22c55e'
        : 'rgba(255,255,255,0.18)'
  const glow = blown
    ? '0 0 8px rgba(239,68,68,0.9)'
    : blowoutRisk > 0.4
      ? `0 0 ${4 + blowoutRisk * 6}px rgba(245,158,11,${0.4 + blowoutRisk * 0.5})`
      : inWindow
        ? '0 0 6px rgba(34,197,94,0.5)'
        : 'none'

  return (
    <div className='flex flex-col items-center gap-1'>
      <span className='text-[8px] font-bold uppercase tracking-[0.28em] text-white/45'>
        {label}
      </span>
      <div
        className='flex h-10 w-5 flex-col overflow-hidden border'
        style={{
          borderColor,
          boxShadow: glow,
          borderRadius: 2,
          opacity: blown ? 0.55 : 1,
        }}
      >
        <div className='flex-1 transition-colors' style={{ background: celsiusToColor(outerC) }} />
        <div className='flex-1 transition-colors' style={{ background: celsiusToColor(innerC) }} />
      </div>
      <span
        className='font-mono text-[9px] font-semibold tabular-nums'
        style={{ color: blown ? '#ef4444' : danger ? '#f59e0b' : 'rgba(255,255,255,0.85)' }}
      >
        {blown ? 'BLOWN' : tempC}
      </span>
    </div>
  )
}

export default function TemperaturePanel() {
  const engine = useTemperatureStore(s => s.engine)
  const tires = useTemperatureStore(s => s.tires)
  const tiresInWindow = useTemperatureStore(s => s.tiresInWindow)
  const tireBlowoutRisk = useTemperatureStore(s => s.tireBlowoutRisk)
  const tireBlown = useTemperatureStore(s => s.tireBlown)
  const engineSeizeRisk = useTemperatureStore(s => s.engineSeizeRisk)
  const engineSeized = useTemperatureStore(s => s.engineSeized)

  const engineTempC = Math.round(engineTempToCelsius(engine.temperature))
  const powerLoss = Math.round((1 - engine.power_multiplier) * 100)
  const engineColor = engineSeized ? '#ef4444' : engineTempColor(engine.temperature)
  const engineDanger = engineSeized || engineSeizeRisk > 0.2

  return (
    <HudPanel accent={engineColor} className='min-w-[188px]' contentClassName='pb-2' edge='right'>
      <div className='flex items-center justify-between border-b border-white/10 px-3 py-1.5'>
        <span className={HUD_LABEL_CLASS} style={{ color: '#ffcc00' }}>
          Temperatures
        </span>
        <span
          className='font-mono text-[11px] font-semibold tabular-nums'
          style={{ color: engineColor }}
        >
          {engineSeized ? 'SEIZED' : `${engineTempC}°C`}
        </span>
      </div>

      <div className='px-3 py-2'>
        <div className='mb-1 flex items-baseline justify-between'>
          <span className={HUD_LABEL_CLASS}>Engine</span>
          {engineSeized ? (
            <span className='font-mono text-[9px] font-bold tabular-nums text-[#ef4444]'>
              FAILURE
            </span>
          ) : powerLoss > 0 ? (
            <span className='font-mono text-[9px] font-bold tabular-nums text-[#ef4444]'>
              −{powerLoss}% PWR
            </span>
          ) : (
            <span className='font-mono text-[9px] font-bold tabular-nums text-white/35'>OK</span>
          )}
        </div>
        <div className='h-1 overflow-hidden bg-white/10'>
          <div
            className='h-full transition-[width,background-color] duration-200'
            style={{
              width: `${Math.min(100, (engine.temperature / 1.4) * 100)}%`,
              background: engineColor,
            }}
          />
        </div>
        {engineDanger && !engineSeized ? (
          <div className='mt-1 h-0.5 overflow-hidden bg-[#ef4444]/15'>
            <div
              className='h-full bg-[#ef4444] transition-[width] duration-200'
              style={{ width: `${Math.min(100, engineSeizeRisk * 100)}%` }}
            />
          </div>
        ) : null}

        <div className='mt-3 flex items-start justify-center gap-3'>
          <div className='flex flex-col gap-2'>
            <TireCell
              label='FL'
              inner={tires.front_left_inner}
              outer={tires.front_left_outer}
              inWindow={tiresInWindow[0]}
              blowoutRisk={tireBlowoutRisk[0]}
              blown={tireBlown[0]}
            />
            <TireCell
              label='RL'
              inner={tires.rear_left_inner}
              outer={tires.rear_left_outer}
              inWindow={tiresInWindow[2]}
              blowoutRisk={tireBlowoutRisk[2]}
              blown={tireBlown[2]}
            />
          </div>
          <div className='mt-3 h-[88px] w-1.5 rounded-full bg-gradient-to-b from-white/15 via-white/5 to-white/15' />
          <div className='flex flex-col gap-2'>
            <TireCell
              label='FR'
              inner={tires.front_right_inner}
              outer={tires.front_right_outer}
              inWindow={tiresInWindow[1]}
              blowoutRisk={tireBlowoutRisk[1]}
              blown={tireBlown[1]}
            />
            <TireCell
              label='RR'
              inner={tires.rear_right_inner}
              outer={tires.rear_right_outer}
              inWindow={tiresInWindow[3]}
              blowoutRisk={tireBlowoutRisk[3]}
              blown={tireBlown[3]}
            />
          </div>
        </div>
      </div>
    </HudPanel>
  )
}
