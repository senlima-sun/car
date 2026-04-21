import { useTemperatureStore } from '../../../stores/useTemperatureStore'
import { engineTempToCelsius, tireTempToCelsius } from '../../../wasm/PhysicsBridge'
import { celsiusToColor } from '../../../utils/temperatureColors'

function engineTempColor(normalized: number): string {
  if (normalized >= 0.9) return '#ef4444'
  if (normalized >= 0.75) return '#f59e0b'
  if (normalized >= 0.4) return '#22c55e'
  return '#60a5fa'
}

function TireCell({
  label,
  inner,
  outer,
  inWindow,
}: {
  label: string
  inner: number
  outer: number
  inWindow: boolean
}) {
  const avg = (inner + outer) / 2
  const tempC = Math.round(tireTempToCelsius(avg))
  const innerC = tireTempToCelsius(inner)
  const outerC = tireTempToCelsius(outer)

  return (
    <div className='flex flex-col items-center gap-1'>
      <span className='text-[8px] font-bold uppercase tracking-[0.28em] text-white/45'>
        {label}
      </span>
      <div
        className='flex h-10 w-5 flex-col overflow-hidden border'
        style={{
          borderColor: inWindow ? '#22c55e' : 'rgba(255,255,255,0.18)',
          boxShadow: inWindow ? '0 0 6px rgba(34,197,94,0.5)' : 'none',
          borderRadius: 2,
        }}
      >
        <div className='flex-1 transition-colors' style={{ background: celsiusToColor(outerC) }} />
        <div className='flex-1 transition-colors' style={{ background: celsiusToColor(innerC) }} />
      </div>
      <span className='font-mono text-[9px] font-semibold tabular-nums text-white/85'>{tempC}</span>
    </div>
  )
}

export default function TemperaturePanel() {
  const engine = useTemperatureStore(s => s.engine)
  const tires = useTemperatureStore(s => s.tires)
  const tiresInWindow = useTemperatureStore(s => s.tiresInWindow)

  const engineTempC = Math.round(engineTempToCelsius(engine.temperature))
  const powerLoss = Math.round((1 - engine.power_multiplier) * 100)
  const engineColor = engineTempColor(engine.temperature)

  return (
    <div
      className='relative border border-white/10 bg-gradient-to-b from-black/85 to-black/70 backdrop-blur-md shadow-[0_14px_40px_rgba(0,0,0,0.5)]'
      style={{
        clipPath: 'polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%, 0 10px)',
        minWidth: 180,
      }}
    >
      <div className='flex items-center justify-between border-b border-white/10 px-3 py-1.5'>
        <span className='text-[9px] font-bold uppercase tracking-[0.32em] text-[#ffcc00]'>
          Temperatures
        </span>
        <span
          className='font-mono text-[11px] font-semibold tabular-nums'
          style={{ color: engineColor }}
        >
          {engineTempC}°C
        </span>
      </div>

      <div className='px-3 py-2'>
        <div className='mb-1 flex items-baseline justify-between'>
          <span className='text-[8px] font-bold uppercase tracking-[0.28em] text-white/45'>
            Engine
          </span>
          {powerLoss > 0 ? (
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
              width: `${Math.min(100, engine.temperature * 100)}%`,
              background: engineColor,
            }}
          />
        </div>

        <div className='mt-3 flex items-start justify-center gap-3'>
          <div className='flex flex-col gap-2'>
            <TireCell
              label='FL'
              inner={tires.front_left_inner}
              outer={tires.front_left_outer}
              inWindow={tiresInWindow[0]}
            />
            <TireCell
              label='RL'
              inner={tires.rear_left_inner}
              outer={tires.rear_left_outer}
              inWindow={tiresInWindow[2]}
            />
          </div>
          <div className='mt-3 h-[88px] w-1.5 rounded-full bg-gradient-to-b from-white/15 via-white/5 to-white/15' />
          <div className='flex flex-col gap-2'>
            <TireCell
              label='FR'
              inner={tires.front_right_inner}
              outer={tires.front_right_outer}
              inWindow={tiresInWindow[1]}
            />
            <TireCell
              label='RR'
              inner={tires.rear_right_inner}
              outer={tires.rear_right_outer}
              inWindow={tiresInWindow[3]}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
